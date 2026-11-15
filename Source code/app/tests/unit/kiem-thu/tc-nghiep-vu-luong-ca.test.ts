import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { signSession, AUTH_COOKIE_NAME } from "@backend/lib/auth";
import { prisma } from "@database/client";
import * as timeLib from "@backend/lib/time";

import {
  GET as getLichRanh,
  POST as postLichRanh,
} from "@/app/api/nhan-vien/lich-ranh/route";
import {
  GET as getDoiCa,
  POST as postDoiCa,
  PUT as putDoiCa,
} from "@/app/api/doi-ca/route";
import { POST as postXuLyDoiCa } from "@/app/api/doi-ca/xu-ly/route";
import { POST as postThayCa } from "@/app/api/thay-ca/route";
import { GET as getThayCaDangMo } from "@/app/api/thay-ca/dang-mo/route";
import { POST as postThayCaChapNhan } from "@/app/api/thay-ca/[id]/chap-nhan/route";
import { POST as postTinhLuong } from "@/app/api/ky-luong/[id]/tinh/route";
import { POST as postGuiBangLuong } from "@/app/api/ky-luong/[id]/gui/route";
import { PUT as putChinhSuaBangLuong } from "@/app/api/bang-luong/[id]/route";
import { POST as postKhongChinhSuaPhanHoi } from "@/app/api/phan-hoi-luong/[id]/khong-chinh-sua/route";
import { POST as postChotBangLuong } from "@/app/api/ky-luong/[id]/chot/route";
import { PUT as putMucLuong } from "@/app/api/chu-quan/muc-luong/route";
import { POST as postTienThuong } from "@/app/api/tien-thuong/route";

async function makeReq(
  url: string,
  options: {
    method?: string;
    role?: "ChuQuan" | "NhanVien";
    userId?: string;
    username?: string;
    name?: string;
    body?: unknown;
  } = {},
): Promise<NextRequest> {
  const {
    method = "GET",
    role,
    userId,
    username = userId ?? "test",
    name = "Test User",
    body,
  } = options;
  const headers = new Headers();
  if (role && userId) {
    const token = await signSession({
      userId,
      username,
      role,
      name,
    });
    headers.set("cookie", `${AUTH_COOKIE_NAME}=${token}`);
  }
  let bodyStr: string | undefined;
  if (body !== undefined) {
    headers.set("content-type", "application/json");
    bodyStr = JSON.stringify(body);
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method,
    headers,
    body: bodyStr,
  });
}

