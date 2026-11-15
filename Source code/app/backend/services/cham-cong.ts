import { Prisma, PrismaClient } from "@prisma/client";
import { prisma, withDbRetry } from "@database/client";
import { SHORT_TX_OPTIONS, acquireAdvisoryXactLock } from "@backend/lib/db-lock";
import {
  CHECKIN_EARLY_MINUTES,
  CHECKOUT_GRACE_MINUTES,
  OVERTIME_MAX_MINUTES,
  formatDateVN,
  formatTimeFromDb,
  formatTimeVN,
  nowVN,
  toDbDateTimeVN,
} from "@backend/lib/time";
import {
  buildDbDateTimeVN,
  chonHeSoTheoNgay,
  parseTimeToMinutes,
  tinhGioLam,
  tinhMocKetThucTangCa,
  tinhTienCong,
  TrangThaiCheckIn,
  TrangThaiCheckOut,
  truPhutHHmm,
  xetTrangThaiCheckIn,
  xetTrangThaiCheckOut,
} from "@backend/calc/chamcong";
import {
  CHECK_IN_CHUA_DEN_GIO,
  CHECK_IN_KHONG_CO_CA,
  CHECK_IN_QUEN,
  CHECK_IN_THANH_CONG,
  CHECK_OUT_QUEN,
  CHECK_OUT_THANH_CONG,
  LoaiThongBao,
} from "@frontend/config/thong-bao";

export class ChamCongServiceError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "ChamCongServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface KetQuaCheckOut {
  gioCheckIn: string;
  gioCheckOut: string;
  tongGioLam: number;
  tongTien: number;
  heSo: number;
  mucLuongTheoGio: number;
}

export interface CaLamHomNayItem {
  malich: string;
  maca: string;
  tenCa: string;
  loaica: string;
  ngayLam: string;
  gioBatDau: string;
  gioKetThuc: string;
  khungGio: string;
  duocCheckInTu: string;
  laCaNhanThay: boolean;
  daCheckIn: boolean;
  daCheckOut: boolean;
  machamcong: string | null;
  thoiGianCheckIn: string | null;
  thoiGianCheckOut: string | null;
  dangTangCa: boolean;
  gioKetThucTangCa: string | null;
  trangThai: TrangThaiCheckIn;
  trangThaiCheckOut: TrangThaiCheckOut;
  trangThaiHienThi: "Chưa check-in" | "Check-in thành công";
  ketQuaCheckOut: KetQuaCheckOut | null;
}

export type TrangThaiManHinhCheckIn =
  | "mac-dinh"
  | "thanh-cong"
  | "quen-check-in"
  | "chua-den-gio"
  | "khong-co-ca";

export interface ThongBaoManHinh {
  type: LoaiThongBao;
  message: string;
}

export interface ChamCongHomNayData {
  ngayHomNay: string;
  gioHeThong: string;
  checkinEarlyMinutes: number;
  caHienTai: CaLamHomNayItem | null;
  caCheckOut: CaLamHomNayItem | null;
  danhSachCa: CaLamHomNayItem[];
  trangThaiManHinh: TrangThaiManHinhCheckIn;
  thongBao: ThongBaoManHinh | null;
}

// ============================================================
// Trạng thái "Có tăng ca" được lưu bền trong CSDL (bảng YeuCauBoSungCC,
// tiền tố mã OTxxxxxx) + tính lười khi quá mốc kết thúc tăng ca,
// không lưu Map hay setTimeout trong RAM và không thay đổi 14 bảng schema.
// ============================================================
export type ChamCongDbClient = PrismaClient | Prisma.TransactionClient;

function isPrismaRootClient(db: ChamCongDbClient): db is PrismaClient {
  return "$transaction" in db && typeof db.$transaction === "function";
}

function getNgayLamStr(ngaylam: Date): string {
  return ngaylam.toISOString().slice(0, 10);
}

