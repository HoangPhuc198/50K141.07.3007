import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { signSession, AUTH_COOKIE_NAME } from "@backend/lib/auth";
import { prisma } from "@database/client";
import { ensureKyLuongHienTai } from "@backend/services/tinh-luong";
import { POST as handleTinh } from "@/app/api/ky-luong/[id]/tinh/route";
import { POST as handleGui } from "@/app/api/ky-luong/[id]/gui/route";
import { GET as handleTongHop } from "@/app/api/ky-luong/[id]/tong-hop/route";
import { GET as handleHienTai } from "@/app/api/ky-luong/hien-tai/route";
import { GET as handleChiTiet } from "@/app/api/ky-luong/[id]/nhan-vien/[manv]/chi-tiet/route";
import {
  luongThang13,
  tinhTienCongNgay,
  tinhTongLuong,
  tinhTongGioLam,
  ngayChiTra,
  laKyCuoiNam,
} from "@backend/calc/luong";
import * as thongBao from "@frontend/config/thong-bao";

const KY_THANG11 = "KL209811";
const KY_THANG12 = "KL209812";
const KY_LOI = "KL209810";
const MANV = "NV000001";
const MA_HS = "HS209811";
const MA_BL_THUONG = "BL209811";
const LICH = ["LL209801", "LL209802", "LL209803", "LL209804", "LL209805"];
const CC = ["CC209801", "CC209802", "CC209803", "CC209804", "CC209805"];

type Handler = (req: Request, c: { params: Promise<Record<string, string>> }) => Promise<Response>;
const goiHandler = (h: Handler, method: string, url: string, params: Record<string, string>, token?: string) =>
  h(
    new Request(`http://localhost:3000${url}`, {
      method,
      headers: token ? { cookie: `${AUTH_COOKIE_NAME}=${token}` } : {},
    }),
    { params: Promise.resolve(params) }
  );
const xemTruoc = (id: string, token?: string) => goiHandler(handleTinh, "POST", `/api/ky-luong/${id}/tinh`, { id }, token);
const gui = (id: string, token?: string) => goiHandler(handleGui, "POST", `/api/ky-luong/${id}/gui`, { id }, token);
const tongHop = (id: string, token?: string) => goiHandler(handleTongHop, "GET", `/api/ky-luong/${id}/tong-hop`, { id }, token);
const chiTiet = (id: string, manv: string, query = "", token?: string) =>
  goiHandler(handleChiTiet, "GET", `/api/ky-luong/${id}/nhan-vien/${manv}/chi-tiet${query}`, { id, manv }, token);
const hienTai = (token?: string) => goiHandler(handleHienTai, "GET", "/api/ky-luong/hien-tai", {}, token);
describe("UC_8.2 Tính lương: công thức (backend/calc/luong.ts)", () => {
  it("tiền công ngày = giờ × mức lương × hệ số (hệ số 2)", () => {
    expect(tinhTienCongNgay({ Giolam: 3, Mucluong: 20000, Heso: 2 })).toBe(120000);
    expect(tinhTienCongNgay({ Giolam: 2.5, Mucluong: 17000, Heso: null })).toBe(42500);
  });

  it("Tongluong = Σ tiền công + Tienthuong", () => {
    const ds = [
      { Giolam: 3, Mucluong: 20000, Heso: 2 },
      { Giolam: 2.5, Mucluong: 20000, Heso: 1 },
    ];
    expect(tinhTongLuong(ds, 100000)).toBe(270000);
    expect(tinhTongLuong(ds, 0)).toBe(170000);
    expect(tinhTongGioLam(ds)).toBe(5.5);
  });

  it("lương tháng 13 = Σ giờ cả năm × mức lương hiện tại", () => {
    expect(luongThang13(104.5, 20000)).toBe(2090000);
    expect(luongThang13(6, 40000)).toBe(240000);
    expect(luongThang13(0, 40000)).toBe(0);
  });

  it("kỳ cuối năm là tháng 12; chi trả ngày 2 tháng sau", () => {
    expect(laKyCuoiNam(12)).toBe(true);
    expect(laKyCuoiNam(11)).toBe(false);
    expect(ngayChiTra(10, 2026)).toBe("2026-11-02");
    expect(ngayChiTra(12, 2026)).toBe("2027-01-02");
  });
});

