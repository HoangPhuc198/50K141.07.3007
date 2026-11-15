import { Prisma } from "@prisma/client";
import { prisma, withDbRetry } from "@database/client";
import { SHORT_TX_OPTIONS, acquireAdvisoryXactLock } from "@backend/lib/db-lock";
import {
  CHECKOUT_GRACE_MINUTES,
  formatDateVN,
  formatTimeFromDb,
  nowVN,
  toDbDateTimeVN,
} from "@backend/lib/time";
import {
  buildDbDateTimeVN,
  parseTimeToMinutes,
  tinhMocKetThucTangCa,
  xetTrangThaiCheckOut,
} from "@backend/calc/chamcong";
import { chotTangCaHetHan, generateNextMachamcong } from "./cham-cong";
import {
  CreateBoSungCCInput,
  XuLyBoSungCCInput,
} from "@backend/validators/bo-sung-cc";
import {
  BO_SUNG_CC_GUI_THANH_CONG,
  BO_SUNG_CC_THANH_CONG,
  BO_SUNG_CC_THIEU_TRUONG,
} from "@frontend/config/thong-bao";

export class BoSungCCServiceError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "BoSungCCServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export type LoaiYeuCauBoSung = "Quên check-out" | "Quên check-in";

export interface CaThieuChamCongItem {
  malich: string;
  ngayLam: string; // YYYY-MM-DD
  ngayHienThi: string; // DD/MM/YYYY
  ngayNgan: string; // DD/MM
  maca: string;
  loaica: string;
  tenCa: string;
  gioBatDau: string;
  gioKetThuc: string;
  loaiThieu: LoaiYeuCauBoSung;
  gioDaCheckIn: string | null;
}

export interface YeuCauBoSungItem {
  mayeucau: string;
  manv: string;
  tenNhanVien: string;
  malich: string;
  ngayLam: string; // YYYY-MM-DD
  ngayHienThi: string; // DD/MM/YYYY
  loaica: string;
  caLam: string;
  loaiYeuCau: LoaiYeuCauBoSung;
  giovaobosung: string | null;
  giorabosung: string;
  gioCheckInHienTai: string | null;
  gioBatDauCa: string;
  gioKetThucCa: string;
  lydo: string;
  trangthai: string;
}

function formatDDMMYYYY(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-");
  return `${d}/${m}/${y}`;
}

function formatDDMM(yyyyMmDd: string): string {
  const [, m, d] = yyyyMmDd.split("-");
  return `${d}/${m}`;
}

/** Chuyển chuỗi "HH:mm" thành Date epoch UTC (1970-01-01THH:mm:00Z) để lưu vào cột TIME. */
export function parseHHmmToDbTime(hhmm: string): Date {
  const [hh, mm] = hhmm.split(":").map((n) => parseInt(n, 10));
  return new Date(Date.UTC(1970, 0, 1, hh || 0, mm || 0, 0, 0));
}

