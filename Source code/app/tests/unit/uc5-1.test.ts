import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { signSession, AUTH_COOKIE_NAME, UserPayload } from "@backend/lib/auth";
import { POST as handleCreateNhanVien } from "@/app/api/chu-quan/nhan-vien/route";
import { prisma } from "@database/client";
import { decrypt } from "@backend/lib/crypto";
import { THEM_NV_TRUNG_SDT } from "@frontend/config/thong-bao";

describe("UC 5.1: Thêm thông tin nhân viên (tests/unit/uc5-1.test.ts)", () => {
  let chuQuanToken: string;
  let nhanVienToken: string;
  const createdManvs: string[] = [];

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
  });

  afterAll(async () => {
    // Dọn dẹp các nhân viên test đã tạo
    if (createdManvs.length > 0) {
      await prisma.nhanVien.deleteMany({
        where: { Manv: { in: createdManvs } },
      });
    }
    // Dọn dẹp SĐT test nếu có
    await prisma.nhanVien.deleteMany({
      where: { Sdt: { in: ["0912345678", "0988888888", "0999999999", "0977777771", "0977777772"] } },
    });
  });

  it("401 Unauthorized khi chưa đăng nhập", async () => {
    const req = new Request("http://localhost:3000/api/chu-quan/nhan-vien", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Hoten: "Nguyễn Văn Test",
      }),
    });
    const res = await handleCreateNhanVien(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("403 Forbidden khi nhân viên cố thêm nhân viên", async () => {
    const req = new Request("http://localhost:3000/api/chu-quan/nhan-vien", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}`,
      },
      body: JSON.stringify({
        Hoten: "Nguyễn Văn Test",
      }),
    });
    const res = await handleCreateNhanVien(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("FORBIDDEN");
  });

  it("thiếu trường bắt buộc trả về lỗi 'Vui lòng nhập đầy đủ thông tin'", async () => {
    const req = new Request("http://localhost:3000/api/chu-quan/nhan-vien", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
      },
      body: JSON.stringify({
        Hoten: "Nguyễn Văn Test",
        // Thiếu Sdt, Diachi, Vitrilamviec, Hinhthuclam, Ngayvaolam, Kinhnghiem
      }),
    });
    const res = await handleCreateNhanVien(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.message).toContain("Vui lòng nhập đầy đủ thông tin");
  });

  it("số điện thoại bị trùng trả về lỗi 'Số điện thoại bị trùng'", async () => {
    // SĐT 0905000001 đã có trong seed
    const req = new Request("http://localhost:3000/api/chu-quan/nhan-vien", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
      },
      body: JSON.stringify({
        Hoten: "Nguyễn Văn Test",
        Sdt: "0905000001", // Trùng NV000001
        Diachi: "71 Ngũ Hành Sơn, TP Đà Nẵng",
        Vitrilamviec: "Phục vụ",
        Hinhthuclam: "Part-time",
        Ngayvaolam: "2026-11-02",
        Kinhnghiem: "Chưa có kinh nghiệm",
      }),
    });
    const res = await handleCreateNhanVien(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.message).toBe(THEM_NV_TRUNG_SDT);
  });

  it("thêm thành công Phục vụ: Manv dạng NVxxxxxx, Tendangnhap=Manv, Trangthai='Thử việc', lương mặc định 17000", async () => {
    await prisma.nhanVien.deleteMany({ where: { Sdt: "0988888888" } });

    const req = new Request("http://localhost:3000/api/chu-quan/nhan-vien", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
      },
      body: JSON.stringify({
        Hoten: "Nguyễn Văn Phục Vụ",
        Sdt: "0988888888",
        Diachi: "123 Hải Châu, Đà Nẵng",
        Truonghoc: "Đại học Kinh Tế",
        Vitrilamviec: "Phục vụ",
        Hinhthuclam: "Part-time",
        Ngayvaolam: "2026-11-02",
        Kinhnghiem: "Chưa có kinh nghiệm",
      }),
    });

    const res = await handleCreateNhanVien(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);

    const nv = json.data;
    createdManvs.push(nv.Manv);

    expect(nv.Manv).toMatch(/^NV\d{6}$/);
    expect(nv.Tendangnhap).toBe(nv.Manv);
    expect(nv.Trangthai).toBe("Thử việc");
    expect(nv.Mucluongtheogio).toBe(17000);
    expect(nv.Hoten).toBe("Nguyễn Văn Phục Vụ");
    expect(nv.Sdt).toBe("0988888888");

    // Kiểm tra trong DB: mật khẩu đã được mã hóa
    const dbRecord = await prisma.nhanVien.findUnique({ where: { Manv: nv.Manv } });
    expect(dbRecord).not.toBeNull();
    expect(dbRecord!.Matkhau).not.toBe("123456");
    expect(decrypt(dbRecord!.Matkhau)).toBe("123456");
  });

  it("thêm thành công Pha chế: lương mặc định 20000", async () => {
    await prisma.nhanVien.deleteMany({ where: { Sdt: "0999999999" } });

    const req = new Request("http://localhost:3000/api/chu-quan/nhan-vien", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
      },
      body: JSON.stringify({
        Hoten: "Trần Văn Pha Chế",
        Sdt: "0999999999",
        Diachi: "456 Thanh Khê, Đà Nẵng",
        Vitrilamviec: "Pha chế",
        Hinhthuclam: "Full-time",
        Ngayvaolam: "2026-11-02",
        Kinhnghiem: "1 năm pha chế",
      }),
    });

    const res = await handleCreateNhanVien(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);

    const nv = json.data;
    createdManvs.push(nv.Manv);

    expect(nv.Manv).toMatch(/^NV\d{6}$/);
    expect(nv.Tendangnhap).toBe(nv.Manv);
    expect(nv.Mucluongtheogio).toBe(20000);
  });

  it("gửi kèm mức lương khác (99000 hoặc 20000) cho Phục vụ -> máy chủ bỏ qua và vẫn lưu 17000", async () => {
    await prisma.nhanVien.deleteMany({ where: { Sdt: "0977777771" } });

    const req = new Request("http://localhost:3000/api/chu-quan/nhan-vien", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
      },
      body: JSON.stringify({
        Hoten: "Lê Văn Giả Mạo Lương 1",
        Sdt: "0977777771",
        Diachi: "100 Lê Duẩn, Đà Nẵng",
        Vitrilamviec: "Phục vụ",
        Hinhthuclam: "Part-time",
        Ngayvaolam: "2026-11-02",
        Kinhnghiem: "Chưa có",
        Mucluongtheogio: 99000,
      }),
    });

    const res = await handleCreateNhanVien(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);

    const nv = json.data;
    createdManvs.push(nv.Manv);
    expect(nv.Mucluongtheogio).toBe(17000);

    const dbRecord = await prisma.nhanVien.findUnique({ where: { Manv: nv.Manv } });
    expect(dbRecord?.Mucluongtheogio).toBe(17000);
  });

  it("gửi kèm mức lương khác (17000) cho Pha chế -> máy chủ bỏ qua và vẫn lưu 20000", async () => {
    await prisma.nhanVien.deleteMany({ where: { Sdt: "0977777772" } });

    const req = new Request("http://localhost:3000/api/chu-quan/nhan-vien", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
      },
      body: JSON.stringify({
        Hoten: "Lê Văn Giả Mạo Lương 2",
        Sdt: "0977777772",
        Diachi: "200 Nguyễn Văn Linh, Đà Nẵng",
        Vitrilamviec: "Pha chế",
        Hinhthuclam: "Full-time",
        Ngayvaolam: "2026-11-02",
        Kinhnghiem: "2 năm",
        Mucluongtheogio: 17000,
      }),
    });

    const res = await handleCreateNhanVien(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);

    const nv = json.data;
    createdManvs.push(nv.Manv);
    expect(nv.Mucluongtheogio).toBe(20000);

    const dbRecord = await prisma.nhanVien.findUnique({ where: { Manv: nv.Manv } });
    expect(dbRecord?.Mucluongtheogio).toBe(20000);
  });

  it("BUG-05: từ chối Ngayvaolam không có thật trên lịch (2026-02-30, 31/04/2026, 2026-02-29) với 400", async () => {
    for (const badDate of ["2026-02-30", "31/04/2026", "2026-02-29", "2026-04-31"]) {
      const req = new Request("http://localhost:3000/api/chu-quan/nhan-vien", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
        },
        body: JSON.stringify({
          Hoten: "Test Ngày Lịch",
          Sdt: "0977777799",
          Diachi: "200 Nguyễn Văn Linh, Đà Nẵng",
          Vitrilamviec: "Phục vụ",
          Hinhthuclam: "Full-time",
          Ngayvaolam: badDate,
          Kinhnghiem: "1 năm",
        }),
      });
      const res = await handleCreateNhanVien(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
    }
  });
});