describe("UC_8.2 API tính xem trước / gửi / đọc", () => {
  let chuQuanToken: string;
  let nhanVienToken: string;
  let mucLuongGoc: number;
  let maCa: string;

  async function donDep() {
    await prisma.chiTietBangLuong.deleteMany({ where: { BangLuong: { Makyluong: { in: [KY_THANG11, KY_THANG12, KY_LOI] } } } });
    await prisma.bangLuong.deleteMany({ where: { Makyluong: { in: [KY_THANG11, KY_THANG12, KY_LOI] } } });
    await prisma.chamCong.deleteMany({ where: { Machamcong: { in: CC } } });
    await prisma.lichLam.deleteMany({ where: { Malich: { in: LICH } } });
    await prisma.heSoLuong.deleteMany({ where: { Maheso: MA_HS } });
    await prisma.kyLuong.deleteMany({ where: { Makyluong: { in: [KY_THANG11, KY_THANG12, KY_LOI] } } });
  }

  const gio = (ngay: string, hhmm: string) => new Date(`${ngay}T${hhmm}:00.000Z`);
  const soDem = async (ky: string) => ({
    bangLuong: await prisma.bangLuong.count({ where: { Makyluong: ky } }),
    chiTiet: await prisma.chiTietBangLuong.count({ where: { BangLuong: { Makyluong: ky } } }),
  });

  beforeAll(async () => {
    process.env.JWT_SECRET = "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";
    chuQuanToken = await signSession({ userId: "CQ000001", username: "chuquan", role: "ChuQuan", name: "Hoàng Lan" });
    nhanVienToken = await signSession({ userId: MANV, username: MANV, role: "NhanVien", name: "Nguyễn Minh Anh" });

    await donDep();
    maCa = (await prisma.caLam.findFirstOrThrow({ orderBy: { Maca: "asc" } })).Maca;
    mucLuongGoc = (await prisma.nhanVien.findUniqueOrThrow({ where: { Manv: MANV } })).Mucluongtheogio;
    await prisma.nhanVien.update({ where: { Manv: MANV }, data: { Mucluongtheogio: 20000 } });

    await prisma.kyLuong.createMany({
      data: [
        { Makyluong: KY_THANG11, Thang: 11, Nam: 2098, Trangthai: "Chưa tính" },
        { Makyluong: KY_THANG12, Thang: 12, Nam: 2098, Trangthai: "Chưa tính" },
        { Makyluong: KY_LOI, Thang: 10, Nam: 2098, Trangthai: "Chưa tính" },
      ],
    });
    // Thưởng nhập trước (UC_8.5) phải được giữ nguyên khi tính lương
    await prisma.bangLuong.create({
      data: { Mabangluong: MA_BL_THUONG, Manv: MANV, Makyluong: KY_THANG11, Tienthuong: 100000, Lydothuong: "Làm tốt" },
    });
    await prisma.heSoLuong.create({
      data: { Maheso: MA_HS, Ngaybatdau: new Date("2098-11-05"), Ngayketthuc: new Date("2098-11-05"), Heso: 2 },
    });
    await prisma.lichLam.createMany({
      data: [
        { Malich: LICH[0], Ngaylam: new Date("2098-11-05"), Maca: maCa },
        { Malich: LICH[1], Ngaylam: new Date("2098-11-06"), Maca: maCa },
        { Malich: LICH[2], Ngaylam: new Date("2098-03-10"), Maca: maCa },
        { Malich: LICH[3], Ngaylam: new Date("2098-12-05"), Maca: maCa },
        { Malich: LICH[4], Ngaylam: new Date("2098-10-05"), Maca: maCa },
      ],
    });
    await prisma.chamCong.createMany({
      data: [
        { Machamcong: CC[0], Manv: MANV, Malich: LICH[0], Thoigiancheckin: gio("2098-11-05", "06:00"), Thoigiancheckout: gio("2098-11-05", "09:00") },
        { Machamcong: CC[1], Manv: MANV, Malich: LICH[1], Thoigiancheckin: gio("2098-11-06", "06:00"), Thoigiancheckout: gio("2098-11-06", "08:30") },
        { Machamcong: CC[2], Manv: MANV, Malich: LICH[2], Thoigiancheckin: gio("2098-03-10", "06:00"), Thoigiancheckout: gio("2098-03-10", "10:00") },
        { Machamcong: CC[3], Manv: MANV, Malich: LICH[3], Thoigiancheckin: gio("2098-12-05", "06:00"), Thoigiancheckout: gio("2098-12-05", "08:00") },
        // 2000 giờ vượt DECIMAL(5,2) → INSERT lỗi giữa transaction (dùng thử rollback của /gui)
        { Machamcong: CC[4], Manv: "NV000002", Malich: LICH[4], Thoigiancheckin: gio("2098-08-01", "06:00"), Thoigiancheckout: gio("2098-10-23", "14:00") },
      ],
    });
  });

  afterAll(async () => {
    await donDep();
    await prisma.nhanVien.update({ where: { Manv: MANV }, data: { Mucluongtheogio: mucLuongGoc } });
  });

  it("đối chiếu thông báo từng ký tự và màu", () => {
    expect(thongBao.TINH_LUONG_THANH_CONG).toBe("Tính lương thành công");
    expect(thongBao.TINH_LUONG_THAT_BAI).toBe("Tính lương thất bại");
    expect(thongBao.GUI_BANG_LUONG_THANH_CONG).toBe("Gửi bảng lương dự kiến thành công");
    expect(thongBao.GUI_BANG_LUONG_TIEU_DE).toBe("Xác nhận gửi bảng lương dự kiến");
    expect(thongBao.GUI_BANG_LUONG_NOI_DUNG).toBe(
      "Nhân viên có thể phản hồi sai sót trước khi chốt lương, xác nhận gửi bảng lương dự kiến?"
    );
    expect(thongBao.GUI_BANG_LUONG_KHONG).toBe("Không");
    expect(thongBao.GUI_BANG_LUONG_CO).toBe("Có");
    expect(thongBao.MAU_THONG_BAO.loi.chu).toBe("#C0392B");
    expect(thongBao.MAU_THONG_BAO["thanh-cong"].nen).toBe("#EDF3EB");
    expect(thongBao.MAU_THONG_BAO["thanh-cong"].chu).toBe("#587554");
  });

  it("chưa đăng nhập → 401 ở cả 5 API", async () => {
    expect((await xemTruoc(KY_THANG11)).status).toBe(401);
    expect((await gui(KY_THANG11)).status).toBe(401);
    expect((await tongHop(KY_THANG11)).status).toBe(401);
    expect((await chiTiet(KY_THANG11, MANV)).status).toBe(401);
    expect((await hienTai()).status).toBe(401);
  });

  it("nhân viên → 403 ở cả 5 API và không ghi gì", async () => {
    expect((await xemTruoc(KY_THANG11, nhanVienToken)).status).toBe(403);
    expect((await gui(KY_THANG11, nhanVienToken)).status).toBe(403);
    expect((await tongHop(KY_THANG11, nhanVienToken)).status).toBe(403);
    expect((await chiTiet(KY_THANG11, MANV, "", nhanVienToken)).status).toBe(403);
    expect((await hienTai(nhanVienToken)).status).toBe(403);
    const ky = await prisma.kyLuong.findUniqueOrThrow({ where: { Makyluong: KY_THANG11 } });
    expect(ky.Trangthai).toBe("Chưa tính");
    expect((await soDem(KY_THANG11)).chiTiet).toBe(0);
  });

  it("mã kỳ sai định dạng → 400, kỳ không tồn tại → 404", async () => {
    expect((await xemTruoc("abc", chuQuanToken)).status).toBe(400);
    expect((await gui("abc", chuQuanToken)).status).toBe(400);
    expect((await xemTruoc("KL209801", chuQuanToken)).status).toBe(404);
    expect((await gui("KL209801", chuQuanToken)).status).toBe(404);
  });

  it("GET hien-tai: kỳ chưa chốt cũ nhất, ngày chi trả = ngày 2 tháng sau", async () => {
    const json = await (await hienTai(chuQuanToken)).json();
    const cuNhat = await prisma.kyLuong.findFirstOrThrow({
      where: { Trangthai: { not: "Đã chốt" } },
      orderBy: [{ Nam: "asc" }, { Thang: "asc" }],
    });
    expect(json.data.Makyluong).toBe(cuNhat.Makyluong.trim());
    expect(json.data.Ngaychitra).toBe(ngayChiTra(cuNhat.Thang, cuNhat.Nam));
    expect(json.data.Kycuoinam).toBe(cuNhat.Thang === 12);
    expect(json.data.Trangthai).toBe(cuNhat.Trangthai);
  });

  it("xem trước kỳ tháng 11 KHÔNG ghi CSDL; hệ số 2, thưởng giữ nguyên", async () => {
    const truoc = await soDem(KY_THANG11);
    const res = await xemTruoc(KY_THANG11, chuQuanToken);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.Trangthai).toBe("Chưa tính");
    expect(json.data.Thongbao).toBe("Tính lương thành công");
    expect(json.data.Ngaychitra).toBe("2098-12-02");
    expect(json.data.Kycuoinam).toBe(false);
    const bl = json.data.BangLuong.find((b: { Manv: string }) => b.Manv === MANV);
    expect(bl.Songay).toBe(2);
    expect(bl.Tonggiolam).toBe(5.5);
    expect(bl.Tienthuong).toBe(100000);
    expect(bl.Luongthang13).toBeNull();
    // 3h × 20000 × 2 + 2.5h × 20000 × 1 + 100000
    expect(bl.Tongluong).toBe(270000);
    const ngay5 = bl.ChiTiet.find((c: { Ngaylam: string }) => c.Ngaylam === "2098-11-05");
    expect(ngay5.Heso).toBe(2);
    expect(ngay5.Thanhtien).toBe(120000);
    expect(ngay5.Ca).toBe("Sáng");
    expect(ngay5.Vao).toBe("06:00");
    expect(ngay5.Ra).toBe("09:00");
    // CSDL không đổi
    expect(await soDem(KY_THANG11)).toEqual(truoc);
    const ky = await prisma.kyLuong.findUniqueOrThrow({ where: { Makyluong: KY_THANG11 } });
    expect(ky.Trangthai).toBe("Chưa tính");
  });

  it("GET tong-hop và chi-tiet (kỳ chưa gửi) tính tại chỗ, phân trang phía máy chủ", async () => {
    const th = await (await tongHop(KY_THANG11, chuQuanToken)).json();
    const nv = th.data.BangLuong.find((b: { Manv: string }) => b.Manv === MANV);
    expect(nv.Manv).toBe("NV000001"); // mã đầy đủ
    expect(nv.Mucluong).toBe(20000);
    expect(nv.Heso).toBeCloseTo(1.55, 2); // (3×2 + 2.5×1) / 5.5
    expect(nv.ChiTiet).toBeUndefined();
    expect(th.data.Tonggio).toBeGreaterThanOrEqual(5.5);

    const t1 = await (await chiTiet(KY_THANG11, MANV, "?trang=1&soDong=1", chuQuanToken)).json();
    expect(t1.data).toMatchObject({ Manv: MANV, Tongsodong: 2, Trang: 1, Sodong: 1, Tonggio: 5.5, Tongluong: 270000, Ngaychitra: "2098-12-02" });
    expect(t1.data.Dong).toHaveLength(1);
    expect(t1.data.Dong[0].Ngaylam).toBe("2098-11-05");
    const t2 = await (await chiTiet(KY_THANG11, MANV.toLowerCase(), "?trang=2&soDong=1", chuQuanToken)).json();
    expect(t2.data.Dong[0]).toMatchObject({ Ngaylam: "2098-11-06", Giolam: 2.5, Heso: 1, Thanhtien: 50000, Thuong: 0 });
    expect((await chiTiet(KY_THANG11, MANV, "?trang=0", chuQuanToken)).status).toBe(400);
    expect((await chiTiet(KY_THANG11, "NV999999", "", chuQuanToken)).status).toBe(404);
  });

  it("gửi lỗi giữa chừng → 'Tính lương thất bại', rollback không lưu gì", async () => {
    const errLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await gui(KY_LOI, chuQuanToken);
    errLog.mockRestore();
    const json = await res.json();
    expect(res.status).toBe(500);
    expect(json.ok).toBe(false);
    expect(json.error.message).toBe("Tính lương thất bại");
    const ky = await prisma.kyLuong.findUniqueOrThrow({ where: { Makyluong: KY_LOI } });
    expect(ky.Trangthai).toBe("Chưa tính");
    expect(await soDem(KY_LOI)).toEqual({ bangLuong: 0, chiTiet: 0 });
  });

  it("gửi kỳ tháng 11: ghi đủ BangLuong + ChiTietBangLuong, kỳ → Dự kiến", async () => {
    const res = await gui(KY_THANG11, chuQuanToken);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.Trangthai).toBe("Dự kiến");
    expect(json.data.Thongbao).toBe("Gửi bảng lương dự kiến thành công");
    const bl = json.data.BangLuong.find((b: { Manv: string }) => b.Manv === MANV);
    expect(bl.Mabangluong).toBe(MA_BL_THUONG);
    expect(bl.Tongluong).toBe(270000);
    expect(bl.Tienthuong).toBe(100000);

    const ky = await prisma.kyLuong.findUniqueOrThrow({ where: { Makyluong: KY_THANG11 } });
    expect(ky.Trangthai).toBe("Dự kiến");
    expect(ky.Ngaychot).toBeNull();
    const ct = await prisma.chiTietBangLuong.findMany({ where: { Mabangluong: MA_BL_THUONG }, orderBy: { Ngaylam: "asc" } });
    expect(ct).toHaveLength(2);
    expect(ct.every((c) => c.Mucluong === 20000)).toBe(true);
    expect(ct[0].Maheso?.trim()).toBe(MA_HS);
    expect(ct[1].Maheso).toBeNull();
    expect(Number(ct[0].Giolam)).toBe(3);
    expect(ct[0].MaCTBL).toMatch(/^CT\d{6}$/);
    const bangLuong = await prisma.bangLuong.findUniqueOrThrow({ where: { Mabangluong: MA_BL_THUONG } });
    expect(bangLuong.Tienthuong).toBe(100000);
  });

  it("gửi lần hai / xem trước lại kỳ đã gửi → 409 'Tính lương thất bại', không ghi thêm", async () => {
    const truoc = await soDem(KY_THANG11);
    const r1 = await gui(KY_THANG11, chuQuanToken);
    expect(r1.status).toBe(409);
    expect((await r1.json()).error.message).toBe("Tính lương thất bại");
    expect((await xemTruoc(KY_THANG11, chuQuanToken)).status).toBe(409);
    expect(await soDem(KY_THANG11)).toEqual(truoc);
  });

  it("kỳ đã gửi đọc từ ChiTietBangLuong: đổi mức lương sau đó không đổi bảng cũ", async () => {
    await prisma.nhanVien.update({ where: { Manv: MANV }, data: { Mucluongtheogio: 30000 } });
    const th = await (await tongHop(KY_THANG11, chuQuanToken)).json();
    const nv = th.data.BangLuong.find((b: { Manv: string }) => b.Manv === MANV);
    expect(th.data.Trangthai).toBe("Dự kiến");
    expect(nv.Mucluong).toBe(20000);
    expect(nv.Tongluong).toBe(270000);
    expect(nv.Heso).toBeCloseTo(1.55, 2);
    const ct = await (await chiTiet(KY_THANG11, MANV, "", chuQuanToken)).json();
    expect(ct.data.Tongluong).toBe(270000);
    expect(ct.data.Dong[0]).toMatchObject({ Ngaylam: "2098-11-05", Mucluong: 20000, Heso: 2, Thanhtien: 120000, Ca: "Sáng", Vao: "06:00" });
  });

  it("kỳ cuối năm: xem trước có lương tháng 13 riêng; gửi lưu; tháng 13 tính lại theo mức hiện tại khi đọc", async () => {
    const xt = await (await xemTruoc(KY_THANG12, chuQuanToken)).json();
    expect(xt.data.Kycuoinam).toBe(true);
    expect(xt.data.Ngaychitra).toBe("2099-01-02");
    const b1 = xt.data.BangLuong.find((b: { Manv: string }) => b.Manv === MANV);
    // chỉ ngày 05/12 thuộc kỳ: 2h × 30000 (mức hiện tại lúc tính)
    expect(b1.Tonggiolam).toBe(2);
    expect(b1.Tongluong).toBe(60000);
    // giờ cả năm = 4 (10/03) + 5,5 (tháng 11) + 2 (05/12) = 11,5 → 11,5 × 30000, hiển thị riêng
    expect(b1.Luongthang13).toBe(345000);
    expect((await soDem(KY_THANG12)).bangLuong).toBe(0);

    expect((await gui(KY_THANG12, chuQuanToken)).status).toBe(200);
    const ct = await prisma.chiTietBangLuong.findMany({ where: { BangLuong: { Makyluong: KY_THANG12 } } });
    expect(ct).toHaveLength(1);
    expect(ct[0].Mucluong).toBe(30000);

    await prisma.nhanVien.update({ where: { Manv: MANV }, data: { Mucluongtheogio: 40000 } });
    const th = await (await tongHop(KY_THANG12, chuQuanToken)).json();
    const b2 = th.data.BangLuong.find((b: { Manv: string }) => b.Manv === MANV);
    expect(b2.Tongluong).toBe(60000); // bảng đã gửi giữ mức lương cũ
    expect(b2.Luongthang13).toBe(460000); // tháng 13: 11,5 × 40000
    expect(b2.Luongthang13).toBe(luongThang13(11.5, 40000));
  });
});

