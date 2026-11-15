import { NhanVien } from "@prisma/client";
import { decrypt } from "../lib/crypto";
import { tinhTrangThaiNhanVien } from "../calc/trangthai";

export interface NhanVienDto {
  Manv: string;
  Tendangnhap: string;
  Hoten: string;
  Sdt: string;
  Diachi: string;
  Truonghoc: string | null;
  Vitrilamviec: string;
  Hinhthuclam: string;
  Ngayvaolam: string;
  Kinhnghiem: string;
  Trangthai: string;
  Mucluongtheogio: number;
  matKhauGiaiMa?: string;
}

export interface MapNhanVienOptions {
  isChuQuan?: boolean;
  atDate?: Date;
  skipTrangThaiDerived?: boolean;
}

/**
 * Bộ ánh xạ chuẩn duy nhất cho đối tượng NhanVien.
 * Trả đủ 12 trường theo tên schema + matKhauGiaiMa (nếu là Chủ quán).
 */
export function toNhanVienDto(
  nv: NhanVien,
  options: MapNhanVienOptions = { isChuQuan: false }
): NhanVienDto {
  const trangThai = options.skipTrangThaiDerived
    ? nv.Trangthai
    : tinhTrangThaiNhanVien(nv.Trangthai, nv.Ngayvaolam, options.atDate);

  let matKhauGiaiMa: string | undefined = undefined;
  if (options.isChuQuan) {
    try {
      matKhauGiaiMa = decrypt(nv.Matkhau);
    } catch {
      matKhauGiaiMa = "******";
    }
  }

  const ngayVaoLamStr =
    nv.Ngayvaolam instanceof Date
      ? nv.Ngayvaolam.toISOString()
      : new Date(nv.Ngayvaolam).toISOString();

  return {
    Manv: nv.Manv.trim(),
    Tendangnhap: nv.Tendangnhap.trim(),
    Hoten: nv.Hoten.trim(),
    Sdt: nv.Sdt.trim(),
    Diachi: nv.Diachi.trim(),
    Truonghoc: nv.Truonghoc ? nv.Truonghoc.trim() : null,
    Vitrilamviec: nv.Vitrilamviec.trim(),
    Hinhthuclam: nv.Hinhthuclam.trim(),
    Ngayvaolam: ngayVaoLamStr,
    Kinhnghiem: nv.Kinhnghiem.trim(),
    Trangthai: trangThai,
    Mucluongtheogio: Number(nv.Mucluongtheogio),
    ...(options.isChuQuan ? { matKhauGiaiMa } : {}),
  };
}

export function toNhanVienListDto(
  list: NhanVien[],
  options: MapNhanVienOptions = { isChuQuan: false }
): NhanVienDto[] {
  return list.map((nv) => toNhanVienDto(nv, options));
}