/** Sinh mã YeuCauBoSungCC tiếp theo dạng YCxxxxxx trong transaction. */
export async function generateNextMayeucau(
  tx: Prisma.TransactionClient
): Promise<string> {
  await acquireAdvisoryXactLock(tx, "yeu_cau_bo_sung_cc:yc_id");

  const records = await tx.yeuCauBoSungCC.findMany({
    where: { Mayeucau: { startsWith: "YC" } },
    select: { Mayeucau: true },
  });

  let maxNum = 0;
  for (const r of records) {
    const trimmed = r.Mayeucau.trim();
    if (trimmed.startsWith("YC")) {
      const numPart = parseInt(trimmed.slice(2), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  }

  return `YC${String(maxNum + 1).padStart(6, "0")}`;
}

function kiemTraQuyenCaCuaNhanVien(
  cleanManv: string,
  nhanVienLichLams: Array<{ Manv: string }>,
  donXinDoiCas: Array<{ Manv: string; Manvnhanthay: string | null }>
): boolean {
  const assignedSet = new Set(
    nhanVienLichLams.map((x) => x.Manv.trim().toUpperCase())
  );
  const coTrongLich = assignedSet.has(cleanManv);
  const daNhuongCa = donXinDoiCas.some((d) => {
    const sender = d.Manv.trim().toUpperCase();
    const replacement = d.Manvnhanthay?.trim().toUpperCase() || null;
    if (sender !== cleanManv || !replacement || replacement === cleanManv) {
      return false;
    }
    // Nếu cả người xin đổi và người nhận thay đều đang nằm trong NhanVien_LichLam
    // (chủ quán đã xếp lại người này vào ca), thì ca vẫn thuộc nhân viên.
    if (coTrongLich && assignedSet.has(replacement)) {
      return false;
    }
    return true;
  });
  const laCaNhanThay = donXinDoiCas.some(
    (d) => d.Manvnhanthay?.trim().toUpperCase() === cleanManv
  );
  return (coTrongLich && !daNhuongCa) || laCaNhanThay;
}

/**
 * UC_3.3: Lấy danh sách ca làm thiếu check-in hoặc check-out của chính nhân viên.
 */
export async function layCaThieuChamCong(
  manv: string
): Promise<CaThieuChamCongItem[]> {
  const cleanManv = manv.trim().toUpperCase();
  const now = nowVN();
  const todayStr = formatDateVN(now);
  const todayDate = new Date(`${todayStr}T00:00:00Z`);
  const nowDb = toDbDateTimeVN(now);
  const hienTaiPhut =
    now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  return withDbRetry(async (db) => {
    await chotTangCaHetHan({ db, manv: cleanManv, now });

    const activeOtRows = await db.yeuCauBoSungCC.findMany({
      where: {
        Manv: cleanManv,
        Mayeucau: { startsWith: "OT" },
      },
      select: { Malich: true },
    });
    const activeOtMalichSet = new Set(
      activeOtRows.map((row) => row.Malich.trim().toUpperCase())
    );

    const lichLams = await db.lichLam.findMany({
      where: {
        Ngaylam: { lte: todayDate },
        OR: [
          { NhanVien_LichLam: { some: { Manv: cleanManv } } },
          {
            DonXinDoiCa: {
              some: {
                Madon: { not: { startsWith: "TD" } },
                Trangthaixuly: "Đã xử lý",
                Manvnhanthay: cleanManv,
              },
            },
          },
        ],
      },
      include: {
        CaLam: true,
        NhanVien_LichLam: {
          select: { Manv: true },
        },
        DonXinDoiCa: {
          where: {
            Madon: { not: { startsWith: "TD" } },
            Trangthaixuly: "Đã xử lý",
            Manvnhanthay: { not: null },
            OR: [{ Manv: cleanManv }, { Manvnhanthay: cleanManv }],
          },
          select: { Manv: true, Manvnhanthay: true },
        },
        ChamCong: {
          where: { Manv: cleanManv },
          select: {
            Machamcong: true,
            Thoigiancheckin: true,
            Thoigiancheckout: true,
          },
        },
        YeuCauBoSungCC: {
          where: {
            Mayeucau: { startsWith: "YC" },
            Manv: cleanManv,
            Trangthai: "Chưa xử lý",
          },
          select: { Mayeucau: true },
        },
      },
      orderBy: [{ Ngaylam: "desc" }, { CaLam: { Giobatdau: "asc" } }],
      take: 100,
    });

    const result: CaThieuChamCongItem[] = [];

    for (const ll of lichLams) {
      if (
        !kiemTraQuyenCaCuaNhanVien(
          cleanManv,
          ll.NhanVien_LichLam,
          ll.DonXinDoiCa
        )
      ) {
        continue;
      }

      // Bỏ qua ca đã có yêu cầu đang chờ xử lý
      if (ll.YeuCauBoSungCC.length > 0) continue;

      const cc = ll.ChamCong[0] ?? null;
      const daCheckIn = Boolean(cc?.Thoigiancheckin);
      const daCheckOut = Boolean(cc?.Thoigiancheckout);

      if (daCheckIn && daCheckOut) continue;

      const ngayStr = ll.Ngaylam.toISOString().slice(0, 10);
      const isPastDay = ngayStr < todayStr;
      const gioBatDau = formatTimeFromDb(ll.CaLam.Giobatdau);
      const gioKetThuc = formatTimeFromDb(ll.CaLam.Gioketthuc);
      const ketThucPhut = parseTimeToMinutes(gioKetThuc);

      let loaiThieu: LoaiYeuCauBoSung | null = null;
      let gioDaCheckIn: string | null = null;

      if (!daCheckIn) {
        if (isPastDay || hienTaiPhut >= ketThucPhut) {
          loaiThieu = "Quên check-in";
        }
      } else if (!daCheckOut) {
        const ketThucCaDb = buildDbDateTimeVN(ngayStr, gioKetThuc);
        const isTangCaDangMo = activeOtMalichSet.has(ll.Malich.trim().toUpperCase());
        const mocTangCa = isTangCaDangMo
          ? tinhMocKetThucTangCa(ngayStr, gioKetThuc, ll.CaLam.Loaica)
          : null;
        const trangThaiOut = xetTrangThaiCheckOut({
          daCheckIn: true,
          daCheckOut: false,
          dangTangCa: isTangCaDangMo,
          hienTaiMs: nowDb.getTime(),
          ketThucCaMs: ketThucCaDb.getTime(),
          mocTangCaMs: mocTangCa ? mocTangCa.mocDb.getTime() : ketThucCaDb.getTime(),
          gracePhut: CHECKOUT_GRACE_MINUTES,
        });
        if (!isTangCaDangMo && (isPastDay || trangThaiOut === "quen-check-out")) {
          loaiThieu = "Quên check-out";
          gioDaCheckIn = cc!.Thoigiancheckin!.toISOString().slice(11, 16);
        }
      }

      if (!loaiThieu) continue;

      result.push({
        malich: ll.Malich.trim(),
        ngayLam: ngayStr,
        ngayHienThi: formatDDMMYYYY(ngayStr),
        ngayNgan: formatDDMM(ngayStr),
        maca: ll.CaLam.Maca.trim(),
        loaica: ll.CaLam.Loaica,
        tenCa: `Ca ${ll.CaLam.Loaica.toLowerCase()}`,
        gioBatDau,
        gioKetThuc,
        loaiThieu,
        gioDaCheckIn,
      });
    }

    return result;
  });
}

/**
 * UC_3.3: Nhân viên gửi yêu cầu bổ sung chấm công (trạng thái "Chưa xử lý").
 */
export async function guiYeuCauBoSungCC(
  manv: string,
  input: CreateBoSungCCInput
): Promise<{
  mayeucau: string;
  malich: string;
  giovaobosung: string | null;
  giorabosung: string;
  lydo: string;
  trangthai: string;
  message: string;
}> {
  const cleanManv = manv.trim().toUpperCase();
  const cleanMalich = input.malich.trim().toUpperCase();
  const now = nowVN();
  const todayStr = formatDateVN(now);
  const hienTaiPhut =
    now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  return withDbRetry(async (db) => {
    return db.$transaction(async (tx) => {
      await chotTangCaHetHan({ db: tx, manv: cleanManv, now });
      const ll = await tx.lichLam.findUnique({
        where: { Malich: cleanMalich },
        include: {
          CaLam: true,
          NhanVien_LichLam: {
            select: { Manv: true },
          },
          DonXinDoiCa: {
            where: {
              Madon: { not: { startsWith: "TD" } },
              Trangthaixuly: "Đã xử lý",
              Manvnhanthay: { not: null },
              OR: [{ Manv: cleanManv }, { Manvnhanthay: cleanManv }],
            },
            select: { Manv: true, Manvnhanthay: true },
          },
          ChamCong: {
            where: { Manv: cleanManv },
            select: {
              Machamcong: true,
              Thoigiancheckin: true,
              Thoigiancheckout: true,
            },
          },
          YeuCauBoSungCC: {
            where: {
              Mayeucau: { startsWith: "YC" },
              Manv: cleanManv,
              Trangthai: "Chưa xử lý",
            },
            select: { Mayeucau: true },
          },
        },
      });

      if (!ll) {
        throw new BoSungCCServiceError(
          "Không tìm thấy ca làm",
          404,
          "NOT_FOUND"
        );
      }

      const coQuyen = kiemTraQuyenCaCuaNhanVien(
        cleanManv,
        ll.NhanVien_LichLam,
        ll.DonXinDoiCa
      );
      if (!coQuyen) {
        throw new BoSungCCServiceError(
          "Bạn không có quyền gửi yêu cầu cho ca làm của người khác",
          403,
          "FORBIDDEN_SHIFT"
        );
      }

      if (ll.YeuCauBoSungCC.length > 0) {
        throw new BoSungCCServiceError(
          "Ca làm này đã có yêu cầu bổ sung đang chờ xử lý",
          409,
          "DUPLICATE_REQUEST"
        );
      }

      const cc = ll.ChamCong[0] ?? null;
      const daCheckIn = Boolean(cc?.Thoigiancheckin);
      const daCheckOut = Boolean(cc?.Thoigiancheckout);

      if (daCheckIn && daCheckOut) {
        throw new BoSungCCServiceError(
          "Ca làm này đã chấm công đầy đủ",
          400,
          "ALREADY_COMPLETE"
        );
      }

      const activeOt = await tx.yeuCauBoSungCC.findFirst({
        where: {
          Manv: cleanManv,
          Malich: cleanMalich,
          Mayeucau: { startsWith: "OT" },
        },
        select: { Mayeucau: true },
      });
      if (activeOt) {
        throw new BoSungCCServiceError(
          "Ca làm này chưa kết thúc",
          400,
          "SHIFT_NOT_ENDED"
        );
      }

      const ngayStr = ll.Ngaylam.toISOString().slice(0, 10);
      const gioKetThucCa = formatTimeFromDb(ll.CaLam.Gioketthuc);
      if (
        ngayStr > todayStr ||
        (ngayStr === todayStr &&
          !daCheckIn &&
          hienTaiPhut < parseTimeToMinutes(gioKetThucCa))
      ) {
        throw new BoSungCCServiceError(
          "Ca làm này chưa kết thúc",
          400,
          "SHIFT_NOT_ENDED"
        );
      }

      const gioRaStr = input.giorabosung.trim();
      const gioRaPhut = parseTimeToMinutes(gioRaStr);

      let giovaobosungDb: Date | null = null;
      let giovaobosungStr: string | null = null;

      if (!daCheckIn) {
        // Nhánh Quên check-in: bắt buộc nhập cả Giờ vào và Giờ kết thúc
        const gioVaoInput = input.giovaobosung?.trim() || "";
        if (!gioVaoInput) {
          throw new BoSungCCServiceError(
            BO_SUNG_CC_THIEU_TRUONG,
            400,
            "MISSING_FIELDS"
          );
        }
        const gioVaoPhut = parseTimeToMinutes(gioVaoInput);
        if (gioRaPhut <= gioVaoPhut) {
          throw new BoSungCCServiceError(
            "Giờ kết thúc ca phải sau giờ vào ca",
            400,
            "INVALID_TIME_RANGE"
          );
        }
        giovaobosungDb = parseHHmmToDbTime(gioVaoInput);
        giovaobosungStr = gioVaoInput;
      } else {
        // Nhánh Quên check-out: Giovaobosung = NULL; kiểm tra giờ ra > giờ check-in đã ghi
        const gioCheckInStr = cc!.Thoigiancheckin!.toISOString().slice(11, 16);
        const gioCheckInPhut = parseTimeToMinutes(gioCheckInStr);
        if (gioRaPhut <= gioCheckInPhut) {
          throw new BoSungCCServiceError(
            "Giờ kết thúc ca phải sau giờ vào ca",
            400,
            "INVALID_TIME_RANGE"
          );
        }
        giovaobosungDb = null;
        giovaobosungStr = null;
      }

      const mayeucau = await generateNextMayeucau(tx);
      const lydoClean = input.lydo.trim();

      await tx.yeuCauBoSungCC.create({
        data: {
          Mayeucau: mayeucau,
          Giovaobosung: giovaobosungDb,
          Giorabosung: parseHHmmToDbTime(gioRaStr),
          Lydo: lydoClean,
          Trangthai: "Chưa xử lý",
          Manv: cleanManv,
          Malich: cleanMalich,
        },
      });

      return {
        mayeucau,
        malich: cleanMalich,
        giovaobosung: giovaobosungStr,
        giorabosung: gioRaStr,
        lydo: lydoClean,
        trangthai: "Chưa xử lý",
        message: BO_SUNG_CC_GUI_THANH_CONG,
      };
    }, SHORT_TX_OPTIONS);
  });
}

/**
 * UC_7.1: Chủ quán lấy danh sách yêu cầu bổ sung chấm công chưa xử lý (phân trang).
 */
export async function layDanhSachYeuCauBoSungChuaXuLy(
  page = 1,
  limit = 50
): Promise<{
  items: YeuCauBoSungItem[];
  total: number;
  page: number;
  limit: number;
}> {
  return withDbRetry(async (db) => {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [total, rows] = await Promise.all([
      db.yeuCauBoSungCC.count({
        where: {
          Mayeucau: { startsWith: "YC" },
          Trangthai: "Chưa xử lý",
        },
      }),
      db.yeuCauBoSungCC.findMany({
        where: {
          Mayeucau: { startsWith: "YC" },
          Trangthai: "Chưa xử lý",
        },
        include: {
          NhanVien: { select: { Manv: true, Hoten: true } },
          LichLam: { include: { CaLam: true } },
        },
        orderBy: { Mayeucau: "asc" },
        skip,
        take: safeLimit,
      }),
    ]);

    const malichSet = Array.from(new Set(rows.map((r) => r.Malich)));
    const chamCongs =
      malichSet.length > 0
        ? await db.chamCong.findMany({
            where: { Malich: { in: malichSet } },
            select: {
              Manv: true,
              Malich: true,
              Thoigiancheckin: true,
            },
          })
        : [];

    const ccMap = new Map<string, Date | null>();
    for (const cc of chamCongs) {
      ccMap.set(
        `${cc.Manv.trim().toUpperCase()}:${cc.Malich.trim().toUpperCase()}`,
        cc.Thoigiancheckin
      );
    }

    const items: YeuCauBoSungItem[] = rows.map((y) => {
      const ngayStr = y.LichLam.Ngaylam.toISOString().slice(0, 10);
      const key = `${y.Manv.trim().toUpperCase()}:${y.Malich.trim().toUpperCase()}`;
      const checkinDate = ccMap.get(key) ?? null;

      return {
        mayeucau: y.Mayeucau.trim(),
        manv: y.Manv.trim(),
        tenNhanVien: y.NhanVien.Hoten.trim(),
        malich: y.Malich.trim(),
        ngayLam: ngayStr,
        ngayHienThi: formatDDMMYYYY(ngayStr),
        loaica: y.LichLam.CaLam.Loaica,
        caLam: `Ca ${y.LichLam.CaLam.Loaica.toLowerCase()}`,
        loaiYeuCau:
          y.Giovaobosung === null ? "Quên check-out" : "Quên check-in",
        giovaobosung: y.Giovaobosung
          ? formatTimeFromDb(y.Giovaobosung)
          : null,
        giorabosung: formatTimeFromDb(y.Giorabosung),
        gioCheckInHienTai: checkinDate
          ? checkinDate.toISOString().slice(11, 16)
          : null,
        gioBatDauCa: formatTimeFromDb(y.LichLam.CaLam.Giobatdau),
        gioKetThucCa: formatTimeFromDb(y.LichLam.CaLam.Gioketthuc),
        lydo: y.Lydo.trim(),
        trangthai: y.Trangthai,
      };
    });

    return { items, total, page: safePage, limit: safeLimit };
  });
}

/**
 * UC_7.1: Chủ quán xác nhận hoặc chỉnh giờ rồi lưu -> cập nhật ChamCong & đổi trạng thái "Đã xử lý".
 */
export async function xuLyYeuCauBoSungCC(input: XuLyBoSungCCInput): Promise<{
  mayeucau: string;
  machamcong: string;
  manv: string;
  malich: string;
  thoigiancheckin: string;
  thoigiancheckout: string;
  trangthai: string;
  message: string;
}> {
  const cleanMayeucau = input.mayeucau.trim().toUpperCase();
  const gioRaStr = input.giorabosung.trim();

  return withDbRetry(async (db) => {
    return db.$transaction(async (tx) => {
      const yc = await tx.yeuCauBoSungCC.findUnique({
        where: { Mayeucau: cleanMayeucau },
        include: {
          LichLam: { include: { CaLam: true } },
        },
      });

      if (!yc || !yc.Mayeucau.trim().toUpperCase().startsWith("YC")) {
        throw new BoSungCCServiceError(
          "Không tìm thấy yêu cầu bổ sung chấm công",
          404,
          "NOT_FOUND"
        );
      }

      if (yc.Trangthai === "Đã xử lý") {
        throw new BoSungCCServiceError(
          "Yêu cầu này đã được xử lý",
          409,
          "ALREADY_PROCESSED"
        );
      }

      const ngayStr = yc.LichLam.Ngaylam.toISOString().slice(0, 10);
      const [namStr, thangStr] = ngayStr.split("-");
      const kyDaChot = await tx.kyLuong.findFirst({
        where: {
          Nam: Number(namStr),
          Thang: Number(thangStr),
          Trangthai: "Đã chốt",
        },
        select: { Makyluong: true },
      });
      if (kyDaChot) {
        throw new BoSungCCServiceError(
          "Kỳ lương đã chốt, không thể chỉnh sửa",
          400,
          "KY_LUONG_DA_CHOT"
        );
      }

      const existingCc = await tx.chamCong.findUnique({
        where: {
          Manv_Malich: {
            Manv: yc.Manv,
            Malich: yc.Malich,
          },
        },
      });

      const checkoutDb = buildDbDateTimeVN(ngayStr, gioRaStr);
      let checkinDb: Date;
      let giovaobosungDb: Date | null = null;

      if (yc.Giovaobosung !== null) {
        // Nhánh Quên check-in: bắt buộc có Giờ bắt đầu* và Giờ kết thúc*
        const gioVaoStr = input.giovaobosung?.trim() || "";
        if (!gioVaoStr) {
          throw new BoSungCCServiceError(
            BO_SUNG_CC_THIEU_TRUONG,
            400,
            "MISSING_FIELDS"
          );
        }
        checkinDb = buildDbDateTimeVN(ngayStr, gioVaoStr);
        giovaobosungDb = parseHHmmToDbTime(gioVaoStr);
      } else {
        // Nhánh Quên check-out: giữ giờ check-in đã có (hoặc giờ bắt đầu ca nếu chưa có bản ghi)
        checkinDb =
          existingCc?.Thoigiancheckin ??
          buildDbDateTimeVN(
            ngayStr,
            formatTimeFromDb(yc.LichLam.CaLam.Giobatdau)
          );
        giovaobosungDb = null;
      }

      if (checkoutDb.getTime() <= checkinDb.getTime()) {
        throw new BoSungCCServiceError(
          "Giờ kết thúc ca bổ sung phải sau giờ vào ca của ca làm",
          400,
          "INVALID_TIME_RANGE"
        );
      }

      let machamcong: string;
      if (existingCc) {
        await tx.chamCong.update({
          where: { Machamcong: existingCc.Machamcong },
          data: {
            Thoigiancheckin: checkinDb,
            Thoigiancheckout: checkoutDb,
          },
        });
        machamcong = existingCc.Machamcong.trim();
      } else {
        machamcong = await generateNextMachamcong(tx);
        await tx.chamCong.create({
          data: {
            Machamcong: machamcong,
            Manv: yc.Manv,
            Malich: yc.Malich,
            Thoigiancheckin: checkinDb,
            Thoigiancheckout: checkoutDb,
          },
        });
      }

      await tx.yeuCauBoSungCC.update({
        where: { Mayeucau: cleanMayeucau },
        data: {
          Giovaobosung: giovaobosungDb,
          Giorabosung: parseHHmmToDbTime(gioRaStr),
          Trangthai: "Đã xử lý",
        },
      });

      return {
        mayeucau: cleanMayeucau,
        machamcong,
        manv: yc.Manv.trim(),
        malich: yc.Malich.trim(),
        thoigiancheckin: checkinDb.toISOString().slice(11, 16),
        thoigiancheckout: checkoutDb.toISOString().slice(11, 16),
        trangthai: "Đã xử lý",
        message: BO_SUNG_CC_THANH_CONG,
      };
    }, SHORT_TX_OPTIONS);
  });
}
