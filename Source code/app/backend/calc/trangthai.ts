import { nowVN } from "../lib/time";

export const SO_NGAY_THU_VIEC = 3;

/**
 * Tính trạng thái nhân viên: sau 3 ngày thử việc tự chuyển sang "Chính thức".
 * Tính động khi đọc (không dùng cron/job nền).
 *
 * @param trangThaiHienTai Trạng thái lưu trong DB ('Thử việc' hoặc 'Chính thức')
 * @param ngayVaoLam Ngày vào làm của nhân viên (Date hoặc chuỗi YYYY-MM-DD / ISO)
 * @param atDate Mốc thời gian đối chiếu (mặc định nowVN())
 */
export function tinhTrangThaiNhanVien(
  trangThaiHienTai: string,
  ngayVaoLam: Date | string,
  atDate: Date = nowVN()
): "Thử việc" | "Chính thức" | string {
  if (trangThaiHienTai !== "Thử việc") {
    return trangThaiHienTai;
  }

  const dVao = typeof ngayVaoLam === "string" ? new Date(ngayVaoLam) : ngayVaoLam;
  if (!dVao || isNaN(dVao.getTime())) {
    return trangThaiHienTai;
  }

  // So sánh ngày theo lịch (bỏ qua phần giờ phút giây)
  const vaoYear = dVao.getFullYear();
  const vaoMonth = dVao.getMonth();
  const vaoDay = dVao.getDate();
  const vaoDateOnly = new Date(Date.UTC(vaoYear, vaoMonth, vaoDay));

  const atYear = atDate.getFullYear();
  const atMonth = atDate.getMonth();
  const atDay = atDate.getDate();
  const atDateOnly = new Date(Date.UTC(atYear, atMonth, atDay));

  const diffMs = atDateOnly.getTime() - vaoDateOnly.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  // Vào làm ngày 1: ngày 1 (0), ngày 2 (1), ngày 3 (2) là Thử việc.
  // Sau 3 ngày (từ ngày thứ 4, diffDays >= 3) -> tự chuyển Chính thức.
  if (diffDays >= SO_NGAY_THU_VIEC) {
    return "Chính thức";
  }

  return "Thử việc";
}

/**
 * Áp dụng tính lại trạng thái cho 1 đối tượng NhanVien
 */
export function withTrangThaiDerived<T extends { Trangthai: string; Ngayvaolam: Date | string }>(
  nv: T,
  atDate: Date = nowVN()
): T {
  return {
    ...nv,
    Trangthai: tinhTrangThaiNhanVien(nv.Trangthai, nv.Ngayvaolam, atDate),
  };
}

/**
 * Áp dụng tính lại trạng thái cho danh sách NhanVien
 */
export function withListTrangThaiDerived<T extends { Trangthai: string; Ngayvaolam: Date | string }>(
  list: T[],
  atDate: Date = nowVN()
): T[] {
  return list.map((item) => withTrangThaiDerived(item, atDate));
}
