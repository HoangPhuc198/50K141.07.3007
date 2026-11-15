import { Prisma } from "@prisma/client";
import { prisma, withDbRetry } from "@database/client";
import { tinhGioLam } from "@backend/calc/chamcong";
import { chotTangCaHetHan } from "./cham-cong";
import { chonHeSoTheoNgayKey, tinhTongGioLam, tinhTongLuong } from "@backend/calc/luong";
import { formatDateVN, nowVN } from "@backend/lib/time";
import {
  chinhSuaBangLuongSchema,
  ChinhSuaBangLuongInput,
} from "@backend/validators/chinh-sua-luong";
import {
  CHINH_SUA_LUONG_KHONG_DOI,
  CHINH_SUA_LUONG_KHONG_THAY_DOI,
  CHINH_SUA_LUONG_THANH_CONG,
} from "@frontend/config/thong-bao";

export class ChinhSuaLuongServiceError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "ChinhSuaLuongServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface KyLuongFilterParams {
  makyluong?: string;
  thangNam?: string;
  trangthai?: string;
  trang: number;
  soDong: number;
}

export interface KyLuongSummaryItem {
  makyluong: string;
  thang: number;
  nam: number;
  kyLuongHienThi: string;
  ngayTao: string;
  tongLuong: number;
  trangthai: string;
  soPhanHoi: number;
  soPhanHoiChuaXuLy: number;
}

export interface ShiftEditItem {
  machamcong: string | null;
  malich: string | null;
  ngaylam: string;
  tenCa: string;
  giovao: string;
  giora: string;
  mucluong: number;
  heso: number;
  tienthuong: number;
}

export interface YeuCauSaiSotItem {
  maphanhoi: string;
  mabangluong: string;
  manv: string;
  tenNhanVien: string;
  kyLuongHienThi: string;
  noidung: string;
  ngaygui: string;
  ngayxuly: string | null;
  trangthai: "Chưa xử lý" | "Đã xử lý";
  trangThaiThe: "Cần chỉnh sửa" | "Đã chỉnh sửa";
  lydochinhsua: string;
  tienthuong: number;
  caMacDinh: ShiftEditItem;
  danhSachCa: ShiftEditItem[];
}

export interface BangLuongKySummaryRow {
  mabangluong: string;
  manv: string;
  tenNhanVien: string;
  tonggiolam: number;
  mucluong: number;
  tienthuong: number;
  tongluong: number;
  lydochinhsua: string | null;
}

export interface ChiTietSaiSotKyDto {
  kyLuong: {
    makyluong: string;
    thang: number;
    nam: number;
    kyLuongHienThi: string;
    trangthai: string;
  };
  chiXem: boolean;
  danhSachYeuCau: YeuCauSaiSotItem[];
  bangLuongTongHop: BangLuongKySummaryRow[];
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDateDDMMYYYY(d: Date): string {
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

function formatDateTimeDisplayVN(d: Date): string {
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} · ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

function buildUtcDateOnly(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function buildUtcDateTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  const dt = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() + 1 !== month ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return dt;
}

/** Parse "DD/MM/YYYY · HH:mm", "YYYY-MM-DD HH:mm", hoặc "HH:mm" thành UTC date đại diện giờ VN. */
export function parseDateTimeInputVN(raw: string, fallbackNgayLam?: string): Date | null {
  const s = raw.trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*[·\-]?\s*(\d{1,2}):(\d{2})$/.exec(s);
  if (m) {
    return buildUtcDateTime(
      parseInt(m[3], 10),
      parseInt(m[2], 10),
      parseInt(m[1], 10),
      parseInt(m[4], 10),
      parseInt(m[5], 10)
    );
  }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})[T\s](\d{1,2}):(\d{2})(?::\d{2})?/.exec(s);
  if (m) {
    return buildUtcDateTime(
      parseInt(m[1], 10),
      parseInt(m[2], 10),
      parseInt(m[3], 10),
      parseInt(m[4], 10),
      parseInt(m[5], 10)
    );
  }
  m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (m && fallbackNgayLam) {
    const parts = fallbackNgayLam.split("-").map((p) => parseInt(p, 10));
    if (parts.length === 3) {
      return buildUtcDateTime(parts[0], parts[1], parts[2], parseInt(m[1], 10), parseInt(m[2], 10));
    }
  }
  return null;
}

