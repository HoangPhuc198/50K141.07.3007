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
import { GET as handleChuQuanTongQuan } from "@/app/api/chu-quan/tong-quan/route";
import { GET as handleNhanVienTongQuan } from "@/app/api/nhan-vien/tong-quan/route";
import { GET as handleThongBao } from "@/app/api/thong-bao/route";
import { GET as handleAuthMe } from "@/app/api/auth/me/route";
import { chuQuanMenu, nhanVienMenu } from "@frontend/config/menu";
import * as thongBao from "@frontend/config/thong-bao";
import { prisma } from "@database/client";
import {
  mapChuQuanDashboardView,
  mapHeaderUser,
  mapNhanVienDashboardView,
} from "@frontend/mappers/tong-quan";

describe("U2 & U3 - Màn hình chính Chủ quán & Nhân viên (dữ liệu thật & bám Figma)", () => {
  const TEST_SECRET =
    "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";

  const signChuQuan = () =>
    signSession({
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Thanh Hà",
    });

  const signNv = (manv: string, name: string) =>
    signSession({
      userId: manv,
      username: manv,
      role: "NhanVien",
      name,
    });

  // Dữ liệu cô lập hoàn toàn với seed & các test khác: ngày 2098-06-17 (Thứ Ba)
  // Tuần hiện tại: 2098-06-16 (Thứ Hai) -> 2098-06-22 (Chủ Nhật)
  const mondayDateObj = new Date("2098-06-16T00:00:00Z");
  const wedDateObj = new Date("2098-06-17T00:00:00Z");
  const testMalichMonSang = "LL980004";
  const testMalichSang = "LL980001";
  const testMalichChieu = "LL980002";
  const testMalichToi = "LL980003";
  const testMalichFuture = "LL980005";
  const testCCIds = ["CC980001", "CC980002", "CC980003", "CC980004"];
  const testNVId = "NV980001";
  const testEmptyNVId = "NV980002";
  const testKLId = "KL980001";
  const testBLId = "BL980001";
  let expectedKyThang = 6;
  let expectedKyTrangThai = "Dự kiến";

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_SECRET;

    await prisma.chiTietBangLuong.deleteMany({ where: { Mabangluong: testBLId } });
    await prisma.bangLuong.deleteMany({ where: { Mabangluong: testBLId } });
    await prisma.kyLuong.deleteMany({ where: { Makyluong: testKLId } });
    await prisma.chamCong.deleteMany({ where: { Machamcong: { in: testCCIds } } });
    await prisma.nhanVien_LichLam.deleteMany({
      where: {
        OR: [
          {
            Malich: {
              in: [
                testMalichMonSang,
                testMalichSang,
                testMalichChieu,
                testMalichToi,
                testMalichFuture,
              ],
            },
          },
          { Manv: { in: [testNVId, testEmptyNVId] } },
        ],
      },
    });
    await prisma.lichLam.deleteMany({
      where: {
        Malich: {
          in: [
            testMalichMonSang,
            testMalichSang,
            testMalichChieu,
            testMalichToi,
            testMalichFuture,
          ],
        },
      },
    });
    await prisma.nhanVien.deleteMany({ where: { Manv: { in: [testNVId, testEmptyNVId] } } });

    await prisma.nhanVien.create({
      data: {
        Manv: testNVId,
        Tendangnhap: testNVId,
        Matkhau: "hash_khong_dung_dang_nhap",
        Hoten: "Nhân Viên Test U3",
        Sdt: "0999888777",
        Diachi: "123 Đường Test",
        Vitrilamviec: "Pha chế",
        Hinhthuclam: "Full-time",
        Ngayvaolam: new Date("2025-01-01T00:00:00Z"),
        Kinhnghiem: "1 năm",
        Trangthai: "Chính thức",
        Mucluongtheogio: 25000,
      },
    });

    await prisma.nhanVien.create({
      data: {
        Manv: testEmptyNVId,
        Tendangnhap: testEmptyNVId,
        Matkhau: "hash_khong_dung_dang_nhap",
        Hoten: "Nhân Viên Mới Không Lương",
        Sdt: "0999888666",
        Diachi: "456 Đường Test",
        Vitrilamviec: "Phục vụ",
        Hinhthuclam: "Part-time",
        Ngayvaolam: new Date("2098-06-01T00:00:00Z"),
        Kinhnghiem: "Chưa có",
        Trangthai: "Thử việc",
        Mucluongtheogio: 20000,
      },
    });

    await prisma.lichLam.createMany({
      data: [
        { Malich: testMalichMonSang, Ngaylam: mondayDateObj, Maca: "CA000001" },
        { Malich: testMalichSang, Ngaylam: wedDateObj, Maca: "CA000001" },
        { Malich: testMalichChieu, Ngaylam: wedDateObj, Maca: "CA000002" },
        { Malich: testMalichToi, Ngaylam: wedDateObj, Maca: "CA000003" },
        { Malich: testMalichFuture, Ngaylam: new Date("2098-06-20T00:00:00Z"), Maca: "CA000001" },
      ],
    });

    await prisma.nhanVien_LichLam.createMany({
      data: [
        { Manv: testNVId, Malich: testMalichMonSang },
        { Manv: testNVId, Malich: testMalichSang },
        { Manv: "NV000002", Malich: testMalichSang },
        { Manv: testNVId, Malich: testMalichChieu },
        { Manv: "NV000003", Malich: testMalichChieu },
        { Manv: "NV000002", Malich: testMalichToi },
        { Manv: testEmptyNVId, Malich: testMalichFuture },
      ],
    });

    await prisma.chamCong.createMany({
      data: [
        // Thứ Hai: đã check-out 4h (06:00 -> 10:00)
        {
          Machamcong: "CC980001",
          Thoigiancheckin: new Date("2098-06-16T06:00:00Z"),
          Thoigiancheckout: new Date("2098-06-16T10:00:00Z"),
          Manv: testNVId,
          Malich: testMalichMonSang,
        },
        // Thứ Tư Ca sáng: đã check-out 5.5h (06:00 -> 11:30)
        {
          Machamcong: "CC980002",
          Thoigiancheckin: new Date("2098-06-17T06:00:00Z"),
          Thoigiancheckout: new Date("2098-06-17T11:30:00Z"),
          Manv: testNVId,
          Malich: testMalichSang,
        },
        // Thứ Tư Ca chiều: NV980001 đang làm (check-in 11:35, chưa check-out)
        {
          Machamcong: "CC980003",
          Thoigiancheckin: new Date("2098-06-17T11:35:00Z"),
          Thoigiancheckout: null,
          Manv: testNVId,
          Malich: testMalichChieu,
        },
        // Thứ Tư Ca chiều: NV000003 đã check-out sớm (11:30 -> 12:30 = 1h)
        {
          Machamcong: "CC980004",
          Thoigiancheckin: new Date("2098-06-17T11:30:00Z"),
          Thoigiancheckout: new Date("2098-06-17T12:30:00Z"),
          Manv: "NV000003",
          Malich: testMalichChieu,
        },
      ],
    });

    // Tìm kỳ lương mới nhất đã có bảng lương (nếu seed đã có) để không ảnh hưởng kỳ mới nhất,
    // nếu chưa có thì dùng kỳ 1998-06 cô lập hoàn toàn.
    const existingKy = await prisma.kyLuong.findFirst({
      where: {
        Trangthai: { in: ["Dự kiến", "Đã chốt"] },
        BangLuong: { some: {} },
      },
      orderBy: [{ Nam: "desc" }, { Thang: "desc" }],
    });

    let targetMakyluong = testKLId;
    if (existingKy) {
      targetMakyluong = existingKy.Makyluong;
      expectedKyThang = existingKy.Thang;
      expectedKyTrangThai = existingKy.Trangthai;
    } else {
      await prisma.kyLuong.create({
        data: {
          Makyluong: testKLId,
          Thang: 6,
          Nam: 1998,
          Trangthai: "Dự kiến",
          Ngaychot: null,
        },
      });
    }

    await prisma.bangLuong.create({
      data: {
        Mabangluong: testBLId,
        Makyluong: targetMakyluong,
        Manv: testNVId,
        Tienthuong: 150000,
        Lydothuong: "Thưởng test U3",
      },
    });
    const ngayChiTiet = existingKy
      ? new Date(Date.UTC(existingKy.Nam, existingKy.Thang - 1, 2))
      : new Date("1998-06-02T00:00:00Z");
    const ngayChiTiet2 = existingKy
      ? new Date(Date.UTC(existingKy.Nam, existingKy.Thang - 1, 3))
      : new Date("1998-06-03T00:00:00Z");
    await prisma.chiTietBangLuong.createMany({
      data: [
        {
          MaCTBL: "CT980001",
          Ngaylam: ngayChiTiet,
          Giolam: 20,
          Mucluong: 25000,
          Mabangluong: testBLId,
          Maheso: null,
        },
        {
          MaCTBL: "CT980002",
          Ngaylam: ngayChiTiet2,
          Giolam: 20,
          Mucluong: 25000,
          Mabangluong: testBLId,
          Maheso: null,
        },
      ],
    });
  });

  afterAll(async () => {
    vi.useRealTimers();
    await prisma.chiTietBangLuong.deleteMany({ where: { Mabangluong: testBLId } });
    await prisma.bangLuong.deleteMany({ where: { Mabangluong: testBLId } });
    await prisma.kyLuong.deleteMany({ where: { Makyluong: testKLId } });
    await prisma.chamCong.deleteMany({ where: { Machamcong: { in: testCCIds } } });
    await prisma.nhanVien_LichLam.deleteMany({
      where: {
        OR: [
          {
            Malich: {
              in: [
                testMalichMonSang,
                testMalichSang,
                testMalichChieu,
                testMalichToi,
                testMalichFuture,
              ],
            },
          },
          { Manv: { in: [testNVId, testEmptyNVId] } },
        ],
      },
    });
    await prisma.lichLam.deleteMany({
      where: {
        Malich: {
          in: [
            testMalichMonSang,
            testMalichSang,
            testMalichChieu,
            testMalichToi,
            testMalichFuture,
          ],
        },
      },
    });
    await prisma.nhanVien.deleteMany({ where: { Manv: { in: [testNVId, testEmptyNVId] } } });
  });

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Kiểm tra phân quyền 401/403 và thông tin phiên thật", () => {
    it("GET /api/chu-quan/tong-quan: 401 chưa đăng nhập, 403 nhân viên, 200 chủ quán", async () => {
      const unauth = await handleChuQuanTongQuan(
        new Request("http://localhost:3000/api/chu-quan/tong-quan"),
        { params: Promise.resolve({}) }
      );
      expect(unauth.status).toBe(401);

      const nvToken = await signNv(testNVId, "Nhân Viên Test U3");
      const forbidden = await handleChuQuanTongQuan(
        new Request("http://localhost:3000/api/chu-quan/tong-quan", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${nvToken}` },
        }),
        { params: Promise.resolve({}) }
      );
      expect(forbidden.status).toBe(403);

      const cqToken = await signChuQuan();
      const okRes = await handleChuQuanTongQuan(
        new Request("http://localhost:3000/api/chu-quan/tong-quan", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` },
        }),
        { params: Promise.resolve({}) }
      );
      expect(okRes.status).toBe(200);
    });

    it("GET /api/nhan-vien/tong-quan: 401 chưa đăng nhập, 403 chủ quán, 200 nhân viên", async () => {
      const unauth = await handleNhanVienTongQuan(
        new Request("http://localhost:3000/api/nhan-vien/tong-quan"),
        { params: Promise.resolve({}) }
      );
      expect(unauth.status).toBe(401);

      const cqToken = await signChuQuan();
      const forbidden = await handleNhanVienTongQuan(
        new Request("http://localhost:3000/api/nhan-vien/tong-quan", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` },
        }),
        { params: Promise.resolve({}) }
      );
      expect(forbidden.status).toBe(403);

      const nvToken = await signNv(testNVId, "Nhân Viên Test U3");
      const okRes = await handleNhanVienTongQuan(
        new Request("http://localhost:3000/api/nhan-vien/tong-quan", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${nvToken}` },
        }),
        { params: Promise.resolve({}) }
      );
      expect(okRes.status).toBe(200);
    });

    it("GET /api/thong-bao & GET /api/auth/me: 401 khi chưa đăng nhập, trả dữ liệu thật khi đã đăng nhập", async () => {
      const resTbUnauth = await handleThongBao(
        new Request("http://localhost:3000/api/thong-bao"),
        { params: Promise.resolve({}) }
      );
      expect(resTbUnauth.status).toBe(401);

      const resMeUnauth = await handleAuthMe(
        new Request("http://localhost:3000/api/auth/me"),
        { params: Promise.resolve({}) }
      );
      expect(resMeUnauth.status).toBe(401);

      const nvToken = await signNv(testNVId, "Nhân Viên Test U3");
      const resMeNv = await handleAuthMe(
        new Request("http://localhost:3000/api/auth/me", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${nvToken}` },
        }),
        { params: Promise.resolve({}) }
      );
      expect(resMeNv.status).toBe(200);
      const jMeNv = await resMeNv.json();
      expect(jMeNv.data.user.userId).toBe(testNVId);
      expect(jMeNv.data.user.position).toBe("Pha chế");

      const cqToken = await signChuQuan();
      const resTbCq = await handleThongBao(
        new Request("http://localhost:3000/api/thong-bao", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` },
        }),
        { params: Promise.resolve({}) }
      );
      expect(resTbCq.status).toBe(200);
      const jTbCq = await resTbCq.json();
      expect(typeof jTbCq.data.count).toBe("number");
      expect(Array.isArray(jTbCq.data.items)).toBe(true);
    });
  });

  describe("Dữ liệu CSDL thật cho U2 (/api/chu-quan/tong-quan) và U3 (/api/nhan-vien/tong-quan)", () => {
    it("U2 trả đúng ca làm hôm nay theo giờ VN, trạng thái từng (Manv, Malich) và giờ làm tuần", async () => {
      vi.setSystemTime(new Date("2098-06-17T13:00:00+07:00"));
      const cqToken = await signChuQuan();
      const res = await handleChuQuanTongQuan(
        new Request("http://localhost:3000/api/chu-quan/tong-quan", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` },
        }),
        { params: Promise.resolve({}) }
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      const data = json.data;

      // Chỉ có NV980001 đang trong ca chiều (chưa check-out)
      expect(data.thongKe.nhanVienDangLam).toBe(1);
      expect(data.tuanHienTai).toEqual({
        tuNgay: "2098-06-16",
        denNgay: "2098-06-22",
      });

      const caSang = data.caLamHomNay.find((c: { maca: string }) => c.maca === "CA000001");
      const caChieu = data.caLamHomNay.find((c: { maca: string }) => c.maca === "CA000002");
      const caToi = data.caLamHomNay.find((c: { maca: string }) => c.maca === "CA000003");
      expect(caSang.trangThai).toBe("Đã kết thúc");
      expect(caChieu.trangThai).toBe("Đang diễn ra");
      expect(caToi.trangThai).toBe("Chưa bắt đầu");

      // Kiểm tra trạng thái theo từng (Manv, Malich) không bị ghi đè chéo ca
      const nvTestSang = caSang.nhanViens.find((n: { manv: string }) => n.manv === testNVId);
      const nvTestChieu = caChieu.nhanViens.find((n: { manv: string }) => n.manv === testNVId);
      const nv2Sang = caSang.nhanViens.find((n: { manv: string }) => n.manv === "NV000002");
      const nv3Chieu = caChieu.nhanViens.find((n: { manv: string }) => n.manv === "NV000003");
      expect(nvTestSang.trangThaiChamCong).toBe("Đã check-out");
      expect(nvTestChieu.trangThaiChamCong).toBe("Đã check-in");
      expect(nv2Sang.trangThaiChamCong).toBe("Chưa check-in");
      expect(nv3Chieu.trangThaiChamCong).toBe("Đã check-out");

      // Giờ làm tuần từng nhân viên: NV980001 = 4h (T2) + 5.5h (T4 sáng) = 9.5h; 2 ca đã hoàn thành trong tuần
      const gioNvTest = data.gioLamTuanNhanVien.find(
        (g: { manv: string }) => g.manv === testNVId
      );
      expect(gioNvTest.tongGioTuan).toBe(9.5);
      expect(gioNvTest.soCaTuan).toBe(2);

      const gioNv3 = data.gioLamTuanNhanVien.find(
        (g: { manv: string }) => g.manv === "NV000003"
      );
      expect(gioNv3.tongGioTuan).toBe(1);
    });

    it("U3 lấy mã NV từ phiên JWT (bỏ qua query manv), trả ca hôm nay, nút Bổ sung chấm công và bảng lương thật", async () => {
      vi.setSystemTime(new Date("2098-06-17T13:00:00+07:00"));

      // NV980001 đang trong ca chiều -> Check-out + bảng lương thật từ CSDL
      const nvTestToken = await signNv(testNVId, "Nhân Viên Test U3");
      const resNvTest = await handleNhanVienTongQuan(
        new Request("http://localhost:3000/api/nhan-vien/tong-quan?manv=NV000002", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${nvTestToken}` },
        }),
        { params: Promise.resolve({}) }
      );
      expect(resNvTest.status).toBe(200);
      const d1 = (await resNvTest.json()).data;
      expect(d1.nhanVien.manv).toBe(testNVId);
      expect(d1.caHienTai.tenCa).toBe("Ca chiều");
      expect(d1.caHienTai.trangThai).toBe("Đang trong ca");
      expect(d1.caHienTai.nutHanhDong).toBe("Check-out");
      expect(d1.caHienTai.thoiGianCheckIn).toBe("11:35");
      expect(d1.caHienTai.thoiGianLam).toBe("1 giờ 25 phút");
      expect(d1.luongThangGanNhat.coBangLuong).toBe(true);
      expect(d1.luongThangGanNhat.kyLuong).toBe(`Lương tháng ${expectedKyThang}`);
      expect(d1.luongThangGanNhat.trangThai).toBe(expectedKyTrangThai);
      expect(d1.luongThangGanNhat.tongTien).toBe(1150000);
      expect(d1.luongThangGanNhat.tongGioLam).toBe(40);
      expect(d1.luongThangGanNhat.mucLuongGio).toBe(25000);

      // NV000003 đã check-out ca chiều -> nutHanhDong = "Bổ sung chấm công"
      const nv3Token = await signNv("NV000003", "Lê Quốc Bảo");
      const resNv3 = await handleNhanVienTongQuan(
        new Request("http://localhost:3000/api/nhan-vien/tong-quan", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${nv3Token}` },
        }),
        { params: Promise.resolve({}) }
      );
      expect(resNv3.status).toBe(200);
      const d3 = (await resNv3.json()).data;
      expect(d3.caHienTai.trangThai).toBe("Đã check-out");
      expect(d3.caHienTai.nutHanhDong).toBe("Bổ sung chấm công");

      // NV000004 không có ca ngày 2098-06-17 -> caHienTai = null
      const nv4Token = await signNv("NV000004", "Phạm Thu Hà");
      const resNv4 = await handleNhanVienTongQuan(
        new Request("http://localhost:3000/api/nhan-vien/tong-quan", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${nv4Token}` },
        }),
        { params: Promise.resolve({}) }
      );
      expect(resNv4.status).toBe(200);
      const d4 = (await resNv4.json()).data;
      expect(d4.caHienTai).toBeNull();
    });

    it("BR01 - NV mới chưa có bảng lương không rò rỉ kỳ lương người khác & không tự bịa thông báo lịch/giờ mẫu", async () => {
      vi.setSystemTime(new Date("2098-06-17T13:00:00+07:00"));
      const emptyNvToken = await signNv(testEmptyNVId, "Nhân Viên Mới Không Lương");

      const resEmpty = await handleNhanVienTongQuan(
        new Request("http://localhost:3000/api/nhan-vien/tong-quan", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${emptyNvToken}` },
        }),
        { params: Promise.resolve({}) }
      );
      expect(resEmpty.status).toBe(200);
      const dEmpty = (await resEmpty.json()).data;

      // NV980001 và các NV khác có kỳ lương thật, nhưng NV980002 chưa có BangLuong nào -> rỗng, không hiện tên kỳ hay "Dự kiến"
      expect(dEmpty.luongThangGanNhat.coBangLuong).toBe(false);
      expect(dEmpty.luongThangGanNhat.kyLuong).toBe("Bảng lương");
      expect(dEmpty.luongThangGanNhat.trangThai).toBe("–");
      expect(dEmpty.luongThangGanNhat.tongTien).toBe(0);
      expect(dEmpty.luongThangGanNhat.tongGioLam).toBe(0);
      expect(dEmpty.luongThangGanNhat.mucLuongGio).toBe(20000);

      // Dù NV980002 có ca tương lai (2098-06-20), bảng LichLam không có cột updated_at nên không phát sinh thông báo giả
      expect(dEmpty.thongBao).toEqual([]);

      const resTb = await handleThongBao(
        new Request("http://localhost:3000/api/thong-bao", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${emptyNvToken}` },
        }),
        { params: Promise.resolve({}) }
      );
      expect(resTb.status).toBe(200);
      const tbData = (await resTb.json()).data;
      expect(tbData.items).toEqual([]);
      expect(tbData.count).toBe(0);
    });
  });

  describe("So khớp từng ký tự 08-THONG-BAO.md, SRS/Figma & loại bỏ số mẫu cứng", () => {
    it("Chuỗi thông báo U3 khớp nguyên văn 08-THONG-BAO.md", () => {
      const mdPath = path.resolve(__dirname, "../../../docs/ke-hoach/08-THONG-BAO.md");
      const md = fs.readFileSync(mdPath, "utf-8");
      expect(md).toContain(thongBao.BANG_LUONG_CHUA_TONG_HOP);
      expect(md).toContain(thongBao.CHECK_IN_KHONG_CO_CA);
      expect(thongBao.BANG_LUONG_CHUA_TONG_HOP).toBe("Bảng lương chưa được tổng hợp");
      expect(thongBao.CHECK_IN_KHONG_CO_CA).toBe("Hiện bạn không có ca làm để check-in");
    });

    it("Menu & nút điều hướng khớp SRS/Figma đã chốt (mục 2, mục 5, mục 18)", () => {
      const nvMain = nhanVienMenu.find((m) => m.id === "main");
      expect(nvMain?.href).toBe("/nhan-vien");

      const nvLuongGroup = nhanVienMenu.find((m) => m.id === "luong_nv");
      const subLabels = nvLuongGroup?.items?.map((c) => c.title) || [];
      expect(subLabels).toContain("Xem bảng lương");
      expect(subLabels).toContain("Phản hồi sai sót lương");

      const cqMain = chuQuanMenu.find((m) => m.id === "main");
      expect(cqMain?.href).toBe("/chu-quan");

      const nvDashPath = path.resolve(__dirname, "../../frontend/screens/nhan-vien/NhanVienDashboard.tsx");
      const nvDashSrc = fs.readFileSync(nvDashPath, "utf-8");
      const mapperPath = path.resolve(__dirname, "../../frontend/mappers/tong-quan.ts");
      const mapperSrc = fs.readFileSync(mapperPath, "utf-8");
      expect(mapperSrc).toContain("/nhan-vien/cham-cong/bo-sung");
      expect(nvDashSrc).not.toContain("2.090.000đ");
      expect(nvDashSrc).not.toContain("Nguyễn Minh Anh");
      expect(nvDashSrc).not.toContain("Lương tháng 10");
      expect(nvDashSrc).not.toContain("?? 0");
      expect(nvDashSrc).not.toContain('|| "Nhân viên"');

      const cqDashPath = path.resolve(__dirname, "../../frontend/screens/chu-quan/ChuQuanDashboard.tsx");
      const cqDashSrc = fs.readFileSync(cqDashPath, "utf-8");
      expect(cqDashSrc).not.toContain("?? 0");
      expect(cqDashSrc).not.toContain('?? "0/0"');

      const appShellPath = path.resolve(__dirname, "../../frontend/components/layout/AppShell.tsx");
      const appShellSrc = fs.readFileSync(appShellPath, "utf-8");
      expect(appShellSrc).toContain("/api/thong-bao");
      expect(appShellSrc).not.toContain("Bảng lương đã sẵn sàng");
      expect(appShellSrc).not.toContain('"Thanh Hà"');
      expect(appShellSrc).not.toContain('"TH"');

      const tongQuanPath = path.resolve(__dirname, "../../backend/services/tong-quan.ts");
      const tongQuanSrc = fs.readFileSync(tongQuanPath, "utf-8");
      expect(tongQuanSrc).not.toContain("2090000");
      expect(tongQuanSrc).not.toContain("2.090.000");
      expect(tongQuanSrc).not.toContain("Hôm nay · 08:00");
      expect(tongQuanSrc).not.toContain("Hôm qua · 16:30");
      expect(tongQuanSrc).not.toContain("Lịch làm tuần này đã được cập nhật");
    });

    it("Không rò rỉ tên/mã NV từ JWT khi NV không tồn tại trong CSDL và mapper rỗng hiển thị chuẩn", async () => {
      const ghostToken = await signNv("NV999999", "Nguyễn Minh Anh");
      const resMe = await handleAuthMe(
        new Request("http://localhost:3000/api/auth/me", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${ghostToken}` },
        }),
        { params: Promise.resolve({}) }
      );
      expect(resMe.status).toBe(200);
      const meJson = await resMe.json();
      expect(meJson.data.user.name).toBe("");
      expect(meJson.data.user.position).toBe("");
      expect(meJson.data.user.userId).toBe("");

      const resTq = await handleNhanVienTongQuan(
        new Request("http://localhost:3000/api/nhan-vien/tong-quan", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${ghostToken}` },
        }),
        { params: Promise.resolve({}) }
      );
      expect(resTq.status).toBe(200);
      const tqJson = await resTq.json();
      expect(tqJson.data.nhanVien).toEqual({
        manv: "",
        hoten: "",
        vitrilamviec: "",
      });

      const headerEmpty = mapHeaderUser(meJson.data.user, "NhanVien");
      expect(headerEmpty.initials).toBe("–");
      expect(headerEmpty.name).toBe("");
      expect(headerEmpty.position).toBe("");

      const cqEmptyView = mapChuQuanDashboardView(
        {
          thongKe: { nhanVienDangLam: 0, caLamHomNay: "0/3", yeuCauCanXuLy: 0 },
          danhSachYeuCau: [],
          caLamHomNay: [],
          tuanHienTai: { tuNgay: "2026-11-09", denNgay: "2026-11-15" },
          gioLamTuanNhanVien: [],
        },
        "all",
        false
      );
      expect(cqEmptyView.nhanVienDangLamText).toBe("0");
      expect(cqEmptyView.caLamHomNayText).toBe("0/3");
      expect(cqEmptyView.yeuCauCanXuLyText).toBe("0");
      expect(cqEmptyView.yeuCauBadgeText).toBe("0 yêu cầu");
      expect(cqEmptyView.emptyListSymbol).toBe("–");

      const nvEmptyView = mapNhanVienDashboardView(
        {
          nhanVien: { manv: "", hoten: "", vitrilamviec: "" },
          caHienTai: null,
          lichRanhTuanMoi: {
            tieuDe: "Đăng ký lịch rảnh tuần mới",
            link: "/nhan-vien/ca-lam/lich-ranh",
          },
          luongThangGanNhat: {
            coBangLuong: false,
            kyLuong: "Bảng lương",
            trangThai: "–",
            tongTien: 0,
            tongGioLam: 0,
            mucLuongGio: 0,
          },
          thongBao: [],
        },
        false
      );
      expect(nvEmptyView.ca.trangThaiText).toBe("Không có ca làm");
      expect(nvEmptyView.ca.thoiGianLamText).toBe("0 giờ");
      expect(nvEmptyView.ca.tenCaText).toBe(thongBao.CHECK_IN_KHONG_CO_CA);
      expect(nvEmptyView.luong.kyLuongText).toBe("Bảng lương");
      expect(nvEmptyView.luong.trangThaiText).toBe("–");
      expect(nvEmptyView.luong.tongTienText).toBe(thongBao.BANG_LUONG_CHUA_TONG_HOP);
      expect(nvEmptyView.luong.tongGioLamText).toBe("0 giờ làm");
      expect(nvEmptyView.luong.mucLuongGioText).toBe("0đ/giờ");
      expect(nvEmptyView.emptySymbol).toBe("–");
    });
  });
});
