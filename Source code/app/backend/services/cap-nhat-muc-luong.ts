import { prisma, withDbRetry } from "@database/client";

export type NhanVienMucLuongDto = {
  Manv: string;
  Hoten: string;
  Vitrilamviec: string;
  Mucluongtheogio: number;
};

/**
 * UC 8.1: Lấy danh sách nhân viên với mức lương hiện tại
 */
export async function getNhanVienMucLuongList(): Promise<NhanVienMucLuongDto[]> {
  return await withDbRetry(async (db) => {
    const list = await db.nhanVien.findMany({
      select: {
        Manv: true,
        Hoten: true,
        Vitrilamviec: true,
        Mucluongtheogio: true,
      },
      orderBy: { Manv: "asc" },
    });
    return list.map((nv) => ({
      Manv: nv.Manv.trim(),
      Hoten: nv.Hoten,
      Vitrilamviec: nv.Vitrilamviec,
      Mucluongtheogio: nv.Mucluongtheogio,
    }));
  });
}

export class CapNhatMucLuongError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "CapNhatMucLuongError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * UC 8.1: Cập nhật mức lương theo giờ
 * - Chỉ áp dụng cho bảng lương tính SAU khi cập nhật (không đổi bảng đã tính)
 * - Mức lương phải là số nguyên dương
 */
export async function capNhatMucLuong(manv: string, mucMoi: number): Promise<NhanVienMucLuongDto> {
  return await withDbRetry(async (db) => {
    const normalizedManv = manv.trim().toUpperCase();

    if (!Number.isInteger(mucMoi) || mucMoi <= 0) {
      throw new CapNhatMucLuongError("Mức lương không hợp lệ", 400, "LUONG_KHONG_HOP_LE");
    }

    const nv = await db.nhanVien.findUnique({ where: { Manv: normalizedManv } });
    if (!nv) {
      throw new CapNhatMucLuongError("Không tìm thấy nhân viên", 404, "NOT_FOUND");
    }

    const updated = await db.nhanVien.update({
      where: { Manv: normalizedManv },
      data: { Mucluongtheogio: mucMoi },
      select: {
        Manv: true,
        Hoten: true,
        Vitrilamviec: true,
        Mucluongtheogio: true,
      },
    });

    return {
      Manv: updated.Manv.trim(),
      Hoten: updated.Hoten,
      Vitrilamviec: updated.Vitrilamviec,
      Mucluongtheogio: updated.Mucluongtheogio,
    };
  });
}