function parseThangNamFilter(raw?: string): { thang: number; nam: number } | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s || s.toLowerCase() === "tất cả") return null;
  let m = /(\d{1,2})\/(\d{4})/.exec(s);
  if (m) {
    return { thang: parseInt(m[1], 10), nam: parseInt(m[2], 10) };
  }
  m = /(\d{4})-(\d{1,2})/.exec(s);
  if (m) {
    return { thang: parseInt(m[2], 10), nam: parseInt(m[1], 10) };
  }
  return null;
}

function lamTron2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function sameMinute(a: Date | null | undefined, b: Date): boolean {
  if (!a) return false;
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate() &&
    a.getUTCHours() === b.getUTCHours() &&
    a.getUTCMinutes() === b.getUTCMinutes()
  );
}

async function generateNextId(
  tx: Prisma.TransactionClient,
  tableName: "HeSoLuong" | "ChiTietBangLuong",
  prefix: "HS" | "CT"
): Promise<string> {
  await tx.$executeRawUnsafe(`LOCK TABLE "${tableName}" IN EXCLUSIVE MODE`);
  const rows =
    tableName === "HeSoLuong"
      ? await tx.heSoLuong.findMany({ select: { Maheso: true } })
      : await tx.chiTietBangLuong.findMany({ select: { MaCTBL: true } });

  let maxNum = 0;
  const re = new RegExp(`^${prefix}(\\d{6})$`);
  for (const r of rows) {
    const id = ("Maheso" in r ? r.Maheso : r.MaCTBL).trim();
    const m = re.exec(id);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `${prefix}${String(maxNum + 1).padStart(6, "0")}`;
}

/**
 * GET /api/ky-luong: lấy danh sách kỳ lương có lọc & phân trang cho U26 (UC_8.3).
 */
export async function layDanhSachKyLuong(params: KyLuongFilterParams) {
  return await withDbRetry(async (db) => {
    const allKyForDropdown = await db.kyLuong.findMany({
      orderBy: [{ Nam: "desc" }, { Thang: "desc" }],
      select: { Makyluong: true, Thang: true, Nam: true, Trangthai: true },
    });

    const parsedTN = parseThangNamFilter(params.thangNam);
    const where: Prisma.KyLuongWhereInput = {};
    if (params.makyluong && params.makyluong !== "Tất cả") {
      where.Makyluong = params.makyluong.trim().toUpperCase();
    }
    if (parsedTN) {
      where.Thang = parsedTN.thang;
      where.Nam = parsedTN.nam;
    }
    if (params.trangthai && params.trangthai !== "Tất cả") {
      where.Trangthai = params.trangthai.trim();
    }

    const total = await db.kyLuong.count({ where });
    const tongSoTrang = total === 0 ? 0 : Math.ceil(total / params.soDong);
    const skip = (params.trang - 1) * params.soDong;

    const kyRows = await db.kyLuong.findMany({
      where,
      orderBy: [{ Nam: "desc" }, { Thang: "desc" }],
      skip,
      take: params.soDong,
      include: {
        BangLuong: {
          include: {
            ChiTietBangLuong: {
              include: { HeSoLuong: true },
            },
            PhanHoiLuong: {
              select: { Maphanhoi: true, Trangthai: true },
            },
          },
        },
      },
    });

    const danhSach: KyLuongSummaryItem[] = kyRows.map((ky) => {
      let tongLuong = 0;
      let soPhanHoi = 0;
      let soPhanHoiChuaXuLy = 0;
      let maxNgayLam: Date | null = null;

      for (const bl of ky.BangLuong) {
        tongLuong += tinhTongLuong(
          bl.ChiTietBangLuong.map((c) => ({
            Giolam: Number(c.Giolam),
            Mucluong: c.Mucluong,
            Heso: c.HeSoLuong ? Number(c.HeSoLuong.Heso) : 1,
          })),
          bl.Tienthuong
        );
        soPhanHoi += bl.PhanHoiLuong.length;
        soPhanHoiChuaXuLy += bl.PhanHoiLuong.filter(
          (p) => p.Trangthai.trim() === "Chưa xử lý"
        ).length;

        for (const ct of bl.ChiTietBangLuong) {
          if (!maxNgayLam || ct.Ngaylam > maxNgayLam) {
            maxNgayLam = ct.Ngaylam;
          }
        }
      }

      const fallbackDate = new Date(Date.UTC(ky.Nam, ky.Thang, 0));
      const ngayTaoDate = ky.Ngaychot ?? maxNgayLam ?? fallbackDate;

      return {
        makyluong: ky.Makyluong.trim(),
        thang: ky.Thang,
        nam: ky.Nam,
        kyLuongHienThi: `${pad2(ky.Thang)}/${ky.Nam}`,
        ngayTao: formatDateDDMMYYYY(ngayTaoDate),
        tongLuong: Math.round(tongLuong),
        trangthai: ky.Trangthai.trim(),
        soPhanHoi,
        soPhanHoiChuaXuLy,
      };
    });

    return {
      danhSach,
      phanTrang: {
        trang: params.trang,
        soDong: params.soDong,
        tongSoDong: total,
        tongSoTrang,
      },
      danhSachKy: allKyForDropdown.map((k) => ({
        makyluong: k.Makyluong.trim(),
        thang: k.Thang,
        nam: k.Nam,
        kyLuongHienThi: `${pad2(k.Thang)}/${k.Nam}`,
        trangthai: k.Trangthai.trim(),
      })),
    };
  });
}

/**
 * GET /api/ky-luong/:id/sai-sot: lấy chi tiết phản hồi sai sót + ca làm của kỳ lương cho U26 màn 2.
 */
export async function layChiTietSaiSotKy(makyluongRaw: string): Promise<ChiTietSaiSotKyDto> {
  const makyluong = makyluongRaw.trim().toUpperCase();

  return await withDbRetry(async (db) => {
    await chotTangCaHetHan({ db });
    const ky = await db.kyLuong.findUnique({
      where: { Makyluong: makyluong },
    });
    if (!ky) {
      throw new ChinhSuaLuongServiceError("Không tìm thấy kỳ lương.", 404, "NOT_FOUND");
    }

    const startMonth = buildUtcDateOnly(ky.Nam, ky.Thang, 1);
    const endMonth = new Date(Date.UTC(ky.Nam, ky.Thang, 0, 23, 59, 59, 999));

    const [bangLuongList, heSoList] = await Promise.all([
      db.bangLuong.findMany({
        where: { Makyluong: makyluong },
        orderBy: { Mabangluong: "asc" },
        include: {
          NhanVien: true,
          ChiTietBangLuong: {
            include: { HeSoLuong: true },
            orderBy: { Ngaylam: "asc" },
          },
          PhanHoiLuong: {
            orderBy: [{ Maphanhoi: "asc" }],
          },
        },
      }),
      db.heSoLuong.findMany({ orderBy: { Ngaybatdau: "asc" } }),
    ]);

    const manvs = bangLuongList.map((b) => b.Manv);
    const chamCongAll =
      manvs.length > 0
        ? await db.chamCong.findMany({
            where: {
              Manv: { in: manvs },
              LichLam: { Ngaylam: { gte: startMonth, lte: endMonth } },
            },
            include: { LichLam: { include: { CaLam: true } } },
            orderBy: { Machamcong: "asc" },
          })
        : [];

    const ccByManv = new Map<string, typeof chamCongAll>();
    for (const cc of chamCongAll) {
      const k = cc.Manv.trim();
      const arr = ccByManv.get(k) ?? [];
      arr.push(cc);
      ccByManv.set(k, arr);
    }

    const danhSachYeuCau: YeuCauSaiSotItem[] = [];
    const bangLuongTongHop: BangLuongKySummaryRow[] = [];

    for (const bl of bangLuongList) {
      const manv = bl.Manv.trim();
      const tenNv = bl.NhanVien.Hoten.trim();
      const ctMap = new Map(bl.ChiTietBangLuong.map((c) => [c.Ngaylam.toISOString().slice(0, 10), c]));

      const tonggiolam = tinhTongGioLam(bl.ChiTietBangLuong.map((c) => ({ Giolam: Number(c.Giolam) })));
      const tongluong = tinhTongLuong(
        bl.ChiTietBangLuong.map((c) => ({
          Giolam: Number(c.Giolam),
          Mucluong: c.Mucluong,
          Heso: c.HeSoLuong ? Number(c.HeSoLuong.Heso) : 1,
        })),
        bl.Tienthuong
      );

      bangLuongTongHop.push({
        mabangluong: bl.Mabangluong.trim(),
        manv,
        tenNhanVien: tenNv,
        tonggiolam,
        mucluong: bl.ChiTietBangLuong[0]?.Mucluong ?? bl.NhanVien.Mucluongtheogio,
        tienthuong: bl.Tienthuong,
        tongluong,
        lydochinhsua: bl.Lydochinhsua,
      });

      const ccList = (ccByManv.get(manv) ?? []).sort((a, b) => {
        const dCmp = a.LichLam.Ngaylam.getTime() - b.LichLam.Ngaylam.getTime();
        if (dCmp !== 0) return dCmp;
        return (a.LichLam.CaLam?.Giobatdau.getTime() ?? 0) - (b.LichLam.CaLam?.Giobatdau.getTime() ?? 0);
      });

      const danhSachCa: ShiftEditItem[] = [];
      for (const cc of ccList) {
        const ngayKey = cc.LichLam.Ngaylam.toISOString().slice(0, 10);
        const ct = ctMap.get(ngayKey);
        const hesoTuLuu = ct?.HeSoLuong ? Number(ct.HeSoLuong.Heso) : null;
        const hesoTuBang = chonHeSoTheoNgayKey(
          ngayKey,
          heSoList.map((h) => ({ ...h, Heso: Number(h.Heso) }))
        );
        const heso = hesoTuLuu ?? (hesoTuBang ? Number(hesoTuBang.Heso) : 1);

        const defaultIn = cc.Thoigiancheckin
          ? cc.Thoigiancheckin
          : buildUtcDateTime(
              cc.LichLam.Ngaylam.getUTCFullYear(),
              cc.LichLam.Ngaylam.getUTCMonth() + 1,
              cc.LichLam.Ngaylam.getUTCDate(),
              cc.LichLam.CaLam.Giobatdau.getUTCHours(),
              cc.LichLam.CaLam.Giobatdau.getUTCMinutes()
            )!;
        const defaultOut = cc.Thoigiancheckout
          ? cc.Thoigiancheckout
          : buildUtcDateTime(
              cc.LichLam.Ngaylam.getUTCFullYear(),
              cc.LichLam.Ngaylam.getUTCMonth() + 1,
              cc.LichLam.Ngaylam.getUTCDate(),
              cc.LichLam.CaLam.Gioketthuc.getUTCHours(),
              cc.LichLam.CaLam.Gioketthuc.getUTCMinutes()
            )!;

        danhSachCa.push({
          machamcong: cc.Machamcong.trim(),
          malich: cc.Malich.trim(),
          ngaylam: ngayKey,
          tenCa: cc.LichLam.CaLam ? `Ca ${cc.LichLam.CaLam.Loaica.toLowerCase()}` : "Ca làm",
          giovao: formatDateTimeDisplayVN(defaultIn),
          giora: formatDateTimeDisplayVN(defaultOut),
          mucluong: ct?.Mucluong ?? bl.NhanVien.Mucluongtheogio,
          heso,
          tienthuong: bl.Tienthuong,
        });
      }

      if (danhSachCa.length === 0) {
        for (const ct of bl.ChiTietBangLuong) {
          const ngayKey = ct.Ngaylam.toISOString().slice(0, 10);
          const [y, m, d] = ngayKey.split("-").map((v) => parseInt(v, 10));
          const gioLam = Number(ct.Giolam);
          const totalMin = Math.round(gioLam * 60);
          const inDt = buildUtcDateTime(y, m, d, 6, 0)!;
          const outDt = new Date(inDt.getTime() + totalMin * 60 * 1000);
          danhSachCa.push({
            machamcong: null,
            malich: null,
            ngaylam: ngayKey,
            tenCa: "Ca làm",
            giovao: formatDateTimeDisplayVN(inDt),
            giora: formatDateTimeDisplayVN(outDt),
            mucluong: ct.Mucluong,
            heso: ct.HeSoLuong ? Number(ct.HeSoLuong.Heso) : 1,
            tienthuong: bl.Tienthuong,
          });
        }
      }

      if (danhSachCa.length === 0) {
        const fallbackDay = `${ky.Nam}-${pad2(ky.Thang)}-01`;
        danhSachCa.push({
          machamcong: null,
          malich: null,
          ngaylam: fallbackDay,
          tenCa: "Ca làm",
          giovao: `01/${pad2(ky.Thang)}/${ky.Nam} · 06:00`,
          giora: `01/${pad2(ky.Thang)}/${ky.Nam} · 11:30`,
          mucluong: bl.NhanVien.Mucluongtheogio,
          heso: 1,
          tienthuong: bl.Tienthuong,
        });
      }

      for (const ph of bl.PhanHoiLuong) {
        const dateMatch = /\b(\d{1,2})\/(\d{1,2})\b/.exec(ph.Noidung);
        let matched = danhSachCa[0];
        if (dateMatch) {
          const targetDayKey = `${ky.Nam}-${pad2(parseInt(dateMatch[2], 10))}-${pad2(parseInt(dateMatch[1], 10))}`;
          const byDate = danhSachCa.filter((c) => c.ngaylam === targetDayKey);
          if (byDate.length > 0) {
            const lowerNd = ph.Noidung.toLowerCase();
            const byCa = byDate.find((c) => lowerNd.includes(c.tenCa.toLowerCase()));
            matched = byCa ?? byDate[0];
          }
        }

        const trangThaiChuan = ph.Trangthai.trim() === "Đã xử lý" ? "Đã xử lý" : "Chưa xử lý";
        danhSachYeuCau.push({
          maphanhoi: ph.Maphanhoi.trim(),
          mabangluong: bl.Mabangluong.trim(),
          manv,
          tenNhanVien: tenNv,
          kyLuongHienThi: `${pad2(ky.Thang)}/${ky.Nam}`,
          noidung: ph.Noidung,
          ngaygui: formatDateDDMMYYYY(ph.Ngaygui),
          ngayxuly: ph.Ngayxuly ? formatDateDDMMYYYY(ph.Ngayxuly) : null,
          trangthai: trangThaiChuan,
          trangThaiThe: trangThaiChuan === "Đã xử lý" ? "Đã chỉnh sửa" : "Cần chỉnh sửa",
          lydochinhsua: bl.Lydochinhsua ?? "",
          tienthuong: bl.Tienthuong,
          caMacDinh: matched,
          danhSachCa,
        });
      }
    }

    // Ưu tiên "Chưa xử lý" lên trước, giữ nguyên thứ tự mã
    danhSachYeuCau.sort((a, b) => {
      if (a.trangthai !== b.trangthai) {
        return a.trangthai === "Chưa xử lý" ? -1 : 1;
      }
      return a.maphanhoi.localeCompare(b.maphanhoi);
    });

    return {
      kyLuong: {
        makyluong: ky.Makyluong.trim(),
        thang: ky.Thang,
        nam: ky.Nam,
        kyLuongHienThi: `${pad2(ky.Thang)}/${ky.Nam}`,
        trangthai: ky.Trangthai.trim(),
      },
      chiXem: ky.Trangthai.trim() === "Đã chốt",
      danhSachYeuCau,
      bangLuongTongHop,
    };
  });
}

/**
 * PUT /api/bang-luong/:id: Chủ quán chỉnh sửa giờ vào/ra, hệ số, tiền thưởng (không sửa mức lương giờ)
 * và đánh dấu phản hồi lương đã xử lý trong 1 transaction.
 */
export async function chinhSuaBangLuong(mabangluongRaw: string, rawBody: unknown) {
  const mabangluong = mabangluongRaw.trim().toUpperCase();
  const parsed = chinhSuaBangLuongSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ChinhSuaLuongServiceError(
      parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ",
      400,
      "VALIDATION_ERROR"
    );
  }
  const input: ChinhSuaBangLuongInput = parsed.data;

  return await withDbRetry(async (db) => {
    return await db.$transaction(async (tx) => {
      await chotTangCaHetHan({ db: tx });
      const bl = await tx.bangLuong.findUnique({
        where: { Mabangluong: mabangluong },
        include: {
          KyLuong: true,
          NhanVien: true,
          ChiTietBangLuong: { include: { HeSoLuong: true } },
          PhanHoiLuong: true,
        },
      });

      if (!bl) {
        throw new ChinhSuaLuongServiceError("Không tìm thấy bảng lương.", 404, "NOT_FOUND");
      }
      if (bl.KyLuong.Trangthai.trim() === "Đã chốt") {
        throw new ChinhSuaLuongServiceError(
          "Kỳ lương đã chốt, chỉ được xem.",
          400,
          "PERIOD_FINALIZED"
        );
      }

      const giovaoDt = parseDateTimeInputVN(input.giovao, input.ngaylam);
      const gioraDt = parseDateTimeInputVN(input.giora, input.ngaylam);
      if (!giovaoDt || !gioraDt) {
        throw new ChinhSuaLuongServiceError(
          "Định dạng giờ vào hoặc giờ ra không hợp lệ.",
          400,
          "INVALID_TIME"
        );
      }
      if (gioraDt.getTime() <= giovaoDt.getTime()) {
        throw new ChinhSuaLuongServiceError(
          "Giờ ra phải sau giờ vào.",
          400,
          "INVALID_TIME_RANGE"
        );
      }

      const targetNgayKey =
        input.ngaylam ??
        `${giovaoDt.getUTCFullYear()}-${pad2(giovaoDt.getUTCMonth() + 1)}-${pad2(giovaoDt.getUTCDate())}`;
      const [y, m, d] = targetNgayKey.split("-").map((v) => parseInt(v, 10));
      const targetNgayDate = buildUtcDateOnly(y, m, d);

      // Tìm ChamCong mục tiêu (nếu có)
      let targetCc = input.machamcong
        ? await tx.chamCong.findUnique({ where: { Machamcong: input.machamcong.trim().toUpperCase() } })
        : await tx.chamCong.findFirst({
            where: { Manv: bl.Manv, LichLam: { Ngaylam: targetNgayDate } },
          });

      if (targetCc && targetCc.Manv.trim() !== bl.Manv.trim()) {
        throw new ChinhSuaLuongServiceError(
          "Bản ghi chấm công không thuộc nhân viên này.",
          400,
          "INVALID_CHAMCONG"
        );
      }

      const existingCt = bl.ChiTietBangLuong.find(
        (c) => c.Ngaylam.toISOString().slice(0, 10) === targetNgayKey
      );

      const oldHeso = existingCt?.HeSoLuong ? Number(existingCt.HeSoLuong.Heso) : 1;
      const newHeso = lamTron2(input.heso);
      const oldThuong = bl.Tienthuong;
      const newThuong = input.tienthuong;

      let sameCheckin = false;
      let sameCheckout = false;
      if (targetCc) {
        sameCheckin = sameMinute(targetCc.Thoigiancheckin, giovaoDt);
        sameCheckout = sameMinute(targetCc.Thoigiancheckout, gioraDt);
      } else if (existingCt) {
        const computedHours = tinhGioLam(giovaoDt, gioraDt);
        sameCheckin = Math.abs(computedHours - Number(existingCt.Giolam)) < 0.01;
        sameCheckout = sameCheckin;
      }

      const sameHeso = Math.abs(newHeso - oldHeso) < 0.001;
      const sameThuong = newThuong === oldThuong;

      if (sameCheckin && sameCheckout && sameHeso && sameThuong) {
        throw new ChinhSuaLuongServiceError(
          CHINH_SUA_LUONG_KHONG_THAY_DOI,
          400,
          "NO_CHANGES"
        );
      }

      // 1. Cập nhật ChamCong (nếu có bản ghi chấm công)
      if (targetCc) {
        targetCc = await tx.chamCong.update({
          where: { Machamcong: targetCc.Machamcong },
          data: {
            Thoigiancheckin: giovaoDt,
            Thoigiancheckout: gioraDt,
          },
        });
      }

      // 2. Xác định Maheso tương ứng với hệ số mới
      let targetMaheso: string | null = existingCt?.Maheso ?? null;
      if (!sameHeso) {
        if (Math.abs(newHeso - 1) < 0.001) {
          targetMaheso = null;
        } else {
          const singleDayHs = await tx.heSoLuong.findFirst({
            where: { Ngaybatdau: targetNgayDate, Ngayketthuc: targetNgayDate },
          });
          if (singleDayHs) {
            await tx.heSoLuong.update({
              where: { Maheso: singleDayHs.Maheso },
              data: { Heso: newHeso },
            });
            targetMaheso = singleDayHs.Maheso;
          } else {
            const newMaHs = await generateNextId(tx, "HeSoLuong", "HS");
            await tx.heSoLuong.create({
              data: {
                Maheso: newMaHs,
                Ngaybatdau: targetNgayDate,
                Ngayketthuc: targetNgayDate,
                Heso: newHeso,
              },
            });
            targetMaheso = newMaHs;
          }
        }
      }

      // 3. Tính lại Giolam của ngày targetNgayDate
      const ccOnDay = await tx.chamCong.findMany({
        where: { Manv: bl.Manv, LichLam: { Ngaylam: targetNgayDate } },
      });
      let newGioLamNgay = 0;
      if (ccOnDay.length > 0) {
        for (const c of ccOnDay) {
          if (c.Thoigiancheckin && c.Thoigiancheckout) {
            newGioLamNgay += tinhGioLam(c.Thoigiancheckin, c.Thoigiancheckout);
          }
        }
        newGioLamNgay = lamTron2(newGioLamNgay);
      } else {
        newGioLamNgay = tinhGioLam(giovaoDt, gioraDt);
      }
      if (newGioLamNgay <= 0) {
        throw new ChinhSuaLuongServiceError("Giờ làm sau chỉnh sửa phải lớn hơn 0.", 400, "INVALID_HOURS");
      }

      if (existingCt) {
        await tx.chiTietBangLuong.update({
          where: { MaCTBL: existingCt.MaCTBL },
          data: {
            Giolam: newGioLamNgay,
            Maheso: targetMaheso,
            // Tuyệt đối KHÔNG sửa Mucluong
          },
        });
      } else {
        const maCtbl = await generateNextId(tx, "ChiTietBangLuong", "CT");
        await tx.chiTietBangLuong.create({
          data: {
            MaCTBL: maCtbl,
            Mabangluong: bl.Mabangluong,
            Ngaylam: targetNgayDate,
            Giolam: newGioLamNgay,
            Mucluong: bl.NhanVien.Mucluongtheogio,
            Maheso: targetMaheso,
          },
        });
      }

      // 4. Cập nhật BangLuong (Tienthuong + Lydothuong thỏa CK_BangLuong_Lydo + Lydochinhsua)
      const lydoThuongMoi =
        newThuong > 0
          ? bl.Lydothuong && bl.Lydothuong.trim().length > 0
            ? bl.Lydothuong
            : input.lydochinhsua
          : bl.Lydothuong;

      await tx.bangLuong.update({
        where: { Mabangluong: bl.Mabangluong },
        data: {
          Tienthuong: newThuong,
          Lydothuong: lydoThuongMoi,
          Lydochinhsua: input.lydochinhsua,
        },
      });

      // 5. Đánh dấu PhanHoiLuong "Đã xử lý"
      const now = nowVN();
      const todayDb = buildUtcDateOnly(now.getFullYear(), now.getMonth() + 1, now.getDate());

      if (input.maphanhoi) {
        const ph = bl.PhanHoiLuong.find(
          (p) => p.Maphanhoi.trim() === input.maphanhoi!.trim().toUpperCase()
        );
        if (!ph) {
          throw new ChinhSuaLuongServiceError(
            "Phản hồi lương không thuộc bảng lương này.",
            400,
            "INVALID_PHANHOI"
          );
        }
        const ngayXuLy = todayDb >= ph.Ngaygui ? todayDb : ph.Ngaygui;
        await tx.phanHoiLuong.update({
          where: { Maphanhoi: ph.Maphanhoi },
          data: { Trangthai: "Đã xử lý", Ngayxuly: ngayXuLy },
        });
      } else {
        for (const ph of bl.PhanHoiLuong.filter((p) => p.Trangthai.trim() === "Chưa xử lý")) {
          const ngayXuLy = todayDb >= ph.Ngaygui ? todayDb : ph.Ngaygui;
          await tx.phanHoiLuong.update({
            where: { Maphanhoi: ph.Maphanhoi },
            data: { Trangthai: "Đã xử lý", Ngayxuly: ngayXuLy },
          });
        }
      }

      // 6. Tính lại tổng giờ và tổng lương trả về
      const ctSau = await tx.chiTietBangLuong.findMany({
        where: { Mabangluong: bl.Mabangluong },
        include: { HeSoLuong: true },
      });
      const tonggiolam = tinhTongGioLam(ctSau.map((c) => ({ Giolam: Number(c.Giolam) })));
      const tongluong = tinhTongLuong(
        ctSau.map((c) => ({
          Giolam: Number(c.Giolam),
          Mucluong: c.Mucluong,
          Heso: c.HeSoLuong ? Number(c.HeSoLuong.Heso) : 1,
        })),
        newThuong
      );

      return {
        message: CHINH_SUA_LUONG_THANH_CONG,
        mabangluong: bl.Mabangluong.trim(),
        tonggiolam,
        tongluong,
        tienthuong: newThuong,
        lydochinhsua: input.lydochinhsua,
      };
    });
  });
}

