/**
 * NGUỒN DUY NHẤT cho chữ và màu thông báo.
 * Lấy nguyên văn từ docs/ke-hoach/08-THONG-BAO.md.
 * CẤM tự viết, rút gọn, hay đổi chữ/màu ở nơi khác.
 */

// ============================================================
// 1. MÀU THÔNG BÁO (đo từ Figma UC_5.1_02, UC_5.1_03, v.v.)
// ============================================================
export const MAU_THONG_BAO = {
  loi: {
    nen: "#F7ECEA",
    chu: "#C0392B",
    vien: "#C0392B",
    bieuTuong: "#C0392B",
  },
  "thanh-cong": {
    nen: "#EDF3EB",
    chu: "#587554",
    vien: "#A5D6A7",
    bieuTuong: "#587554",
  },
  "canh-bao": {
    nen: "#FEF9E7",
    chu: "#D35400",
    vien: "#F39C12",
    bieuTuong: "#D35400",
  },
} as const;

export type LoaiThongBao = "loi" | "thanh-cong" | "canh-bao";

// ============================================================
// 2. CHUỖI THÔNG BÁO THEO MÀN HÌNH (08-THONG-BAO.md mục 3 & 4)
// ============================================================

// ---- Đăng nhập (UC_1) ----
export const DANG_NHAP_TRONG = "Không được để trống";
export const DANG_NHAP_SAI = "Tên đăng nhập hoặc mật khẩu không đúng";

// ---- Thêm thông tin nhân viên (UC_5.1) ----
export const THEM_NV_THANH_CONG = "Thêm thông tin nhân viên thành công";
export const THEM_NV_THIEU_TRUONG = "Vui lòng nhập đầy đủ thông tin";
export const THEM_NV_TRUNG_SDT = "Số điện thoại này đã tồn tại trên hệ thống";
export const THEM_NV_TRANG_THAI_MAC_DINH = "Thử việc";

// ---- Sửa thông tin nhân viên (UC_5.2) ----
export const SUA_NV_THANH_CONG = "Sửa thông tin nhân viên thành công";
export const SUA_NV_THIEU_TRUONG = "Vui lòng nhập đầy đủ thông tin";
export const SUA_NV_TRUNG_SDT = "Số điện thoại này đã tồn tại trên hệ thống";

// ---- Xoá thông tin nhân viên (UC_5.3) ----
export const XOA_NV_XAC_NHAN = "Xác nhận xóa thông tin nhân viên này?";
export const XOA_NV_THANH_CONG = "Xóa thông tin nhân viên thành công";
export const XOA_NV_THAT_BAI = "Xóa thất bại, đã có lỗi, vui lòng thử lại sau";

// ---- Xem thông tin nhân viên (UC_5.4) ----
// Không có thông báo riêng trên màn hình chính

// ---- Cập nhật mức lương (UC_8.1) ----
export const CAP_NHAT_LUONG_THANH_CONG = "Cập nhật mức lương thành công";
export const CAP_NHAT_LUONG_KHONG_HOP_LE = "Mức lương không hợp lệ";
export const CAP_NHAT_LUONG_VUI_LONG_NHAP = "Vui lòng nhập mức lương";
export const CAP_NHAT_LUONG_THAT_BAI = "Cập nhật mức lương thất bại";

/**
 * Sinh câu xác nhận cập nhật mức lương theo Figma UC_8.1_03 và SRS d.2081.
 * "Bạn có chắc chắn muốn cập nhật mức lương của <Tên> từ <mức cũ> lên <mức mới>?"
 */
export function xuLyCapNhatLuongXacNhan(
  ten: string,
  mucCu: number,
  mucMoi: number
): string {
  return `Bạn có chắc chắn muốn cập nhật mức lương của ${ten} từ ${mucCu.toLocaleString("vi-VN")}đ/giờ lên ${mucMoi.toLocaleString("vi-VN")}đ/giờ không?`;
}

// ---- Đăng ký lịch rảnh (UC_2.1) ----
export const DANG_KY_LICH_RANH_THANH_CONG = "Đăng ký thành công";
export const DANG_KY_LICH_RANH_CHUA_CHON = "Chọn ít nhất một ca rảnh trong tuần";

// ---- Yêu cầu đổi ca (UC_2.2) ----
export const YEU_CAU_DOI_CA_THANH_CONG = "Đã gửi thành công";
export const XU_LY_DOI_CA_THANH_CONG = "Xử lý đổi ca thành công";

// ---- Thay ca (UC_2.3) ----
export const THAY_CA_LOI_MOI_TIEU_DE =
  "Cần người thay ca gấp, bạn có chấp nhận thay ca hay không?";
export const THAY_CA_XAC_NHAN_THANH_CONG = "Đã xác nhận thành công";
export const THAY_CA_DA_CO_NGUOI_NHAN = "Đã có người nhận thay ca";
export const THAY_CA_DA_CO_NV_DONG_Y = "Đã có nhân viên đồng ý";
export const THAY_CA_CANH_BAO_SAT_GIO =
  "Cảnh báo thay ca gấp: Sát giờ làm (≤30 phút) vẫn chưa có nhân viên nhận thay ca";
export const THAY_CA_CANH_BAO_KHONG_NGUOI_RANH =
  "Cảnh báo thay ca gấp: Không có nhân viên có lịch rảnh phù hợp cho ca cần thay";

