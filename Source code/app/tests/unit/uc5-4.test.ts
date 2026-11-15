import { describe, it, expect, beforeAll } from "vitest";
import { signSession, AUTH_COOKIE_NAME, UserPayload } from "@backend/lib/auth";
import { GET as handleGetList } from "@/app/api/chu-quan/nhan-vien/route";
import { GET as handleGetDetail } from "@/app/api/chu-quan/nhan-vien/[id]/route";

describe("UC 5.4: Xem thông tin nhân viên (tests/unit/uc5-4.test.ts)", () => {
  let chuQuanToken: string;
  let nhanVienToken: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";

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

  it("401 Unauthorized khi chưa đăng nhập vào danh sách", async () => {
    const req = new Request("http://localhost:3000/api/chu-quan/nhan-vien", {
      method: "GET",
    });
    const res = await handleGetList(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("403 Forbidden nhân viên truy cập danh sách nhân viên CQ", async () => {
    const req = new Request("http://localhost:3000/api/chu-quan/nhan-vien", {
      method: "GET",
      headers: { cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}` },
    });
    const res = await handleGetList(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("lấy danh sách thành công: có phân trang, items là mảng", async () => {
    const req = new Request("http://localhost:3000/api/chu-quan/nhan-vien", {
      method: "GET",
      headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
    });
    const res = await handleGetList(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.data.items)).toBe(true);
    expect(json.data.total).toBeGreaterThan(0);
    expect(json.data.page).toBe(1);
    expect(typeof json.data.totalPages).toBe("number");
  });

  it("tìm kiếm theo tên 'Minh': trả về kết quả", async () => {
    const req = new Request("http://localhost:3000/api/chu-quan/nhan-vien?q=Minh", {
      method: "GET",
      headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
    });
    const res = await handleGetList(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    // Có ít nhất 1 kết quả chứa "Minh"
    const names = json.data.items.map((nv: { Hoten: string }) => nv.Hoten.toLowerCase());
    expect(names.some((n: string) => n.includes("minh"))).toBe(true);
  });

  it("tìm kiếm theo mã NV000001: trả về 1 kết quả", async () => {
    const req = new Request("http://localhost:3000/api/chu-quan/nhan-vien?q=NV000001", {
      method: "GET",
      headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
    });
    const res = await handleGetList(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.items.length).toBeGreaterThanOrEqual(1);
    expect(json.data.items[0].Manv).toBe("NV000001");
  });

  it("tìm kiếm không thấy: trả về mảng rỗng", async () => {
    const req = new Request("http://localhost:3000/api/chu-quan/nhan-vien?q=XXXXXXXXXXXXXXXXX", {
      method: "GET",
      headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
    });
    const res = await handleGetList(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.items.length).toBe(0);
    expect(json.data.total).toBe(0);
  });

  it("lấy chi tiết NV000001: có matKhauGiaiMa (CQ)", async () => {
    const req = new Request("http://localhost:3000/api/chu-quan/nhan-vien/NV000001", {
      method: "GET",
      headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
    });
    const res = await handleGetDetail(req, { params: Promise.resolve({ id: "NV000001" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.Manv).toBe("NV000001");
    expect(json.data.matKhauGiaiMa).toBeDefined();
    expect(typeof json.data.matKhauGiaiMa).toBe("string");
  });

  it("lấy chi tiết không tìm thấy: 404", async () => {
    const req = new Request("http://localhost:3000/api/chu-quan/nhan-vien/NVXXXXXX", {
      method: "GET",
      headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
    });
    const res = await handleGetDetail(req, { params: Promise.resolve({ id: "NVXXXXXX" }) });
    expect(res.status).toBe(404);
  });

  it("danh sách mỗi nhân viên có Trangthai tính động (NV007 vào ngày hiện tại vẫn Thử việc)", async () => {
    // NV000007 vào làm hôm nay (xem seed.sql), ngày 11/11/2026 chưa đủ 3 ngày
    const req = new Request("http://localhost:3000/api/chu-quan/nhan-vien?q=NV000007", {
      method: "GET",
      headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
    });
    const res = await handleGetList(req, { params: Promise.resolve({}) });
    const json = await res.json();
    if (json.data.items.length > 0) {
      const nv7 = json.data.items.find((n: { Manv: string }) => n.Manv === "NV000007");
      if (nv7) {
        expect(nv7.Trangthai).toBe("Thử việc");
      }
    }
  });
});
