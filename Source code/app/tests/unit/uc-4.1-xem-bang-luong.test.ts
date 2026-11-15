/**
 * Unit / API tests cho UC_4.1 - Xem bảng lương (Nhân viên).
 * Bao gồm: 401/403, NV A không xem được lương NV B, chỉ kỳ gần nhất (Dự kiến/Đã chốt),
 * bỏ qua kỳ Chưa tính, phân trang phía máy chủ, tính lại đúng giá trị dẫn xuất, và chuỗi 08-THONG-BAO.md.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@database/client";
import { AUTH_COOKIE_NAME, signSession } from "@backend/lib/auth";
import { GET } from "@/app/api/bang-luong/moi-nhat/route";
import { GET as handleNvTongQuan } from "@/app/api/nhan-vien/tong-quan/route";
import * as thongBao from "@frontend/config/thong-bao";

const KY_CU = "KL209710"; // 10/2097 Đã chốt
const KY_MOI = "KL209711"; // 11/2097 Dự kiến
const KY_CHUA_TINH = "KL209712"; // 12/2097 Chưa tính
const KY_2024 = "KL202410"; // 10/2024 Đã chốt (test không giới hạn thời gian)
const BL_A_CU = "BL41ACU1";
const BL_A_MOI = "BL41AMO1";
const BL_B_MOI = "BL41BMO1";
const BL_A_CHUA_TINH = "BL41ACT1";
const BL_OLD_2024 = "BL41OLD1";
const MA_HS = "HS41TEST";

const NV_A = "NV000001";
const NV_B = "NV000002";
const NV_MOI = "NV41MOI1";
const NV_OLD = "NV41OLD1";

function taoRequest(token?: string, query = "") {
  const headers: Record<string, string> = {};
  if (token) headers.cookie = `${AUTH_COOKIE_NAME}=${token}`;
  return new NextRequest(`http://localhost:3000/api/bang-luong/moi-nhat${query}`, { headers });
}

function goiGet(token?: string, query = "") {
  return GET(taoRequest(token, query), { params: Promise.resolve({}) });
}

describe("UC_4.1 - API GET /api/bang-luong/moi-nhat", () => {
  let cqToken: string;
  let nvAToken: string;
  let nvBToken: string;

  async function donDep() {
    await prisma.chiTietBangLuong.deleteMany({
      where: { Mabangluong: { in: [BL_A_CU, BL_A_MOI, BL_B_MOI, BL_A_CHUA_TINH, BL_OLD_2024] } },
    });
    await prisma.bangLuong.deleteMany({
      where: { Mabangluong: { in: [BL_A_CU, BL_A_MOI, BL_B_MOI, BL_A_CHUA_TINH, BL_OLD_2024] } },
    });
    await prisma.heSoLuong.deleteMany({ where: { Maheso: MA_HS } });
    await prisma.kyLuong.deleteMany({
      where: { Makyluong: { in: [KY_CU, KY_MOI, KY_CHUA_TINH, KY_2024] } },
    });
    await prisma.nhanVien.deleteMany({ where: { Manv: { in: [NV_MOI, NV_OLD] } } });
  }

  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";
    cqToken = await signSession({ userId: "CQ000001", username: "chuquan", role: "ChuQuan", name: "Hoàng Lan" });
    nvAToken = await signSession({ userId: NV_A, username: NV_A, role: "NhanVien", name: "Nguyễn Minh Anh" });
    nvBToken = await signSession({ userId: NV_B, username: NV_B, role: "NhanVien", name: "Trần Văn Bình" });

    await donDep();

    await prisma.nhanVien.create({
      data: {
        Manv: NV_MOI,
        Tendangnhap: NV_MOI,
        Matkhau: "hash_test_41",
        Hoten: "Nhân Viên Mới UC41",
        Sdt: "0941414141",
        Diachi: "Đà Nẵng",
        Vitrilamviec: "Pha chế",
        Hinhthuclam: "Part-time",
        Ngayvaolam: new Date("2097-11-01"),
        Kinhnghiem: "Mới",
        Trangthai: "Thử việc",
        Mucluongtheogio: 18000,
      },
    });

    await prisma.heSoLuong.create({
      data: {
        Maheso: MA_HS,
        Ngaybatdau: new Date("2097-11-01"),
        Ngayketthuc: new Date("2097-11-30"),
        Heso: 2,
      },
    });

    await prisma.kyLuong.createMany({
      data: [
        { Makyluong: KY_CU, Thang: 10, Nam: 2097, Trangthai: "Đã chốt", Ngaychot: new Date("2097-11-01") },
        { Makyluong: KY_MOI, Thang: 11, Nam: 2097, Trangthai: "Dự kiến" },
        { Makyluong: KY_CHUA_TINH, Thang: 12, Nam: 2097, Trangthai: "Chưa tính" },
      ],
    });

    await prisma.bangLuong.createMany({
      data: [
        { Mabangluong: BL_A_CU, Manv: NV_A, Makyluong: KY_CU, Tienthuong: 0, Lydothuong: null },
        { Mabangluong: BL_A_MOI, Manv: NV_A, Makyluong: KY_MOI, Tienthuong: 50000, Lydothuong: "Chuyên cần" },
        { Mabangluong: BL_B_MOI, Manv: NV_B, Makyluong: KY_MOI, Tienthuong: 999000, Lydothuong: "Thưởng riêng NV B" },
        // Kỳ Chưa tính có sẵn thưởng (UC_8.5) nhưng không được phép lộ ở UC_4.1
        { Mabangluong: BL_A_CHUA_TINH, Manv: NV_A, Makyluong: KY_CHUA_TINH, Tienthuong: 500000, Lydothuong: "Kỳ chưa tính" },
      ],
    });

    // NV A kỳ mới (11/2097): 8 ngày làm để test phân trang (6 dòng/trang -> 2 trang)
    const ngayNvA = [1, 2, 3, 4, 5, 6, 7, 8].map((d) => ({
      MaCTBL: `CT41AM0${d}`,
      Mabangluong: BL_A_MOI,
      Ngaylam: new Date(`2097-11-0${d}`),
      Giolam: d === 1 ? 5.5 : 4,
      Mucluong: 20000,
      Maheso: d === 1 ? MA_HS : null,
    }));

    await prisma.chiTietBangLuong.createMany({
      data: [
        { MaCTBL: "CT41ACU1", Mabangluong: BL_A_CU, Ngaylam: new Date("2097-10-01"), Giolam: 5, Mucluong: 20000, Maheso: null },
        ...ngayNvA,
        { MaCTBL: "CT41BMO1", Mabangluong: BL_B_MOI, Ngaylam: new Date("2097-11-02"), Giolam: 8, Mucluong: 30000, Maheso: null },
      ],
    });
  });

  afterAll(async () => {
    await donDep();
  });

  it("Khớp nguyên văn thông báo trong 08-THONG-BAO.md", () => {
    expect(thongBao.BANG_LUONG_CHUA_TONG_HOP).toBe("Bảng lương chưa được tổng hợp");
    expect(thongBao.MAU_THONG_BAO.loi.chu).toBe("#C0392B");
  });

  it("Chưa đăng nhập → 401", async () => {
    const res = await goiGet();
    expect(res.status).toBe(401);
  });

  it("Chủ quán gọi endpoint nhân viên → 403", async () => {
    const res = await goiGet(cqToken);
    expect(res.status).toBe(403);
  });

  it("Tham số phân trang không hợp lệ → 400", async () => {
    const res = await goiGet(nvAToken, "?trang=0&soDong=6");
    expect(res.status).toBe(400);
  });

  it("NV A chỉ thấy bảng lương kỳ gần nhất (11/2097 Dự kiến), không thấy kỳ Chưa tính (12/2097) hay kỳ cũ (10/2097), và không xem được lương NV B kể cả khi truyền ?manv=NV000002", async () => {
    const res = await goiGet(nvAToken, `?manv=${NV_B}&trang=1&soDong=6`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.data.coBangLuong).toBe(true);
    expect(body.data.kyLuong.makyluong).toBe(KY_MOI);
    expect(body.data.kyLuong.thang).toBe(11);
    expect(body.data.kyLuong.nam).toBe(2097);
    expect(body.data.kyLuong.trangthai).toBe("Dự kiến");

    // Đúng thông tin NV A, không lẫn NV B
    expect(body.data.bangLuong.manv).toBe(NV_A);
    expect(body.data.bangLuong.tienthuong).toBe(50000);
    // Tổng giờ = 5.5 + 7*4 = 33.5
    expect(body.data.bangLuong.tonggiolam).toBe(33.5);
    // Tổng lương = (5.5*20000*2) + 7*(4*20000*1) + 50000 = 220000 + 560000 + 50000 = 830000
    expect(body.data.bangLuong.tongluong).toBe(830000);

    // Phân trang trang 1
    expect(body.data.chiTiet).toHaveLength(6);
    expect(body.data.phanTrang).toEqual({
      trang: 1,
      soDong: 6,
      tongSoDong: 8,
      tongSoTrang: 2,
    });
    expect(body.data.chiTiet[0]).toMatchObject({
      Ngaylam: "2097-11-01",
      Giolam: 5.5,
      Mucluong: 20000,
      Heso: 2,
      Thuong: 0,
      Thanhtien: 220000,
    });
  });

  it("Phân trang trang 2 trả đúng 2 dòng còn lại", async () => {
    const res = await goiGet(nvAToken, "?trang=2&soDong=6");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.chiTiet).toHaveLength(2);
    expect(body.data.phanTrang.trang).toBe(2);
    expect(body.data.chiTiet[0].Ngaylam).toBe("2097-11-07");
    expect(body.data.chiTiet[1].Ngaylam).toBe("2097-11-08");
  });

  it("NV B chỉ thấy bảng lương của NV B, không thấy dữ liệu NV A", async () => {
    const res = await goiGet(nvBToken, `?manv=${NV_A}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.coBangLuong).toBe(true);
    expect(body.data.bangLuong.manv).toBe(NV_B);
    expect(body.data.bangLuong.tienthuong).toBe(999000);
    expect(body.data.bangLuong.tonggiolam).toBe(8);
    expect(body.data.bangLuong.tongluong).toBe(8 * 30000 + 999000);
  });

  it("Khi NV B không có bảng lương ở kỳ 11/2097 → không lộ kỳ 11/2097 của NV A; NV mới chưa từng có bảng lương → coBangLuong: false", async () => {
    await prisma.chiTietBangLuong.deleteMany({ where: { Mabangluong: BL_B_MOI } });
    await prisma.bangLuong.deleteMany({ where: { Mabangluong: BL_B_MOI } });

    const resB = await goiGet(nvBToken);
    expect(resB.status).toBe(200);
    const bodyB = await resB.json();
    expect(bodyB.ok).toBe(true);
    if (bodyB.data.kyLuong) {
      expect(bodyB.data.kyLuong.makyluong).not.toBe(KY_MOI);
      expect(bodyB.data.bangLuong.manv).toBe(NV_B);
    }

    const nvMoiToken = await signSession({ userId: NV_MOI, username: NV_MOI, role: "NhanVien", name: "Nhân Viên Mới UC41" });
    const res = await goiGet(nvMoiToken);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.coBangLuong).toBe(false);
    expect(body.data.bangLuong).toBeNull();
    expect(body.data.chiTiet).toEqual([]);
  });

  it("Khi kỳ gần nhất chuyển sang Đã chốt → trả trạng thái Đã chốt", async () => {
    await prisma.kyLuong.update({
      where: { Makyluong: KY_MOI },
      data: { Trangthai: "Đã chốt", Ngaychot: new Date("2097-12-01") },
    });

    const res = await goiGet(nvAToken);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.coBangLuong).toBe(true);
    expect(body.data.kyLuong.trangthai).toBe("Đã chốt");
    expect(body.data.bangLuong.trangthai).toBe("Đã chốt");
  });

  it("Từ chối yêu cầu xem kỳ cũ từ phía máy chủ (?makyluong, ?thang, ?nam -> 400)", async () => {
    for (const qs of [`?makyluong=${KY_CU}`, "?thang=10&nam=2097", "?nam=2097"]) {
      const res = await goiGet(nvAToken, qs);
      expect(res.status).toBe(400);
    }
  });

  it("(c)(e) Tháng 10 Đã chốt có NV A (không có NV mới); tháng 11 đang Chưa tính -> NV A thấy tháng 10 Đã chốt, NV mới thấy rỗng", async () => {
    await prisma.kyLuong.update({
      where: { Makyluong: KY_MOI },
      data: { Trangthai: "Chưa tính", Ngaychot: null },
    });

    const resA = await goiGet(nvAToken);
    expect(resA.status).toBe(200);
    const bodyA = await resA.json();
    expect(bodyA.data.coBangLuong).toBe(true);
    expect(bodyA.data.kyLuong.makyluong).toBe(KY_CU);
    expect(bodyA.data.kyLuong.thang).toBe(10);
    expect(bodyA.data.kyLuong.nam).toBe(2097);
    expect(bodyA.data.kyLuong.trangthai).toBe("Đã chốt");

    // Thẻ lương U3 (NhanVienDashboard) phải trả đúng kỳ 10/2097 Đã chốt giống hệt UC_4.1
    const resTqA = await handleNvTongQuan(
      new Request("http://localhost:3000/api/nhan-vien/tong-quan", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${nvAToken}` },
      }),
      { params: Promise.resolve({}) }
    );
    expect(resTqA.status).toBe(200);
    const tqA = (await resTqA.json()).data;
    expect(tqA.luongThangGanNhat.coBangLuong).toBe(true);
    expect(tqA.luongThangGanNhat.kyLuong).toBe("Lương tháng 10");
    expect(tqA.luongThangGanNhat.trangThai).toBe("Đã chốt");
    expect(tqA.luongThangGanNhat.tongTien).toBe(bodyA.data.bangLuong.tongluong);

    // NV mới vào tháng 11 không có BangLuong tháng 10 -> rỗng, không lộ tháng 10 của NV A
    const nvMoiToken = await signSession({
      userId: NV_MOI,
      username: NV_MOI,
      role: "NhanVien",
      name: "Nhân Viên Mới UC41",
    });
    const resMoi = await goiGet(nvMoiToken);
    expect(resMoi.status).toBe(200);
    const bodyMoi = await resMoi.json();
    expect(bodyMoi.data.coBangLuong).toBe(false);
    expect(bodyMoi.data.bangLuong).toBeNull();
  });

  it("(f) Kỳ cũ năm 2024 Đã chốt vẫn là kỳ gần nhất nếu NV không có kỳ mới hơn (không giới hạn thời gian)", async () => {
    await prisma.nhanVien.create({
      data: {
        Manv: NV_OLD,
        Tendangnhap: NV_OLD,
        Matkhau: "hash_test_old",
        Hoten: "Nhân Viên Kỳ Cũ 2024",
        Sdt: "0941414142",
        Diachi: "Đà Nẵng",
        Vitrilamviec: "Phục vụ",
        Hinhthuclam: "Part-time",
        Ngayvaolam: new Date("2024-10-01"),
        Kinhnghiem: "1 năm",
        Trangthai: "Chính thức",
        Mucluongtheogio: 19000,
      },
    });
    await prisma.kyLuong.create({
      data: {
        Makyluong: KY_2024,
        Thang: 10,
        Nam: 2024,
        Trangthai: "Đã chốt",
        Ngaychot: new Date("2024-11-02"),
      },
    });
    await prisma.bangLuong.create({
      data: {
        Mabangluong: BL_OLD_2024,
        Manv: NV_OLD,
        Makyluong: KY_2024,
        Tienthuong: 10000,
        Lydothuong: "Thưởng 2024",
      },
    });
    await prisma.chiTietBangLuong.create({
      data: {
        MaCTBL: "CT41OLD1",
        Mabangluong: BL_OLD_2024,
        Ngaylam: new Date("2024-10-15"),
        Giolam: 4,
        Mucluong: 19000,
        Maheso: null,
      },
    });

    const nvOldToken = await signSession({
      userId: NV_OLD,
      username: NV_OLD,
      role: "NhanVien",
      name: "Nhân Viên Kỳ Cũ 2024",
    });
    const res = await goiGet(nvOldToken);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.coBangLuong).toBe(true);
    expect(body.data.kyLuong.makyluong).toBe(KY_2024);
    expect(body.data.kyLuong.thang).toBe(10);
    expect(body.data.kyLuong.nam).toBe(2024);
    expect(body.data.kyLuong.trangthai).toBe("Đã chốt");
    expect(body.data.bangLuong.tongluong).toBe(4 * 19000 + 10000);
  });
});
