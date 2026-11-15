/**
 * Bộ ánh xạ chuẩn cho bảng lương tính (UC_8.2): dùng chung cho xem trước, gửi, tổng hợp, chi tiết.
 * Mọi giá trị dẫn xuất (tiền công, tổng giờ, tổng lương, lương tháng 13) tính khi đọc.
 */

import {
  luongThang13,
  tinhTienCongNgay,
  tinhTongGioLam,
  tinhTongLuong,
} from "@backend/calc/luong";

export interface NgayLamRaw {
  Ngaylam: string; // YYYY-MM-DD
  Giolam: number;
  Mucluong: number;
  Maheso: string | null;
  Heso: number;
  Ca: string;
  Vao: string | null; // HH:mm
  Ra: string | null; // HH:mm
}

export interface NhanVienLuongRaw {
  Manv: string;
  Hoten: string;
  Mucluong: number; // mức lương/giờ dùng để hiển thị (hiện tại hoặc đã chụp)
  Mabangluong: string | null;
  Tienthuong: number;
  Lydothuong: string | null;
  /** Σ giờ làm cả năm (chỉ cần ở kỳ cuối năm) */
  GioCaNam: number;
  /** Mức lương theo giờ hiện tại của nhân viên (dùng cho lương tháng 13) */
  MucluongHienTai: number;
  Ngay: NgayLamRaw[];
}

export type ChiTietNgayDto = {
  Ngaylam: string;
  Ca: string;
  Vao: string | null;
  Ra: string | null;
  Giolam: number;
  Mucluong: number;
  Maheso: string | null;
  Heso: number;
  Thuong: number;
  Thanhtien: number;
};

export type BangLuongTinhDto = {
  Mabangluong: string | null;
  Manv: string;
  Hoten: string;
  Songay: number;
  Tonggiolam: number;
  Mucluong: number;
  /** Hệ số trung bình theo giờ (= 1 khi không có ngày hệ số) */
  Heso: number;
  Tienthuong: number;
  Lydothuong: string | null;
  Tongluong: number;
  /** Chỉ có ở kỳ cuối năm; hiển thị riêng, không cộng vào Tongluong */
  Luongthang13: number | null;
  ChiTiet?: ChiTietNgayDto[];
};

function lamTron2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function mapChiTietNgay(n: NgayLamRaw): ChiTietNgayDto {
  return {
    Ngaylam: n.Ngaylam,
    Ca: n.Ca,
    Vao: n.Vao,
    Ra: n.Ra,
    Giolam: n.Giolam,
    Mucluong: n.Mucluong,
    Maheso: n.Maheso,
    Heso: n.Heso,
    Thuong: 0, // tiền thưởng thuộc BangLuong, không thuộc từng ngày
    Thanhtien: tinhTienCongNgay(n),
  };
}

export function mapBangLuongTinh(nv: NhanVienLuongRaw, cuoiNam: boolean): BangLuongTinhDto {
  const tongGio = tinhTongGioLam(nv.Ngay);
  const heso =
    tongGio > 0 ? lamTron2(nv.Ngay.reduce((s, n) => s + n.Giolam * n.Heso, 0) / tongGio) : 1;
  return {
    Mabangluong: nv.Mabangluong,
    Manv: nv.Manv.trim(),
    Hoten: nv.Hoten,
    Songay: nv.Ngay.length,
    Tonggiolam: tongGio,
    Mucluong: nv.Mucluong,
    Heso: heso,
    Tienthuong: nv.Tienthuong,
    Lydothuong: nv.Lydothuong,
    Tongluong: tinhTongLuong(nv.Ngay, nv.Tienthuong),
    Luongthang13: cuoiNam ? luongThang13(lamTron2(nv.GioCaNam), nv.MucluongHienTai) : null,
    ChiTiet: nv.Ngay.map(mapChiTietNgay),
  };
}
