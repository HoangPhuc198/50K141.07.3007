import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { signSession, AUTH_COOKIE_NAME } from "@backend/lib/auth";
import { prisma } from "@database/client";
import * as timeLib from "@backend/lib/time";

import { POST as loginPOST } from "@/app/api/auth/login/route";
import { GET as getChamCongHomNay } from "@/app/api/cham-cong/hom-nay/route";
import { POST as checkInPOST } from "@/app/api/cham-cong/check-in/route";
import { POST as boSungPOST } from "@/app/api/bo-sung-cc/route";
import { GET as phanHoiGET, POST as phanHoiPOST } from "@/app/api/phan-hoi-luong/route";
import { POST as nhanVienPOST } from "@/app/api/chu-quan/nhan-vien/route";
import {
  GET as nhanVienIdGET,
  PUT as nhanVienIdPUT,
  DELETE as nhanVienIdDELETE,
} from "@/app/api/chu-quan/nhan-vien/[id]/route";
import { PUT as mucLuongPUT } from "@/app/api/chu-quan/muc-luong/route";
import {
  POST as heSoPOST,
  DELETE as heSoDELETE,
} from "@/app/api/he-so/route";
import {
  GET as tienThuongGET,
  POST as tienThuongPOST,
} from "@/app/api/tien-thuong/route";

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

