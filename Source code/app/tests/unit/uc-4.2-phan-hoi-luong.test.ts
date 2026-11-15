/**
 * Unit / API tests cho UC_4.2 - Phản hồi sai sót lương (Nhân viên).
 * Bao gồm: 401/403, phản hồi bảng lương người khác, quá hạn (từ ngày 2 tháng sau hoặc Đã chốt),
 * trống nội dung, gửi thành công & đọc lại (round-trip), và ranh giới thời gian isQuaHanPhanHoi.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@database/client";
import { AUTH_COOKIE_NAME, signSession } from "@backend/lib/auth";
import { GET, POST } from "@/app/api/phan-hoi-luong/route";
import { isQuaHanPhanHoi } from "@backend/services/phan-hoi-luong";
import * as thongBao from "@frontend/config/thong-bao";

const KY_HOP_LE = "KL209911"; // 11/2099 Dự kiến (chưa quá hạn)
const KY_QUA_HAN = "KL202001"; // 01/2020 Dự kiến (quá hạn so với nowVN)
const KY_DA_CHOT = "KL209910"; // 10/2099 Đã chốt

const BL_A_HOP_LE = "BL42AHL1";
const BL_B_HOP_LE = "BL42BHL1";
const BL_A_QUA_HAN = "BL42AQH1";
const BL_A_CHOT = "BL42ACH1";

const NV_A = "NV000001";
const NV_B = "NV000002";

function reqGet(token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers.cookie = `${AUTH_COOKIE_NAME}=${token}`;
  return new NextRequest("http://localhost:3000/api/phan-hoi-luong", { headers });
}

function reqPost(token: string | undefined, body: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.cookie = `${AUTH_COOKIE_NAME}=${token}`;
  return new NextRequest("http://localhost:3000/api/phan-hoi-luong", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("UC_4.2 - Quy tắc hạn phản hồi trước ngày 2 tháng sau", () => {
  it("Ngày 1 tháng sau vẫn còn hạn, từ ngày 2 tháng sau là quá hạn", () => {
    expect(isQuaHanPhanHoi(10, 2026, "Dự kiến", new Date(2026, 9, 31, 23, 59))).toBe(false);
    expect(isQuaHanPhanHoi(10, 2026, "Dự kiến", new Date(2026, 10, 1, 23, 59))).toBe(false);
    expect(isQuaHanPhanHoi(10, 2026, "Dự kiến", new Date(2026, 10, 2, 0, 0))).toBe(true);
    expect(isQuaHanPhanHoi(12, 2026, "Dự kiến", new Date(2027, 0, 1, 18, 0))).toBe(false);
    expect(isQuaHanPhanHoi(12, 2026, "Dự kiến", new Date(2027, 0, 2, 0, 1))).toBe(true);
    expect(isQuaHanPhanHoi(12, 2099, "Đã chốt", new Date(2026, 10, 1, 10, 0))).toBe(true);
  });
});

describe("UC_4.2 - API GET & POST /api/phan-hoi-luong", () => {
  let cqToken: string;
  let nvAToken: string;

  async function donDep() {
    await prisma.phanHoiLuong.deleteMany({
      where: { Mabangluong: { in: [BL_A_HOP_LE, BL_B_HOP_LE, BL_A_QUA_HAN, BL_A_CHOT] } },
    });
    await prisma.chiTietBangLuong.deleteMany({
      where: { Mabangluong: { in: [BL_A_HOP_LE, BL_B_HOP_LE, BL_A_QUA_HAN, BL_A_CHOT] } },
    });
    await prisma.bangLuong.deleteMany({
      where: { Mabangluong: { in: [BL_A_HOP_LE, BL_B_HOP_LE, BL_A_QUA_HAN, BL_A_CHOT] } },
    });
    await prisma.kyLuong.deleteMany({
      where: { Makyluong: { in: [KY_HOP_LE, KY_QUA_HAN, KY_DA_CHOT] } },
    });
  }

  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";
    cqToken = await signSession({ userId: "CQ000001", username: "chuquan", role: "ChuQuan", name: "Hoàng Lan" });
    nvAToken = await signSession({ userId: NV_A, username: NV_A, role: "NhanVien", name: "Nguyễn Minh Anh" });

    await donDep();

    await prisma.kyLuong.createMany({
      data: [
        { Makyluong: KY_QUA_HAN, Thang: 1, Nam: 2020, Trangthai: "Dự kiến" },
        { Makyluong: KY_DA_CHOT, Thang: 10, Nam: 2099, Trangthai: "Đã chốt", Ngaychot: new Date("2099-11-02") },
        { Makyluong: KY_HOP_LE, Thang: 11, Nam: 2099, Trangthai: "Dự kiến" },
      ],
    });

    await prisma.bangLuong.createMany({
      data: [
        { Mabangluong: BL_A_QUA_HAN, Manv: NV_A, Makyluong: KY_QUA_HAN, Tienthuong: 0, Lydothuong: null },
        { Mabangluong: BL_A_CHOT, Manv: NV_A, Makyluong: KY_DA_CHOT, Tienthuong: 0, Lydothuong: null },
        { Mabangluong: BL_A_HOP_LE, Manv: NV_A, Makyluong: KY_HOP_LE, Tienthuong: 100000, Lydothuong: "Test" },
        { Mabangluong: BL_B_HOP_LE, Manv: NV_B, Makyluong: KY_HOP_LE, Tienthuong: 0, Lydothuong: null },
      ],
    });

    await prisma.chiTietBangLuong.createMany({
      data: [
        { MaCTBL: "CT42A001", Mabangluong: BL_A_HOP_LE, Ngaylam: new Date("2099-11-10"), Giolam: 8, Mucluong: 25000 },
        { MaCTBL: "CT42B001", Mabangluong: BL_B_HOP_LE, Ngaylam: new Date("2099-11-10"), Giolam: 8, Mucluong: 25000 },
        { MaCTBL: "CT42QH01", Mabangluong: BL_A_QUA_HAN, Ngaylam: new Date("2020-01-10"), Giolam: 8, Mucluong: 25000 },
        { MaCTBL: "CT42CH01", Mabangluong: BL_A_CHOT, Ngaylam: new Date("2099-10-10"), Giolam: 8, Mucluong: 25000 },
      ],
    });
  });

  afterAll(async () => {
    await donDep();
  });

  it("401 khi chưa đăng nhập, 403 khi Chủ quán gọi API của Nhân viên", async () => {
    const r401Get = await GET(reqGet(), { params: Promise.resolve({}) });
    expect(r401Get.status).toBe(401);

    const r401Post = await POST(reqPost(undefined, { noidung: "Thiếu giờ" }), { params: Promise.resolve({}) });
    expect(r401Post.status).toBe(401);

    const r403Get = await GET(reqGet(cqToken), { params: Promise.resolve({}) });
    expect(r403Get.status).toBe(403);

    const r403Post = await POST(reqPost(cqToken, { noidung: "Thiếu giờ" }), { params: Promise.resolve({}) });
    expect(r403Post.status).toBe(403);
  });

  it("403 khi nhân viên gửi phản hồi cho bảng lương của người khác", async () => {
    const res = await POST(
      reqPost(nvAToken, { mabangluong: BL_B_HOP_LE, noidung: "Sai giờ ca sáng" }),
      { params: Promise.resolve({}) }
    );
    expect(res.status).toBe(403);
  });

  it("400 với thông báo chuẩn khi để trống nội dung phản hồi", async () => {
    const res = await POST(
      reqPost(nvAToken, { mabangluong: BL_A_HOP_LE, noidung: "   " }),
      { params: Promise.resolve({}) }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toBe(thongBao.PHAN_HOI_LUONG_THIEU_NOI_DUNG);
  });

  it("400 Đã hết thời gian phản hồi khi kỳ quá hạn (sau ngày 2 tháng sau) hoặc Đã chốt", async () => {
    const resQuaHan = await POST(
      reqPost(nvAToken, { mabangluong: BL_A_QUA_HAN, noidung: "Thiếu 2 giờ" }),
      { params: Promise.resolve({}) }
    );
    expect(resQuaHan.status).toBe(400);
    expect((await resQuaHan.json()).error.message).toBe(thongBao.PHAN_HOI_LUONG_HET_HAN);

    const resChot = await POST(
      reqPost(nvAToken, { mabangluong: BL_A_CHOT, noidung: "Thiếu 2 giờ" }),
      { params: Promise.resolve({}) }
    );
    expect(resChot.status).toBe(400);
    expect((await resChot.json()).error.message).toBe(thongBao.PHAN_HOI_LUONG_HET_HAN);
  });

  it("201 Gửi phản hồi thành công cho bảng lương Dự kiến của mình trước hạn và đọc lại khớp", async () => {
    const resGet1 = await GET(reqGet(nvAToken), { params: Promise.resolve({}) });
    expect(resGet1.status).toBe(200);
    const jGet1 = await resGet1.json();
    expect(jGet1.data.coBangLuong).toBe(true);
    expect(jGet1.data.bangLuong.mabangluong).toBe(BL_A_HOP_LE);
    expect(jGet1.data.quaHan).toBe(false);

    const noiDungGui = "Thiếu 5,5 giờ ca sáng 10/11";
    const resPost = await POST(
      reqPost(nvAToken, { mabangluong: BL_A_HOP_LE, noidung: noiDungGui }),
      { params: Promise.resolve({}) }
    );
    expect(resPost.status).toBe(201);
    const jPost = await resPost.json();
    expect(jPost.data.message).toBe(thongBao.PHAN_HOI_LUONG_GUI_THANH_CONG);
    expect(jPost.data.phanHoi.trangthai).toBe("Chưa xử lý");
    expect(jPost.data.phanHoi.noidung).toBe(noiDungGui);

    // Round-trip: GET trả lại đúng phản hồi vừa lưu
    const resGet2 = await GET(reqGet(nvAToken), { params: Promise.resolve({}) });
    expect(resGet2.status).toBe(200);
    const jGet2 = await resGet2.json();
    expect(jGet2.data.danhSachPhanHoi.some((p: { noidung: string }) => p.noidung === noiDungGui)).toBe(true);
  });
});