describe("ensureKyLuongHienTai tự động tạo kỳ lương khi CSDL trống hoặc qua tháng mới", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function makeMockDb(opts: {
    openKy?: { Makyluong: string; Thang: number; Nam: number; Trangthai: string; Ngaychot: Date | null } | null;
    allKys?: Array<{ Thang: number; Nam: number }>;
    chamCongDates?: string[];
    onCreate?: (data: { Makyluong: string; Thang: number; Nam: number; Trangthai: string; Ngaychot: null }) => unknown;
    raceResult?: { Makyluong: string; Thang: number; Nam: number; Trangthai: string; Ngaychot: Date | null } | null;
  }) {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(opts.openKy ?? null)
      .mockResolvedValueOnce(opts.raceResult ?? null);
    const findManyKys = vi.fn().mockResolvedValue(opts.allKys ?? []);
    const findManyCc = vi.fn().mockResolvedValue(
      (opts.chamCongDates ?? []).map((d) => ({
        LichLam: { Ngaylam: new Date(`${d}T00:00:00.000Z`) },
      })),
    );
    const create = vi.fn().mockImplementation(async ({ data }) => {
      if (opts.onCreate) return opts.onCreate(data);
      return data;
    });
    const db = {
      kyLuong: { findFirst, findMany: findManyKys, create },
      chamCong: { findMany: findManyCc },
    };
    return { db: db as unknown as Parameters<typeof ensureKyLuongHienTai>[0], findFirst, create };
  }

  it("trả về kỳ chưa chốt hiện có mà không tạo mới", async () => {
    const openKy = { Makyluong: "KL202611", Thang: 11, Nam: 2026, Trangthai: "Chưa tính", Ngaychot: null };
    const { db, create } = makeMockDb({ openKy });
    const ky = await ensureKyLuongHienTai(db);
    expect(ky).toEqual(openKy);
    expect(create).not.toHaveBeenCalled();
  });

  it("CSDL trống + có chấm công hoàn thành trong tháng -> tự tạo KL202611 trạng thái Chưa tính", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T10:00:00+07:00"));
    const { db, create } = makeMockDb({
      openKy: null,
      allKys: [],
      chamCongDates: ["2026-11-11", "2026-11-14", "2026-11-15"],
    });
    const ky = await ensureKyLuongHienTai(db);
    expect(create).toHaveBeenCalledWith({
      data: {
        Makyluong: "KL202611",
        Thang: 11,
        Nam: 2026,
        Trangthai: "Chưa tính",
        Ngaychot: null,
      },
    });
    expect(ky?.Makyluong).toBe("KL202611");
  });

  it("CSDL trống + chưa có chấm công -> tạo kỳ lương theo tháng hiện tại VN", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-03T09:00:00+07:00"));
    const { db, create } = makeMockDb({
      openKy: null,
      allKys: [],
      chamCongDates: [],
    });
    const ky = await ensureKyLuongHienTai(db);
    expect(create).toHaveBeenCalledWith({
      data: {
        Makyluong: "KL202612",
        Thang: 12,
        Nam: 2026,
        Trangthai: "Chưa tính",
        Ngaychot: null,
      },
    });
    expect(ky?.Makyluong).toBe("KL202612");
  });

  it("chấm công tháng cũ chưa có kỳ lương (qua đầu tháng mới) -> ưu tiên tạo kỳ cũ nhất trước", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-01T08:00:00+07:00"));
    const { db, create } = makeMockDb({
      openKy: null,
      allKys: [{ Thang: 10, Nam: 2026 }],
      chamCongDates: ["2026-10-20", "2026-11-14", "2026-12-01"],
    });
    const ky = await ensureKyLuongHienTai(db);
    expect(create).toHaveBeenCalledWith({
      data: {
        Makyluong: "KL202611",
        Thang: 11,
        Nam: 2026,
        Trangthai: "Chưa tính",
        Ngaychot: null,
      },
    });
    expect(ky?.Makyluong).toBe("KL202611");
  });

  it("kỳ tháng hiện tại đã chốt trong cùng tháng -> trả về null để không nhảy trước sang tháng sau", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-28T15:00:00+07:00"));
    const { db, create } = makeMockDb({
      openKy: null,
      allKys: [{ Thang: 11, Nam: 2026 }],
      chamCongDates: ["2026-11-15"],
    });
    const ky = await ensureKyLuongHienTai(db);
    expect(ky).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it("xử lý an toàn P2002 khi hai yêu cầu đồng thời cùng tạo một kỳ lương", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T10:00:00+07:00"));
    const existing = { Makyluong: "KL202611", Thang: 11, Nam: 2026, Trangthai: "Chưa tính", Ngaychot: null };
    const { db } = makeMockDb({
      openKy: null,
      allKys: [],
      chamCongDates: ["2026-11-15"],
      raceResult: existing,
      onCreate: () => {
        throw new Prisma.PrismaClientKnownRequestError("Unique constraint", {
          code: "P2002",
          clientVersion: "6.0.0",
        });
      },
    });
    const ky = await ensureKyLuongHienTai(db);
    expect(ky).toEqual(existing);
  });
});