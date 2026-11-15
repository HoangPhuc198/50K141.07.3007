import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { signSession, AUTH_COOKIE_NAME, UserPayload } from "@backend/lib/auth";
import { GET as handleGetNhanVien, PUT as handleUpdateNhanVien } from "@/app/api/chu-quan/nhan-vien/[id]/route";
import { prisma } from "@database/client";
import { decrypt, encrypt } from "@backend/lib/crypto";
import { SUA_NV_TRUNG_SDT } from "@frontend/config/thong-bao";

describe("UC 5.2: Sửa thông tin nhân viên (tests/unit/uc5-2.test.ts)", () => {
  let chuQuanToken: string;
  let nhanVienToken: string;
  const testManv = "NV000003"; // Lê Quốc Bảo từ seed

  beforeAll(async () => {
    process.env.JWT_SECRET = "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";
    process.env.DEFAULT_PASSWORD = "123456";

    const chuQuanPayload: UserPayload = {
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Thanh Hà",
    };

    const nhanVienPayload: UserPayload = {
      userId: "NV000001",
      username: "NV000001",
      role: "NhanVien",
      name: "Nguyễn Minh Anh",
    };

    chuQuanToken = await signSession(chuQuanPayload);
    nhanVienToken = await signSession(nhanVienPayload);

    // Đảm bảo NV000003 có mật khẩu mã hóa hợp lệ
    await prisma.nhanVien.update({
      where: { Manv: testManv },
      data: {
        Matkhau: encrypt("Password123"),
      },
    });
  });

  afterAll(async () => {
    // Khôi phục NV000003 về trạng thái ban đầu
    await prisma.nhanVien.update({
      where: { Manv: testManv },
      data: {
        Hoten: "Lê Quốc Bảo",
        Sdt: "0905000003",
        Diachi: "8 Ông Ích Khiêm, Hải Châu, Đà Nẵng",
        Truonghoc: "Đại học Bách khoa - ĐHĐN",
        Vitrilamviec: "Phục vụ",
        Hinhthuclam: "Part-time",
        Ngayvaolam: new Date("2024-09-01"),
        Kinhnghiem: "1 năm phục vụ",
        Trangthai: "Chính thức",
        Mucluongtheogio: 19000,
        Matkhau: encrypt("123456"),
      },
    });
  });

  it("401 Unauthorized khi chưa đăng nhập", async () => {
    const req = new Request(`http://localhost:3000/api/chu-quan/nhan-vien/${testManv}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Hoten: "Lê Quốc Bảo Sửa" }),
    });
    const res = await handleUpdateNhanVien(req, { params: Promise.resolve({ id: testManv }) });
    expect(res.status).toBe(401);
  });

  it("403 Forbidden khi nhân viên cố sửa", async () => {
    const req = new Request(`http://localhost:3000/api/chu-quan/nhan-vien/${testManv}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}`,
      },
      body: JSON.stringify({ Hoten: "Lê Quốc Bảo Sửa" }),
    });
    const res = await handleUpdateNhanVien(req, { params: Promise.resolve({ id: testManv }) });
    expect(res.status).toBe(403);
  });

  it("GET chi tiết: hiện mật khẩu giải mã cho CQ", async () => {
    const req = new Request(`http://localhost:3000/api/chu-quan/nhan-vien/${testManv}`, {
      method: "GET",
      headers: {
        cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
      },
    });
    const res = await handleGetNhanVien(req, { params: Promise.resolve({ id: testManv }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.matKhauGiaiMa).toBe("Password123");
  });

  it("thiếu trường bắt buộc trả về lỗi 'Vui lòng nhập đầy đủ thông tin'", async () => {
    const req = new Request(`http://localhost:3000/api/chu-quan/nhan-vien/${testManv}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
      },
      body: JSON.stringify({
        Hoten: "Lê Quốc Bảo Mới",
        // Thiếu Sdt, Diachi, Vitrilamviec, Hinhthuclam, Ngayvaolam, Kinhnghiem
      }),
    });
    const res = await handleUpdateNhanVien(req, { params: Promise.resolve({ id: testManv }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.message).toContain("Vui lòng nhập đầy đủ thông tin");
  });

  it("số điện thoại bị trùng với nhân viên khác trả về lỗi 'Số điện thoại bị trùng'", async () => {
    // SĐT 0905000001 là của NV000001
    const req = new Request(`http://localhost:3000/api/chu-quan/nhan-vien/${testManv}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
      },
      body: JSON.stringify({
        Hoten: "Lê Quốc Bảo",
        Sdt: "0905000001", // Trùng NV000001
        Diachi: "8 Ông Ích Khiêm, Hải Châu, Đà Nẵng",
        Vitrilamviec: "Phục vụ",
        Hinhthuclam: "Part-time",
        Ngayvaolam: "2024-09-01",
        Kinhnghiem: "1 năm phục vụ",
      }),
    });
    const res = await handleUpdateNhanVien(req, { params: Promise.resolve({ id: testManv }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.message).toBe(SUA_NV_TRUNG_SDT);
  });

  it("sửa thành công: giữ nguyên mức lương (KHÔNG sửa mức lương), đổi thông tin khác", async () => {
    const originalLuong = 19000;

    const req = new Request(`http://localhost:3000/api/chu-quan/nhan-vien/${testManv}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
      },
      body: JSON.stringify({
        Hoten: "Lê Quốc Bảo Cập Nhật",
        Sdt: "0905000003", // giữ SĐT cũ của chính mình
        Diachi: "99 Núi Thành, Đà Nẵng",
        Truonghoc: "ĐH Kinh Tế",
        Vitrilamviec: "Pha chế",
        Hinhthuclam: "Full-time",
        Ngayvaolam: "2024-09-01",
        Kinhnghiem: "2 năm pha chế",
        Trangthai: "Chính thức",
        Mucluongtheogio: 99999, // Thử gửi mức lương khác lên -> không được sửa
        Matkhau: "NewSecret456",
      }),
    });

    const res = await handleUpdateNhanVien(req, { params: Promise.resolve({ id: testManv }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    const updated = json.data;
    expect(updated.Hoten).toBe("Lê Quốc Bảo Cập Nhật");
    expect(updated.Diachi).toBe("99 Núi Thành, Đà Nẵng");
    expect(updated.Vitrilamviec).toBe("Pha chế");
    expect(updated.Mucluongtheogio).toBe(originalLuong); // Giữ nguyên 19000, KHÔNG đổi thành 99999
    expect(updated.matKhauGiaiMa).toBe("NewSecret456");

    // Kiểm tra trong DB
    const inDb = await prisma.nhanVien.findUnique({ where: { Manv: testManv } });
    expect(inDb!.Mucluongtheogio).toBe(originalLuong);
    expect(decrypt(inDb!.Matkhau)).toBe("NewSecret456");
  });

  it("BUG-05: từ chối Ngayvaolam không có thật trên lịch (2026-02-30, 31/04/2026) với 400 khi sửa", async () => {
    for (const badDate of ["2026-02-30", "31/04/2026", "2026-02-29"]) {
      const req = new Request(`http://localhost:3000/api/chu-quan/nhan-vien/${testManv}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
        },
        body: JSON.stringify({
          Hoten: "Lê Quốc Bảo",
          Sdt: "0905000003",
          Diachi: "99 Núi Thành, Đà Nẵng",
          Vitrilamviec: "Pha chế",
          Hinhthuclam: "Full-time",
          Ngayvaolam: badDate,
          Kinhnghiem: "2 năm pha chế",
          Trangthai: "Chính thức",
        }),
      });
      const res = await handleUpdateNhanVien(req, { params: Promise.resolve({ id: testManv }) });
      expect(res.status).toBe(400);
    }
  });
});
