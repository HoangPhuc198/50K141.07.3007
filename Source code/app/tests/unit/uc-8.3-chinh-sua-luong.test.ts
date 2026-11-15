/**
 * Unit / API tests cho UC_8.3 - Chỉnh sửa sai sót bảng lương (Chủ quán).
 * Bao gồm: 401/403, lọc + phân trang GET /api/ky-luong, GET /api/ky-luong/:id/sai-sot,
 * chặn sửa kỳ Đã chốt, cấm sửa mức lương theo giờ, bắt buộc lý do chỉnh sửa,
 * giờ ra sau giờ vào, không thay đổi gì, tiền thưởng không hợp lệ,
 * lưu chỉnh sửa cập nhật giờ vào/ra + hệ số + thưởng + đánh dấu PhanHoiLuong Đã xử lý,
 * và hành động Không chỉnh sửa.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@database/client";
import { AUTH_COOKIE_NAME, signSession } from "@backend/lib/auth";
import { GET as getKyLuongList } from "@/app/api/ky-luong/route";
import { GET as getSaiSotKy } from "@/app/api/ky-luong/[id]/sai-sot/route";
import { PUT as putBangLuong } from "@/app/api/bang-luong/[id]/route";
import { POST as postKhongChinhSua } from "@/app/api/phan-hoi-luong/[id]/khong-chinh-sua/route";
import * as thongBao from "@frontend/config/thong-bao";

const KY_DU_KIEN = "KL209510";
const KY_CHOT = "KL209509";
const BL_DU_KIEN = "BL83DK01";
const BL_CHOT = "BL83CH01";
const CT_DU_KIEN = "CT83DK01";
const CT_CHOT = "CT83CH01";
const CA_ID = "CA000001";
const LICH_DK = "LL83DK01";
const LICH_CHOT = "LL83CH01";
const CC_DK = "CC83DK01";
const CC_CHOT = "CC83CH01";
const PH_EDIT = "PH83ED01";
const PH_NOEDIT = "PH83NE01";
const PH_CHOT = "PH83CH01";
const NV_TEST = "NV000001";

function mkReq(url: string, token?: string, method = "GET", body?: unknown) {
  const headers: Record<string, string> = {};
  if (token) headers.cookie = `${AUTH_COOKIE_NAME}=${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("UC_8.3 - Chỉnh sửa sai sót bảng lương (Chủ quán)", () => {
  let cqToken: string;
  let nvToken: string;

  async function donDep() {
    await prisma.phanHoiLuong.deleteMany({ where: { Maphanhoi: { in: [PH_EDIT, PH_NOEDIT, PH_CHOT] } } });
    await prisma.chiTietBangLuong.deleteMany({ where: { MaCTBL: { in: [CT_DU_KIEN, CT_CHOT] } } });
    await prisma.bangLuong.deleteMany({ where: { Mabangluong: { in: [BL_DU_KIEN, BL_CHOT] } } });
    await prisma.chamCong.deleteMany({ where: { Machamcong: { in: [CC_DK, CC_CHOT] } } });
    await prisma.nhanVien_LichLam.deleteMany({ where: { Malich: { in: [LICH_DK, LICH_CHOT] } } });
    await prisma.lichLam.deleteMany({ where: { Malich: { in: [LICH_DK, LICH_CHOT] } } });
    await prisma.heSoLuong.deleteMany({
      where: { Ngaybatdau: new Date("2095-10-15"), Ngayketthuc: new Date("2095-10-15") },
    });
    await prisma.kyLuong.deleteMany({ where: { Makyluong: { in: [KY_DU_KIEN, KY_CHOT] } } });
  }

  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";
    cqToken = await signSession({ userId: "CQ000001", username: "chuquan", role: "ChuQuan", name: "Hoàng Lan" });
    nvToken = await signSession({ userId: NV_TEST, username: NV_TEST, role: "NhanVien", name: "Nguyễn Minh Anh" });

    await donDep();

    await prisma.kyLuong.createMany({
      data: [
        { Makyluong: KY_CHOT, Thang: 9, Nam: 2095, Trangthai: "Đã chốt", Ngaychot: new Date("2095-10-02") },
        { Makyluong: KY_DU_KIEN, Thang: 10, Nam: 2095, Trangthai: "Dự kiến" },
      ],
    });

    await prisma.lichLam.createMany({
      data: [
        { Malich: LICH_CHOT, Ngaylam: new Date("2095-09-15"), Maca: CA_ID },
        { Malich: LICH_DK, Ngaylam: new Date("2095-10-15"), Maca: CA_ID },
      ],
    });

    await prisma.nhanVien_LichLam.createMany({
      data: [
        { Manv: NV_TEST, Malich: LICH_CHOT },
        { Manv: NV_TEST, Malich: LICH_DK },
      ],
    });

    await prisma.chamCong.createMany({
      data: [
        {
          Machamcong: CC_CHOT,
          Manv: NV_TEST,
          Malich: LICH_CHOT,
          Thoigiancheckin: new Date("2095-09-15T06:00:00.000Z"),
          Thoigiancheckout: new Date("2095-09-15T11:30:00.000Z"),
        },
        {
          Machamcong: CC_DK,
          Manv: NV_TEST,
          Malich: LICH_DK,
          Thoigiancheckin: new Date("2095-10-15T06:00:00.000Z"),
          Thoigiancheckout: new Date("2095-10-15T10:00:00.000Z"),
        },
      ],
    });

    await prisma.bangLuong.createMany({
      data: [
        { Mabangluong: BL_CHOT, Manv: NV_TEST, Makyluong: KY_CHOT, Tienthuong: 0, Lydothuong: null },
        { Mabangluong: BL_DU_KIEN, Manv: NV_TEST, Makyluong: KY_DU_KIEN, Tienthuong: 0, Lydothuong: null },
      ],
    });

    await prisma.chiTietBangLuong.createMany({
      data: [
        { MaCTBL: CT_CHOT, Mabangluong: BL_CHOT, Ngaylam: new Date("2095-09-15"), Giolam: 5.5, Mucluong: 20000 },
        { MaCTBL: CT_DU_KIEN, Mabangluong: BL_DU_KIEN, Ngaylam: new Date("2095-10-15"), Giolam: 4, Mucluong: 20000 },
      ],
    });

    await prisma.phanHoiLuong.createMany({
      data: [
        {
          Maphanhoi: PH_CHOT,
          Noidung: "Kỳ chốt chỉ xem",
          Ngaygui: new Date("2095-10-01"),
          Ngayxuly: new Date("2095-10-01"),
          Trangthai: "Đã xử lý",
          Mabangluong: BL_CHOT,
        },
        {
          Maphanhoi: PH_EDIT,
          Noidung: "Thiếu 1,5 giờ ca sáng 15/10",
          Ngaygui: new Date("2095-10-31"),
          Ngayxuly: null,
          Trangthai: "Chưa xử lý",
          Mabangluong: BL_DU_KIEN,
        },
        {
          Maphanhoi: PH_NOEDIT,
          Noidung: "Nhờ kiểm tra lại ngày 15/10",
          Ngaygui: new Date("2095-10-31"),
          Ngayxuly: null,
          Trangthai: "Chưa xử lý",
          Mabangluong: BL_DU_KIEN,
        },
      ],
    });
  });

  afterAll(async () => {
    await donDep();
  });

  it("401 chưa đăng nhập và 403 khi Nhân viên gọi API Chủ quán", async () => {
    expect((await getKyLuongList(mkReq("/api/ky-luong"), { params: Promise.resolve({}) })).status).toBe(401);
    expect((await getKyLuongList(mkReq("/api/ky-luong", nvToken), { params: Promise.resolve({}) })).status).toBe(403);
    expect(
      (await getSaiSotKy(mkReq(`/api/ky-luong/${KY_DU_KIEN}/sai-sot`, nvToken), {
        params: Promise.resolve({ id: KY_DU_KIEN }),
      })).status
    ).toBe(403);
    expect(
      (await putBangLuong(
        mkReq(`/api/bang-luong/${BL_DU_KIEN}`, nvToken, "PUT", { lydochinhsua: "test" }),
        { params: Promise.resolve({ id: BL_DU_KIEN }) }
      )).status
    ).toBe(403);
    expect(
      (await postKhongChinhSua(mkReq(`/api/phan-hoi-luong/${PH_EDIT}/khong-chinh-sua`, nvToken, "POST"), {
        params: Promise.resolve({ id: PH_EDIT }),
      })).status
    ).toBe(403);
  });

  it("GET /api/ky-luong lọc và phân trang đúng, kỳ Đã chốt có chiXem = true", async () => {
    const resList = await getKyLuongList(
      mkReq(`/api/ky-luong?makyluong=${KY_DU_KIEN}&trangthai=${encodeURIComponent("Dự kiến")}&trang=1&soDong=6`, cqToken),
      { params: Promise.resolve({}) }
    );
    expect(resList.status).toBe(200);
    const jsonList = await resList.json();
    expect(jsonList.data.danhSach.length).toBe(1);
    expect(jsonList.data.danhSach[0].makyluong).toBe(KY_DU_KIEN);
    expect(jsonList.data.danhSach[0].soPhanHoi).toBe(2);

    const resChot = await getSaiSotKy(mkReq(`/api/ky-luong/${KY_CHOT}/sai-sot`, cqToken), {
      params: Promise.resolve({ id: KY_CHOT }),
    });
    expect(resChot.status).toBe(200);
    const jsonChot = await resChot.json();
    expect(jsonChot.data.chiXem).toBe(true);
  });

  it("Chặn sửa kỳ Đã chốt và cấm sửa mức lương theo giờ", async () => {
    const resChot = await putBangLuong(
      mkReq(`/api/bang-luong/${BL_CHOT}`, cqToken, "PUT", {
        maphanhoi: PH_CHOT,
        machamcong: CC_CHOT,
        ngaylam: "2095-09-15",
        giovao: "15/09/2095 · 06:00",
        giora: "15/09/2095 · 12:00",
        heso: 1,
        tienthuong: 0,
        lydochinhsua: "Thử sửa kỳ đã chốt",
      }),
      { params: Promise.resolve({ id: BL_CHOT }) }
    );
    expect(resChot.status).toBe(400);

    const resMucLuong = await putBangLuong(
      mkReq(`/api/bang-luong/${BL_DU_KIEN}`, cqToken, "PUT", {
        maphanhoi: PH_EDIT,
        machamcong: CC_DK,
        ngaylam: "2095-10-15",
        giovao: "15/10/2095 · 06:00",
        giora: "15/10/2095 · 11:30",
        heso: 1,
        tienthuong: 0,
        mucluong: 99999,
        lydochinhsua: "Thử sửa mức lương",
      }),
      { params: Promise.resolve({ id: BL_DU_KIEN }) }
    );
    expect(resMucLuong.status).toBe(400);
  });

  it("Kiểm tra lỗi: trống lý do, giờ ra <= giờ vào, thưởng không hợp lệ, không thay đổi gì", async () => {
    const resTrongLyDo = await putBangLuong(
      mkReq(`/api/bang-luong/${BL_DU_KIEN}`, cqToken, "PUT", {
        maphanhoi: PH_EDIT,
        machamcong: CC_DK,
        ngaylam: "2095-10-15",
        giovao: "15/10/2095 · 06:00",
        giora: "15/10/2095 · 11:30",
        heso: 1,
        tienthuong: 0,
        lydochinhsua: "   ",
      }),
      { params: Promise.resolve({ id: BL_DU_KIEN }) }
    );
    expect(resTrongLyDo.status).toBe(400);
    expect((await resTrongLyDo.json()).error.message).toBe(thongBao.CHINH_SUA_LUONG_THIEU_LY_DO);

    const resGioSai = await putBangLuong(
      mkReq(`/api/bang-luong/${BL_DU_KIEN}`, cqToken, "PUT", {
        maphanhoi: PH_EDIT,
        machamcong: CC_DK,
        ngaylam: "2095-10-15",
        giovao: "15/10/2095 · 11:30",
        giora: "15/10/2095 · 06:00",
        heso: 1,
        tienthuong: 0,
        lydochinhsua: "Sai giờ",
      }),
      { params: Promise.resolve({ id: BL_DU_KIEN }) }
    );
    expect(resGioSai.status).toBe(400);

    const resThuongAm = await putBangLuong(
      mkReq(`/api/bang-luong/${BL_DU_KIEN}`, cqToken, "PUT", {
        maphanhoi: PH_EDIT,
        machamcong: CC_DK,
        ngaylam: "2095-10-15",
        giovao: "15/10/2095 · 06:00",
        giora: "15/10/2095 · 11:30",
        heso: 1,
        tienthuong: -1000,
        lydochinhsua: "Thưởng âm",
      }),
      { params: Promise.resolve({ id: BL_DU_KIEN }) }
    );
    expect(resThuongAm.status).toBe(400);
    expect((await resThuongAm.json()).error.message).toBe(thongBao.CHINH_SUA_LUONG_THUONG_KHONG_HOP_LE);

    const resKhongDoi = await putBangLuong(
      mkReq(`/api/bang-luong/${BL_DU_KIEN}`, cqToken, "PUT", {
        maphanhoi: PH_EDIT,
        machamcong: CC_DK,
        ngaylam: "2095-10-15",
        giovao: "15/10/2095 · 06:00",
        giora: "15/10/2095 · 10:00",
        heso: 1,
        tienthuong: 0,
        lydochinhsua: "Không sửa gì cả",
      }),
      { params: Promise.resolve({ id: BL_DU_KIEN }) }
    );
    expect(resKhongDoi.status).toBe(400);
    expect((await resKhongDoi.json()).error.message).toBe(thongBao.CHINH_SUA_LUONG_KHONG_THAY_DOI);
  });

  it("Lưu chỉnh sửa thành công cập nhật giờ vào/ra, hệ số, thưởng, giữ nguyên mức lương và đánh dấu phản hồi Đã xử lý", async () => {
    const resPut = await putBangLuong(
      mkReq(`/api/bang-luong/${BL_DU_KIEN}`, cqToken, "PUT", {
        maphanhoi: PH_EDIT,
        machamcong: CC_DK,
        ngaylam: "2095-10-15",
        giovao: "15/10/2095 · 06:00",
        giora: "15/10/2095 · 11:30",
        heso: 1.5,
        tienthuong: 50000,
        lydochinhsua: "Cập nhật đủ 5,5 giờ ca sáng 15/10",
      }),
      { params: Promise.resolve({ id: BL_DU_KIEN }) }
    );
    expect(resPut.status).toBe(200);
    const jPut = await resPut.json();
    expect(jPut.data.message).toBe(thongBao.CHINH_SUA_LUONG_THANH_CONG);
    // 5.5 giờ * 20.000 * 1.5 + 50.000 = 165.000 + 50.000 = 215.000
    expect(jPut.data.tonggiolam).toBe(5.5);
    expect(jPut.data.tongluong).toBe(215000);

    // Round-trip kiểm tra CSDL & GET /sai-sot
    const ct = await prisma.chiTietBangLuong.findUnique({ where: { MaCTBL: CT_DU_KIEN } });
    expect(Number(ct?.Giolam)).toBe(5.5);
    expect(ct?.Mucluong).toBe(20000); // KHÔNG đổi mức lương theo giờ!

    const ph = await prisma.phanHoiLuong.findUnique({ where: { Maphanhoi: PH_EDIT } });
    expect(ph?.Trangthai).toBe("Đã xử lý");
    expect(ph?.Ngayxuly).not.toBeNull();

    const bl = await prisma.bangLuong.findUnique({ where: { Mabangluong: BL_DU_KIEN } });
    expect(bl?.Tienthuong).toBe(50000);
    expect(bl?.Lydochinhsua).toBe("Cập nhật đủ 5,5 giờ ca sáng 15/10");
  });

  it("POST /api/phan-hoi-luong/:id/khong-chinh-sua đánh dấu Đã xử lý và giữ nguyên bảng lương", async () => {
    const resNoEdit = await postKhongChinhSua(
      mkReq(`/api/phan-hoi-luong/${PH_NOEDIT}/khong-chinh-sua`, cqToken, "POST"),
      { params: Promise.resolve({ id: PH_NOEDIT }) }
    );
    expect(resNoEdit.status).toBe(200);
    const j = await resNoEdit.json();
    expect(j.data.message).toBe(thongBao.CHINH_SUA_LUONG_KHONG_DOI);

    const ph = await prisma.phanHoiLuong.findUnique({ where: { Maphanhoi: PH_NOEDIT } });
    expect(ph?.Trangthai).toBe("Đã xử lý");
  });
});
