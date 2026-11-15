/**
 * Test đối chiếu thông báo chuẩn với docs/ke-hoach/08-THONG-BAO.md
 * Đảm bảo:
 * 1. Mọi chuỗi thông báo khớp nguyên văn từng ký tự
 * 2. Màu lỗi chuẩn đỏ #C0392B
 * 3. Quét mã không còn chuỗi thông báo cũ/rải rác ngoài thong-bao.ts
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as thongBao from "@frontend/config/thong-bao";

const DOCS_THONG_BAO_PATH = path.resolve(__dirname, "../../../docs/ke-hoach/08-THONG-BAO.md");
const FRONTEND_SCREENS_DIR = path.resolve(__dirname, "../../frontend/screens");

describe("08-THONG-BAO.md đối chiếu chuẩn", () => {
  it("08-THONG-BAO.md phải tồn tại", () => {
    expect(fs.existsSync(DOCS_THONG_BAO_PATH)).toBe(true);
  });

  it("Màu thông báo lỗi chuẩn Figma: chữ & viền #C0392B, nền #F7ECEA", () => {
    expect(thongBao.MAU_THONG_BAO.loi.chu).toBe("#C0392B");
    expect(thongBao.MAU_THONG_BAO.loi.nen).toBe("#F7ECEA");
    expect(thongBao.MAU_THONG_BAO.loi.vien).toBe("#C0392B");
    expect(thongBao.MAU_THONG_BAO.loi.bieuTuong).toBe("#C0392B");
  });

  it("Màu thông báo thành công: chữ #587554, nền #EDF3EB", () => {
    expect(thongBao.MAU_THONG_BAO["thanh-cong"].chu).toBe("#587554");
    expect(thongBao.MAU_THONG_BAO["thanh-cong"].nen).toBe("#EDF3EB");
  });

  describe("So khớp từng ký tự các thông báo màn hình đã làm", () => {
    // Đăng nhập
    it("Đăng nhập: trống & sai", () => {
      expect(thongBao.DANG_NHAP_TRONG).toBe("Không được để trống");
      expect(thongBao.DANG_NHAP_SAI).toBe("Tên đăng nhập hoặc mật khẩu không đúng");
    });

    // UC 5.1 Thêm thông tin
    it("UC 5.1 Thêm: thành công, thiếu trường, trùng SĐT, trạng thái mặc định", () => {
      expect(thongBao.THEM_NV_THANH_CONG).toBe("Thêm thông tin nhân viên thành công");
      expect(thongBao.THEM_NV_THIEU_TRUONG).toBe("Vui lòng nhập đầy đủ thông tin");
      expect(thongBao.THEM_NV_TRUNG_SDT).toBe("Số điện thoại này đã tồn tại trên hệ thống");
      expect(thongBao.THEM_NV_TRANG_THAI_MAC_DINH).toBe("Thử việc");
    });

    // UC 5.2 Sửa thông tin
    it("UC 5.2 Sửa: thành công, thiếu trường, trùng SĐT", () => {
      expect(thongBao.SUA_NV_THANH_CONG).toBe("Sửa thông tin nhân viên thành công");
      expect(thongBao.SUA_NV_THIEU_TRUONG).toBe("Vui lòng nhập đầy đủ thông tin");
      expect(thongBao.SUA_NV_TRUNG_SDT).toBe("Số điện thoại này đã tồn tại trên hệ thống");
    });

    // UC 5.3 Xóa thông tin
    it("UC 5.3 Xóa: xác nhận, thành công, thất bại", () => {
      expect(thongBao.XOA_NV_XAC_NHAN).toBe("Xác nhận xóa thông tin nhân viên này?");
      expect(thongBao.XOA_NV_THANH_CONG).toBe("Xóa thông tin nhân viên thành công");
      expect(thongBao.XOA_NV_THAT_BAI).toBe("Xóa thất bại, đã có lỗi, vui lòng thử lại sau");
    });

    // UC 8.1 Cập nhật mức lương
    it("UC 8.1 Cập nhật mức lương", () => {
      expect(thongBao.CAP_NHAT_LUONG_THANH_CONG).toBe("Cập nhật mức lương thành công");
      expect(thongBao.CAP_NHAT_LUONG_KHONG_HOP_LE).toBe("Mức lương không hợp lệ");
      expect(thongBao.CAP_NHAT_LUONG_VUI_LONG_NHAP).toBe("Vui lòng nhập mức lương");
      expect(thongBao.CAP_NHAT_LUONG_THAT_BAI).toBe("Cập nhật mức lương thất bại");
    });

    // UC 2.1 Đăng ký lịch rảnh
    it("UC 2.1 Đăng ký lịch rảnh: thành công, chưa chọn ca", () => {
      expect(thongBao.DANG_KY_LICH_RANH_THANH_CONG).toBe("Đăng ký thành công");
      expect(thongBao.DANG_KY_LICH_RANH_CHUA_CHON).toBe("Chọn ít nhất một ca rảnh trong tuần");
    });

    // UC 2.2 Yêu cầu đổi ca
    it("UC 2.2 Yêu cầu đổi ca: thành công", () => {
      expect(thongBao.YEU_CAU_DOI_CA_THANH_CONG).toBe("Đã gửi thành công");
    });

    // UC 6.3 Xử lý đổi ca
    it("UC 6.3 Xử lý đổi ca: thành công", () => {
      expect(thongBao.XU_LY_DOI_CA_THANH_CONG).toBe("Xử lý đổi ca thành công");
    });

    // UC 6.1 Xếp lịch làm
    it("UC 6.1 Xếp lịch làm: thành công", () => {
      expect(thongBao.XEP_LICH_LAM_THANH_CONG).toBe("Đã lưu lịch thành công");
    });

    // UC 4.1 Xem bảng lương
    it("UC 4.1 Xem bảng lương: bảng lương chưa được tổng hợp", () => {
      expect(thongBao.BANG_LUONG_CHUA_TONG_HOP).toBe("Bảng lương chưa được tổng hợp");
    });

    // UC 4.2 Phản hồi sai sót lương
    it("UC 4.2 Phản hồi sai sót lương: quá hạn, trống nội dung, thành công", () => {
      expect(thongBao.PHAN_HOI_LUONG_HET_HAN).toBe("Đã hết thời gian phản hồi");
      expect(thongBao.PHAN_HOI_LUONG_THIEU_NOI_DUNG).toBe("Vui lòng nhập nội dung phản hồi");
      expect(thongBao.PHAN_HOI_LUONG_GUI_THANH_CONG).toBe("Gửi phản hồi thành công");
    });

    // UC 8.3 Chỉnh sửa sai sót bảng lương
    it("UC 8.3 Chỉnh sửa sai sót bảng lương: hộp thoại, thành công, không đổi, lỗi", () => {
      expect(thongBao.CHINH_SUA_LUONG_XAC_NHAN_TIEU_DE).toBe("Xác nhận chỉnh sửa bản lương");
      expect(thongBao.CHINH_SUA_LUONG_XAC_NHAN_NOI_DUNG).toBe(
        "Vui lòng kiểm tra lại nội dung trước khi xác nhận"
      );
      expect(thongBao.CHINH_SUA_LUONG_KHONG).toBe("Không");
      expect(thongBao.CHINH_SUA_LUONG_CO).toBe("Có");
      expect(thongBao.CHINH_SUA_LUONG_THANH_CONG).toBe("Tính lương thành công");
      expect(thongBao.CHINH_SUA_LUONG_KHONG_DOI).toBe("Ghi nhận không chỉnh sửa");
      expect(thongBao.CHINH_SUA_LUONG_KHONG_THAY_DOI).toBe("Bạn chưa thay đổi thông tin nào");
      expect(thongBao.CHINH_SUA_LUONG_THIEU_LY_DO).toBe("Vui lòng nhập lý do chỉnh sửa");
      expect(thongBao.CHINH_SUA_LUONG_THUONG_KHONG_HOP_LE).toBe("Số tiền thưởng không hợp lệ");
      expect(thongBao.CHINH_SUA_LUONG_THAT_BAI).toBe("Chỉnh sửa thất bại");
    });

    // UC 8.6 Chốt bảng lương
    it("UC 8.6 Chốt bảng lương: hộp thoại chặn và thành công", () => {
      expect(thongBao.CHOT_LUONG_CO_PHAN_HOI_TIEU_DE).toBe("Có phản hồi chưa xử lý");
      expect(thongBao.CHOT_LUONG_CO_PHAN_HOI_NOI_DUNG).toBe(
        "Vui lòng xử lý hết các phản hồi trước khi chốt bảng lương"
      );
      expect(thongBao.CHOT_LUONG_THANH_CONG).toBe("Chốt bảng lương thành công");
    });

    // UC 2.3 Thay ca gấp
    it("UC 2.3 Thay ca: lời mời, xác nhận, đã có người nhận, đã đồng ý, cảnh báo CQ", () => {
      expect(thongBao.THAY_CA_LOI_MOI_TIEU_DE).toBe(
        "Cần người thay ca gấp, bạn có chấp nhận thay ca hay không?"
      );
      expect(thongBao.THAY_CA_XAC_NHAN_THANH_CONG).toBe("Đã xác nhận thành công");
      expect(thongBao.THAY_CA_DA_CO_NGUOI_NHAN).toBe("Đã có người nhận thay ca");
      expect(thongBao.THAY_CA_DA_CO_NV_DONG_Y).toBe("Đã có nhân viên đồng ý");
      expect(thongBao.THAY_CA_CANH_BAO_SAT_GIO).toBe(
        "Cảnh báo thay ca gấp: Sát giờ làm (≤30 phút) vẫn chưa có nhân viên nhận thay ca"
      );
      expect(thongBao.THAY_CA_CANH_BAO_KHONG_NGUOI_RANH).toBe(
        "Cảnh báo thay ca gấp: Không có nhân viên có lịch rảnh phù hợp cho ca cần thay"
      );
    });
  });

  describe("Quét mã frontend không còn chuỗi sai lệch ngoài thong-bao.ts", () => {
    const FORBIDDEN_STRINGS = [
      "Chưa nhập đủ thông tin",
      "Thử việc · 3 ngày",
      "Số điện thoại bị trùng",
      "phản hồii",
      "Xác nhận chỉnh sửa bảng lương",
    ];

    function scanFiles(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results = results.concat(scanFiles(fullPath));
        } else if (file.endsWith(".tsx") || file.endsWith(".ts")) {
          results.push(fullPath);
        }
      }
      return results;
    }

    it("Không còn chuỗi thông báo cũ/sai lệch trong frontend/screens", () => {
      const files = scanFiles(FRONTEND_SCREENS_DIR);
      const violations: string[] = [];

      for (const f of files) {
        const content = fs.readFileSync(f, "utf-8");
        for (const bad of FORBIDDEN_STRINGS) {
          if (content.includes(bad)) {
            violations.push(`${path.relative(FRONTEND_SCREENS_DIR, f)}: chứa chuỗi bị cấm "${bad}"`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe("So khớp từng ký tự các UC còn lại (3.1, 3.2, 3.3/7.1, 7.2, 8.2, 8.4, 8.5)", () => {
    it("Check-in (UC_3.1) khớp từng ký tự với 08-THONG-BAO.md", () => {
      const md = fs.readFileSync(DOCS_THONG_BAO_PATH, "utf-8");
      const expected = [
        thongBao.CHECK_IN_THANH_CONG,
        thongBao.CHECK_IN_QUEN,
        thongBao.CHECK_IN_CHUA_DEN_GIO,
        thongBao.CHECK_IN_KHONG_CO_CA,
      ];
      expect(thongBao.CHECK_IN_THANH_CONG).toBe("Check-in thành công");
      expect(thongBao.CHECK_IN_QUEN).toBe("Bạn đã quên check-in");
      expect(thongBao.CHECK_IN_CHUA_DEN_GIO).toBe(
        "Chưa đến giờ vào ca, bạn chỉ được check-in trước giờ làm tối đa 5 phút"
      );
      expect(thongBao.CHECK_IN_KHONG_CO_CA).toBe("Hiện bạn không có ca làm để check-in");
      for (const s of expected) expect(md).toContain(s);
    });

    it("Check-out (UC_3.2) khớp từng ký tự với 08-THONG-BAO.md", () => {
      const md = fs.readFileSync(DOCS_THONG_BAO_PATH, "utf-8");
      expect(thongBao.CHECK_OUT_THANH_CONG).toBe("Check-out thành công");
      expect(thongBao.CHECK_OUT_QUEN).toBe("Bạn đã quên check-out");
      expect(thongBao.CHECK_OUT_HOI_TANG_CA).toBe("Bạn có muốn tăng ca không?");
      expect(md).toContain(thongBao.CHECK_OUT_THANH_CONG);
      expect(md).toContain(thongBao.CHECK_OUT_QUEN);
      expect(md).toContain(thongBao.CHECK_OUT_HOI_TANG_CA);
    });

    it("Bổ sung chấm công & Báo cáo chấm công (UC_3.3, 7.1, 7.2)", () => {
      const md = fs.readFileSync(DOCS_THONG_BAO_PATH, "utf-8");
      expect(thongBao.BO_SUNG_CC_THIEU_TRUONG).toBe("Vui lòng nhập đầy đủ");
      expect(thongBao.BO_SUNG_CC_GUI_THANH_CONG).toBe("Gửi yêu cầu thành công");
      expect(thongBao.BO_SUNG_CC_THANH_CONG).toBe("Bổ sung chấm công thành công");
      expect(thongBao.BAO_CAO_CHAM_CONG_TRONG).toBe("Không có dữ liệu");
      for (const s of [
        thongBao.BO_SUNG_CC_THIEU_TRUONG,
        thongBao.BO_SUNG_CC_GUI_THANH_CONG,
        thongBao.BO_SUNG_CC_THANH_CONG,
        thongBao.BAO_CAO_CHAM_CONG_TRONG,
      ]) {
        expect(md).toContain(s);
      }
    });

    it("Tính lương, Hệ số lương, Tiền thưởng (UC_8.2, 8.4, 8.5)", () => {
      const md = fs.readFileSync(DOCS_THONG_BAO_PATH, "utf-8");
      expect(thongBao.TINH_LUONG_THANH_CONG).toBe("Tính lương thành công");
      expect(thongBao.TINH_LUONG_THAT_BAI).toBe("Tính lương thất bại");
      expect(thongBao.GUI_BANG_LUONG_THANH_CONG).toBe("Gửi bảng lương dự kiến thành công");
      expect(thongBao.GUI_BANG_LUONG_TIEU_DE).toBe("Xác nhận gửi bảng lương dự kiến");
      expect(thongBao.GUI_BANG_LUONG_NOI_DUNG).toBe(
        "Nhân viên có thể phản hồi sai sót trước khi chốt lương, xác nhận gửi bảng lương dự kiến?"
      );
      expect(thongBao.GUI_BANG_LUONG_KHONG).toBe("Không");
      expect(thongBao.GUI_BANG_LUONG_CO).toBe("Có");
      expect(thongBao.HE_SO_LUONG_LOI).toBe("Hệ số lỗi, vui lòng nhập lại");
      expect(thongBao.HE_SO_LUONG_THOI_GIAN_SAI).toBe("Thời gian áp dụng không hợp lệ");
      expect(thongBao.HE_SO_LUONG_DA_XOA).toBe("Đã xóa khoảng áp dụng");
      expect(thongBao.HE_SO_LUONG_THANH_CONG).toBe("Đã lưu thành công");
      expect(thongBao.TIEN_THUONG_CHUA_LUU).toBe("Chưa lưu thay đổi");
      expect(thongBao.TIEN_THUONG_THANH_CONG).toBe("Lưu tiền thưởng thành công");
      expect(thongBao.NHAP_TIEN_THUONG_THANH_CONG).toBe("Nhập tiền thưởng thành công");
      expect(thongBao.TIEN_THUONG_KHONG_HOP_LE).toBe("Số tiền không hợp lệ");
      expect(thongBao.TIEN_THUONG_THIEU_LY_DO).toBe("Lý do thưởng không được để trống");
      for (const [k, v] of Object.entries(thongBao)) {
        if (typeof v === "string" && k === k.toUpperCase()) {
          expect(md, `${k} không có trong 08-THONG-BAO.md`).toContain(v);
        }
      }
    });
  });
});