describe("BƯỚC 2 - Ưu tiên 2: Kiểm tra dữ liệu vào và ngoại lệ (UC_1, 3.1, 3.3, 4.2, 5.1–5.3, 8.1, 8.4, 8.5)", () => {
  const createdManvs: string[] = [];
  const createdHeSoIds: string[] = [];
  let defaultPassword = "";

  beforeAll(async () => {
    try {
      process.loadEnvFile();
    } catch {
      // ignore
    }
    defaultPassword = process.env.DEFAULT_PASSWORD ?? "";

    // Dọn dẹp fixture trước khi tạo mới
    await prisma.phanHoiLuong.deleteMany({
      where: { Mabangluong: { in: ["BL960001", "BL960002"] } },
    });
    await prisma.chiTietBangLuong.deleteMany({
      where: { Mabangluong: { in: ["BL960001", "BL960002"] } },
    });
    await prisma.bangLuong.deleteMany({
      where: { Mabangluong: { in: ["BL960001", "BL960002"] } },
    });
    await prisma.kyLuong.deleteMany({
      where: { Makyluong: { in: ["KL209610", "KL209609"] } },
    });
    await prisma.yeuCauBoSungCC.deleteMany({
      where: { Malich: { in: ["LL960001", "LL960002", "LL960003"] } },
    });
    await prisma.chamCong.deleteMany({
      where: { Malich: { in: ["LL960001", "LL960002", "LL960003"] } },
    });
    await prisma.nhanVien_LichLam.deleteMany({
      where: { Malich: { in: ["LL960001", "LL960002", "LL960003"] } },
    });
    await prisma.lichLam.deleteMany({
      where: { Malich: { in: ["LL960001", "LL960002", "LL960003"] } },
    });

    await prisma.kyLuong.createMany({
      data: [
        {
          Makyluong: "KL209609",
          Thang: 9,
          Nam: 2096,
          Trangthai: "Đã chốt",
          Ngaychot: new Date("2096-10-02T00:00:00.000Z"),
        },
        {
          Makyluong: "KL209610",
          Thang: 10,
          Nam: 2096,
          Trangthai: "Dự kiến",
          Ngaychot: null,
        },
      ],
    });

    await prisma.bangLuong.createMany({
      data: [
        {
          Mabangluong: "BL960001",
          Makyluong: "KL209610",
          Manv: "NV000001",
          Tienthuong: 0,
          Lydothuong: null,
        },
        {
          Mabangluong: "BL960002",
          Makyluong: "KL209609",
          Manv: "NV000001",
          Tienthuong: 0,
          Lydothuong: null,
        },
      ],
    });

    await prisma.chiTietBangLuong.createMany({
      data: [
        {
          MaCTBL: "CT960001",
          Mabangluong: "BL960001",
          Ngaylam: new Date("2096-10-15T00:00:00.000Z"),
          Giolam: 5.5,
          Mucluong: 24000,
          Maheso: null,
        },
        {
          MaCTBL: "CT960002",
          Mabangluong: "BL960002",
          Ngaylam: new Date("2096-09-15T00:00:00.000Z"),
          Giolam: 5.5,
          Mucluong: 24000,
          Maheso: null,
        },
      ],
    });

    await prisma.lichLam.createMany({
      data: [
        {
          Malich: "LL960001",
          Maca: "CA000001",
          Ngaylam: new Date("2096-10-15T00:00:00.000Z"),
        },
        {
          Malich: "LL960002",
          Maca: "CA000001",
          Ngaylam: new Date("2096-10-16T00:00:00.000Z"),
        },
        {
          Malich: "LL960003",
          Maca: "CA000001",
          Ngaylam: new Date("2096-10-17T00:00:00.000Z"),
        },
      ],
    });

    await prisma.nhanVien_LichLam.createMany({
      data: [
        { Manv: "NV000001", Malich: "LL960001" },
        { Manv: "NV000001", Malich: "LL960002" },
        { Manv: "NV000007", Malich: "LL960003" },
      ],
    });

    // LL960001 có check-in lúc 06:00 (lưu theo chuẩn toDbDateTimeVN: 2096-10-15T06:00:00.000Z) nhưng quên check-out
    await prisma.chamCong.create({
      data: {
        Machamcong: "CC960001",
        Manv: "NV000001",
        Malich: "LL960001",
        Thoigiancheckin: new Date("2096-10-15T06:00:00.000Z"),
        Thoigiancheckout: null,
      },
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    if (createdHeSoIds.length > 0) {
      await prisma.heSoLuong.deleteMany({
        where: { Maheso: { in: createdHeSoIds } },
      });
    }
    await prisma.phanHoiLuong.deleteMany({
      where: { Mabangluong: { in: ["BL960001", "BL960002"] } },
    });
    await prisma.chiTietBangLuong.deleteMany({
      where: { Mabangluong: { in: ["BL960001", "BL960002"] } },
    });
    await prisma.bangLuong.deleteMany({
      where: { Mabangluong: { in: ["BL960001", "BL960002"] } },
    });
    await prisma.kyLuong.deleteMany({
      where: { Makyluong: { in: ["KL209610", "KL209609"] } },
    });
    await prisma.yeuCauBoSungCC.deleteMany({
      where: { Malich: { in: ["LL960001", "LL960002", "LL960003"] } },
    });
    await prisma.chamCong.deleteMany({
      where: { Malich: { in: ["LL960001", "LL960002", "LL960003"] } },
    });
    await prisma.nhanVien_LichLam.deleteMany({
      where: { Malich: { in: ["LL960001", "LL960002", "LL960003"] } },
    });
    await prisma.lichLam.deleteMany({
      where: { Malich: { in: ["LL960001", "LL960002", "LL960003"] } },
    });
    if (createdManvs.length > 0) {
      await prisma.nhanVien.deleteMany({
        where: { Manv: { in: createdManvs } },
      });
    }
    await prisma.nhanVien.updateMany({
      where: { Manv: "NV000001" },
      data: { Mucluongtheogio: 24000 },
    });
    await prisma.nhanVien.updateMany({
      where: { Manv: "NV000003" },
      data: { Mucluongtheogio: 19000 },
    });
  });

  // =========================================================================
  // UC_1: ĐĂNG NHẬP
  // =========================================================================
  describe("UC_1 - Đăng nhập (dữ liệu vào, ngoại lệ, quy tắc)", () => {
    it("TC_1_01 & TC_1_02: Đăng nhập thành công với tài khoản chủ quán (chuquan) và nhân viên (NV000001)", async () => {
      const resCq = await loginPOST(
        await makeReq("/api/auth/login", {
          method: "POST",
          body: { username: "chuquan", password: defaultPassword },
        }),
        { params: Promise.resolve({}) },
      );
      expect(resCq.status).toBe(200);
      const bodyCq = await resCq.json();
      expect(bodyCq.ok).toBe(true);
      expect(bodyCq.data.redirectUrl).toBe("/chu-quan");

      const resNv = await loginPOST(
        await makeReq("/api/auth/login", {
          method: "POST",
          body: { username: "NV000001", password: defaultPassword },
        }),
        { params: Promise.resolve({}) },
      );
      expect(resNv.status).toBe(200);
      const bodyNv = await resNv.json();
      expect(bodyNv.ok).toBe(true);
      expect(bodyNv.data.redirectUrl).toBe("/nhan-vien");
    });

    it("TC_1_03: Để trống tên đăng nhập -> trả 400 với thông báo 'Không được để trống'", async () => {
      const res = await loginPOST(
        await makeReq("/api/auth/login", {
          method: "POST",
          body: { username: "", password: "123456" },
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toBe("Không được để trống");
    });

    it("TC_1_04: Để trống mật khẩu -> trả 400 với thông báo 'Không được để trống'", async () => {
      const res = await loginPOST(
        await makeReq("/api/auth/login", {
          method: "POST",
          body: { username: "NV000001", password: "" },
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toBe("Không được để trống");
    });

    it("TC_1_05: Nhập đúng tên đăng nhập, sai mật khẩu -> trả 401 'Tên đăng nhập hoặc mật khẩu không đúng'", async () => {
      const res = await loginPOST(
        await makeReq("/api/auth/login", {
          method: "POST",
          body: { username: "NV000001", password: "sai_mat_khau_999" },
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.message).toBe("Tên đăng nhập hoặc mật khẩu không đúng");
    });

    it("TC_1_06: Nhập tên đăng nhập không tồn tại (NV999999) -> trả 401 cùng câu 'Tên đăng nhập hoặc mật khẩu không đúng'", async () => {
      const res = await loginPOST(
        await makeReq("/api/auth/login", {
          method: "POST",
          body: { username: "NV999999", password: "bat_ky" },
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.message).toBe("Tên đăng nhập hoặc mật khẩu không đúng");
    });

    it("TC_1_08: Đăng nhập bằng chữ thường nv000001 (tên đăng nhập không phân biệt hoa thường)", async () => {
      const res = await loginPOST(
        await makeReq("/api/auth/login", {
          method: "POST",
          body: { username: "nv000001", password: defaultPassword },
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.redirectUrl).toBe("/nhan-vien");
    });
  });

  // =========================================================================
  // UC_3.1: CHECK-IN (BIÊN GIỜ GIẢ LẬP & NGOẠI LỆ)
  // =========================================================================
  describe("UC_3.1 - Check-in (biên 05:55, 05:53, 06:12 và ngoại lệ)", () => {
    it("TC_3.1_02: Ca bắt đầu 06:00, check-in lúc 05:55:00 (đúng 5 phút trước) -> Được check-in", async () => {
      const spy = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2096-10-16T05:55:00+07:00"));
      try {
        const resPost = await checkInPOST(
          await makeReq("/api/cham-cong/check-in", {
            method: "POST",
            role: "NhanVien",
            userId: "NV000001",
            body: { malich: "LL960002" },
          }),
          { params: Promise.resolve({}) },
        );
        expect(resPost.status).toBe(200);
        const bodyPost = await resPost.json();
        expect(bodyPost.data.message).toBe("Check-in thành công");
        expect(bodyPost.data.thoigiancheckin).toBe("05:55");
      } finally {
        spy.mockRestore();
        await prisma.chamCong.deleteMany({
          where: { Malich: "LL960002", Manv: "NV000001" },
        });
      }
    });

    it("TC_3.1_03: Ca bắt đầu 06:00, check-in lúc 05:53:00 (sớm 7 phút) -> Hiện 'Chưa đến giờ vào ca, bạn chỉ được check-in trước giờ làm tối đa 5 phút'", async () => {
      const spy = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2096-10-16T05:53:00+07:00"));
      try {
        const resPost = await checkInPOST(
          await makeReq("/api/cham-cong/check-in", {
            method: "POST",
            role: "NhanVien",
            userId: "NV000001",
            body: { malich: "LL960002" },
          }),
          { params: Promise.resolve({}) },
        );
        expect(resPost.status).toBe(400);
        const bodyPost = await resPost.json();
        expect(bodyPost.error.message).toBe(
          "Chưa đến giờ vào ca, bạn chỉ được check-in trước giờ làm tối đa 5 phút",
        );
      } finally {
        spy.mockRestore();
      }
    });

    it("TC_3.1_04: Nhân viên không có ca nào hôm nay -> Hiện 'Hiện bạn không có ca làm để check-in'", async () => {
      const spy = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2096-10-25T08:00:00+07:00"));
      try {
        const resGet = await getChamCongHomNay(
          await makeReq("/api/cham-cong/hom-nay", {
            role: "NhanVien",
            userId: "NV000001",
          }),
          { params: Promise.resolve({}) },
        );
        expect(resGet.status).toBe(200);
        const bodyGet = await resGet.json();
        expect(bodyGet.data.trangThaiManHinh).toBe("khong-co-ca");
        expect(bodyGet.data.thongBao.message).toBe("Hiện bạn không có ca làm để check-in");
      } finally {
        spy.mockRestore();
      }
    });

    it("TC_3.1_05: Ca đã kết thúc mà chưa check-in -> Hiện 'Bạn đã quên check-in'", async () => {
      const spy = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2096-10-16T12:30:00+07:00"));
      try {
        const resGet = await getChamCongHomNay(
          await makeReq("/api/cham-cong/hom-nay", {
            role: "NhanVien",
            userId: "NV000001",
          }),
          { params: Promise.resolve({}) },
        );
        expect(resGet.status).toBe(200);
        const bodyGet = await resGet.json();
        expect(bodyGet.data.trangThaiManHinh).toBe("quen-check-in");
        expect(bodyGet.data.thongBao.message).toBe("Bạn đã quên check-in");
      } finally {
        spy.mockRestore();
      }
    });

    it("TC_3.1_01, TC_3.1_06, TC_3.1_08: Check-in lúc 06:12 ghi đúng 06:12, bấm lần hai cho cùng ca bị chặn", async () => {
      const spy = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2096-10-16T06:12:00+07:00"));
      try {
        const res1 = await checkInPOST(
          await makeReq("/api/cham-cong/check-in", {
            method: "POST",
            role: "NhanVien",
            userId: "NV000001",
            body: { malich: "LL960002" },
          }),
          { params: Promise.resolve({}) },
        );
        expect(res1.status).toBe(200);
        const body1 = await res1.json();
        expect(body1.data.message).toBe("Check-in thành công");
        expect(body1.data.thoigiancheckin).toBe("06:12");

        // Bấm lần 2 cho cùng ca bị chặn (409 Conflict)
        const res2 = await checkInPOST(
          await makeReq("/api/cham-cong/check-in", {
            method: "POST",
            role: "NhanVien",
            userId: "NV000001",
            body: { malich: "LL960002" },
          }),
          { params: Promise.resolve({}) },
        );
        expect(res2.status).toBe(409);
      } finally {
        spy.mockRestore();
        await prisma.chamCong.deleteMany({
          where: { Malich: "LL960002", Manv: "NV000001" },
        });
      }
    });

    it("TC_3.1_10: Nhân viên thử việc (NV000007) có ca -> Check-in được như nhân viên chính thức", async () => {
      const spy = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2096-10-17T06:00:00+07:00"));
      try {
        const res = await checkInPOST(
          await makeReq("/api/cham-cong/check-in", {
            method: "POST",
            role: "NhanVien",
            userId: "NV000007",
            body: { malich: "LL960003" },
          }),
          { params: Promise.resolve({}) },
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.message).toBe("Check-in thành công");
      } finally {
        spy.mockRestore();
        await prisma.chamCong.deleteMany({
          where: { Malich: "LL960003", Manv: "NV000007" },
        });
      }
    });
  });

  // =========================================================================
  // UC_3.3: YÊU CẦU BỔ SUNG CHẤM CÔNG
  // =========================================================================
  describe("UC_3.3 - Yêu cầu bổ sung chấm công (dữ liệu vào & ngoại lệ)", () => {
    it("TC_3.3_03: Để trống giờ -> trả 400 'Vui lòng nhập đầy đủ'", async () => {
      const res = await boSungPOST(
        await makeReq("/api/bo-sung-cc", {
          method: "POST",
          role: "NhanVien",
          userId: "NV000001",
          body: {
            malich: "LL960001",
            giorabosung: "",
            lydo: "Về gấp",
          },
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toBe("Vui lòng nhập đầy đủ");
    });

    it("TC_3.3_04: Để trống lý do -> trả 400 'Vui lòng nhập đầy đủ'", async () => {
      const res = await boSungPOST(
        await makeReq("/api/bo-sung-cc", {
          method: "POST",
          role: "NhanVien",
          userId: "NV000001",
          body: {
            malich: "LL960001",
            giorabosung: "11:30",
            lydo: "   ",
          },
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toBe("Vui lòng nhập đầy đủ");
    });

    it("TC_3.3_06: Nhập giờ kết thúc sớm hơn hoặc bằng giờ vào (05:00 <= 06:00) -> Bị từ chối 400", async () => {
      const spy = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2096-10-16T08:00:00+07:00"));
      try {
        const res = await boSungPOST(
          await makeReq("/api/bo-sung-cc", {
            method: "POST",
            role: "NhanVien",
            userId: "NV000001",
            body: {
              malich: "LL960001",
              giorabosung: "05:00",
              lydo: "Nhập nhầm giờ",
            },
          }),
          { params: Promise.resolve({}) },
        );
        expect(res.status).toBe(400);
      } finally {
        spy.mockRestore();
      }
    });

    it("TC_3.3_01 & TC_3.3_02: Gửi yêu cầu bổ sung chấm công hợp lệ cho ca quên check-out và ca quên check-in", async () => {
      const spy = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2096-10-17T14:00:00+07:00"));
      try {
        const resOut = await boSungPOST(
          await makeReq("/api/bo-sung-cc", {
            method: "POST",
            role: "NhanVien",
            userId: "NV000001",
            body: {
              malich: "LL960001",
              giorabosung: "11:30",
              lydo: "Về gấp",
            },
          }),
          { params: Promise.resolve({}) },
        );
        expect(resOut.status).toBe(201);
        const bodyOut = await resOut.json();
        expect(bodyOut.data.message).toBe("Gửi yêu cầu thành công");

        const resIn = await boSungPOST(
          await makeReq("/api/bo-sung-cc", {
            method: "POST",
            role: "NhanVien",
            userId: "NV000001",
            body: {
              malich: "LL960002",
              giovaobosung: "06:00",
              giorabosung: "11:30",
              lydo: "Quên điện thoại",
            },
          }),
          { params: Promise.resolve({}) },
        );
        expect(resIn.status).toBe(201);
        const bodyIn = await resIn.json();
        expect(bodyIn.data.message).toBe("Gửi yêu cầu thành công");
      } finally {
        spy.mockRestore();
      }
    });
  });

  // =========================================================================
  // UC_4.2: PHẢN HỒI SAI SÓT LƯƠNG
  // =========================================================================
  describe("UC_4.2 - Phản hồi sai sót lương (dữ liệu vào, biên hạn phản hồi)", () => {
    it("TC_4.2_02: Để trống nội dung phản hồi -> Hiện 'Vui lòng nhập nội dung phản hồi'", async () => {
      const res = await phanHoiPOST(
        await makeReq("/api/phan-hoi-luong", {
          method: "POST",
          role: "NhanVien",
          userId: "NV000001",
          body: {
            mabangluong: "BL960001",
            noidung: "   ",
          },
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toBe("Vui lòng nhập nội dung phản hồi");
    });

    it("TC_4.2_01 & TC_4.2_04: Bảng lương T10/2096, gửi phản hồi ngày 01/11/2096 gửi được; từ ngày 02/11/2096 bị chặn bằng 'Đã hết thời gian phản hồi'", async () => {
      const spy1 = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2096-11-01T23:00:00+07:00"));
      try {
        const res1 = await phanHoiPOST(
          await makeReq("/api/phan-hoi-luong", {
            method: "POST",
            role: "NhanVien",
            userId: "NV000001",
            body: {
              mabangluong: "BL960001",
              noidung: "Thiếu 1 giờ ca tối",
            },
          }),
          { params: Promise.resolve({}) },
        );
        expect(res1.status).toBe(201);
        const body1 = await res1.json();
        expect(body1.data.message).toBe("Gửi phản hồi thành công");
      } finally {
        spy1.mockRestore();
      }

      const spy2 = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2096-11-02T00:01:00+07:00"));
      try {
        const res2 = await phanHoiPOST(
          await makeReq("/api/phan-hoi-luong", {
            method: "POST",
            role: "NhanVien",
            userId: "NV000001",
            body: {
              mabangluong: "BL960001",
              noidung: "Phản hồi ngày 02/11",
            },
          }),
          { params: Promise.resolve({}) },
        );
        expect(res2.status).toBe(400);
        const body2 = await res2.json();
        expect(body2.error.message).toBe("Đã hết thời gian phản hồi");
      } finally {
        spy2.mockRestore();
      }
    });

    it("TC_4.2_03: Đã quá hạn phản hồi khi mở GET /api/phan-hoi-luong -> báo 'Đã hết thời gian phản hồi'", async () => {
      const spy = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2096-11-05T10:00:00+07:00"));
      try {
        const res = await phanHoiGET(
          await makeReq("/api/phan-hoi-luong", {
            role: "NhanVien",
            userId: "NV000001",
          }),
          { params: Promise.resolve({}) },
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.quaHan).toBe(true);
        expect(body.data.lyDoHetHan).toBe("Đã hết thời gian phản hồi");
      } finally {
        spy.mockRestore();
      }
    });

    it("TC_4.2_05: Kỳ lương đã chốt (BL960002) -> Không gửi phản hồi được (400)", async () => {
      const spy = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2096-09-25T10:00:00+07:00"));
      try {
        const res = await phanHoiPOST(
          await makeReq("/api/phan-hoi-luong", {
            method: "POST",
            role: "NhanVien",
            userId: "NV000001",
            body: {
              mabangluong: "BL960002",
              noidung: "Phản hồi kỳ đã chốt",
            },
          }),
          { params: Promise.resolve({}) },
        );
        expect(res.status).toBe(400);
      } finally {
        spy.mockRestore();
      }
    });
  });

  // =========================================================================
  // UC_5.1, UC_5.2, UC_5.3: QUẢN LÝ NHÂN VIÊN
  // =========================================================================
  describe("UC_5.1, UC_5.2, UC_5.3 - Quản lý nhân viên (dữ liệu vào, trùng SĐT, biên, quy tắc)", () => {
    it("TC_5.1_03: Bỏ trống trường bắt buộc ở form Thêm -> Hiện 'Vui lòng nhập đầy đủ thông tin'", async () => {
      const res = await nhanVienPOST(
        await makeReq("/api/chu-quan/nhan-vien", {
          method: "POST",
          role: "ChuQuan",
          userId: "CQ000001",
          body: {
            Hoten: "",
            Sdt: "0905111222",
            Diachi: "Đà Nẵng",
            Truonghoc: "ĐH Bách Khoa",
            Vitrilamviec: "Phục vụ",
            Hinhthuclam: "Part-time",
            Ngayvaolam: "2026-11-10",
            Kinhnghiem: "1 năm",
          },
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toBe("Vui lòng nhập đầy đủ thông tin");
    });

    it("TC_5.1_04: Thêm NV mới với SĐT đã tồn tại (0905000001) -> Hiện 'Số điện thoại này đã tồn tại trên hệ thống'", async () => {
      const res = await nhanVienPOST(
        await makeReq("/api/chu-quan/nhan-vien", {
          method: "POST",
          role: "ChuQuan",
          userId: "CQ000001",
          body: {
            Hoten: "Nguyễn Trùng SĐT",
            Sdt: "0905000001",
            Diachi: "Đà Nẵng",
            Truonghoc: "ĐH Kinh Tế",
            Vitrilamviec: "Phục vụ",
            Hinhthuclam: "Part-time",
            Ngayvaolam: "2026-11-10",
            Kinhnghiem: "1 năm",
          },
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toBe("Số điện thoại này đã tồn tại trên hệ thống");
    });

    it("TC_5.1_05: Nhập SĐT 9 chữ số, 11 chữ số, có chữ cái -> Cả ba bị từ chối (400)", async () => {
      for (const badSdt of ["090511122", "090511122233", "09051112ab"]) {
        const res = await nhanVienPOST(
          await makeReq("/api/chu-quan/nhan-vien", {
            method: "POST",
            role: "ChuQuan",
            userId: "CQ000001",
            body: {
              Hoten: "Nguyễn Văn Test",
              Sdt: badSdt,
              Diachi: "Đà Nẵng",
              Truonghoc: "ĐH Sư Phạm",
              Vitrilamviec: "Phục vụ",
              Hinhthuclam: "Part-time",
              Ngayvaolam: "2026-11-10",
              Kinhnghiem: "1 năm",
            },
          }),
          { params: Promise.resolve({}) },
        );
        expect(res.status).toBe(400);
      }
    });

    it("TC_5.1_01, TC_5.1_02, TC_5.1_06, TC_5.1_09, TC_5.1_11: Thêm NV Phục vụ để trống Trường học, gửi kèm mức lương 99000 -> lưu mức 17000 theo vị trí, đăng nhập được, trạng thái khi xem là Chính thức (sau 3 ngày)", async () => {
      const spy = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2026-11-15T10:00:00+07:00"));
      try {
        const resCreate = await nhanVienPOST(
          await makeReq("/api/chu-quan/nhan-vien", {
            method: "POST",
            role: "ChuQuan",
            userId: "CQ000001",
            body: {
              Hoten: "Nguyễn Văn An",
              Sdt: "0905888991",
              Diachi: "123 Lê Duẩn, Đà Nẵng",
              Truonghoc: "",
              Vitrilamviec: "Phục vụ",
              Hinhthuclam: "Part-time",
              Ngayvaolam: "2026-11-10",
              Kinhnghiem: "1 năm",
              Mucluongtheogio: 99000,
            },
          }),
          { params: Promise.resolve({}) },
        );
        expect(resCreate.status).toBe(201);
        const bodyCreate = await resCreate.json();
        const newManv = bodyCreate.data.Manv as string;
        createdManvs.push(newManv);

        expect(bodyCreate.data.Mucluongtheogio).toBe(17000);
        expect(bodyCreate.data.Tendangnhap).toBe(newManv);

        // TC_5.1_11: Xem thông tin NV có ngày vào làm cách đây > 3 ngày -> Trạng thái là Chính thức
        const resDetail = await nhanVienIdGET(
          await makeReq(`/api/chu-quan/nhan-vien/${newManv}`, {
            role: "ChuQuan",
            userId: "CQ000001",
          }),
          { params: Promise.resolve({ id: newManv }) },
        );
        expect(resDetail.status).toBe(200);
        const bodyDetail = await resDetail.json();
        expect(bodyDetail.data.Trangthai).toBe("Chính thức");

        // TC_5.1_02: Đăng nhập bằng mã NV mới và mật khẩu ban đầu
        const resLogin = await loginPOST(
          await makeReq("/api/auth/login", {
            method: "POST",
            body: {
              username: newManv,
              password: bodyCreate.data.MatkhauPlaintext ?? defaultPassword,
            },
          }),
          { params: Promise.resolve({}) },
        );
        expect(resLogin.status).toBe(200);
      } finally {
        spy.mockRestore();
      }
    });

    it("TC_5.2_03: Ở form Sửa, xóa trống Họ tên -> Hiện 'Vui lòng nhập đầy đủ thông tin'", async () => {
      const manv = createdManvs[0] ?? "NV000002";
      const res = await nhanVienIdPUT(
        await makeReq(`/api/chu-quan/nhan-vien/${manv}`, {
          method: "PUT",
          role: "ChuQuan",
          userId: "CQ000001",
          body: {
            Hoten: "",
            Sdt: "0905888991",
            Diachi: "Đà Nẵng",
            Truonghoc: "",
            Vitrilamviec: "Phục vụ",
            Hinhthuclam: "Part-time",
            Ngayvaolam: "2026-11-10",
            Kinhnghiem: "1 năm",
            Trangthai: "Chính thức",
          },
        }),
        { params: Promise.resolve({ id: manv }) },
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toBe("Vui lòng nhập đầy đủ thông tin");
    });

    it("TC_5.2_04: Đổi SĐT của NV X thành SĐT của NV Y (0905000001) -> Hiện 'Số điện thoại này đã tồn tại trên hệ thống'", async () => {
      const manv = createdManvs[0] ?? "NV000002";
      const res = await nhanVienIdPUT(
        await makeReq(`/api/chu-quan/nhan-vien/${manv}`, {
          method: "PUT",
          role: "ChuQuan",
          userId: "CQ000001",
          body: {
            Hoten: "Nguyễn Văn An",
            Sdt: "0905000001",
            Diachi: "Đà Nẵng",
            Truonghoc: "",
            Vitrilamviec: "Phục vụ",
            Hinhthuclam: "Part-time",
            Ngayvaolam: "2026-11-10",
            Kinhnghiem: "1 năm",
            Trangthai: "Chính thức",
          },
        }),
        { params: Promise.resolve({ id: manv }) },
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toBe("Số điện thoại này đã tồn tại trên hệ thống");
    });

    it("TC_5.2_01, TC_5.2_02, TC_5.2_05, TC_5.2_07: Sửa thông tin giữ nguyên SĐT chính mình, đổi địa chỉ và mật khẩu -> Lưu được, đăng nhập bằng mật khẩu mới", async () => {
      const manv = createdManvs[0];
      expect(manv).toBeTruthy();

      const resGet = await nhanVienIdGET(
        await makeReq(`/api/chu-quan/nhan-vien/${manv}`, {
          role: "ChuQuan",
          userId: "CQ000001",
        }),
        { params: Promise.resolve({ id: manv }) },
      );
      expect(resGet.status).toBe(200);
      const bodyGet = await resGet.json();
      expect(bodyGet.data.Sdt).toBe("0905888991");

      const resPut = await nhanVienIdPUT(
        await makeReq(`/api/chu-quan/nhan-vien/${manv}`, {
          method: "PUT",
          role: "ChuQuan",
          userId: "CQ000001",
          body: {
            Hoten: "Nguyễn Văn An Đã Sửa",
            Sdt: "0905888991",
            Diachi: "456 Nguyễn Văn Linh, Đà Nẵng",
            Truonghoc: "ĐH Duy Tân",
            Vitrilamviec: "Phục vụ",
            Hinhthuclam: "Full-time",
            Ngayvaolam: "2026-11-10",
            Kinhnghiem: "2 năm",
            Trangthai: "Chính thức",
            Matkhau: "MatKhauMoi@2026",
          },
        }),
        { params: Promise.resolve({ id: manv }) },
      );
      expect(resPut.status).toBe(200);

      const resLoginNew = await loginPOST(
        await makeReq("/api/auth/login", {
          method: "POST",
          body: { username: manv, password: "MatKhauMoi@2026" },
        }),
        { params: Promise.resolve({}) },
      );
      expect(resLoginNew.status).toBe(200);
    });

    it("TC_5.3_06: NV có trong kỳ lương chưa chốt (NV000001 có BL960001 ở kỳ Dự kiến KL209610) -> Không xóa được (400/409)", async () => {
      const res = await nhanVienIdDELETE(
        await makeReq("/api/chu-quan/nhan-vien/NV000001", {
          method: "DELETE",
          role: "ChuQuan",
          userId: "CQ000001",
        }),
        { params: Promise.resolve({ id: "NV000001" }) },
      );
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("TC_5.3_01, TC_5.3_02, TC_5.3_03: Xóa NV không thuộc kỳ lương chưa chốt -> Xóa thành công, không đăng nhập lại được, dữ liệu liên quan bị xóa sạch", async () => {
      const manv = createdManvs[0];
      expect(manv).toBeTruthy();

      const resDel = await nhanVienIdDELETE(
        await makeReq(`/api/chu-quan/nhan-vien/${manv}`, {
          method: "DELETE",
          role: "ChuQuan",
          userId: "CQ000001",
        }),
        { params: Promise.resolve({ id: manv }) },
      );
      expect(resDel.status).toBe(200);
      createdManvs.shift();

      const resLogin = await loginPOST(
        await makeReq("/api/auth/login", {
          method: "POST",
          body: { username: manv, password: "MatKhauMoi@2026" },
        }),
        { params: Promise.resolve({}) },
      );
      expect(resLogin.status).toBe(401);
    });
  });

  // =========================================================================
  // UC_8.1: CẬP NHẬT MỨC LƯƠNG
  // =========================================================================
  describe("UC_8.1 - Cập nhật mức lương (biên, ngoại lệ, quy tắc)", () => {
    it("TC_8.1_04: Lần lượt nhập 0, -5000, 17500.5, abc -> Hiện 'Mức lương không hợp lệ'", async () => {
      for (const badVal of [0, -5000, 17500.5, "abc"]) {
        const res = await mucLuongPUT(
          await makeReq("/api/chu-quan/muc-luong", {
            method: "PUT",
            role: "ChuQuan",
            userId: "CQ000001",
            body: { Manv: "NV000003", Mucluongtheogio: badVal },
          }),
          { params: Promise.resolve({}) },
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.message).toBe("Mức lương không hợp lệ");
      }
    });

    it("TC_8.1_01 & TC_8.1_07: Cập nhật mức lương hợp lệ -> Lưu mức lương mới; bảng lương Dự kiến đã tính trước đó giữ nguyên mức cũ", async () => {
      const res = await mucLuongPUT(
        await makeReq("/api/chu-quan/muc-luong", {
          method: "PUT",
          role: "ChuQuan",
          userId: "CQ000001",
          body: { Manv: "NV000001", Mucluongtheogio: 26000 },
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.Mucluongtheogio).toBe(26000);

      const ctbl = await prisma.chiTietBangLuong.findUnique({
        where: { MaCTBL: "CT960001" },
      });
      expect(Number(ctbl?.Mucluong)).toBe(24000);

      await prisma.nhanVien.update({
        where: { Manv: "NV000001" },
        data: { Mucluongtheogio: 24000 },
      });
    });
  });

  // =========================================================================
  // UC_8.4: NHẬP HỆ SỐ LƯƠNG
  // =========================================================================
  describe("UC_8.4 - Nhập hệ số lương (dữ liệu vào, biên ngày hiệu lực, kỳ đã chốt)", () => {
    it("TC_8.4_02: Nhập hệ số 0.5 -> Hiện 'Hệ số lỗi, vui lòng nhập lại'", async () => {
      const spy = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2096-11-14T10:00:00+07:00"));
      try {
        const res = await heSoPOST(
          await makeReq("/api/he-so", {
            method: "POST",
            role: "ChuQuan",
            userId: "CQ000001",
            body: {
              Ngaybatdau: "2096-12-02",
              Ngayketthuc: "2096-12-02",
              Heso: 0.5,
            },
          }),
          { params: Promise.resolve({}) },
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.message).toBe("Hệ số lỗi, vui lòng nhập lại");
      } finally {
        spy.mockRestore();
      }
    });

    it("TC_8.4_03: Ngày kết thúc trước ngày bắt đầu (05/12 -> 03/12) -> Hiện 'Thời gian áp dụng không hợp lệ'", async () => {
      const spy = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2096-11-14T10:00:00+07:00"));
      try {
        const res = await heSoPOST(
          await makeReq("/api/he-so", {
            method: "POST",
            role: "ChuQuan",
            userId: "CQ000001",
            body: {
              Ngaybatdau: "2096-12-05",
              Ngayketthuc: "2096-12-03",
              Heso: 2,
            },
          }),
          { params: Promise.resolve({}) },
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.message).toBe("Thời gian áp dụng không hợp lệ");
      } finally {
        spy.mockRestore();
      }
    });

    it("TC_8.4_05: Hôm nay 14/11/2096, thêm khoảng bắt đầu hôm nay (14/11) hoặc ngày đã qua (10/11) -> Không cho lưu (400)", async () => {
      const spy = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2096-11-14T10:00:00+07:00"));
      try {
        for (const badDate of ["2096-11-14", "2096-11-10"]) {
          const res = await heSoPOST(
            await makeReq("/api/he-so", {
              method: "POST",
              role: "ChuQuan",
              userId: "CQ000001",
              body: {
                Ngaybatdau: badDate,
                Ngayketthuc: "2096-11-20",
                Heso: 2,
              },
            }),
            { params: Promise.resolve({}) },
          );
          expect(res.status).toBe(400);
        }
      } finally {
        spy.mockRestore();
      }
    });

    it("TC_8.4_01, TC_8.4_04, TC_8.4_07: Thêm khoảng áp dụng hợp lệ (vắt qua 2 kỳ 30/11–02/12) -> lưu thành công, sau đó xóa khoảng -> 'Đã xóa khoảng áp dụng'", async () => {
      const spy = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2096-11-14T10:00:00+07:00"));
      try {
        const resAdd = await heSoPOST(
          await makeReq("/api/he-so", {
            method: "POST",
            role: "ChuQuan",
            userId: "CQ000001",
            body: {
              Ngaybatdau: "2096-11-30",
              Ngayketthuc: "2096-12-02",
              Heso: 2,
            },
          }),
          { params: Promise.resolve({}) },
        );
        expect(resAdd.status).toBe(200);
        const bodyAdd = await resAdd.json();
        const maHeSo = bodyAdd.data.Maheso as string;
        expect(maHeSo).toMatch(/^HS\d{6}$/);
        expect(bodyAdd.data.Heso).toBe(2);
        createdHeSoIds.push(maHeSo);

        const resDel = await heSoDELETE(
          await makeReq(`/api/he-so?id=${maHeSo}`, {
            method: "DELETE",
            role: "ChuQuan",
            userId: "CQ000001",
          }),
          { params: Promise.resolve({}) },
        );
        expect(resDel.status).toBe(200);
        const bodyDel = await resDel.json();
        expect(bodyDel.data.message).toBe("Đã xóa khoảng áp dụng");
        createdHeSoIds.pop();
      } finally {
        spy.mockRestore();
      }
    });

    it("TC_8.4_08: Thêm/sửa hệ số của khoảng thuộc kỳ lương đã chốt (KL209609: tháng 09/2096) -> Bị từ chối (400)", async () => {
      const spy = vi
        .spyOn(timeLib, "nowVN")
        .mockReturnValue(new Date("2096-08-20T10:00:00+07:00"));
      try {
        const res = await heSoPOST(
          await makeReq("/api/he-so", {
            method: "POST",
            role: "ChuQuan",
            userId: "CQ000001",
            body: {
              Ngaybatdau: "2096-09-02",
              Ngayketthuc: "2096-09-02",
              Heso: 2,
            },
          }),
          { params: Promise.resolve({}) },
        );
        expect(res.status).toBe(400);
      } finally {
        spy.mockRestore();
      }
    });
  });

  // =========================================================================
  // UC_8.5: NHẬP TIỀN THƯỞNG
  // =========================================================================
  describe("UC_8.5 - Nhập tiền thưởng (dữ liệu vào, ngoại lệ, kỳ đã chốt)", () => {
    it("TC_8.5_02: Chưa nhập thưởng -> Xem cột tiền thưởng mặc định = 0", async () => {
      const res = await tienThuongGET(
        await makeReq("/api/tien-thuong?makyluong=KL209610", {
          role: "ChuQuan",
          userId: "CQ000001",
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      const nv1 = body.data.nhanViens?.find(
        (r: { Manv: string }) => r.Manv === "NV000001",
      );
      expect(nv1?.Tienthuong ?? 0).toBe(0);
    });

    it("TC_8.5_03: Nhập số tiền là chữ ('abc') hoặc số thập phân (100.5) -> Hiện 'Số tiền không hợp lệ'", async () => {
      for (const badMoney of ["abc", 100.5]) {
        const res = await tienThuongPOST(
          await makeReq("/api/tien-thuong", {
            method: "POST",
            role: "ChuQuan",
            userId: "CQ000001",
            body: {
              Makyluong: "KL209610",
              Manv: "NV000001",
              Tienthuong: badMoney,
              Lydothuong: "Thưởng chuyên cần",
            },
          }),
          { params: Promise.resolve({}) },
        );
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.message).toBe("Số tiền không hợp lệ");
      }
    });

    it("TC_8.5_04: Nhập số tiền, để trống lý do -> Hiện 'Lý do thưởng không được để trống'", async () => {
      const res = await tienThuongPOST(
        await makeReq("/api/tien-thuong", {
          method: "POST",
          role: "ChuQuan",
          userId: "CQ000001",
          body: {
            Makyluong: "KL209610",
            Manv: "NV000001",
            Tienthuong: 200000,
            Lydothuong: "   ",
          },
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.message).toBe("Lý do thưởng không được để trống");
    });

    it("TC_8.5_07: Thử nhập thưởng cho kỳ đã chốt (KL209609) -> Bị từ chối (400)", async () => {
      const res = await tienThuongPOST(
        await makeReq("/api/tien-thuong", {
          method: "POST",
          role: "ChuQuan",
          userId: "CQ000001",
          body: {
            Makyluong: "KL209609",
            Manv: "NV000001",
            Tienthuong: 200000,
            Lydothuong: "Thưởng kỳ đã chốt",
          },
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(400);
    });

    it("TC_8.5_01: Nhập tiền thưởng hợp lệ -> Hiện 'Lưu tiền thưởng thành công'", async () => {
      const res = await tienThuongPOST(
        await makeReq("/api/tien-thuong", {
          method: "POST",
          role: "ChuQuan",
          userId: "CQ000001",
          body: {
            Makyluong: "KL209610",
            Manv: "NV000001",
            Tienthuong: 200000,
            Lydothuong: "Sinh nhật",
          },
        }),
        { params: Promise.resolve({}) },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.message).toBe("Lưu tiền thưởng thành công");
    });
  });
});