describe("BƯỚC 2 - Ưu tiên 3: Quy tắc nghiệp vụ và tính lương (UC_8.2, 8.3, 8.6, 3.1, 2.1, 2.2/6.3/2.3)", () => {
  const TEST_KYS = ["KL209710", "KL209712", "KL209708"];
  const TEST_LLS = [
    "LL970001",
    "LL970002",
    "LL970003",
    "LL970004",
    "LL970005",
    "LL970006",
  ];
  const TEST_HSS = ["HS970001"];

  async function cleanupAll() {
    await prisma.phanHoiLuong.deleteMany({
      where: { BangLuong: { Makyluong: { in: TEST_KYS } } },
    });
    await prisma.chiTietBangLuong.deleteMany({
      where: { BangLuong: { Makyluong: { in: TEST_KYS } } },
    });
    await prisma.bangLuong.deleteMany({
      where: { Makyluong: { in: TEST_KYS } },
    });
    await prisma.kyLuong.deleteMany({
      where: { Makyluong: { in: TEST_KYS } },
    });
    await prisma.yeuCauBoSungCC.deleteMany({
      where: { Malich: { in: TEST_LLS } },
    });
    await prisma.donXinDoiCa.deleteMany({
      where: { Malich: { in: TEST_LLS } },
    });
    await prisma.chamCong.deleteMany({
      where: { Malich: { in: TEST_LLS } },
    });
    await prisma.nhanVien_LichLam.deleteMany({
      where: { Malich: { in: TEST_LLS } },
    });
    await prisma.lichLam.deleteMany({
      where: { Malich: { in: TEST_LLS } },
    });
    await prisma.lichRanh.deleteMany({
      where: {
        Ngayranh: {
          gte: new Date("2097-01-01T00:00:00.000Z"),
          lte: new Date("2097-12-31T00:00:00.000Z"),
        },
      },
    });
    await prisma.heSoLuong.deleteMany({
      where: {
        OR: [
          { Maheso: { in: TEST_HSS } },
          {
            Ngaybatdau: {
              gte: new Date("2097-01-01T00:00:00.000Z"),
              lte: new Date("2097-12-31T00:00:00.000Z"),
            },
          },
        ],
      },
    });
  }

  beforeAll(async () => {
    try {
      process.loadEnvFile();
    } catch {
      // ignore
    }
    await cleanupAll();

    // Tạo hệ số 2 cho ngày lễ 2097-10-20
    await prisma.heSoLuong.create({
      data: {
        Maheso: "HS970001",
        Ngaybatdau: new Date("2097-10-20T00:00:00.000Z"),
        Ngayketthuc: new Date("2097-10-20T00:00:00.000Z"),
        Heso: 2,
      },
    });

    // Tạo 3 kỳ lương: KL209710 (Chưa tính), KL209712 (Chưa tính - tháng 12 cuối năm), KL209708 (Đã chốt)
    await prisma.kyLuong.createMany({
      data: [
        {
          Makyluong: "KL209710",
          Thang: 10,
          Nam: 2097,
          Trangthai: "Chưa tính",
          Ngaychot: null,
        },
        {
          Makyluong: "KL209712",
          Thang: 12,
          Nam: 2097,
          Trangthai: "Chưa tính",
          Ngaychot: null,
        },
        {
          Makyluong: "KL209708",
          Thang: 8,
          Nam: 2097,
          Trangthai: "Đã chốt",
          Ngaychot: new Date("2097-09-02T00:00:00.000Z"),
        },
      ],
    });

    // Tạo lịch làm cho NV000007 (mức 17.000đ/giờ, Phục vụ) và NV000001 (Pha chế)
    await prisma.lichLam.createMany({
      data: [
        {
          Malich: "LL970001",
          Maca: "CA000001",
          Ngaylam: new Date("2097-10-10T00:00:00.000Z"), // Ngày thường hệ số 1
        },
        {
          Malich: "LL970002",
          Maca: "CA000001",
          Ngaylam: new Date("2097-10-20T00:00:00.000Z"), // Ngày lễ hệ số 2
        },
        {
          Malich: "LL970003",
          Maca: "CA000001",
          Ngaylam: new Date("2097-12-10T00:00:00.000Z"), // Kỳ tháng 12
        },
        {
          Malich: "LL970004",
          Maca: "CA000001",
          Ngaylam: new Date("2097-11-15T00:00:00.000Z"), // Ca tương lai cho đổi ca UC_2.2 / 6.3
        },
        {
          Malich: "LL970005",
          Maca: "CA000002",
          Ngaylam: new Date("2097-11-15T00:00:00.000Z"), // Ca chiều cho thay ca gấp UC_2.3
        },
        {
          Malich: "LL970006",
          Maca: "CA000001",
          Ngaylam: new Date("2097-08-10T00:00:00.000Z"), // Ca thuộc kỳ đã chốt KL209708
        },
      ],
    });

    await prisma.nhanVien_LichLam.createMany({
      data: [
        { Manv: "NV000007", Malich: "LL970001" },
        { Manv: "NV000007", Malich: "LL970002" },
        { Manv: "NV000007", Malich: "LL970003" },
        { Manv: "NV000001", Malich: "LL970004" }, // NV000001 là Pha chế
        { Manv: "NV000001", Malich: "LL970005" },
        { Manv: "NV000007", Malich: "LL970006" },
      ],
    });

    // Chấm công cho NV000007 (mức 17.000đ/giờ):
    // - LL970001: 06:00 -> 11:30 (5.5 giờ, hệ số 1 => 93.500đ)
    // - LL970002: 06:00 -> 11:30 (5.5 giờ, hệ số 2 => 187.000đ)
    // - LL970003: 06:00 -> 16:00 (10 giờ trong tháng 12)
    await prisma.chamCong.createMany({
      data: [
        {
          Machamcong: "CC970001",
          Manv: "NV000007",
          Malich: "LL970001",
          Thoigiancheckin: new Date("2097-10-10T06:00:00.000Z"),
          Thoigiancheckout: new Date("2097-10-10T11:30:00.000Z"),
        },
        {
          Machamcong: "CC970002",
          Manv: "NV000007",
          Malich: "LL970002",
          Thoigiancheckin: new Date("2097-10-20T06:00:00.000Z"),
          Thoigiancheckout: new Date("2097-10-20T11:30:00.000Z"),
        },
        {
          Machamcong: "CC970003",
          Manv: "NV000007",
          Malich: "LL970003",
          Thoigiancheckin: new Date("2097-12-10T06:00:00.000Z"),
          Thoigiancheckout: new Date("2097-12-10T16:00:00.000Z"),
        },
      ],
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await cleanupAll();
    await prisma.nhanVien.updateMany({
      where: { Manv: "NV000007" },
      data: { Mucluongtheogio: 17000 },
    });
  });

  // =========================================================================
  // UC_2.1: CỬA SỔ ĐĂNG KÝ LỊCH RẢNH THEO GIỜ GIẢ LẬP
  // =========================================================================
  describe("UC_2.1 - Cửa sổ tuần đăng ký lịch rảnh theo giờ giả lập & chặn ngoài tuần", () => {
    it("TC_2.1_05: Giờ hệ thống từ thứ hai đến thứ bảy 17:59:59 -> Hiện tuần đang chạy, gửi được", async () => {
      const spy = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2097-11-09T17:59:00+07:00")); // Thứ bảy 17:59
      try {
        const resGet = await getLichRanh(
          await makeReq("/api/nhan-vien/lich-ranh", {
            role: "NhanVien",
            userId: "NV000001",
          }),
          { params: Promise.resolve({}) },
        );
        expect(resGet.status).toBe(200);
        const bodyGet = await resGet.json();
        expect(bodyGet.data.tuan.startDate).toBe("2097-11-04");
        expect(bodyGet.data.tuan.endDate).toBe("2097-11-10");
      } finally {
        spy.mockRestore();
      }
    });

    it("TC_2.1_06 & TC_2.1_07 & TC_2.1_08: Thứ bảy từ 18:00 và Chủ nhật chuyển sang tuần sau; Thứ hai 00:00 giữ tuần vừa bắt đầu", async () => {
      const spySat = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2097-11-09T18:00:00+07:00"));
      try {
        const resSat = await getLichRanh(
          await makeReq("/api/nhan-vien/lich-ranh", {
            role: "NhanVien",
            userId: "NV000001",
          }),
          { params: Promise.resolve({}) },
        );
        const bodySat = await resSat.json();
        expect(bodySat.data.tuan.startDate).toBe("2097-11-11");
        expect(bodySat.data.tuan.endDate).toBe("2097-11-17");
      } finally {
        spySat.mockRestore();
      }

      const spySun = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2097-11-10T23:59:00+07:00"));
      try {
        const resSun = await getLichRanh(
          await makeReq("/api/nhan-vien/lich-ranh", {
            role: "NhanVien",
            userId: "NV000001",
          }),
          { params: Promise.resolve({}) },
        );
        const bodySun = await resSun.json();
        expect(bodySun.data.tuan.startDate).toBe("2097-11-11");
        expect(bodySun.data.tuan.endDate).toBe("2097-11-17");
      } finally {
        spySun.mockRestore();
      }

      const spyMon = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2097-11-11T00:00:00+07:00"));
      try {
        const resMon = await getLichRanh(
          await makeReq("/api/nhan-vien/lich-ranh", {
            role: "NhanVien",
            userId: "NV000001",
          }),
          { params: Promise.resolve({}) },
        );
        const bodyMon = await resMon.json();
        expect(bodyMon.data.tuan.startDate).toBe("2097-11-11");
        expect(bodyMon.data.tuan.endDate).toBe("2097-11-17");
      } finally {
        spyMon.mockRestore();
      }
    });

    it("TC_2.1_03 & TC_2.1_09 & TC_2.1_10: Không chọn ca nào trả 400; gửi ngày ngoài tuần hiển thị trả 400; đăng ký lại cùng ngày cập nhật không trùng lặp", async () => {
      const spy = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2097-11-11T09:00:00+07:00"));
      try {
        // TC_2.1_03: danhSach rỗng
        const resEmpty = await postLichRanh(
          await makeReq("/api/nhan-vien/lich-ranh", {
            method: "POST",
            role: "NhanVien",
            userId: "NV000002",
            body: {
              startDate: "2097-11-11",
              endDate: "2097-11-17",
              danhSach: [],
            },
          }),
          { params: Promise.resolve({}) },
        );
        expect(resEmpty.status).toBe(400);
        const bodyEmpty = await resEmpty.json();
        expect(bodyEmpty.error.message).toBe("Chọn ít nhất một ca rảnh trong tuần");

        // TC_2.1_09: gửi ngày ngoài tuần hiển thị (cách 2 tuần: 2097-11-25) -> 400
        const resOut = await postLichRanh(
          await makeReq("/api/nhan-vien/lich-ranh", {
            method: "POST",
            role: "NhanVien",
            userId: "NV000002",
            body: {
              startDate: "2097-11-11",
              endDate: "2097-11-17",
              danhSach: [{ ngay: "2097-11-25", maCa: "CA000001" }],
            },
          }),
          { params: Promise.resolve({}) },
        );
        expect(resOut.status).toBe(400);

        // TC_2.1_01 & TC_2.1_10: Đăng ký lịch rảnh cho ngày 2097-11-16 (ngày chưa bị khóa lịch làm) rồi đăng ký lại không bị trùng lặp
        const resOk1 = await postLichRanh(
          await makeReq("/api/nhan-vien/lich-ranh", {
            method: "POST",
            role: "NhanVien",
            userId: "NV000002",
            body: {
              startDate: "2097-11-11",
              endDate: "2097-11-17",
              danhSach: [
                { ngay: "2097-11-16", maCa: "CA000001" },
                { ngay: "2097-11-16", maCa: "CA000002" },
              ],
            },
          }),
          { params: Promise.resolve({}) },
        );
        expect(resOk1.status).toBe(200);

        const resOk2 = await postLichRanh(
          await makeReq("/api/nhan-vien/lich-ranh", {
            method: "POST",
            role: "NhanVien",
            userId: "NV000002",
            body: {
              startDate: "2097-11-11",
              endDate: "2097-11-17",
              danhSach: [
                { ngay: "2097-11-16", maCa: "CA000001" },
                { ngay: "2097-11-16", maCa: "CA000002" },
              ],
            },
          }),
          { params: Promise.resolve({}) },
        );
        expect(resOk2.status).toBe(200);

        const countAfter = await prisma.lichRanh.count({
          where: {
            Manv: "NV000002",
            Ngayranh: new Date("2097-11-16T00:00:00.000Z"),
          },
        });
        expect(countAfter).toBe(2);
      } finally {
        spy.mockRestore();
      }
    });
  });

  // =========================================================================
  // UC_2.2, UC_6.3, UC_2.3: ĐỔI CA / XỬ LÝ ĐỔI CA / THAY CA GẤP (CÙNG VỊ TRÍ)
  // =========================================================================
  describe("UC_2.2, UC_6.3, UC_2.3 - Quy tắc cùng vị trí làm việc & người thay ca", () => {
    it("TC_2.2_05 & TC_2.2_06: NV pha chế (NV000001) mở danh sách người thay chỉ thấy Pha chế; gửi yêu cầu đổi ca với người thay khác vị trí (NV000003 - Phục vụ) bị từ chối 400", async () => {
      const spy = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2097-11-12T09:00:00+07:00"));
      try {
        const resList = await getDoiCa(
          await makeReq("/api/doi-ca?type=nguoi-thay&malich=LL970004", {
            role: "NhanVien",
            userId: "NV000001",
          }),
          { params: Promise.resolve({}) },
        );
        expect(resList.status).toBe(200);
        const bodyList = await resList.json();
        const manvs = (bodyList.data.items as Array<{ manv: string }>).map((x) =>
          x.manv.trim(),
        );
        expect(manvs).toContain("NV000002"); // NV000002 là Pha chế
        expect(manvs).not.toContain("NV000001"); // không có chính mình
        expect(manvs).not.toContain("NV000003"); // không có Phục vụ

        // TC_2.2_06: Gửi đổi ca với NV000003 (Phục vụ - khác vị trí) -> 400
        const resDiffRole = await postDoiCa(
          await makeReq("/api/doi-ca", {
            method: "POST",
            role: "NhanVien",
            userId: "NV000001",
            body: {
              Malich: "LL970004",
              Manvnhanthay: "NV000003",
            },
          }),
          { params: Promise.resolve({}) },
        );
        expect(resDiffRole.status).toBe(400);
      } finally {
        spy.mockRestore();
      }
    });

    it("TC_2.2_02, TC_6.3_09, TC_6.3_10, TC_6.3_05: Gửi đơn không người thay, chủ quán lưu thiếu người thay hoặc khác vị trí trả 400; lưu người thay cùng vị trí thành công", async () => {
      const spy = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2097-11-12T09:00:00+07:00"));
      try {
        // TC_2.2_02: Gửi đơn đổi ca tick 'Không có người thay thế'
        const resCreate = await postDoiCa(
          await makeReq("/api/doi-ca", {
            method: "POST",
            role: "NhanVien",
            userId: "NV000001",
            body: {
              Malich: "LL970004",
              khongCoNguoiThay: true,
            },
          }),
          { params: Promise.resolve({}) },
        );
        expect(resCreate.status).toBe(201);
        const bodyCreate = await resCreate.json();
        const madon = (bodyCreate.data.madon ?? bodyCreate.data.Madon) as string;
        expect(madon).toBeTruthy();

        // TC_6.3_10: Chủ quán lưu xử lý đổi ca nhưng để trống người thay -> 400
        const resMissing = await postXuLyDoiCa(
          await makeReq("/api/doi-ca/xu-ly", {
            method: "POST",
            role: "ChuQuan",
            userId: "CQ000001",
            body: {
              Madon: madon,
              Manvnhanthay: "",
            },
          }),
          { params: Promise.resolve({}) },
        );
        expect(resMissing.status).toBe(400);

        // TC_6.3_09: Chủ quán lưu xử lý đổi ca với người thay khác vị trí (NV000003 - Phục vụ) -> 400
        const resWrongRole = await postXuLyDoiCa(
          await makeReq("/api/doi-ca/xu-ly", {
            method: "POST",
            role: "ChuQuan",
            userId: "CQ000001",
            body: {
              Madon: madon,
              Manvnhanthay: "NV000003",
            },
          }),
          { params: Promise.resolve({}) },
        );
        expect(resWrongRole.status).toBe(400);

        // TC_6.3_05: Chủ quán lưu xử lý đổi ca với NV000002 (cùng vị trí Pha chế, đã đăng ký lịch rảnh ngày 2097-11-15) -> 200
        const resApprove = await putDoiCa(
          await makeReq("/api/doi-ca", {
            method: "PUT",
            role: "ChuQuan",
            userId: "CQ000001",
            body: {
              Madon: madon,
              Manvnhanthay: "NV000002",
            },
          }),
          { params: Promise.resolve({}) },
        );
        expect(resApprove.status).toBe(200);
      } finally {
        spy.mockRestore();
      }
    });

    it("TC_2.3_08 & TC_2.3_09 & TC_2.3_01: Thay ca gấp chỉ gửi cho nhân viên cùng vị trí có đăng ký lịch rảnh (NV000002 thấy, NV000003 Phục vụ không thấy)", async () => {
      const spy = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2097-11-15T08:00:00+07:00"));
      try {
        // Seed trực tiếp lịch rảnh CA000002 ngày 2097-11-15 cho NV000002 (Pha chế) và NV000003 (Phục vụ)
        await prisma.lichRanh.deleteMany({
          where: {
            OR: [
              { Malichranh: { in: ["LR970002", "LR970003"] } },
              {
                Manv: { in: ["NV000002", "NV000003"] },
                Ngayranh: new Date("2097-11-15T00:00:00.000Z"),
              },
            ],
          },
        });
        await prisma.lichRanh.createMany({
          data: [
            {
              Malichranh: "LR970002",
              Manv: "NV000002",
              Caranh: "CA000002",
              Ngayranh: new Date("2097-11-15T00:00:00.000Z"),
            },
            {
              Malichranh: "LR970003",
              Manv: "NV000003",
              Caranh: "CA000002",
              Ngayranh: new Date("2097-11-15T00:00:00.000Z"),
            },
          ],
        });

        // NV000001 báo nghỉ gấp ca chiều LL970005 ngày 2097-11-15
        const resPost = await postThayCa(
          await makeReq("/api/thay-ca", {
            method: "POST",
            role: "NhanVien",
            userId: "NV000001",
            body: { malich: "LL970005" },
          }),
          { params: Promise.resolve({}) },
        );
        expect(resPost.status).toBeLessThan(300);

        // NV000002 (Pha chế, có lịch rảnh CA000002 ngày 2097-11-15) thấy thông báo thay ca đang mở
        const resNv2 = await getThayCaDangMo(
          await makeReq("/api/thay-ca/dang-mo", {
            role: "NhanVien",
            userId: "NV000002",
          }),
          { params: Promise.resolve({}) },
        );
        expect(resNv2.status).toBe(200);
        const bodyNv2 = await resNv2.json();
        const loiMoiNv2 = bodyNv2.data.loiMoi ?? [];
        expect(loiMoiNv2.length).toBeGreaterThan(0);

        // NV000003 (Phục vụ - khác vị trí) không nhận thông báo thay ca của Pha chế
        const resNv3 = await getThayCaDangMo(
          await makeReq("/api/thay-ca/dang-mo", {
            role: "NhanVien",
            userId: "NV000003",
          }),
          { params: Promise.resolve({}) },
        );
        expect(resNv3.status).toBe(200);
        const bodyNv3 = await resNv3.json();
        const loiMoiNv3 = bodyNv3.data.loiMoi ?? [];
        const hasLL970005 = loiMoiNv3.some(
          (x: { malich?: string }) => x.malich?.trim() === "LL970005",
        );
        expect(hasLL970005).toBe(false);

        // NV000002 bấm Chấp nhận thay ca
        const idYeuCau = loiMoiNv2[0]?.id as string;
        expect(idYeuCau).toBeTruthy();
        const resAccept = await postThayCaChapNhan(
          await makeReq(`/api/thay-ca/${idYeuCau}/chap-nhan`, {
            method: "POST",
            role: "NhanVien",
            userId: "NV000002",
          }),
          { params: Promise.resolve({ id: idYeuCau }) },
        );
        expect(resAccept.status).toBe(200);
        const bodyAccept = await resAccept.json();
        expect(bodyAccept.data.message).toBe("Đã xác nhận thành công");
      } finally {
        spy.mockRestore();
      }
    });
  });

  // =========================================================================
  // UC_8.2: TÍNH LƯƠNG & GỬI BẢNG LƯƠNG DỰ KIẾN
  // =========================================================================
  describe("UC_8.2 - Quy tắc tính lương (giờ × mức × hệ số + thưởng, ngày lễ hệ số 2, lương tháng 13, gửi lần 2 bị từ chối)", () => {
    it("TC_8.2_02, TC_8.2_05, TC_8.2_06: Xem trước tính lương KHÔNG ghi CSDL; công thức ngày thường (5.5×17000×1 = 93.500đ) + ngày lễ hệ số 2 (5.5×17000×2 = 187.000đ) = 280.500đ", async () => {
      const resPreview = await postTinhLuong(
        await makeReq("/api/ky-luong/KL209710/tinh", {
          method: "POST",
          role: "ChuQuan",
          userId: "CQ000001",
        }),
        { params: Promise.resolve({ id: "KL209710" }) },
      );
      expect(resPreview.status).toBe(200);
      const bodyPreview = await resPreview.json();

      // TC_8.2_02: Kỳ lương trong CSDL vẫn là 'Chưa tính', chưa có BangLuong
      const kyInDb = await prisma.kyLuong.findUnique({
        where: { Makyluong: "KL209710" },
      });
      expect(kyInDb?.Trangthai.trim()).toBe("Chưa tính");
      const blCount = await prisma.bangLuong.count({
        where: { Makyluong: "KL209710" },
      });
      expect(blCount).toBe(0);

      // TC_8.2_05 & TC_8.2_06: Kiểm tra kết quả tính của NV000007 (5.5h hệ số 1 + 5.5h hệ số 2, mức 17.000đ)
      const list = bodyPreview.data.BangLuong ?? [];
      const nv7 = list.find(
        (r: { Manv?: string }) => r.Manv?.trim() === "NV000007",
      );
      expect(nv7).toBeTruthy();
      expect(Number(nv7.Tonggiolam)).toBe(11);
      expect(Number(nv7.Tongluong)).toBe(5.5 * 17000 * 1 + 5.5 * 17000 * 2); // 280.500đ
    });

    it("TC_8.2_03, TC_8.2_08, TC_8.2_09: Gửi bảng lương dự kiến chuyển kỳ sang 'Dự kiến'; gửi lần 2 bị từ chối (400/409); đổi mức lương NV không làm đổi bảng đã gửi", async () => {
      // TC_8.2_03: Gửi bảng lương dự kiến lần 1 -> thành công
      const resGui1 = await postGuiBangLuong(
        await makeReq("/api/ky-luong/KL209710/gui", {
          method: "POST",
          role: "ChuQuan",
          userId: "CQ000001",
        }),
        { params: Promise.resolve({ id: "KL209710" }) },
      );
      expect(resGui1.status).toBe(200);

      const kyAfter = await prisma.kyLuong.findUnique({
        where: { Makyluong: "KL209710" },
      });
      expect(kyAfter?.Trangthai.trim()).toBe("Dự kiến");

      // TC_8.2_09: Gửi lần 2 cho kỳ đã Dự kiến -> Bị từ chối
      const resGui2 = await postGuiBangLuong(
        await makeReq("/api/ky-luong/KL209710/gui", {
          method: "POST",
          role: "ChuQuan",
          userId: "CQ000001",
        }),
        { params: Promise.resolve({ id: "KL209710" }) },
      );
      expect(resGui2.status).toBeGreaterThanOrEqual(400);

      // TC_8.2_08: Đổi mức lương NV000007 sang 19000 -> bảng lương đã gửi vẫn giữ mức 17000
      await putMucLuong(
        await makeReq("/api/chu-quan/muc-luong", {
          method: "PUT",
          role: "ChuQuan",
          userId: "CQ000001",
          body: { Manv: "NV000007", Mucluongtheogio: 19000 },
        }),
        { params: Promise.resolve({}) },
      );

      const blNv7 = await prisma.bangLuong.findFirst({
        where: { Makyluong: "KL209710", Manv: "NV000007" },
        include: { ChiTietBangLuong: true },
      });
      expect(blNv7?.ChiTietBangLuong[0]?.Mucluong).toBe(17000);

      await prisma.nhanVien.update({
        where: { Manv: "NV000007" },
        data: { Mucluongtheogio: 17000 },
      });
    });

    it("TC_8.2_07: Kỳ cuối năm (tháng 12 - KL209712) có thêm Lương tháng 13 = tổng giờ cả năm × mức lương theo giờ", async () => {
      const resDec = await postTinhLuong(
        await makeReq("/api/ky-luong/KL209712/tinh", {
          method: "POST",
          role: "ChuQuan",
          userId: "CQ000001",
        }),
        { params: Promise.resolve({ id: "KL209712" }) },
      );
      expect(resDec.status).toBe(200);
      const bodyDec = await resDec.json();
      expect(bodyDec.data.Kycuoinam).toBe(true);

      const list = bodyDec.data.BangLuong ?? [];
      const nv7 = list.find(
        (r: { Manv?: string }) => r.Manv?.trim() === "NV000007",
      );
      expect(nv7).toBeTruthy();
      // Tổng giờ năm 2097 của NV000007 = 11h (T10) + 10h (T12) = 21h; Lương tháng 13 = 21 × 17000 = 357.000đ
      expect(Number(nv7.Luongthang13)).toBe(21 * 17000);
    });
  });

  // =========================================================================
  // UC_8.3 & UC_8.6: CHỈNH SỬA BẢNG LƯƠNG & CHỐT BẢNG LƯƠNG
  // =========================================================================
  describe("UC_8.3 & UC_8.6 - Chỉnh sửa sai sót bảng lương và Chốt bảng lương", () => {
    let maBangLuongNv7 = "";

    beforeAll(async () => {
      const bl = await prisma.bangLuong.findFirst({
        where: { Makyluong: "KL209710", Manv: "NV000007" },
      });
      maBangLuongNv7 = bl?.Mabangluong.trim() ?? "";
    });

    it("TC_8.3_04, TC_8.3_05, TC_8.3_06, TC_8.3_07, TC_8.3_08: Kiểm tra ngoại lệ và quy tắc chỉnh sửa bảng lương", async () => {
      expect(maBangLuongNv7).toBeTruthy();

      // TC_8.3_04: Chưa đổi thông tin nào mà bấm Lưu -> trả 400 'Bạn chưa thay đổi thông tin nào'
      const resNoChange = await putChinhSuaBangLuong(
        await makeReq(`/api/bang-luong/${maBangLuongNv7}`, {
          method: "PUT",
          role: "ChuQuan",
          userId: "CQ000001",
          body: {
            ngaylam: "2097-10-10",
            giovao: "06:00",
            giora: "11:30",
            heso: 1,
            tienthuong: 0,
            lydochinhsua: "Kiểm tra không đổi",
          },
        }),
        { params: Promise.resolve({ id: maBangLuongNv7 }) },
      );
      expect(resNoChange.status).toBe(400);
      const bodyNoChange = await resNoChange.json();
      expect(bodyNoChange.error.message).toBe("Bạn chưa thay đổi thông tin nào");

      // TC_8.3_05: Để trống lý do chỉnh sửa -> Hiện 'Vui lòng nhập lý do chỉnh sửa'
      const resNoReason = await putChinhSuaBangLuong(
        await makeReq(`/api/bang-luong/${maBangLuongNv7}`, {
          method: "PUT",
          role: "ChuQuan",
          userId: "CQ000001",
          body: {
            ngaylam: "2097-10-10",
            giovao: "06:00",
            giora: "12:30",
            heso: 1,
            tienthuong: 100000,
            lydochinhsua: "   ",
          },
        }),
        { params: Promise.resolve({ id: maBangLuongNv7 }) },
      );
      expect(resNoReason.status).toBe(400);
      const bodyNoReason = await resNoReason.json();
      expect(bodyNoReason.error.message).toBe("Vui lòng nhập lý do chỉnh sửa");

      // TC_8.3_06: Nhập thưởng là chữ ('abc') -> Hiện 'Số tiền thưởng không hợp lệ'
      const resBadBonus = await putChinhSuaBangLuong(
        await makeReq(`/api/bang-luong/${maBangLuongNv7}`, {
          method: "PUT",
          role: "ChuQuan",
          userId: "CQ000001",
          body: {
            ngaylam: "2097-10-10",
            giovao: "06:00",
            giora: "12:30",
            heso: 1,
            tienthuong: "abc",
            lydochinhsua: "Sửa thưởng",
          },
        }),
        { params: Promise.resolve({ id: maBangLuongNv7 }) },
      );
      expect(resBadBonus.status).toBe(400);
      const bodyBadBonus = await resBadBonus.json();
      expect(bodyBadBonus.error.message).toBe("Số tiền thưởng không hợp lệ");

      // TC_8.3_07: Thử gửi kèm mucluongtheogio -> Bị chặn (không cho sửa mức lương theo giờ ở UC_8.3)
      const resEditRate = await putChinhSuaBangLuong(
        await makeReq(`/api/bang-luong/${maBangLuongNv7}`, {
          method: "PUT",
          role: "ChuQuan",
          userId: "CQ000001",
          body: {
            ngaylam: "2097-10-10",
            giovao: "06:00",
            giora: "12:30",
            heso: 1,
            tienthuong: 50000,
            lydochinhsua: "Thử sửa mức lương",
            mucluongtheogio: 99000,
          },
        }),
        { params: Promise.resolve({ id: maBangLuongNv7 }) },
      );
      expect(resEditRate.status).toBe(400);

      // TC_8.3_08: Giờ kết thúc sớm hơn hoặc bằng giờ vào (05:00 <= 06:00) -> Bị từ chối 400
      const resBadHours = await putChinhSuaBangLuong(
        await makeReq(`/api/bang-luong/${maBangLuongNv7}`, {
          method: "PUT",
          role: "ChuQuan",
          userId: "CQ000001",
          body: {
            ngaylam: "2097-10-10",
            giovao: "06:00",
            giora: "05:00",
            heso: 1,
            tienthuong: 0,
            lydochinhsua: "Giờ ra trước giờ vào",
          },
        }),
        { params: Promise.resolve({ id: maBangLuongNv7 }) },
      );
      expect(resBadHours.status).toBe(400);
    });

    it("TC_8.3_02: Chỉnh sửa sai sót bảng lương -> tính lại tiền công và tổng lương, lưu kèm lý do, hiện 'Tính lương thành công'", async () => {
      await prisma.phanHoiLuong.createMany({
        data: [
          {
            Maphanhoi: "PH970001",
            Mabangluong: maBangLuongNv7,
            Noidung: "Thiếu 1 giờ ngày 10/10",
            Ngaygui: new Date("2097-10-25T00:00:00.000Z"),
            Trangthai: "Chưa xử lý",
          },
          {
            Maphanhoi: "PH970002",
            Mabangluong: maBangLuongNv7,
            Noidung: "Thắc mắc tiền thưởng",
            Ngaygui: new Date("2097-10-26T00:00:00.000Z"),
            Trangthai: "Chưa xử lý",
          },
        ],
      });

      const resEdit = await putChinhSuaBangLuong(
        await makeReq(`/api/bang-luong/${maBangLuongNv7}`, {
          method: "PUT",
          role: "ChuQuan",
          userId: "CQ000001",
          body: {
            maphanhoi: "PH970001",
            ngaylam: "2097-10-10",
            giovao: "06:00",
            giora: "11:30",
            heso: 1,
            tienthuong: 100000,
            lydochinhsua: "Cộng thưởng chuyên cần 100k",
          },
        }),
        { params: Promise.resolve({ id: maBangLuongNv7 }) },
      );
      expect(resEdit.status).toBe(200);
      const bodyEdit = await resEdit.json();
      expect(bodyEdit.data.tongluong).toBe(280500 + 100000); // 380.500đ (khớp TC_4.1_10)
      expect(bodyEdit.data.message).toBe("Tính lương thành công");
    });

    it("TC_8.6_02, TC_8.6_01, TC_8.6_04, TC_8.6_05, TC_8.6_06: Không chốt được khi còn phản hồi chưa xử lý; xử lý xong chốt thành công; kỳ đã chốt không sửa hay chốt lần 2 được", async () => {
      // Hiện còn PH970002 đang 'Chưa xử lý' -> TC_8.6_02: Bấm Chốt bảng lương bị chặn (400/409), kỳ vẫn Dự kiến
      const resChotBlocked = await postChotBangLuong(
        await makeReq("/api/ky-luong/KL209710/chot", {
          method: "POST",
          role: "ChuQuan",
          userId: "CQ000001",
        }),
        { params: Promise.resolve({ id: "KL209710" }) },
      );
      expect(resChotBlocked.status).toBeGreaterThanOrEqual(400);
      const kyStillDraft = await prisma.kyLuong.findUnique({
        where: { Makyluong: "KL209710" },
      });
      expect(kyStillDraft?.Trangthai.trim()).toBe("Dự kiến");

      // TC_8.3_04 (nhánh 5a): Ghi nhận không chỉnh sửa cho PH970002 -> 'Ghi nhận không chỉnh sửa'
      const resNoEdit = await postKhongChinhSuaPhanHoi(
        await makeReq("/api/phan-hoi-luong/PH970002/khong-chinh-sua", {
          method: "POST",
          role: "ChuQuan",
          userId: "CQ000001",
        }),
        { params: Promise.resolve({ id: "PH970002" }) },
      );
      expect(resNoEdit.status).toBe(200);
      const bodyNoEdit = await resNoEdit.json();
      expect(bodyNoEdit.data.message).toBe("Ghi nhận không chỉnh sửa");

      // TC_8.6_05: Thử chốt kỳ 'Chưa tính' (KL209712) -> Bị từ chối
      const resChotChuaTinh = await postChotBangLuong(
        await makeReq("/api/ky-luong/KL209712/chot", {
          method: "POST",
          role: "ChuQuan",
          userId: "CQ000001",
        }),
        { params: Promise.resolve({ id: "KL209712" }) },
      );
      expect(resChotChuaTinh.status).toBeGreaterThanOrEqual(400);

      // TC_8.6_01: Khi 0 phản hồi chưa xử lý -> Chốt bảng lương thành công
      const resChotOk = await postChotBangLuong(
        await makeReq("/api/ky-luong/KL209710/chot", {
          method: "POST",
          role: "ChuQuan",
          userId: "CQ000001",
        }),
        { params: Promise.resolve({ id: "KL209710" }) },
      );
      expect(resChotOk.status).toBe(200);
      const bodyChotOk = await resChotOk.json();
      expect(bodyChotOk.data.message).toBe("Chốt bảng lương thành công");

      // TC_8.6_06: Chốt lần hai cho kỳ đã chốt -> Bị từ chối
      const resChotTwice = await postChotBangLuong(
        await makeReq("/api/ky-luong/KL209710/chot", {
          method: "POST",
          role: "ChuQuan",
          userId: "CQ000001",
        }),
        { params: Promise.resolve({ id: "KL209710" }) },
      );
      expect(resChotTwice.status).toBeGreaterThanOrEqual(400);

      // TC_8.3_09 & TC_8.6_04 & TC_7.1_05: Kỳ đã chốt (KL209710) -> Thử sửa bảng lương, tiền thưởng đều bị từ chối
      const resEditAfterLock = await putChinhSuaBangLuong(
        await makeReq(`/api/bang-luong/${maBangLuongNv7}`, {
          method: "PUT",
          role: "ChuQuan",
          userId: "CQ000001",
          body: {
            ngaylam: "2097-10-10",
            giovao: "06:00",
            giora: "12:30",
            heso: 1,
            tienthuong: 200000,
            lydochinhsua: "Thử sửa sau khi chốt",
          },
        }),
        { params: Promise.resolve({ id: maBangLuongNv7 }) },
      );
      expect(resEditAfterLock.status).toBe(400);

      const resThuongAfterLock = await postTienThuong(
        await makeReq("/api/tien-thuong", {
          method: "POST",
          role: "ChuQuan",
          userId: "CQ000001",
          body: {
            Makyluong: "KL209710",
            Manv: "NV000007",
            Tienthuong: 500000,
            Lydothuong: "Thử sửa thưởng sau khi chốt",
          },
        }),
        { params: Promise.resolve({}) },
      );
      expect(resThuongAfterLock.status).toBe(400);
    });
  });
});
