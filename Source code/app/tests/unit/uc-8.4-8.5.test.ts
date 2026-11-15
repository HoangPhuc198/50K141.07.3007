import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { signSession, AUTH_COOKIE_NAME, UserPayload } from "@backend/lib/auth";
import { prisma } from "@database/client";
import { GET as handleGetHeSo, POST as handlePostHeSo, DELETE as handleDeleteHeSo } from "@/app/api/he-so/route";
import { DELETE as handleDeleteHeSoById } from "@/app/api/he-so/[id]/route";
import { GET as handleGetTienThuong, POST as handlePostTienThuong } from "@/app/api/tien-thuong/route";
import { PUT as handlePutBangLuongThuong } from "@/app/api/bang-luong/[id]/thuong/route";
import * as thongBao from "@frontend/config/thong-bao";
import { formatDateVN, nowVN } from "@backend/lib/time";

describe("UC_8.4 Nhập hệ số lương & UC_8.5 Nhập tiền thưởng", () => {
  let chuQuanToken: string;
  let nhanVienToken: string;

  let createdMaHeSo: string | null = null;
  let testMakyluongChuaChot: string = "KL209911";
  let testMakyluongDaChot: string = "KL209910";
  let testManv: string = "NV000001";
  let createdMaBangLuong: string | null = null;

  beforeAll(async () => {
    process.env.JWT_SECRET = "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";

    chuQuanToken = await signSession({
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Hoàng Lan",
    });

    nhanVienToken = await signSession({
      userId: "NV000001",
      username: "NV000001",
      role: "NhanVien",
      name: "Nguyễn Minh Anh",
    });

    // Tạo kỳ lương test chưa chốt và đã chốt
    await prisma.kyLuong.upsert({
      where: { Makyluong: testMakyluongChuaChot },
      update: { Trangthai: "Dự kiến", Ngaychot: null },
      create: {
        Makyluong: testMakyluongChuaChot,
        Thang: 11,
        Nam: 2099,
        Trangthai: "Dự kiến",
      },
    });

    await prisma.kyLuong.upsert({
      where: { Makyluong: testMakyluongDaChot },
      update: { Trangthai: "Đã chốt", Ngaychot: new Date("2099-11-02") },
      create: {
        Makyluong: testMakyluongDaChot,
        Thang: 10,
        Nam: 2099,
        Trangthai: "Đã chốt",
        Ngaychot: new Date("2099-11-02"),
      },
    });
  });

  afterAll(async () => {
    // Dọn dẹp dữ liệu test
    if (createdMaHeSo) {
      await prisma.heSoLuong.deleteMany({ where: { Maheso: createdMaHeSo } });
    }
    await prisma.bangLuong.deleteMany({
      where: { Makyluong: { in: [testMakyluongChuaChot, testMakyluongDaChot] } },
    });
    await prisma.kyLuong.deleteMany({
      where: { Makyluong: { in: [testMakyluongChuaChot, testMakyluongDaChot] } },
    });
  });

  // ========================================================
  // 1. KIỂM TRA THÔNG BÁO TỪNG KÝ TỰ (RULES.md & 08-THONG-BAO.md)
  // ========================================================
  describe("Thông báo chuẩn nguyên văn", () => {
    it("UC 8.4: Thông báo hệ số lương", () => {
      expect(thongBao.HE_SO_LUONG_LOI).toBe("Hệ số lỗi, vui lòng nhập lại");
      expect(thongBao.HE_SO_LUONG_THOI_GIAN_SAI).toBe("Thời gian áp dụng không hợp lệ");
      expect(thongBao.HE_SO_LUONG_DA_XOA).toBe("Đã xóa khoảng áp dụng");
      expect(thongBao.HE_SO_LUONG_THANH_CONG).toBe("Đã lưu thành công");
    });

    it("UC 8.5: Thông báo tiền thưởng", () => {
      expect(thongBao.TIEN_THUONG_CHUA_LUU).toBe("Chưa lưu thay đổi");
      expect(thongBao.TIEN_THUONG_THANH_CONG).toBe("Lưu tiền thưởng thành công");
      expect(thongBao.NHAP_TIEN_THUONG_THANH_CONG).toBe("Nhập tiền thưởng thành công");
      expect(thongBao.TIEN_THUONG_KHONG_HOP_LE).toBe("Số tiền không hợp lệ");
      expect(thongBao.TIEN_THUONG_THIEU_LY_DO).toBe("Lý do thưởng không được để trống");
    });
  });

  // ========================================================
  // 2. UC 8.4: NHẬP HỆ SỐ LƯƠNG
  // ========================================================
  describe("UC 8.4: GET/POST/DELETE /api/he-so", () => {
    it("Chưa đăng nhập -> 401", async () => {
      const reqGet = new Request("http://localhost:3000/api/he-so", { method: "GET" });
      const resGet = await handleGetHeSo(reqGet, { params: Promise.resolve({}) });
      expect(resGet.status).toBe(401);

      const reqPost = new Request("http://localhost:3000/api/he-so", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Ngaybatdau: "2099-12-24", Ngayketthuc: "2099-12-25", Heso: 2 }),
      });
      const resPost = await handlePostHeSo(reqPost, { params: Promise.resolve({}) });
      expect(resPost.status).toBe(401);

      const reqDel = new Request("http://localhost:3000/api/he-so?id=HS000001", { method: "DELETE" });
      const resDel = await handleDeleteHeSo(reqDel, { params: Promise.resolve({}) });
      expect(resDel.status).toBe(401);
    });

    it("Nhân viên truy cập -> 403", async () => {
      const headers = { cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}` };
      const reqGet = new Request("http://localhost:3000/api/he-so", { method: "GET", headers });
      const resGet = await handleGetHeSo(reqGet, { params: Promise.resolve({}) });
      expect(resGet.status).toBe(403);

      const reqPost = new Request("http://localhost:3000/api/he-so", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ Ngaybatdau: "2099-12-24", Ngayketthuc: "2099-12-25", Heso: 2 }),
      });
      const resPost = await handlePostHeSo(reqPost, { params: Promise.resolve({}) });
      expect(resPost.status).toBe(403);
    });

    it("Lỗi khi hệ số < 1 -> 400 'Hệ số lỗi, vui lòng nhập lại'", async () => {
      const req = new Request("http://localhost:3000/api/he-so", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Ngaybatdau: "2099-12-24",
          Ngayketthuc: "2099-12-25",
          Heso: 0.5,
        }),
      });
      const res = await handlePostHeSo(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error.message).toBe("Hệ số lỗi, vui lòng nhập lại");
    });

    it("Lỗi khi ngày kết thúc < ngày bắt đầu -> 400 'Thời gian áp dụng không hợp lệ'", async () => {
      const req = new Request("http://localhost:3000/api/he-so", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Ngaybatdau: "2099-12-25",
          Ngayketthuc: "2099-12-24",
          Heso: 2,
        }),
      });
      const res = await handlePostHeSo(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error.message).toBe("Thời gian áp dụng không hợp lệ");
    });

    it("Lỗi khi ngày bắt đầu <= hôm nay -> 400 'Thời gian áp dụng không hợp lệ'", async () => {
      const todayStr = formatDateVN(nowVN());
      const req = new Request("http://localhost:3000/api/he-so", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Ngaybatdau: todayStr,
          Ngayketthuc: todayStr,
          Heso: 2,
        }),
      });
      const res = await handlePostHeSo(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error.message).toBe("Thời gian áp dụng không hợp lệ");
    });

    it("Lưu khoảng hệ số hợp lệ -> Thành công 200, mã HSxxxxxx", async () => {
      const req = new Request("http://localhost:3000/api/he-so", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Ngaybatdau: "2099-12-24",
          Ngayketthuc: "2099-12-25",
          Heso: 2,
        }),
      });
      const res = await handlePostHeSo(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.Maheso).toMatch(/^HS\d{6}$/);
      expect(json.data.Ngaybatdau).toBe("2099-12-24");
      expect(json.data.Ngayketthuc).toBe("2099-12-25");
      expect(json.data.Heso).toBe(2);

      createdMaHeSo = json.data.Maheso;
    });

    it("GET /api/he-so đọc lại danh sách có khoảng vừa lưu (test khứ hồi)", async () => {
      const req = new Request("http://localhost:3000/api/he-so", {
        method: "GET",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
        },
      });
      const res = await handleGetHeSo(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      const found = json.data.find((item: any) => item.Maheso === createdMaHeSo);
      expect(found).toBeDefined();
      expect(found.Ngaybatdau).toBe("2099-12-24");
      expect(found.Ngayketthuc).toBe("2099-12-25");
      expect(found.Heso).toBe(2);
    });

    it("Sửa khoảng hệ số -> Cập nhật thành công", async () => {
      const req = new Request("http://localhost:3000/api/he-so", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Maheso: createdMaHeSo,
          Ngaybatdau: "2099-12-24",
          Ngayketthuc: "2099-12-26",
          Heso: 2.5,
        }),
      });
      const res = await handlePostHeSo(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.Heso).toBe(2.5);
      expect(json.data.Ngayketthuc).toBe("2099-12-26");
    });

    it("DELETE /api/he-so xóa khoảng hệ số -> Thành công, 'Đã xóa khoảng áp dụng'", async () => {
      const req = new Request(`http://localhost:3000/api/he-so?id=${createdMaHeSo}`, {
        method: "DELETE",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
        },
      });
      const res = await handleDeleteHeSo(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.message).toBe("Đã xóa khoảng áp dụng");

      // Kiểm tra DB không còn
      const inDb = await prisma.heSoLuong.findUnique({ where: { Maheso: createdMaHeSo! } });
      expect(inDb).toBeNull();
      createdMaHeSo = null;
    });
  });

  // ========================================================
  // 3. UC 8.5: NHẬP TIỀN THƯỞNG
  // ========================================================
  describe("UC 8.5: GET/POST /api/tien-thuong & PUT /api/bang-luong/:id/thuong", () => {
    it("Chưa đăng nhập -> 401", async () => {
      const reqGet = new Request("http://localhost:3000/api/tien-thuong", { method: "GET" });
      const resGet = await handleGetTienThuong(reqGet, { params: Promise.resolve({}) });
      expect(resGet.status).toBe(401);

      const reqPost = new Request("http://localhost:3000/api/tien-thuong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Makyluong: testMakyluongChuaChot, Manv: testManv, Tienthuong: 100000, Lydothuong: "Thưởng tết" }),
      });
      const resPost = await handlePostTienThuong(reqPost, { params: Promise.resolve({}) });
      expect(resPost.status).toBe(401);
    });

    it("Nhân viên truy cập -> 403", async () => {
      const headers = { cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}` };
      const reqGet = new Request("http://localhost:3000/api/tien-thuong", { method: "GET", headers });
      const resGet = await handleGetTienThuong(reqGet, { params: Promise.resolve({}) });
      expect(resGet.status).toBe(403);

      const reqPost = new Request("http://localhost:3000/api/tien-thuong", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ Makyluong: testMakyluongChuaChot, Manv: testManv, Tienthuong: 100000, Lydothuong: "Thưởng tết" }),
      });
      const resPost = await handlePostTienThuong(reqPost, { params: Promise.resolve({}) });
      expect(resPost.status).toBe(403);
    });

    it("GET /api/tien-thuong trả về kỳ lương và danh sách nhân viên", async () => {
      const req = new Request(`http://localhost:3000/api/tien-thuong?makyluong=${testMakyluongChuaChot}`, {
        method: "GET",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
        },
      });
      const res = await handleGetTienThuong(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.kyLuongHienTai.Makyluong).toBe(testMakyluongChuaChot);
      expect(Array.isArray(json.data.danhSachNhanVien)).toBe(true);
      expect(json.data.danhSachNhanVien.length).toBeGreaterThan(0);

      const nv1 = json.data.danhSachNhanVien.find((nv: any) => nv.Manv === testManv);
      expect(nv1).toBeDefined();
      expect(nv1.Tienthuong).toBe(0);
    });

    it("Lỗi khi số tiền không phải số nguyên hoặc âm -> 400 'Số tiền không hợp lệ'", async () => {
      const req = new Request("http://localhost:3000/api/tien-thuong", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Makyluong: testMakyluongChuaChot,
          Manv: testManv,
          Tienthuong: -50000,
          Lydothuong: "Lý do",
        }),
      });
      const res = await handlePostTienThuong(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error.message).toBe("Số tiền không hợp lệ");
    });

    it("Lỗi khi số tiền là số thập phân -> 400 'Số tiền không hợp lệ'", async () => {
      const req = new Request("http://localhost:3000/api/tien-thuong", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Makyluong: testMakyluongChuaChot,
          Manv: testManv,
          Tienthuong: 100.5,
          Lydothuong: "Lý do",
        }),
      });
      const res = await handlePostTienThuong(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error.message).toBe("Số tiền không hợp lệ");
    });

    it("Lỗi khi lý do thưởng để trống -> 400 'Lý do thưởng không được để trống'", async () => {
      const req = new Request("http://localhost:3000/api/tien-thuong", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Makyluong: testMakyluongChuaChot,
          Manv: testManv,
          Tienthuong: 100000,
          Lydothuong: "   ",
        }),
      });
      const res = await handlePostTienThuong(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error.message).toBe("Lý do thưởng không được để trống");
    });

    it("Từ chối khi kỳ lương ĐÃ CHỐT -> 400 'Kỳ lương đã chốt, không thể chỉnh sửa'", async () => {
      const req = new Request("http://localhost:3000/api/tien-thuong", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Makyluong: testMakyluongDaChot,
          Manv: testManv,
          Tienthuong: 200000,
          Lydothuong: "Thưởng sinh nhật",
        }),
      });
      const res = await handlePostTienThuong(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error.message).toBe("Kỳ lương đã chốt, không thể chỉnh sửa");
    });

    it("Lưu tiền thưởng khi BangLuong chưa có -> Tạo mới BangLuong dạng BLxxxxxx nhất quán với P11A", async () => {
      const req = new Request("http://localhost:3000/api/tien-thuong", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Makyluong: testMakyluongChuaChot,
          Manv: testManv,
          Tienthuong: 100000,
          Lydothuong: "Sinh nhật nhân viên",
        }),
      });
      const res = await handlePostTienThuong(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.Mabangluong).toMatch(/^BL\d{6}$/);
      expect(json.data.Tienthuong).toBe(100000);
      expect(json.data.Lydothuong).toBe("Sinh nhật nhân viên");
      expect(json.data.message).toBe(thongBao.TIEN_THUONG_THANH_CONG);

      createdMaBangLuong = json.data.Mabangluong;
    });

    it("Khứ hồi: GET /api/tien-thuong đọc lại thấy tiền thưởng và lý do đã lưu", async () => {
      const req = new Request(`http://localhost:3000/api/tien-thuong?makyluong=${testMakyluongChuaChot}`, {
        method: "GET",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
        },
      });
      const res = await handleGetTienThuong(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      const nv1 = json.data.danhSachNhanVien.find((nv: any) => nv.Manv === testManv);
      expect(nv1).toBeDefined();
      expect(nv1.Tienthuong).toBe(100000);
      expect(nv1.Lydothuong).toBe("Sinh nhật nhân viên");
      expect(nv1.Mabangluong).toBe(createdMaBangLuong);
    });

    it("PUT /api/bang-luong/:id/thuong cập nhật tiền thưởng theo mã bảng lương", async () => {
      const req = new Request(`http://localhost:3000/api/bang-luong/${createdMaBangLuong}/thuong`, {
        method: "PUT",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Tienthuong: 150000,
          Lydothuong: "Thưởng thành tích xuất sắc",
        }),
      });
      const res = await handlePutBangLuongThuong(req, {
        params: Promise.resolve({ id: createdMaBangLuong! }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.Tienthuong).toBe(150000);
      expect(json.data.Lydothuong).toBe("Thưởng thành tích xuất sắc");
      expect(json.data.message).toBe(thongBao.TIEN_THUONG_THANH_CONG);

      // BUG-01 trên PUT /api/bang-luong/:id/thuong: từ chối số thập phân
      const badReq = new Request(`http://localhost:3000/api/bang-luong/${createdMaBangLuong}/thuong`, {
        method: "PUT",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Tienthuong: "100.5",
          Lydothuong: "Kiểm tra số thập phân",
        }),
      });
      const badRes = await handlePutBangLuongThuong(badReq, {
        params: Promise.resolve({ id: createdMaBangLuong! }),
      });
      expect(badRes.status).toBe(400);
    });

    it("BUG-01 & BUG-05: từ chối Tienthuong thập phân ('100000.5', '100.5'), Heso lẫn chữ ('2abc') và ngày 2099-02-30", async () => {
      for (const badTien of ["100000.5", "100.5"]) {
        const req = new Request("http://localhost:3000/api/tien-thuong", {
          method: "POST",
          headers: {
            cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            Makyluong: testMakyluongChuaChot,
            Manv: testManv,
            Tienthuong: badTien,
            Lydothuong: "Kiểm tra số thập phân",
          }),
        });
        const res = await handlePostTienThuong(req, { params: Promise.resolve({}) });
        expect(res.status).toBe(400);
      }

      const reqBadHeSo = new Request("http://localhost:3000/api/he-so", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Ngaybatdau: "2099-12-24",
          Ngayketthuc: "2099-12-25",
          Heso: "2abc",
        }),
      });
      expect((await handlePostHeSo(reqBadHeSo, { params: Promise.resolve({}) })).status).toBe(400);

      const reqBadDate = new Request("http://localhost:3000/api/he-so", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Ngaybatdau: "2099-02-30",
          Ngayketthuc: "2099-03-01",
          Heso: 2,
        }),
      });
      expect((await handlePostHeSo(reqBadDate, { params: Promise.resolve({}) })).status).toBe(400);
    });
  });
});
