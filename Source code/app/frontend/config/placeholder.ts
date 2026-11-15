/**
 * Bảng chữ gợi ý (placeholder) dùng chung cho toàn bộ ô nhập liệu (input, textarea, DatePicker, MonthPicker).
 * Quy tắc đã chốt (15/11/2026):
 * - Mọi placeholder chỉ là chữ hướng dẫn bắt đầu bằng "Nhập " hoặc "Chọn ".
 * - Tuyệt đối không dùng giá trị mẫu (tên riêng, số điện thoại, địa chỉ, số tiền, ngày/giờ mẫu cụ thể).
 */
export const PLACEHOLDER = {
  // Đăng nhập & Tài khoản
  tenDangNhap: "Nhập tên đăng nhập",
  matKhau: "Nhập mật khẩu",

  // Quản lý nhân viên (UC_5.1, UC_5.2, UC_5.3, UC_5.4)
  hoTen: "Nhập họ tên",
  diaChi: "Nhập địa chỉ",
  soDienThoai: "Nhập số điện thoại",
  truongHoc: "Nhập trường học",
  kinhNghiem: "Nhập kinh nghiệm",
  timNhanVien: "Nhập tên hoặc mã nhân viên",

  // Chọn ngày / tháng dùng chung
  chonNgay: "Chọn ngày",
  chonThang: "Chọn tháng",

  // Chấm công & Đổi/Thay ca (UC_2.3, UC_3.3, UC_7.1)
  gioVao: "Nhập giờ vào",
  gioRa: "Nhập giờ ra",
  gioBatDau: "Nhập giờ bắt đầu",
  gioKetThuc: "Nhập giờ kết thúc",
  lyDoQuenChamCong: "Nhập lý do quên chấm công",
  lyDoXinNghi: "Nhập lý do xin nghỉ",

  // Lương, Hệ số, Thưởng, Phản hồi (UC_4.2, UC_8.1, UC_8.3, UC_8.4, UC_8.5)
  mucLuongMoi: "Nhập mức lương mới",
  heSo: "Nhập hệ số",
  heSoLuong: "Nhập hệ số lương",
  soTienThuong: "Nhập số tiền thưởng",
  lyDoThuong: "Nhập lý do thưởng",
  lyDoChinhSua: "Nhập lý do chỉnh sửa",
  noiDungPhanHoi: "Nhập nội dung sai sót cần kiểm tra",
} as const;
