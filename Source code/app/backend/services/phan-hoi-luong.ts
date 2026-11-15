import { Prisma } from "@prisma/client";
import { withDbRetry } from "@database/client";
import { tinhTongLuong } from "@backend/calc/luong";
import { formatDateVN, nowVN } from "@backend/lib/time";
import { CreatePhanHoiLuongInput } from "@backend/validators/phan-hoi-luong";
import {
  BANG_LUONG_CHUA_TONG_HOP,
  PHAN_HOI_LUONG_GUI_THANH_CONG,
  PHAN_HOI_LUONG_HET_HAN,
} from "@frontend/config/thong-bao";

export class PhanHoiLuongServiceError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "PhanHoiLuongServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface PhanHoiLuongItem {
  maphanhoi: string;
  mabangluong: string;
  noidung: string;
  ngaygui: string;
  ngayxuly: string | null;
  trangthai: string;
}

export interface ThongTinPhanHoiLuongDto {
  coBangLuong: boolean;
  quaHan: boolean;
  lyDoHetHan: string | null;
  nhanVien: {
    manv: string;
    tennv: string;
  };
  kyLuong: {
    makyluong: string;
    thang: number;
    nam: number;
    trangthai: string;
    hienThi: string;
  } | null;
  bangLuong: {
    mabangluong: string;
    tongluong: number;
  } | null;
  danhSachPhanHoi: PhanHoiLuongItem[];
}

/**
 * Kiểm tra kỳ lương đã hết thời gian phản hồi sai sót hay chưa.
 * BR: Chỉ phản hồi khi kỳ chưa "Đã chốt" và trước ngày 2 của tháng kế tiếp (theo giờ VN).
 */
export function isQuaHanPhanHoi(
  thang: number,
  nam: number,
  trangThaiKy: string,
  now: Date = nowVN()
): boolean {
  if (trangThaiKy.trim() === "Đã chốt") {
    return true;
  }
  const nextMonth = thang === 12 ? 1 : thang + 1;
  const nextYear = thang === 12 ? nam + 1 : nam;

  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();

  if (y > nextYear) return true;
  if (y === nextYear && m > nextMonth) return true;
  if (y === nextYear && m === nextMonth && d >= 2) return true;
  return false;
}

function toDbDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function formatKyMMYYYY(thang: number, nam: number): string {
  return `${String(thang).padStart(2, "0")}/${nam}`;
}

