import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import fs from "node:fs";
import path from "node:path";
import { signSession, AUTH_COOKIE_NAME } from "@backend/lib/auth";
import { prisma } from "@database/client";
import { GET as handleThongBao } from "@/app/api/thong-bao/route";
import { GET as handleChuQuanTongQuan } from "@/app/api/chu-quan/tong-quan/route";
import { GET as handleNhanVienTongQuan } from "@/app/api/nhan-vien/tong-quan/route";
import { POST as postThayCa } from "@/app/api/thay-ca/route";
import { clearThayCaMapForTest } from "@backend/services/thay-ca";
import { getAllMenuRoutes } from "@frontend/config/menu";
import * as thongBao from "@frontend/config/thong-bao";

describe("P13B - Chuông thông báo (GET /api/thong-bao), phân quyền 401/403 & thống nhất popup", () => {
  const TEST_SECRET =
    "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";

  const nvA = "NV950001";
  const nvB = "NV950002";
  const testMalichToi = "LL950001"; // 2095-05-15 Ca Tối (17:00-22:00)
  const testMalichSang = "LL950002"; // 2095-05-15 Ca Sáng (06:00-11:30) -> đã kết thúc lúc 14:00
  const testDateStr = "2095-05-15";
  const testDateDb = new Date(`${testDateStr}T00:00:00Z`);
  const testLr = "LR950001";
  const testKl = "KL950001";
  const testBl = "BL950001";
  const testCtbl = "CT950001";
  const testPhChua = "PH950001";
  const testDonChua = "DD950001";
  const testDonDaXuLy = "DD950002";
  const testYcChua = "YC950001";
  const testYcDaXuLy = "YC950002";

  let cqToken = "";
  let nvAToken = "";
  let nvBToken = "";

  async function cleanup() {
    clearThayCaMapForTest();
    await prisma.phanHoiLuong.deleteMany({ where: { Maphanhoi: testPhChua } });
    await prisma.chiTietBangLuong.deleteMany({ where: { MaCTBL: testCtbl } });
    await prisma.bangLuong.deleteMany({ where: { Mabangluong: testBl } });
    await prisma.kyLuong.deleteMany({ where: { Makyluong: testKl } });
    await prisma.donXinDoiCa.deleteMany({
      where: {
        OR: [
          { Madon: { in: [testDonChua, testDonDaXuLy] } },
          { Malich: { in: [testMalichToi, testMalichSang] } },
        ],
      },
    });
    await prisma.yeuCauBoSungCC.deleteMany({
      where: {
        OR: [
          { Mayeucau: { in: [testYcChua, testYcDaXuLy] } },
          { Malich: { in: [testMalichToi, testMalichSang] } },
        ],
      },
    });
    await prisma.chamCong.deleteMany({
      where: { Manv: { in: [nvA, nvB] } },
    });
    await prisma.nhanVien_LichLam.deleteMany({
      where: { Malich: { in: [testMalichToi, testMalichSang] } },
    });
    await prisma.lichRanh.deleteMany({ where: { Malichranh: testLr } });
    await prisma.lichLam.deleteMany({
      where: { Malich: { in: [testMalichToi, testMalichSang] } },
    });
    await prisma.nhanVien.deleteMany({
      where: { Manv: { in: [nvA, nvB] } },
    });
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_SECRET;
    await cleanup();

    await prisma.nhanVien.createMany({
      data: [
        {
          Manv: nvA,
          Tendangnhap: nvA,
          Matkhau: "hash",
          Hoten: "Nguyễn Kiểm Thử A",
          Sdt: "0959500001",
          Diachi: "Đà Nẵng",
          Vitrilamviec: "Pha chế",
          Hinhthuclam: "Full-time",
          Ngayvaolam: new Date("2025-01-01T00:00:00Z"),
          Kinhnghiem: "1 năm",
          Trangthai: "Chính thức",
          Mucluongtheogio: 25000,
        },
        {
          Manv: nvB,
          Tendangnhap: nvB,
          Matkhau: "hash",
          Hoten: "Trần Kiểm Thử B",
          Sdt: "0959500002",
          Diachi: "Đà Nẵng",
          Vitrilamviec: "Pha chế",
          Hinhthuclam: "Part-time",
          Ngayvaolam: new Date("2025-01-01T00:00:00Z"),
          Kinhnghiem: "1 năm",
          Trangthai: "Chính thức",
          Mucluongtheogio: 20000,
        },
      ],
    });

    await prisma.lichLam.createMany({
      data: [
        { Malich: testMalichToi, Ngaylam: testDateDb, Maca: "CA000003" },
        { Malich: testMalichSang, Ngaylam: testDateDb, Maca: "CA000001" },
      ],
    });

    await prisma.nhanVien_LichLam.createMany({
      data: [
        { Manv: nvA, Malich: testMalichToi },
        { Manv: nvA, Malich: testMalichSang },
      ],
    });

    await prisma.lichRanh.create({
      data: {
        Malichranh: testLr,
        Manv: nvB,
        Ngayranh: testDateDb,
        Caranh: "CA000003",
      },
    });

    await prisma.kyLuong.create({
      data: {
        Makyluong: testKl,
        Thang: 5,
        Nam: 2095,
        Trangthai: "Dự kiến",
        Ngaychot: null,
      },
    });

    await prisma.bangLuong.create({
      data: {
        Mabangluong: testBl,
        Tienthuong: 0,
        Manv: nvA,
        Makyluong: testKl,
      },
    });

    await prisma.chiTietBangLuong.create({
      data: {
        MaCTBL: testCtbl,
        Ngaylam: testDateDb,
        Giolam: 5,
        Mucluong: 25000,
        Mabangluong: testBl,
      },
    });

    await prisma.phanHoiLuong.create({
      data: {
        Maphanhoi: testPhChua,
        Noidung: "Thiếu 1 giờ tăng ca test P13B",
        Ngaygui: testDateDb,
        Trangthai: "Chưa xử lý",
        Mabangluong: testBl,
      },
    });

    await prisma.donXinDoiCa.createMany({
      data: [
        {
          Madon: testDonChua,
          Trangthaixuly: "Chưa xử lý",
          Manv: nvA,
          Malich: testMalichToi,
          Manvnhanthay: nvB,
        },
        {
          Madon: testDonDaXuLy,
          Trangthaixuly: "Đã xử lý",
          Manv: nvA,
          Malich: testMalichSang,
          Manvnhanthay: nvB,
        },
      ],
    });

    await prisma.yeuCauBoSungCC.createMany({
      data: [
        {
          Mayeucau: testYcChua,
          Giovaobosung: new Date("1970-01-01T06:00:00Z"),
          Giorabosung: new Date("1970-01-01T11:30:00Z"),
          Lydo: "Quên chấm công sáng test chưa xử lý",
          Trangthai: "Chưa xử lý",
          Manv: nvA,
          Malich: testMalichSang,
        },
        {
          Mayeucau: testYcDaXuLy,
          Giovaobosung: new Date("1970-01-01T06:00:00Z"),
          Giorabosung: new Date("1970-01-01T11:30:00Z"),
          Lydo: "Đã duyệt bổ sung test P13B",
          Trangthai: "Đã xử lý",
          Manv: nvA,
          Malich: testMalichSang,
        },
      ],
    });
  });

  afterAll(async () => {
    vi.useRealTimers();
    await cleanup();
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    // 2095-05-15 14:00 VN (07:00 UTC): Ca sáng đã kết thúc (nvA thiếu check-in), Ca tối chưa bắt đầu
    vi.setSystemTime(new Date(`${testDateStr}T07:00:00Z`));
    cqToken = await signSession({
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Thanh Hà",
    });
    nvAToken = await signSession({
      userId: nvA,
      username: nvA,
      role: "NhanVien",
      name: "Nguyễn Kiểm Thử A",
    });
    nvBToken = await signSession({
      userId: nvB,
      username: nvB,
      role: "NhanVien",
      name: "Trần Kiểm Thử B",
    });
  });

  afterEach(() => {
    clearThayCaMapForTest();
    vi.useRealTimers();
  });

  it("1. Kiểm tra 401/403 cho GET /api/thong-bao và các endpoint vai trò liên quan", async () => {
    const resNoAuth = await handleThongBao(
      new Request("http://localhost:3000/api/thong-bao"),
      { params: Promise.resolve({}) }
    );
    expect(resNoAuth.status).toBe(401);

    // Token giả mạo / sai vai trò -> 403
    const badRoleToken = await signSession({
      userId: "XX000001",
      username: "khach",
      role: "Khach" as unknown as "NhanVien",
      name: "Khách",
    });
    const resBadRole = await handleThongBao(
      new Request("http://localhost:3000/api/thong-bao", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${badRoleToken}` },
      }),
      { params: Promise.resolve({}) }
    );
    expect(resBadRole.status).toBe(403);

    // NV gọi API Chủ quán -> 403; CQ gọi API Nhân viên -> 403
    const resNvCallCq = await handleChuQuanTongQuan(
      new Request("http://localhost:3000/api/chu-quan/tong-quan", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${nvAToken}` },
      }),
      { params: Promise.resolve({}) }
    );
    expect(resNvCallCq.status).toBe(403);

    const resCqCallNv = await handleNhanVienTongQuan(
      new Request("http://localhost:3000/api/nhan-vien/tong-quan", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` },
      }),
      { params: Promise.resolve({}) }
    );
    expect(resCqCallNv.status).toBe(403);
  });

  it("2. NV nhận đủ bảng lương mới, đơn đổi ca đã xử lý, bổ sung CC đã xử lý và thay ca gấp đang mở (cô lập theo NV)", async () => {
    // nvA gửi yêu cầu thay ca gấp ca tối -> nvB có lịch rảnh nhận lời mời đang mở
    const postRes = await postThayCa(
      new Request("http://localhost:3000/api/thay-ca", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${nvAToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ malich: testMalichToi, lyDo: "Bận việc gia đình" }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(postRes.status).toBe(201);

    // nvA kiểm tra /api/thong-bao
    const resA = await handleThongBao(
      new Request("http://localhost:3000/api/thong-bao", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${nvAToken}` },
      }),
      { params: Promise.resolve({}) }
    );
    expect(resA.status).toBe(200);
    const jsonA = await resA.json();
    expect(jsonA.ok).toBe(true);
    expect(jsonA.data.count).toBe(jsonA.data.items.length);

    const idsA = jsonA.data.items.map((i: { id: string }) => i.id);
    expect(idsA).toContain(`BL-${testKl}`);
    expect(idsA).toContain(`DC-${testDonDaXuLy}`);
    expect(idsA).toContain(`BS-${testYcDaXuLy}`);
    expect(idsA.some((id: string) => id.startsWith("TC-YC-"))).toBe(true);
    // Không rò rỉ dữ liệu dành riêng cho CQ (YC chưa xử lý / QCC)
    expect(idsA.some((id: string) => id.startsWith("YC-"))).toBe(false);
    expect(idsA.some((id: string) => id.startsWith("QCC-"))).toBe(false);

    // nvB (người được mời thay ca gấp) kiểm tra /api/thong-bao -> thấy TC-MO-* khớp nguyên văn THAY_CA_LOI_MOI_TIEU_DE
    const resB = await handleThongBao(
      new Request("http://localhost:3000/api/thong-bao", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${nvBToken}` },
      }),
      { params: Promise.resolve({}) }
    );
    expect(resB.status).toBe(200);
    const jsonB = await resB.json();
    const inviteNotif = jsonB.data.items.find((i: { id: string }) =>
      i.id.startsWith("TC-MO-")
    );
    expect(inviteNotif).toBeDefined();
    expect(inviteNotif.chiTiet).toContain(thongBao.THAY_CA_LOI_MOI_TIEU_DE);
    expect(inviteNotif.link).toBe("/nhan-vien/ca-lam/thay-ca");
    // nvB không nhìn thấy bảng lương / bổ sung chấm công của nvA
    expect(jsonB.data.items.some((i: { id: string }) => i.id === `BL-${testKl}`)).toBe(false);
    expect(jsonB.data.items.some((i: { id: string }) => i.id === `BS-${testYcDaXuLy}`)).toBe(false);

    // Mọi link trả về cho NV đều phải thuộc route hợp lệ trong menu
    const validRoutes = new Set(
      getAllMenuRoutes()
        .filter((r) => r.role === "NhanVien")
        .map((r) => r.href)
    );
    for (const item of [...jsonA.data.items, ...jsonB.data.items]) {
      if (item.link) {
        expect(validRoutes.has(item.link)).toBe(true);
      }
    }
  });

  it("3. CQ nhận đủ đơn đổi ca/bổ sung/phản hồi lương chưa xử lý + người quên chấm công + link hợp lệ (không /chu-quan/tong-quan)", async () => {
    const resCq = await handleThongBao(
      new Request("http://localhost:3000/api/thong-bao", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` },
      }),
      { params: Promise.resolve({}) }
    );
    expect(resCq.status).toBe(200);
    const jsonCq = await resCq.json();
    expect(jsonCq.ok).toBe(true);
    expect(jsonCq.data.count).toBe(jsonCq.data.items.length);

    const items = jsonCq.data.items as Array<{
      id: string;
      tieuDe: string;
      chiTiet: string;
      link?: string;
    }>;
    const ids = items.map((i) => i.id);

    expect(ids).toContain(`YC-${testDonChua}`);
    expect(ids).toContain(`YC-${testYcChua}`);
    expect(ids).toContain(`YC-${testPhChua}`);
    // testDonDaXuLy chuyển ca sáng cho nvB nên nvB chịu trách nhiệm và thiếu check-in
    expect(ids).toContain(`QCC-${nvB}-${testMalichSang}`);

    // Đơn đã xử lý không xuất hiện trong mục chưa xử lý của CQ
    expect(ids).not.toContain(`YC-${testDonDaXuLy}`);
    expect(ids).not.toContain(`YC-${testYcDaXuLy}`);

    const validCqRoutes = new Set(
      getAllMenuRoutes()
        .filter((r) => r.role === "ChuQuan")
        .map((r) => r.href)
    );
    for (const item of items) {
      expect(item.link).toBeTruthy();
      expect(item.link).not.toBe("/chu-quan/tong-quan");
      expect(validCqRoutes.has(item.link!)).toBe(true);
    }
  });

  it("4. Thống nhất popup toàn hệ thống dùng chung ConfirmDialog / PopupModal", () => {
    const popupConsumers = [
      "frontend/screens/chu-quan/luong/ChotBangLuongScreen.tsx",
      "frontend/screens/chu-quan/luong/TinhLuongScreen.tsx",
      "frontend/screens/chu-quan/luong/ChinhSuaBangLuongScreen.tsx",
      "frontend/screens/chu-quan/nhan-vien/XoaNhanVienScreen.tsx",
      "frontend/screens/nhan-vien/cham-cong/CheckOutScreen.tsx",
    ];
    for (const rel of popupConsumers) {
      const src = fs.readFileSync(path.resolve(__dirname, "../..", rel), "utf-8");
      expect(src).toContain("ConfirmDialog");
    }

    const appShellSrc = fs.readFileSync(
      path.resolve(__dirname, "../../frontend/components/layout/AppShell.tsx"),
      "utf-8"
    );
    expect(appShellSrc).toContain("PopupModal");
    expect(appShellSrc).toContain("Thông báo của bạn");
  });
});
