import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { signSession, AUTH_COOKIE_NAME } from "@backend/lib/auth";
import { formatDateVN, nowVN } from "@backend/lib/time";
import { prisma } from "@database/client";
import { GET as handleGetBangLuongKy } from "@/app/api/ky-luong/[id]/bang-luong/route";
import { POST as handlePostChot } from "@/app/api/ky-luong/[id]/chot/route";
import { GET as handleGetMoiNhat } from "@/app/api/bang-luong/moi-nhat/route";
import { PUT as handlePutBangLuong } from "@/app/api/bang-luong/[id]/route";
import { POST as handlePostKhongChinhSua } from "@/app/api/phan-hoi-luong/[id]/khong-chinh-sua/route";
import { POST as handlePostPhanHoi } from "@/app/api/phan-hoi-luong/route";
import { POST as handlePostTienThuong } from "@/app/api/tien-thuong/route";
import { PUT as handlePutThuong } from "@/app/api/bang-luong/[id]/thuong/route";
import { POST as handlePostHeSo } from "@/app/api/he-so/route";
import { DELETE as handleDeleteHeSoById } from "@/app/api/he-so/[id]/route";
import { POST as handlePostXuLyBoSungCC } from "@/app/api/bo-sung-cc/xu-ly/route";
import { POST as handlePostTinhLuong } from "@/app/api/ky-luong/[id]/tinh/route";
import { POST as handlePostGuiLuong } from "@/app/api/ky-luong/[id]/gui/route";
import * as thongBao from "@frontend/config/thong-bao";

const KY_ID = "KL209411";
const KY_CHUA_TINH = "KL209412";
const BL_ID = "BL940001";
const CT_ID = "CT940001";
const PH_ID = "PH940001";
const HS_ID = "HS940001";
const LL_ID = "LL940001";
const CC_ID = "CC940001";
const YC_ID = "YC940001";
const MANV = "NV000001";

async function cleanupFixtures() {
  await prisma.phanHoiLuong.deleteMany({ where: { Maphanhoi: PH_ID } });
  await prisma.yeuCauBoSungCC.deleteMany({ where: { Mayeucau: YC_ID } });
  await prisma.chamCong.deleteMany({ where: { Machamcong: CC_ID } });
  await prisma.chiTietBangLuong.deleteMany({ where: { MaCTBL: CT_ID } });
  await prisma.bangLuong.deleteMany({ where: { Mabangluong: BL_ID } });
  await prisma.heSoLuong.deleteMany({ where: { Maheso: HS_ID } });
  await prisma.nhanVien_LichLam.deleteMany({ where: { Malich: LL_ID, Manv: MANV } });
  await prisma.lichLam.deleteMany({ where: { Malich: LL_ID } });
  await prisma.kyLuong.deleteMany({
    where: { Makyluong: { in: [KY_ID, KY_CHUA_TINH] } },
  });
}