async function generateNextMaphanhoi(tx: Prisma.TransactionClient): Promise<string> {
  await tx.$executeRawUnsafe('LOCK TABLE "PhanHoiLuong" IN EXCLUSIVE MODE');
  const rows = await tx.phanHoiLuong.findMany({ select: { Maphanhoi: true } });
  let maxNum = 0;
  for (const r of rows) {
    const m = /^PH(\d{6})$/.exec(r.Maphanhoi.trim());
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return `PH${String(maxNum + 1).padStart(6, "0")}`;
}

/**
 * GET /api/phan-hoi-luong: lấy thông tin kỳ lương gần nhất và các phản hồi của chính nhân viên.
 */
export async function layThongTinPhanHoiLuong(
  manvRaw: string
): Promise<ThongTinPhanHoiLuongDto> {
  const manv = manvRaw.trim().toUpperCase();

  return await withDbRetry(async (db) => {
    const nv = await db.nhanVien.findUnique({
      where: { Manv: manv },
      select: { Manv: true, Hoten: true },
    });
    const tenNv = nv?.Hoten.trim() || "Nhân viên";

    const ky = await db.kyLuong.findFirst({
      where: { Trangthai: { in: ["Dự kiến", "Đã chốt"] } },
      orderBy: [{ Nam: "desc" }, { Thang: "desc" }],
    });

    if (!ky) {
      return {
        coBangLuong: false,
        quaHan: false,
        lyDoHetHan: null,
        nhanVien: { manv, tennv: tenNv },
        kyLuong: null,
        bangLuong: null,
        danhSachPhanHoi: [],
      };
    }

    const bl = await db.bangLuong.findFirst({
      where: { Manv: manv, Makyluong: ky.Makyluong },
      include: {
        ChiTietBangLuong: {
          include: { HeSoLuong: true },
          orderBy: { Ngaylam: "asc" },
        },
        PhanHoiLuong: {
          orderBy: [{ Ngaygui: "desc" }, { Maphanhoi: "desc" }],
        },
      },
    });

    if (!bl) {
      return {
        coBangLuong: false,
        quaHan: false,
        lyDoHetHan: null,
        nhanVien: { manv, tennv: tenNv },
        kyLuong: null,
        bangLuong: null,
        danhSachPhanHoi: [],
      };
    }

    const tongluong = tinhTongLuong(
      bl.ChiTietBangLuong.map((c) => ({
        Giolam: Number(c.Giolam),
        Mucluong: c.Mucluong,
        Heso: c.HeSoLuong ? Number(c.HeSoLuong.Heso) : 1,
      })),
      bl.Tienthuong
    );

    const quaHan = isQuaHanPhanHoi(ky.Thang, ky.Nam, ky.Trangthai, nowVN());

    return {
      coBangLuong: true,
      quaHan,
      lyDoHetHan: quaHan ? PHAN_HOI_LUONG_HET_HAN : null,
      nhanVien: { manv, tennv: tenNv },
      kyLuong: {
        makyluong: ky.Makyluong.trim(),
        thang: ky.Thang,
        nam: ky.Nam,
        trangthai: ky.Trangthai.trim(),
        hienThi: formatKyMMYYYY(ky.Thang, ky.Nam),
      },
      bangLuong: {
        mabangluong: bl.Mabangluong.trim(),
        tongluong,
      },
      danhSachPhanHoi: bl.PhanHoiLuong.map((p) => ({
        maphanhoi: p.Maphanhoi.trim(),
        mabangluong: p.Mabangluong.trim(),
        noidung: p.Noidung,
        ngaygui: p.Ngaygui.toISOString().slice(0, 10),
        ngayxuly: p.Ngayxuly ? p.Ngayxuly.toISOString().slice(0, 10) : null,
        trangthai: p.Trangthai.trim(),
      })),
    };
  });
}

/**
 * POST /api/phan-hoi-luong: nhân viên gửi phản hồi sai sót cho bảng lương của chính mình.
 */
export async function guiPhanHoiLuong(
  manvRaw: string,
  input: CreatePhanHoiLuongInput
): Promise<{
  message: string;
  phanHoi: PhanHoiLuongItem;
}> {
  const manv = manvRaw.trim().toUpperCase();

  return await withDbRetry(async (db) => {
    let bangLuongTarget = null as {
      Mabangluong: string;
      Manv: string;
      KyLuong: { Makyluong: string; Thang: number; Nam: number; Trangthai: string };
    } | null;

    if (input.mabangluong) {
      const found = await db.bangLuong.findUnique({
        where: { Mabangluong: input.mabangluong },
        include: { KyLuong: true },
      });
      if (!found) {
        throw new PhanHoiLuongServiceError(BANG_LUONG_CHUA_TONG_HOP, 404, "NOT_FOUND");
      }
      if (found.Manv.trim().toUpperCase() !== manv) {
        throw new PhanHoiLuongServiceError(
          "Bạn không có quyền gửi phản hồi cho bảng lương này.",
          403,
          "FORBIDDEN"
        );
      }
      bangLuongTarget = found;
    } else {
      const ky = await db.kyLuong.findFirst({
        where: { Trangthai: { in: ["Dự kiến", "Đã chốt"] } },
        orderBy: [{ Nam: "desc" }, { Thang: "desc" }],
      });
      if (!ky) {
        throw new PhanHoiLuongServiceError(BANG_LUONG_CHUA_TONG_HOP, 404, "NOT_FOUND");
      }
      const found = await db.bangLuong.findFirst({
        where: { Manv: manv, Makyluong: ky.Makyluong },
        include: { KyLuong: true },
      });
      if (!found) {
        throw new PhanHoiLuongServiceError(BANG_LUONG_CHUA_TONG_HOP, 404, "NOT_FOUND");
      }
      bangLuongTarget = found;
    }

    const now = nowVN();
    const quaHan = isQuaHanPhanHoi(
      bangLuongTarget.KyLuong.Thang,
      bangLuongTarget.KyLuong.Nam,
      bangLuongTarget.KyLuong.Trangthai,
      now
    );

    if (quaHan) {
      throw new PhanHoiLuongServiceError(PHAN_HOI_LUONG_HET_HAN, 400, "OVERDUE");
    }

    const created = await db.$transaction(async (tx) => {
      const maphanhoi = await generateNextMaphanhoi(tx);
      return await tx.phanHoiLuong.create({
        data: {
          Maphanhoi: maphanhoi,
          Noidung: input.noidung,
          Ngaygui: toDbDateOnly(now),
          Ngayxuly: null,
          Trangthai: "Chưa xử lý",
          Mabangluong: bangLuongTarget!.Mabangluong,
        },
      });
    });

    return {
      message: PHAN_HOI_LUONG_GUI_THANH_CONG,
      phanHoi: {
        maphanhoi: created.Maphanhoi.trim(),
        mabangluong: created.Mabangluong.trim(),
        noidung: created.Noidung,
        ngaygui: formatDateVN(now),
        ngayxuly: null,
        trangthai: created.Trangthai.trim(),
      },
    };
  });
}
