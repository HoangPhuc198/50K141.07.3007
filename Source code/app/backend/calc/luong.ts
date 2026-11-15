/**
 * Tính lương (UC_8.2). Mọi giá trị dẫn xuất tính khi đọc, KHÔNG lưu vào CSDL.
 * - Tiền công ngày = giờ × Mucluong (mức lương chụp trong ChiTietBangLuong) × hệ số
 * - Tongluong = Σ tiền công + Tienthuong
 * - Lương tháng 13 = Σ giờ cả năm × mức lương theo giờ hiện tại (BR04)
 */

import { tinhTienCong } from "@backend/calc/chamcong";

export type ViTriLamViec = "Phục vụ" | "Pha chế";

/** Mức lương khởi điểm theo vị trí làm việc (SRS UC_5.1 BR04). Nguồn duy nhất cho cả FE và BE. */
export const MUC_LUONG_KHOI_DIEM: Record<ViTriLamViec, number> = {
  "Phục vụ": 17000,
  "Pha chế": 20000,
};

/** Trả về mức lương khởi điểm theo vị trí làm việc. */
export function mucLuongKhoiDiemTheoViTri(viTri: string): number {
  if (viTri in MUC_LUONG_KHOI_DIEM) {
    return MUC_LUONG_KHOI_DIEM[viTri as ViTriLamViec];
  }
  return MUC_LUONG_KHOI_DIEM["Phục vụ"];
}

function lamTron2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface ChiTietLuongInput {
  Giolam: number | string;
  Mucluong: number;
  /** Hệ số lương của ngày; rỗng (Maheso null) thì = 1 */
  Heso?: number | string | null;
}

/** Tiền công của một ngày = giờ × Mucluong × hệ số (hệ số rỗng = 1). */
export function tinhTienCongNgay(ct: ChiTietLuongInput): number {
  const heSo = ct.Heso === null || ct.Heso === undefined ? 1 : Number(ct.Heso);
  return tinhTienCong(Number(ct.Giolam), ct.Mucluong, heSo);
}

/** BangLuong.Tonggiolam = Σ Giolam */
export function tinhTongGioLam(danhSach: Pick<ChiTietLuongInput, "Giolam">[]): number {
  return lamTron2(danhSach.reduce((s, ct) => s + Number(ct.Giolam), 0));
}

/** BangLuong.Tongluong = Σ tiền công + Tienthuong */
export function tinhTongLuong(danhSach: ChiTietLuongInput[], tienThuong: number): number {
  const tong = danhSach.reduce((s, ct) => s + tinhTienCongNgay(ct), 0);
  return lamTron2(tong + tienThuong);
}

/**
 * Lương tháng 13 = Σ giờ làm của cả năm × mức lương theo giờ HIỆN TẠI (SRS BR04).
 * Hàm duy nhất tính lương tháng 13.
 */
export function luongThang13(tongGioCaNam: number, mucLuongHienTai: number): number {
  if (tongGioCaNam <= 0 || mucLuongHienTai <= 0) return 0;
  return lamTron2(tongGioCaNam * mucLuongHienTai);
}

/** Kỳ cuối năm (tháng 12) mới tính thêm lương tháng 13. */
export function laKyCuoiNam(thang: number): boolean {
  return thang === 12;
}

/** Ngày chi trả: ngày 2 của tháng sau kỳ lương (dạng YYYY-MM-DD). */
export function ngayChiTra(thang: number, nam: number): string {
  const nextThang = thang === 12 ? 1 : thang + 1;
  const nextNam = thang === 12 ? nam + 1 : nam;
  return `${nextNam}-${String(nextThang).padStart(2, "0")}-02`;
}

export interface HeSoKhoangMa {
  Maheso: string;
  Ngaybatdau: Date;
  Ngayketthuc: Date;
  Heso: number | string;
}

/** Hệ số áp dụng cho một ngày (khóa YYYY-MM-DD); không có khoảng nào thì null (= 1). */
export function chonHeSoTheoNgayKey(ngayKey: string, danhSach: HeSoKhoangMa[]): HeSoKhoangMa | null {
  return (
    danhSach.find(
      (k) =>
        k.Ngaybatdau.toISOString().slice(0, 10) <= ngayKey &&
        ngayKey <= k.Ngayketthuc.toISOString().slice(0, 10)
    ) ?? null
  );
}