describe("UC_8.6 Chốt bảng lương & BR01 sau khi chốt", () => {
  let chuQuanToken = "";
  let nhanVienToken = "";

  beforeAll(async () => {
    process.env.JWT_SECRET =
      "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";

    chuQuanToken = await signSession({
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Hoàng Lan",
    });

    nhanVienToken = await signSession({
      userId: MANV,
      username: MANV,
      role: "NhanVien",
      name: "Nguyễn Minh Anh",
    });

    await cleanupFixtures();

    const caLam = await prisma.caLam.findFirst({ select: { Maca: true } });
    if (!caLam) {
      throw new Error("Thiếu dữ liệu CaLam trong CSDL test");
    }

    await prisma.kyLuong.create({
      data: {
        Makyluong: KY_ID,
        Thang: 11,
        Nam: 2094,
        Trangthai: "Dự kiến",
        Ngaychot: null,
      },
    });

    await prisma.kyLuong.create({
      data: {
        Makyluong: KY_CHUA_TINH,
        Thang: 12,
        Nam: 2094,
        Trangthai: "Chưa tính",
        Ngaychot: null,
      },
    });

    await prisma.heSoLuong.create({
      data: {
        Maheso: HS_ID,
        Ngaybatdau: new Date("2094-11-10T00:00:00.000Z"),
        Ngayketthuc: new Date("2094-11-12T00:00:00.000Z"),
        Heso: 1.5,
      },
    });

    await prisma.lichLam.create({
      data: {
        Malich: LL_ID,
        Ngaylam: new Date("2094-11-10T00:00:00.000Z"),
        Maca: caLam.Maca,
      },
    });

    await prisma.chamCong.create({
      data: {
        Machamcong: CC_ID,
        Manv: MANV,
        Malich: LL_ID,
        Thoigiancheckin: new Date("2094-11-10T07:00:00.000Z"),
        Thoigiancheckout: new Date("2094-11-10T11:00:00.000Z"),
      },
    });

    await prisma.yeuCauBoSungCC.create({
      data: {
        Mayeucau: YC_ID,
        Giovaobosung: null,
        Giorabosung: new Date("1970-01-01T12:00:00.000Z"),
        Lydo: "Test bổ sung",
        Trangthai: "Chưa xử lý",
        Manv: MANV,
        Malich: LL_ID,
      },
    });

    await prisma.bangLuong.create({
      data: {
        Mabangluong: BL_ID,
        Manv: MANV,
        Makyluong: KY_ID,
        Tienthuong: 100000,
        Lydothuong: "Thưởng chuyên cần",
      },
    });

    await prisma.chiTietBangLuong.create({
      data: {
        MaCTBL: CT_ID,
        Ngaylam: new Date("2094-11-10T00:00:00.000Z"),
        Giolam: 4,
        Mucluong: 30000,
        Mabangluong: BL_ID,
        Maheso: HS_ID,
      },
    });

    await prisma.phanHoiLuong.create({
      data: {
        Maphanhoi: PH_ID,
        Noidung: "Kiểm tra lại giờ làm ngày 10/11",
        Ngaygui: new Date("2094-12-01T00:00:00.000Z"),
        Ngayxuly: null,
        Trangthai: "Chưa xử lý",
        Mabangluong: BL_ID,
      },
    });
  });

  afterAll(async () => {
    await cleanupFixtures();
  });

  it("401 khi chưa đăng nhập & 403 khi Nhân viên gọi GET bang-luong / POST chot", async () => {
    const reqGet401 = new Request(`http://localhost:3000/api/ky-luong/${KY_ID}/bang-luong`);
    const resGet401 = await handleGetBangLuongKy(reqGet401, {
      params: Promise.resolve({ id: KY_ID }),
    });
    expect(resGet401.status).toBe(401);

    const reqPost401 = new Request(`http://localhost:3000/api/ky-luong/${KY_ID}/chot`, {
      method: "POST",
    });
    const resPost401 = await handlePostChot(reqPost401, {
      params: Promise.resolve({ id: KY_ID }),
    });
    expect(resPost401.status).toBe(401);

    const nvHeaders = { cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}` };
    const reqGet403 = new Request(`http://localhost:3000/api/ky-luong/${KY_ID}/bang-luong`, {
      headers: nvHeaders,
    });
    const resGet403 = await handleGetBangLuongKy(reqGet403, {
      params: Promise.resolve({ id: KY_ID }),
    });
    expect(resGet403.status).toBe(403);

    const reqPost403 = new Request(`http://localhost:3000/api/ky-luong/${KY_ID}/chot`, {
      method: "POST",
      headers: nvHeaders,
    });
    const resPost403 = await handlePostChot(reqPost403, {
      params: Promise.resolve({ id: KY_ID }),
    });
    expect(resPost403.status).toBe(403);
  });

  it("GET /api/ky-luong/:id/bang-luong trả đủ thông tin kỳ, bảng lương và số phản hồi chưa xử lý", async () => {
    const req = new Request(`http://localhost:3000/api/ky-luong/${KY_ID}/bang-luong`, {
      headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
    });
    const res = await handleGetBangLuongKy(req, {
      params: Promise.resolve({ id: KY_ID }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.kyLuong.Makyluong).toBe(KY_ID);
    expect(json.data.kyLuong.Trangthai).toBe("Dự kiến");
    expect(json.data.soPhanHoiChuaXuLy).toBe(1);
    expect(json.data.soNhanVien).toBe(1);
    expect(json.data.danhSach[0]).toMatchObject({
      Mabangluong: BL_ID,
      Manv: MANV,
      Songay: 1,
      Tonggiolam: 4,
      Mucluong: 30000,
      Heso: 1.5,
      Tienthuong: 100000,
      Tongluong: 4 * 30000 * 1.5 + 100000,
    });
  });

  it("Chặn chốt khi còn phản hồi chưa xử lý (400, đúng chữ 08-THONG-BAO.md, không đổi CSDL)", async () => {
    const req = new Request(`http://localhost:3000/api/ky-luong/${KY_ID}/chot`, {
      method: "POST",
      headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
    });
    const res = await handlePostChot(req, {
      params: Promise.resolve({ id: KY_ID }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("CO_PHAN_HOI_CHUA_XU_LY");
    expect(json.error.message).toBe(thongBao.CHOT_LUONG_CO_PHAN_HOI_NOI_DUNG);

    const kyAfter = await prisma.kyLuong.findUnique({ where: { Makyluong: KY_ID } });
    expect(kyAfter?.Trangthai).toBe("Dự kiến");
    expect(kyAfter?.Ngaychot).toBeNull();
  });

  it("Chặn chốt kỳ ở trạng thái 'Chưa tính' (400)", async () => {
    const req = new Request(`http://localhost:3000/api/ky-luong/${KY_CHUA_TINH}/chot`, {
      method: "POST",
      headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
    });
    const res = await handlePostChot(req, {
      params: Promise.resolve({ id: KY_CHUA_TINH }),
    });
    expect(res.status).toBe(400);

    const kyAfter = await prisma.kyLuong.findUnique({ where: { Makyluong: KY_CHUA_TINH } });
    expect(kyAfter?.Trangthai).toBe("Chưa tính");
  });

  it("Chốt thành công khi 0 phản hồi chưa xử lý -> 'Đã chốt', Ngaychot = hôm nay VN, NV thấy 'Đã chốt'", async () => {
    await prisma.phanHoiLuong.update({
      where: { Maphanhoi: PH_ID },
      data: { Trangthai: "Đã xử lý", Ngayxuly: new Date("2094-12-01T00:00:00.000Z") },
    });

    const req = new Request(`http://localhost:3000/api/ky-luong/${KY_ID}/chot`, {
      method: "POST",
      headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
    });
    const res = await handlePostChot(req, {
      params: Promise.resolve({ id: KY_ID }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.message).toBe(thongBao.CHOT_LUONG_THANH_CONG);
    expect(json.data.kyLuong.Trangthai).toBe("Đã chốt");
    expect(json.data.kyLuong.Ngaychot).toBe(formatDateVN(nowVN()));

    const kyDb = await prisma.kyLuong.findUnique({ where: { Makyluong: KY_ID } });
    expect(kyDb?.Trangthai).toBe("Đã chốt");
    expect(kyDb?.Ngaychot?.toISOString().slice(0, 10)).toBe(formatDateVN(nowVN()));

    // Nhân viên xem bảng lương mới nhất thấy nhãn Đã chốt
    const reqNv = new Request("http://localhost:3000/api/bang-luong/moi-nhat", {
      headers: { cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}` },
    });
    const resNv = await handleGetMoiNhat(reqNv, { params: Promise.resolve({}) });
    expect(resNv.status).toBe(200);
    const jsonNv = await resNv.json();
    expect(jsonNv.data.kyLuong.makyluong).toBe(KY_ID);
    expect(jsonNv.data.kyLuong.trangthai).toBe("Đã chốt");
    expect(jsonNv.data.bangLuong.trangthai).toBe("Đã chốt");

    // Chốt lại lần nữa -> 400
    const resAgain = await handlePostChot(req, {
      params: Promise.resolve({ id: KY_ID }),
    });
    expect(resAgain.status).toBe(400);
  });

  describe("BR01: Mọi API sửa/tính/gửi/bổ sung/phản hồi của kỳ 'Đã chốt' đều bị từ chối", () => {
    it("PUT /api/bang-luong/:id bị từ chối 400", async () => {
      const req = new Request(`http://localhost:3000/api/bang-luong/${BL_ID}`, {
        method: "PUT",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          maphanhoi: PH_ID,
          machamcong: CC_ID,
          giovao: "07:00",
          giora: "12:00",
          heso: 1.5,
          tienthuong: 100000,
          lydochinhsua: "Thử sửa sau chốt",
        }),
      });
      const res = await handlePutBangLuong(req, {
        params: Promise.resolve({ id: BL_ID }),
      });
      expect(res.status).toBe(400);
    });

    it("POST /api/phan-hoi-luong/:id/khong-chinh-sua bị từ chối 400", async () => {
      const req = new Request(
        `http://localhost:3000/api/phan-hoi-luong/${PH_ID}/khong-chinh-sua`,
        {
          method: "POST",
          headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
        }
      );
      const res = await handlePostKhongChinhSua(req, {
        params: Promise.resolve({ id: PH_ID }),
      });
      expect(res.status).toBe(400);
    });

    it("POST /api/tien-thuong bị từ chối 400", async () => {
      const req = new Request("http://localhost:3000/api/tien-thuong", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Makyluong: KY_ID,
          items: [{ Mabangluong: BL_ID, Tienthuong: 200000, Lydothuong: "Sửa sau chốt" }],
        }),
      });
      const res = await handlePostTienThuong(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
    });

    it("PUT /api/bang-luong/:id/thuong bị từ chối 400", async () => {
      const req = new Request(`http://localhost:3000/api/bang-luong/${BL_ID}/thuong`, {
        method: "PUT",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Tienthuong: 200000,
          Lydothuong: "Sửa sau chốt",
        }),
      });
      const res = await handlePutThuong(req, {
        params: Promise.resolve({ id: BL_ID }),
      });
      expect(res.status).toBe(400);
    });

    it("POST /api/he-so (sửa & tạo mới trùng kỳ đã chốt) và DELETE /api/he-so/:id bị từ chối 400", async () => {
      const reqEdit = new Request("http://localhost:3000/api/he-so", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Maheso: HS_ID,
          Ngaybatdau: "2094-11-10",
          Ngayketthuc: "2094-11-12",
          Heso: 2,
        }),
      });
      const resEdit = await handlePostHeSo(reqEdit, { params: Promise.resolve({}) });
      expect(resEdit.status).toBe(400);
      expect((await resEdit.json()).error.message).toBe("Kỳ lương đã chốt, không thể chỉnh sửa");

      const reqCreateOverlap = new Request("http://localhost:3000/api/he-so", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Ngaybatdau: "2094-11-15",
          Ngayketthuc: "2094-11-16",
          Heso: 2,
        }),
      });
      const resOverlap = await handlePostHeSo(reqCreateOverlap, {
        params: Promise.resolve({}),
      });
      expect(resOverlap.status).toBe(400);
      expect((await resOverlap.json()).error.message).toBe(
        "Kỳ lương đã chốt, không thể chỉnh sửa"
      );

      const reqDelete = new Request(`http://localhost:3000/api/he-so/${HS_ID}`, {
        method: "DELETE",
        headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
      });
      const resDelete = await handleDeleteHeSoById(reqDelete, {
        params: Promise.resolve({ id: HS_ID }),
      });
      expect(resDelete.status).toBe(400);
      expect((await resDelete.json()).error.message).toBe(
        "Kỳ lương đã chốt, không thể chỉnh sửa"
      );
    });

    it("POST /api/bo-sung-cc/xu-ly bị từ chối 400 khi ngày làm thuộc kỳ đã chốt", async () => {
      const req = new Request("http://localhost:3000/api/bo-sung-cc/xu-ly", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mayeucau: YC_ID,
          giovaobosung: null,
          giorabosung: "12:00",
        }),
      });
      const res = await handlePostXuLyBoSungCC(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
      expect((await res.json()).error.message).toBe("Kỳ lương đã chốt, không thể chỉnh sửa");
    });

    it("POST /api/ky-luong/:id/tinh và /gui bị từ chối 409 sau khi chốt", async () => {
      const reqTinh = new Request(`http://localhost:3000/api/ky-luong/${KY_ID}/tinh`, {
        method: "POST",
        headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
      });
      const resTinh = await handlePostTinhLuong(reqTinh, {
        params: Promise.resolve({ id: KY_ID }),
      });
      expect(resTinh.status).toBe(409);

      const reqGui = new Request(`http://localhost:3000/api/ky-luong/${KY_ID}/gui`, {
        method: "POST",
        headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
      });
      const resGui = await handlePostGuiLuong(reqGui, {
        params: Promise.resolve({ id: KY_ID }),
      });
      expect(resGui.status).toBe(409);
    });

    it("POST /api/phan-hoi-luong (Nhân viên) bị từ chối 400 sau khi chốt", async () => {
      const req = new Request("http://localhost:3000/api/phan-hoi-luong", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mabangluong: BL_ID,
          noidung: "Gửi phản hồi sau khi chốt",
        }),
      });
      const res = await handlePostPhanHoi(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
      expect((await res.json()).error.message).toBe(thongBao.PHAN_HOI_LUONG_HET_HAN);
    });
  });
});