/**
 * POST /api/phan-hoi-luong/:id/khong-chinh-sua: đánh dấu phản hồi Đã xử lý mà không sửa bảng lương (UC_8.3 - 5a).
 */
export async function khongChinhSuaPhanHoi(maphanhoiRaw: string) {
  const maphanhoi = maphanhoiRaw.trim().toUpperCase();

  return await withDbRetry(async (db) => {
    const ph = await db.phanHoiLuong.findUnique({
      where: { Maphanhoi: maphanhoi },
      include: { BangLuong: { include: { KyLuong: true } } },
    });

    if (!ph) {
      throw new ChinhSuaLuongServiceError("Không tìm thấy phản hồi lương.", 404, "NOT_FOUND");
    }
    if (ph.BangLuong.KyLuong.Trangthai.trim() === "Đã chốt") {
      throw new ChinhSuaLuongServiceError(
        "Kỳ lương đã chốt, chỉ được xem.",
        400,
        "PERIOD_FINALIZED"
      );
    }

    const now = nowVN();
    const todayDb = buildUtcDateOnly(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const ngayXuLy = todayDb >= ph.Ngaygui ? todayDb : ph.Ngaygui;

    await db.phanHoiLuong.update({
      where: { Maphanhoi: ph.Maphanhoi },
      data: {
        Trangthai: "Đã xử lý",
        Ngayxuly: ngayXuLy,
      },
    });

    return {
      message: CHINH_SUA_LUONG_KHONG_DOI,
      maphanhoi: ph.Maphanhoi.trim(),
      trangthai: "Đã xử lý",
      ngayxuly: formatDateVN(now),
    };
  });
}