// ---- Check-in (UC_3.1) ----
export const CHECK_IN_THANH_CONG = "Check-in thành công";
export const CHECK_IN_QUEN = "Bạn đã quên check-in";
export const CHECK_IN_CHUA_DEN_GIO = "Chưa đến giờ vào ca, bạn chỉ được check-in trước giờ làm tối đa 5 phút";
export const CHECK_IN_KHONG_CO_CA = "Hiện bạn không có ca làm để check-in";

// ---- Check-out (UC_3.2) ----
export const CHECK_OUT_THANH_CONG = "Check-out thành công";
export const CHECK_OUT_QUEN = "Bạn đã quên check-out";
export const CHECK_OUT_HOI_TANG_CA = "Bạn có muốn tăng ca không?";

// ---- Bổ sung chấm công (UC_3.2 / 3.3) ----
export const BO_SUNG_CC_THIEU_TRUONG = "Vui lòng nhập đầy đủ";
export const BO_SUNG_CC_GUI_THANH_CONG = "Gửi yêu cầu thành công";
export const BO_SUNG_CC_THANH_CONG = "Bổ sung chấm công thành công";

// ---- Xem bảng lương & phản hồi (UC_4.1, 4.2) ----
export const BANG_LUONG_CHUA_TONG_HOP = "Bảng lương chưa được tổng hợp";
export const PHAN_HOI_LUONG_HET_HAN = "Đã hết thời gian phản hồi";
export const PHAN_HOI_LUONG_THIEU_NOI_DUNG = "Vui lòng nhập nội dung phản hồi";
export const PHAN_HOI_LUONG_GUI_THANH_CONG = "Gửi phản hồi thành công";

// ---- Xếp lịch làm (UC_6.1) ----
export const XEP_LICH_LAM_THANH_CONG = "Đã lưu lịch thành công";

// ---- Xem báo cáo chấm công (UC_7.1) ----
export const BAO_CAO_CHAM_CONG_TRONG = "Không có dữ liệu";

// ---- Chỉnh sửa sai sót bảng lương (UC_8.3) ----
export const TINH_LUONG_THANH_CONG = "Tính lương thành công";
export const TINH_LUONG_THAT_BAI = "Tính lương thất bại";

// ---- Gửi bảng lương dự kiến (UC_8.2, ĐÃ CHỐT 13/11/2026; SRS U25 dòng 2–6, khớp Figma UC_8.2_tinh-luong_03) ----
export const GUI_BANG_LUONG_THANH_CONG = "Gửi bảng lương dự kiến thành công";
export const GUI_BANG_LUONG_TIEU_DE = "Xác nhận gửi bảng lương dự kiến";
export const GUI_BANG_LUONG_NOI_DUNG =
  "Nhân viên có thể phản hồi sai sót trước khi chốt lương, xác nhận gửi bảng lương dự kiến?";
export const GUI_BANG_LUONG_KHONG = "Không";
export const GUI_BANG_LUONG_CO = "Có";
export const CHINH_SUA_LUONG_THANH_CONG = "Tính lương thành công";
export const CHINH_SUA_LUONG_KHONG_DOI = "Ghi nhận không chỉnh sửa";
export const CHINH_SUA_LUONG_XAC_NHAN_TIEU_DE = "Xác nhận chỉnh sửa bản lương";
export const CHINH_SUA_LUONG_XAC_NHAN_NOI_DUNG = "Vui lòng kiểm tra lại nội dung trước khi xác nhận";
export const CHINH_SUA_LUONG_KHONG = "Không";
export const CHINH_SUA_LUONG_CO = "Có";
export const CHINH_SUA_LUONG_KHONG_THAY_DOI = "Bạn chưa thay đổi thông tin nào";
export const CHINH_SUA_LUONG_THIEU_LY_DO = "Vui lòng nhập lý do chỉnh sửa";
export const CHINH_SUA_LUONG_THUONG_KHONG_HOP_LE = "Số tiền thưởng không hợp lệ";
export const CHINH_SUA_LUONG_THAT_BAI = "Chỉnh sửa thất bại";

// ---- Nhập hệ số lương (UC_8.4) ----
export const HE_SO_LUONG_LOI = "Hệ số lỗi, vui lòng nhập lại";
export const HE_SO_LUONG_THOI_GIAN_SAI = "Thời gian áp dụng không hợp lệ";
export const HE_SO_LUONG_DA_XOA = "Đã xóa khoảng áp dụng";
export const HE_SO_LUONG_THANH_CONG = "Đã lưu thành công";

// ---- Nhập tiền thưởng (UC_8.5) ----
export const TIEN_THUONG_CHUA_LUU = "Chưa lưu thay đổi";
export const TIEN_THUONG_THANH_CONG = "Lưu tiền thưởng thành công";
export const NHAP_TIEN_THUONG_THANH_CONG = "Nhập tiền thưởng thành công";
export const TIEN_THUONG_KHONG_HOP_LE = "Số tiền không hợp lệ";
export const TIEN_THUONG_THIEU_LY_DO = "Lý do thưởng không được để trống";

// ---- Chốt bảng lương (UC_8.6) ----
export const CHOT_LUONG_CO_PHAN_HOI_TIEU_DE = "Có phản hồi chưa xử lý";
export const CHOT_LUONG_CO_PHAN_HOI_NOI_DUNG = "Vui lòng xử lý hết các phản hồi trước khi chốt bảng lương";
export const CHOT_LUONG_THANH_CONG = "Chốt bảng lương thành công";