function buildOtDbTime(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00Z`);
}

function getTangCaLockKey(manv: string, malich: string): string {
  return `tang_ca:${manv.trim().toUpperCase()}:${malich.trim().toUpperCase()}`;
}

async function generateNextMaTangCa(
  tx: Prisma.TransactionClient
): Promise<string> {
  await acquireAdvisoryXactLock(tx, "yeu_cau_bo_sung_cc:ot_id");

  const records = await tx.yeuCauBoSungCC.findMany({
    where: { Mayeucau: { startsWith: "OT" } },
    select: { Mayeucau: true },
  });

  let maxNum = 0;
  for (const r of records) {
    const trimmed = r.Mayeucau.trim().toUpperCase();
    if (trimmed.startsWith("OT")) {
      const numPart = parseInt(trimmed.slice(2), 10);
      if (!Number.isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  }

  return `OT${String(maxNum + 1).padStart(6, "0")}`;
}

async function finalizeOneExpiredTangCa(
  tx: Prisma.TransactionClient,
  manv: string,
  malich: string,
  mocKetThucTangCaDb: Date
): Promise<void> {
  const cleanManv = manv.trim().toUpperCase();
  const cleanMalich = malich.trim().toUpperCase();

  await acquireAdvisoryXactLock(tx, getTangCaLockKey(cleanManv, cleanMalich));

  const activeOt = await tx.yeuCauBoSungCC.findFirst({
    where: {
      Manv: cleanManv,
      Malich: cleanMalich,
      Mayeucau: { startsWith: "OT" },
    },
    select: { Mayeucau: true },
  });

  if (!activeOt) return;

  const cc = await tx.chamCong.findUnique({
    where: {
      Manv_Malich: { Manv: cleanManv, Malich: cleanMalich },
    },
    select: { Machamcong: true, Thoigiancheckin: true, Thoigiancheckout: true },
  });

  if (cc?.Thoigiancheckin && !cc.Thoigiancheckout) {
    const checkoutTime =
      mocKetThucTangCaDb.getTime() > cc.Thoigiancheckin.getTime()
        ? mocKetThucTangCaDb
        : new Date(cc.Thoigiancheckin.getTime() + 1000);
    await tx.chamCong.update({
      where: { Machamcong: cc.Machamcong },
      data: { Thoigiancheckout: checkoutTime },
    });
  }

  await tx.yeuCauBoSungCC.deleteMany({
    where: {
      Manv: cleanManv,
      Malich: cleanMalich,
      Mayeucau: { startsWith: "OT" },
    },
  });
}

/**
 * Tính lười các ca tăng ca đã chạm hoặc vượt mốc kết thúc (15:00 với ca sáng):
 * tự ghi ChamCong.Thoigiancheckout từ mốc kết thúc tăng ca và xóa bản ghi đánh dấu OT.
 */
export async function chotTangCaHetHan(options?: {
  db?: ChamCongDbClient;
  manv?: string;
  now?: Date;
}): Promise<void> {
  if (!options?.db) {
    await withDbRetry(async (db) => chotTangCaHetHan({ ...options, db }));
    return;
  }

  const db = options.db;
  const now = options.now ?? nowVN();
  const nowDb = toDbDateTimeVN(now);
  const cleanManv = options.manv?.trim().toUpperCase();

  const otRows = await db.yeuCauBoSungCC.findMany({
    where: {
      Mayeucau: { startsWith: "OT" },
      ...(cleanManv ? { Manv: cleanManv } : {}),
    },
    select: {
      Manv: true,
      Malich: true,
      LichLam: {
        select: {
          Ngaylam: true,
          CaLam: {
            select: {
              Loaica: true,
              Gioketthuc: true,
            },
          },
        },
      },
    },
  });

  if (otRows.length === 0) return;

  const expiredTargets: Array<{
    manv: string;
    malich: string;
    mocKetThucTangCaDb: Date;
  }> = [];

  for (const row of otRows) {
    const ngayLamStr = getNgayLamStr(row.LichLam.Ngaylam);
    const gioKetThuc = formatTimeFromDb(row.LichLam.CaLam.Gioketthuc);
    const mocTangCa = tinhMocKetThucTangCa(
      ngayLamStr,
      gioKetThuc,
      row.LichLam.CaLam.Loaica,
      OVERTIME_MAX_MINUTES
    );
    if (nowDb.getTime() >= mocTangCa.mocDb.getTime()) {
      expiredTargets.push({
        manv: row.Manv.trim().toUpperCase(),
        malich: row.Malich.trim().toUpperCase(),
        mocKetThucTangCaDb: mocTangCa.mocDb,
      });
    }
  }

  if (expiredTargets.length === 0) return;

  if (isPrismaRootClient(db)) {
    await db.$transaction(async (tx) => {
      for (const target of expiredTargets) {
        await finalizeOneExpiredTangCa(
          tx,
          target.manv,
          target.malich,
          target.mocKetThucTangCaDb
        );
      }
    }, SHORT_TX_OPTIONS);
  } else {
    for (const target of expiredTargets) {
      await finalizeOneExpiredTangCa(
        db,
        target.manv,
        target.malich,
        target.mocKetThucTangCaDb
      );
    }
  }
}

/**
 * Sinh mã ChamCong tiếp theo dạng CCxxxxxx trong transaction.
 */
export async function generateNextMachamcong(
  tx: Prisma.TransactionClient
): Promise<string> {
  await tx.$executeRawUnsafe('LOCK TABLE "ChamCong" IN EXCLUSIVE MODE');

  const records = await tx.chamCong.findMany({
    select: { Machamcong: true },
  });

  let maxNum = 0;
  for (const r of records) {
    const trimmed = r.Machamcong.trim();
    if (trimmed.startsWith("CC")) {
      const numPart = parseInt(trimmed.slice(2), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  }

  return `CC${String(maxNum + 1).padStart(6, "0")}`;
}

function chonCaHienTai(
  danhSach: CaLamHomNayItem[],
  hienTaiPhut: number
): CaLamHomNayItem | null {
  if (danhSach.length === 0) return null;

  const coTheCheckIn = danhSach.find((c) => c.trangThai === "co-the-check-in");
  if (coTheCheckIn) return coTheCheckIn;

  const dangTrongCaDaCheckIn = danhSach.find(
    (c) =>
      c.trangThai === "da-check-in" &&
      hienTaiPhut < parseTimeToMinutes(c.gioKetThuc)
  );
  if (dangTrongCaDaCheckIn) return dangTrongCaDaCheckIn;

  const chuaDenGio = danhSach.find((c) => c.trangThai === "chua-den-gio");
  if (chuaDenGio) return chuaDenGio;

  const quenCheckInList = danhSach.filter((c) => c.trangThai === "quen-check-in");
  if (quenCheckInList.length > 0) {
    return quenCheckInList[quenCheckInList.length - 1];
  }

  return danhSach[danhSach.length - 1];
}

function chonCaCheckOut(danhSach: CaLamHomNayItem[]): CaLamHomNayItem | null {
  if (danhSach.length === 0) return null;

  const dangMo = danhSach.find(
    (c) =>
      c.trangThaiCheckOut === "dang-lam-viec" ||
      c.trangThaiCheckOut === "dang-tang-ca"
  );
  if (dangMo) return dangMo;

  const quenList = danhSach.filter((c) => c.trangThaiCheckOut === "quen-check-out");
  if (quenList.length > 0) return quenList[quenList.length - 1];

  const daCheckOutList = danhSach.filter((c) => c.trangThaiCheckOut === "da-check-out");
  if (daCheckOutList.length > 0) return daCheckOutList[daCheckOutList.length - 1];

  return danhSach[0];
}

function mapTrangThaiManHinh(ca: CaLamHomNayItem | null): {
  trangThaiManHinh: TrangThaiManHinhCheckIn;
  thongBao: ThongBaoManHinh | null;
} {
  if (!ca) {
    return {
      trangThaiManHinh: "khong-co-ca",
      thongBao: { type: "loi", message: CHECK_IN_KHONG_CO_CA },
    };
  }
  switch (ca.trangThai) {
    case "co-the-check-in":
      return { trangThaiManHinh: "mac-dinh", thongBao: null };
    case "da-check-in":
      return {
        trangThaiManHinh: "thanh-cong",
        thongBao: { type: "thanh-cong", message: CHECK_IN_THANH_CONG },
      };
    case "quen-check-in":
      return {
        trangThaiManHinh: "quen-check-in",
        thongBao: { type: "loi", message: CHECK_IN_QUEN },
      };
    case "chua-den-gio":
      return {
        trangThaiManHinh: "chua-den-gio",
        thongBao: { type: "loi", message: CHECK_IN_CHUA_DEN_GIO },
      };
  }
}

async function queryCaHomNay(
  db: ChamCongDbClient,
  manv: string,
  now: Date
): Promise<ChamCongHomNayData> {
  const cleanManv = manv.trim().toUpperCase();
  const todayStr = formatDateVN(now);
  const todayDate = new Date(`${todayStr}T00:00:00Z`);
  const nowDb = toDbDateTimeVN(now);
  const hienTaiPhut =
    now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  await chotTangCaHetHan({ db, manv: cleanManv, now });

  const [lichLams, nhanVien, heSoList] = await Promise.all([
    db.lichLam.findMany({
      where: { Ngaylam: todayDate },
      include: {
        CaLam: true,
        NhanVien_LichLam: {
          where: { Manv: cleanManv },
          select: { Manv: true },
        },
        DonXinDoiCa: {
          where: {
            Madon: { not: { startsWith: "TD" } },
            Trangthaixuly: "Đã xử lý",
            Manvnhanthay: { not: null },
            OR: [{ Manv: cleanManv }, { Manvnhanthay: cleanManv }],
          },
          select: {
            Manv: true,
            Manvnhanthay: true,
            Trangthaixuly: true,
          },
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
            Manv: cleanManv,
            Mayeucau: { startsWith: "OT" },
          },
          select: {
            Mayeucau: true,
          },
        },
      },
      orderBy: {
        CaLam: { Giobatdau: "asc" },
      },
    }),
    db.nhanVien.findUnique({
      where: { Manv: cleanManv },
      select: { Mucluongtheogio: true },
    }),
    db.heSoLuong.findMany(),
  ]);

  const mucLuongTheoGio = Number(nhanVien?.Mucluongtheogio || 0);
  const heSoHomNay = chonHeSoTheoNgay(
    todayDate,
    heSoList.map((h) => ({
      Ngaybatdau: h.Ngaybatdau,
      Ngayketthuc: h.Ngayketthuc,
      Heso: Number(h.Heso),
    }))
  );

  const danhSachCa: CaLamHomNayItem[] = [];

  for (const ll of lichLams) {
    const coTrongLich = ll.NhanVien_LichLam.length > 0;
    const daNhuongCa = ll.DonXinDoiCa.some(
      (d) =>
        d.Manv.trim().toUpperCase() === cleanManv &&
        d.Manvnhanthay !== null &&
        d.Manvnhanthay.trim().toUpperCase() !== cleanManv
    );
    const laCaNhanThay = ll.DonXinDoiCa.some(
      (d) => d.Manvnhanthay?.trim().toUpperCase() === cleanManv
    );

    const thuocVeNhanVien = (coTrongLich && !daNhuongCa) || laCaNhanThay;
    if (!thuocVeNhanVien) continue;

    const gioBatDau = formatTimeFromDb(ll.CaLam.Giobatdau);
    const gioKetThuc = formatTimeFromDb(ll.CaLam.Gioketthuc);
    const batDauPhut = parseTimeToMinutes(gioBatDau);
    const ketThucPhut = parseTimeToMinutes(gioKetThuc);

    const cc = ll.ChamCong[0] ?? null;
    const daCheckIn = Boolean(cc?.Thoigiancheckin);
    const daCheckOut = Boolean(cc?.Thoigiancheckout);

    const otRecord = ll.YeuCauBoSungCC[0] ?? null;
    const mocTangCa = tinhMocKetThucTangCa(
      todayStr,
      gioKetThuc,
      ll.CaLam.Loaica,
      OVERTIME_MAX_MINUTES
    );
    const dangTangCa = Boolean(
      otRecord &&
        daCheckIn &&
        !daCheckOut &&
        nowDb.getTime() < mocTangCa.mocDb.getTime()
    );
    const ketThucCaDb = buildDbDateTimeVN(todayStr, gioKetThuc);

    const trangThai = xetTrangThaiCheckIn({
      batDauPhut,
      ketThucPhut,
      hienTaiPhut,
      daCheckIn,
      somPhut: CHECKIN_EARLY_MINUTES,
    });

    const trangThaiCheckOut = xetTrangThaiCheckOut({
      daCheckIn,
      daCheckOut,
      dangTangCa,
      hienTaiMs: nowDb.getTime(),
      ketThucCaMs: ketThucCaDb.getTime(),
      mocTangCaMs: mocTangCa.mocDb.getTime(),
      gracePhut: CHECKOUT_GRACE_MINUTES,
    });

    const thoiGianCheckIn = cc?.Thoigiancheckin
      ? cc.Thoigiancheckin.toISOString().slice(11, 16)
      : null;
    const thoiGianCheckOut = cc?.Thoigiancheckout
      ? cc.Thoigiancheckout.toISOString().slice(11, 16)
      : null;

    let ketQuaCheckOut: KetQuaCheckOut | null = null;
    if (cc?.Thoigiancheckin && cc?.Thoigiancheckout) {
      const gioLam = tinhGioLam(cc.Thoigiancheckin, cc.Thoigiancheckout);
      const tienCong = tinhTienCong(gioLam, mucLuongTheoGio, heSoHomNay);
      ketQuaCheckOut = {
        gioCheckIn: cc.Thoigiancheckin.toISOString().slice(11, 16),
        gioCheckOut: cc.Thoigiancheckout.toISOString().slice(11, 16),
        tongGioLam: gioLam,
        tongTien: tienCong,
        heSo: heSoHomNay,
        mucLuongTheoGio,
      };
    }

    const loaica = ll.CaLam.Loaica;
    danhSachCa.push({
      malich: ll.Malich.trim(),
      maca: ll.CaLam.Maca.trim(),
      tenCa: `Ca ${loaica.toLowerCase()}`,
      loaica,
      ngayLam: todayStr,
      gioBatDau,
      gioKetThuc,
      khungGio: `${gioBatDau} – ${gioKetThuc}`,
      duocCheckInTu: truPhutHHmm(gioBatDau, CHECKIN_EARLY_MINUTES),
      laCaNhanThay,
      daCheckIn,
      daCheckOut,
      machamcong: cc ? cc.Machamcong.trim() : null,
      thoiGianCheckIn,
      thoiGianCheckOut,
      dangTangCa,
      gioKetThucTangCa: dangTangCa ? mocTangCa.gioHienThi : null,
      trangThai,
      trangThaiCheckOut,
      trangThaiHienThi: daCheckIn ? "Check-in thành công" : "Chưa check-in",
      ketQuaCheckOut,
    });
  }

  const caHienTai = chonCaHienTai(danhSachCa, hienTaiPhut);
  const caCheckOut = chonCaCheckOut(danhSachCa);
  const { trangThaiManHinh, thongBao } = mapTrangThaiManHinh(caHienTai);

  return {
    ngayHomNay: todayStr,
    gioHeThong: formatTimeVN(now).slice(0, 5),
    checkinEarlyMinutes: CHECKIN_EARLY_MINUTES,
    caHienTai,
    caCheckOut,
    danhSachCa,
    trangThaiManHinh,
    thongBao,
  };
}

/**
 * GET /api/cham-cong/hom-nay
 */
export async function layCaHomNayCuaNhanVien(
  manv: string
): Promise<ChamCongHomNayData> {
  const now = nowVN();
  return withDbRetry(async (db) => queryCaHomNay(db, manv, now));
}

/**
 * POST /api/cham-cong/check-in
 */
export async function thucHienCheckIn(
  manv: string,
  malichInput?: string
): Promise<{
  machamcong: string;
  malich: string;
  thoigiancheckin: string;
  message: string;
  homNay: ChamCongHomNayData;
}> {
  const now = nowVN();
  const cleanManv = manv.trim().toUpperCase();
  const cleanMalich = malichInput?.trim().toUpperCase();

  return withDbRetry(async (db) => {
    return db.$transaction(async (tx) => {
      const homNay = await queryCaHomNay(tx, cleanManv, now);

      let targetCa: CaLamHomNayItem | undefined;
      if (cleanMalich) {
        targetCa = homNay.danhSachCa.find((c) => c.malich === cleanMalich);
        if (!targetCa) {
          const lichTonTai = await tx.lichLam.findUnique({
            where: { Malich: cleanMalich },
            select: { Malich: true },
          });
          if (lichTonTai) {
            throw new ChamCongServiceError(
              CHECK_IN_KHONG_CO_CA,
              403,
              "FORBIDDEN_SHIFT"
            );
          }
          throw new ChamCongServiceError(
            CHECK_IN_KHONG_CO_CA,
            400,
            "NO_SHIFT"
          );
        }
      } else {
        if (!homNay.caHienTai) {
          throw new ChamCongServiceError(
            CHECK_IN_KHONG_CO_CA,
            400,
            "NO_SHIFT"
          );
        }
        targetCa = homNay.caHienTai;
      }

      if (targetCa.daCheckIn) {
        throw new ChamCongServiceError(
          "Mỗi ca chỉ được check-in một lần",
          409,
          "ALREADY_CHECKED_IN"
        );
      }

      if (targetCa.trangThai === "chua-den-gio") {
        throw new ChamCongServiceError(
          CHECK_IN_CHUA_DEN_GIO,
          400,
          "TOO_EARLY"
        );
      }

      if (targetCa.trangThai === "quen-check-in") {
        throw new ChamCongServiceError(
          CHECK_IN_QUEN,
          400,
          "MISSED_CHECKIN"
        );
      }

      const existing = await tx.chamCong.findUnique({
        where: {
          Manv_Malich: {
            Manv: cleanManv,
            Malich: targetCa.malich,
          },
        },
        select: { Machamcong: true, Thoigiancheckin: true },
      });

      if (existing?.Thoigiancheckin) {
        throw new ChamCongServiceError(
          "Mỗi ca chỉ được check-in một lần",
          409,
          "ALREADY_CHECKED_IN"
        );
      }

      const thoiGianCheckInDb = toDbDateTimeVN(now);
      let machamcong: string;

      if (existing) {
        await tx.chamCong.update({
          where: { Machamcong: existing.Machamcong },
          data: { Thoigiancheckin: thoiGianCheckInDb },
        });
        machamcong = existing.Machamcong.trim();
      } else {
        machamcong = await generateNextMachamcong(tx);
        await tx.chamCong.create({
          data: {
            Machamcong: machamcong,
            Manv: cleanManv,
            Malich: targetCa.malich,
            Thoigiancheckin: thoiGianCheckInDb,
            Thoigiancheckout: null,
          },
        });
      }

      const updatedHomNay = await queryCaHomNay(tx, cleanManv, now);

      return {
        machamcong,
        malich: targetCa.malich,
        thoigiancheckin: formatTimeVN(now).slice(0, 5),
        message: CHECK_IN_THANH_CONG,
        homNay: updatedHomNay,
      };
    }, SHORT_TX_OPTIONS);
  });
}

/**
 * POST /api/cham-cong/check-out
 */
export async function thucHienCheckOut(
  manv: string,
  tangCa: boolean = false,
  malichInput?: string
): Promise<{
  dangTangCa: boolean;
  ketThucTangCa?: string;
  machamcong: string;
  malich: string;
  message: string;
  ketQua: KetQuaCheckOut | null;
  homNay: ChamCongHomNayData;
}> {
  const now = nowVN();
  const nowDb = toDbDateTimeVN(now);
  const cleanManv = manv.trim().toUpperCase();
  const cleanMalich = malichInput?.trim().toUpperCase();

  return withDbRetry(async (db) => {
    return db.$transaction(async (tx) => {
      const homNay = await queryCaHomNay(tx, cleanManv, now);

      let targetCa: CaLamHomNayItem | undefined;
      if (cleanMalich) {
        targetCa = homNay.danhSachCa.find((c) => c.malich === cleanMalich);
        if (!targetCa) {
          const lichTonTai = await tx.lichLam.findUnique({
            where: { Malich: cleanMalich },
            select: { Malich: true },
          });
          if (lichTonTai) {
            throw new ChamCongServiceError(
              CHECK_IN_KHONG_CO_CA,
              403,
              "FORBIDDEN_SHIFT"
            );
          }
          throw new ChamCongServiceError(
            CHECK_IN_KHONG_CO_CA,
            400,
            "NO_SHIFT"
          );
        }
      } else {
        targetCa = homNay.caCheckOut ?? undefined;
      }

      if (!targetCa || !targetCa.daCheckIn) {
        // Kiểm tra xem có ca ngày trước chưa check-out không
        const caChuaCheckOutCu = await tx.chamCong.findFirst({
          where: {
            Manv: cleanManv,
            Thoigiancheckin: { not: null },
            Thoigiancheckout: null,
          },
          select: { Machamcong: true },
        });
        if (caChuaCheckOutCu) {
          throw new ChamCongServiceError(
            CHECK_OUT_QUEN,
            400,
            "MISSED_CHECKOUT"
          );
        }
        throw new ChamCongServiceError(
          CHECK_IN_KHONG_CO_CA,
          400,
          "NOT_CHECKED_IN"
        );
      }

      if (targetCa.daCheckOut) {
        throw new ChamCongServiceError(
          "Ca làm này đã được check-out",
          409,
          "ALREADY_CHECKED_OUT"
        );
      }

      if (targetCa.trangThaiCheckOut === "quen-check-out") {
        throw new ChamCongServiceError(
          CHECK_OUT_QUEN,
          400,
          "MISSED_CHECKOUT"
        );
      }

      const cc = await tx.chamCong.findUnique({
        where: {
          Manv_Malich: {
            Manv: cleanManv,
            Malich: targetCa.malich,
          },
        },
      });

      if (!cc?.Thoigiancheckin) {
        throw new ChamCongServiceError(
          CHECK_IN_KHONG_CO_CA,
          400,
          "NOT_CHECKED_IN"
        );
      }

      const mocTangCa = tinhMocKetThucTangCa(
        targetCa.ngayLam,
        targetCa.gioKetThuc,
        targetCa.loaica,
        OVERTIME_MAX_MINUTES
      );

      // Trường hợp chọn "Có tăng ca" và chưa hết giờ tăng ca
      if (tangCa && nowDb.getTime() < mocTangCa.mocDb.getTime()) {
        await acquireAdvisoryXactLock(
          tx,
          getTangCaLockKey(cleanManv, targetCa.malich)
        );

        const latestCc = await tx.chamCong.findUnique({
          where: { Machamcong: cc.Machamcong },
          select: { Thoigiancheckout: true },
        });
        if (latestCc?.Thoigiancheckout) {
          throw new ChamCongServiceError(
            "Ca làm này đã được check-out",
            409,
            "ALREADY_CHECKED_OUT"
          );
        }

        const existingOt = await tx.yeuCauBoSungCC.findFirst({
          where: {
            Manv: cleanManv,
            Malich: targetCa.malich,
            Mayeucau: { startsWith: "OT" },
          },
          select: { Mayeucau: true },
        });

        const otGioRa = buildOtDbTime(mocTangCa.gioHienThi);
        if (existingOt) {
          await tx.yeuCauBoSungCC.update({
            where: { Mayeucau: existingOt.Mayeucau },
            data: {
              Giorabosung: otGioRa,
              Trangthai: "Đã xử lý",
            },
          });
        } else {
          const maOt = await generateNextMaTangCa(tx);
          await tx.yeuCauBoSungCC.create({
            data: {
              Mayeucau: maOt,
              Giovaobosung: null,
              Giorabosung: otGioRa,
              Lydo: "Đăng ký tăng ca",
              Trangthai: "Đã xử lý",
              Manv: cleanManv,
              Malich: targetCa.malich,
            },
          });
        }

        const updatedHomNay = await queryCaHomNay(tx, cleanManv, now);
        return {
          dangTangCa: true,
          ketThucTangCa: mocTangCa.gioHienThi,
          machamcong: cc.Machamcong.trim(),
          malich: targetCa.malich,
          message: `Đang tăng ca đến ${mocTangCa.gioHienThi}`,
          ketQua: null,
          homNay: updatedHomNay,
        };
      }

      // Check-out ngay ("Không tăng ca", kết thúc sớm, hoặc đã chạm/quá mốc hết giờ tăng ca)
      await acquireAdvisoryXactLock(
        tx,
        getTangCaLockKey(cleanManv, targetCa.malich)
      );

      const latestCc = await tx.chamCong.findUnique({
        where: { Machamcong: cc.Machamcong },
        select: { Thoigiancheckin: true, Thoigiancheckout: true },
      });
      if (!latestCc?.Thoigiancheckin) {
        throw new ChamCongServiceError(
          CHECK_IN_KHONG_CO_CA,
          400,
          "NOT_CHECKED_IN"
        );
      }
      if (latestCc.Thoigiancheckout) {
        throw new ChamCongServiceError(
          "Ca làm này đã được check-out",
          409,
          "ALREADY_CHECKED_OUT"
        );
      }

      const mocRa =
        tangCa && nowDb.getTime() >= mocTangCa.mocDb.getTime()
          ? mocTangCa.mocDb
          : nowDb;

      const checkoutDb =
        mocRa.getTime() > latestCc.Thoigiancheckin.getTime()
          ? mocRa
          : new Date(latestCc.Thoigiancheckin.getTime() + 1000);

      await tx.chamCong.update({
        where: { Machamcong: cc.Machamcong },
        data: { Thoigiancheckout: checkoutDb },
      });
      await tx.yeuCauBoSungCC.deleteMany({
        where: {
          Manv: cleanManv,
          Malich: targetCa.malich,
          Mayeucau: { startsWith: "OT" },
        },
      });

      const updatedHomNay = await queryCaHomNay(tx, cleanManv, now);
      const updatedCa = updatedHomNay.danhSachCa.find(
        (c) => c.malich === targetCa!.malich
      );

      return {
        dangTangCa: false,
        machamcong: cc.Machamcong.trim(),
        malich: targetCa.malich,
        message: CHECK_OUT_THANH_CONG,
        ketQua: updatedCa?.ketQuaCheckOut ?? null,
        homNay: updatedHomNay,
      };
    }, SHORT_TX_OPTIONS);
  });
}
