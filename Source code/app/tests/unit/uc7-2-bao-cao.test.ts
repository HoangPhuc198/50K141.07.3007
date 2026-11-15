import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { signSession, AUTH_COOKIE_NAME } from "@backend/lib/auth";
import { GET as getBaoCaoChamCong } from "@/app/api/bao-cao/cham-cong/route";
import { layDanhSachQuenChamCong } from "@backend/services/bao-cao-cham-cong";
import { phanLoaiQuenChamCong } from "@backend/calc/chamcong";
import * as thongBao from "@frontend/config/thong-bao";
import { prisma } from "@database/client";

describe("UC_7.2 - Xem báo cáo chấm công & Hàm quên chấm công", () => {
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

  const testDate1 = "2098-10-05";
  const testDate2 = "2098-10-08";
  const emptyDate = "2098-12-25";
  const testMalich1 = "LL720001"; // 2098-10-05 Ca sáng (06:00-11:30)
  const testMalich2 = "LL720002"; // 2098-10-05 Ca chiều (11:30-17:00)
  const testMalich3 = "LL720003"; // 2098-10-08 Ca sáng (06:00-11:30)
  const testMalich4 = "LL720004"; // 2098-10-08 Ca tối (17:00-22:00)
  const testCC1 = "CC720001";
  const testCC2 = "CC720002";
  const testCC3 = "CC720003";
  const testDon1 = "DD720001";

  beforeAll(async () => {
    process.env.JWT_SECRET =
      "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";

    // Dọn sạch dữ liệu test nếu còn sót
    await prisma.donXinDoiCa.deleteMany({
      where: { Madon: { in: [testDon1] } },
    });
    await prisma.chamCong.deleteMany({
      where: { Machamcong: { in: [testCC1, testCC2, testCC3] } },
    });
    await prisma.nhanVien_LichLam.deleteMany({
      where: {
        Malich: { in: [testMalich1, testMalich2, testMalich3, testMalich4] },
      },
    });
    await prisma.lichLam.deleteMany({
      where: {
        Malich: { in: [testMalich1, testMalich2, testMalich3, testMalich4] },
      },
    });

    await prisma.lichLam.createMany({
      data: [
        {
          Malich: testMalich1,
          Ngaylam: new Date(`${testDate1}T00:00:00Z`),
          Maca: "CA000001",
        },
        {
          Malich: testMalich2,
          Ngaylam: new Date(`${testDate1}T00:00:00Z`),
          Maca: "CA000002",
        },
        {
          Malich: testMalich3,
          Ngaylam: new Date(`${testDate2}T00:00:00Z`),
          Maca: "CA000001",
        },
        {
          Malich: testMalich4,
          Ngaylam: new Date(`${testDate2}T00:00:00Z`),
          Maca: "CA000003",
        },
      ],
    });

    // Phân công:
    // - testMalich1 (05/10 Sáng): NV000001 (đủ in/out 5.5h), NV000002 (quên check-in)
    // - testMalich2 (05/10 Chiều): NV000001 (06:05 -> 11:30? dùng 13:30->18:00 = 4.5h)
    // - testMalich3 (08/10 Sáng): NV000001 (06:05 -> 11:30 = 5.42h), NV000003 (được đổi ca cho NV000002 -> NV000002 quên check-out)
    // - testMalich4 (08/10 Tối 17:00-22:00): NV000004 (chưa chấm công, test ca chưa kết thúc lúc 18:00)
    await prisma.nhanVien_LichLam.createMany({
      data: [
        { Manv: "NV000001", Malich: testMalich1 },
        { Manv: "NV000002", Malich: testMalich1 },
        { Manv: "NV000001", Malich: testMalich2 },
        { Manv: "NV000001", Malich: testMalich3 },
        { Manv: "NV000003", Malich: testMalich3 },
        { Manv: "NV000004", Malich: testMalich4 },
      ],
    });

    // Đơn đổi ca đã xử lý: NV000003 nhường testMalich3 cho NV000002
    await prisma.donXinDoiCa.create({
      data: {
        Madon: testDon1,
        Trangthaixuly: "Đã xử lý",
        Manv: "NV000003",
        Malich: testMalich3,
        Manvnhanthay: "NV000002",
      },
    });

    await prisma.chamCong.createMany({
      data: [
        {
          Machamcong: testCC1,
          Manv: "NV000001",
          Malich: testMalich1,
          Thoigiancheckin: new Date(`${testDate1}T06:00:00Z`),
          Thoigiancheckout: new Date(`${testDate1}T11:30:00Z`),
        },
        {
          Machamcong: testCC2,
          Manv: "NV000001",
          Malich: testMalich2,
          Thoigiancheckin: new Date(`${testDate1}T13:30:00Z`),
          Thoigiancheckout: new Date(`${testDate1}T18:00:00Z`),
        },
        {
          Machamcong: testCC3,
          Manv: "NV000002",
          Malich: testMalich3,
          Thoigiancheckin: new Date(`${testDate2}T06:05:00Z`),
          Thoigiancheckout: null,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.donXinDoiCa.deleteMany({
      where: { Madon: { in: [testDon1] } },
    });
    await prisma.chamCong.deleteMany({
      where: { Machamcong: { in: [testCC1, testCC2, testCC3] } },
    });
    await prisma.nhanVien_LichLam.deleteMany({
      where: {
        Malich: { in: [testMalich1, testMalich2, testMalich3, testMalich4] },
      },
    });
    await prisma.lichLam.deleteMany({
      where: {
        Malich: { in: [testMalich1, testMalich2, testMalich3, testMalich4] },
      },
    });
  });

  describe("Thông báo chuẩn 08-THONG-BAO.md", () => {
    it("BAO_CAO_CHAM_CONG_TRONG phải khớp nguyên văn từng ký tự", () => {
      expect(thongBao.BAO_CAO_CHAM_CONG_TRONG).toBe("Không có dữ liệu");
    });
  });

  describe("Phân quyền 401/403 GET /api/bao-cao/cham-cong", () => {
    it("chưa đăng nhập trả về 401", async () => {
      const req = new Request(
        `http://localhost:3000/api/bao-cao/cham-cong?ngay=${testDate1}`
      );
      const res = await getBaoCaoChamCong(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    it("nhân viên truy cập báo cáo chấm công bị chặn 403", async () => {
      const nvToken = await signNv("NV000001", "Nguyễn Minh Anh");
      const req = new Request(
        `http://localhost:3000/api/bao-cao/cham-cong?ngay=${testDate1}`,
        {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${nvToken}` },
        }
      );
      const res = await getBaoCaoChamCong(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe("FORBIDDEN");
    });
  });

  describe("Validate đầu vào & dữ liệu báo cáo", () => {
    it("trả về 400 nếu truyền cả ngay và thang hoặc sai định dạng", async () => {
      const cqToken = await signChuQuan();
      const reqBoth = new Request(
        `http://localhost:3000/api/bao-cao/cham-cong?ngay=${testDate1}&thang=2098-10`,
        { headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` } }
      );
      const resBoth = await getBaoCaoChamCong(reqBoth, {
        params: Promise.resolve({}),
      });
      expect(resBoth.status).toBe(400);

      const reqBadDate = new Request(
        "http://localhost:3000/api/bao-cao/cham-cong?ngay=2098-02-31",
        { headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` } }
      );
      const resBadDate = await getBaoCaoChamCong(reqBadDate, {
        params: Promise.resolve({}),
      });
      expect(resBadDate.status).toBe(400);
    });

    it("xem báo cáo theo ngày (?ngay=): trả đủ họ tên, ca, giờ vào, giờ ra, tổng giờ", async () => {
      const cqToken = await signChuQuan();
      const req = new Request(
        `http://localhost:3000/api/bao-cao/cham-cong?ngay=${testDate1}`,
        { headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` } }
      );
      const res = await getBaoCaoChamCong(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.mode).toBe("ngay");
      expect(json.data.ngay).toBe(testDate1);
      expect(json.data.items).toHaveLength(2);

      expect(json.data.items[0]).toMatchObject({
        manv: "NV000001",
        hoten: "Nguyễn Minh Anh",
        caLam: "Sáng",
        gioVao: "06:00",
        gioRa: "11:30",
        tongGio: 5.5,
      });
      expect(json.data.items[1]).toMatchObject({
        manv: "NV000001",
        hoten: "Nguyễn Minh Anh",
        caLam: "Chiều",
        gioVao: "13:30",
        gioRa: "18:00",
        tongGio: 4.5,
      });
    });

    it("xem báo cáo theo ngày không có dữ liệu -> trả danh sách rỗng và 'Không có dữ liệu'", async () => {
      const cqToken = await signChuQuan();
      const req = new Request(
        `http://localhost:3000/api/bao-cao/cham-cong?ngay=${emptyDate}`,
        { headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` } }
      );
      const res = await getBaoCaoChamCong(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.items).toEqual([]);
      expect(json.data.message).toBe(thongBao.BAO_CAO_CHAM_CONG_TRONG);
    });

    it("xem báo cáo theo tháng (?thang=YYYY-MM): trả họ tên, tổng ca, tổng giờ, chi tiết", async () => {
      const cqToken = await signChuQuan();
      const req = new Request(
        "http://localhost:3000/api/bao-cao/cham-cong?thang=2098-10",
        { headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` } }
      );
      const res = await getBaoCaoChamCong(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.mode).toBe("thang");
      expect(json.data.thang).toBe("10/2098");
      expect(json.data.items).toHaveLength(2);

      const nv1 = json.data.items.find(
        (i: { manv: string }) => i.manv === "NV000001"
      );
      expect(nv1).toBeDefined();
      expect(nv1.hoten).toBe("Nguyễn Minh Anh");
      expect(nv1.tongCa).toBe(2);
      expect(nv1.tongGio).toBe(10);
      expect(nv1.chiTiet).toHaveLength(2);
      expect(nv1.chiTiet[0]).toMatchObject({
        ngayLam: testDate1,
        ngayHienThi: "05/10/2098",
        caLam: "Ca sáng",
        gioVao: "06:00",
        gioRa: "11:30",
        tongGio: 5.5,
      });

      const nv2 = json.data.items.find(
        (i: { manv: string }) => i.manv === "NV000002"
      );
      expect(nv2).toBeDefined();
      expect(nv2.tongCa).toBe(1);
      expect(nv2.tongGio).toBe(0);
      expect(nv2.chiTiet[0]).toMatchObject({
        ngayLam: testDate2,
        gioVao: "06:05",
        gioRa: null,
        tongGio: 0,
      });
    });

    it("hỗ trợ định dạng ?thang=MM/YYYY và không có dữ liệu -> 'Không có dữ liệu'", async () => {
      const cqToken = await signChuQuan();
      const req = new Request(
        "http://localhost:3000/api/bao-cao/cham-cong?thang=12/2098",
        { headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` } }
      );
      const res = await getBaoCaoChamCong(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.thang).toBe("12/2098");
      expect(json.data.items).toEqual([]);
      expect(json.data.message).toBe(thongBao.BAO_CAO_CHAM_CONG_TRONG);
    });
  });

  describe("Hàm quên chấm công (tính khi đọc, không job)", () => {
    it("hàm thuần phanLoaiQuenChamCong phân loại đúng ca kết thúc thiếu check-in/check-out", () => {
      // Ca chưa kết thúc (18:00 < 22:00 cùng ngày) -> null
      expect(
        phanLoaiQuenChamCong({
          ngayLam: "2098-10-08",
          gioKetThuc: "22:00",
          todayStr: "2098-10-08",
          hienTaiPhut: 18 * 60,
          daCheckIn: false,
          daCheckOut: false,
        })
      ).toBeNull();

      // Ca đã kết thúc hôm nay, thiếu check-in -> "Quên check-in"
      expect(
        phanLoaiQuenChamCong({
          ngayLam: "2098-10-08",
          gioKetThuc: "11:30",
          todayStr: "2098-10-08",
          hienTaiPhut: 11 * 60 + 30,
          daCheckIn: false,
          daCheckOut: false,
        })
      ).toBe("Quên check-in");

      // Ca quá khứ, đã check-in nhưng thiếu check-out -> "Quên check-out"
      expect(
        phanLoaiQuenChamCong({
          ngayLam: "2098-10-05",
          gioKetThuc: "11:30",
          todayStr: "2098-10-08",
          hienTaiPhut: 10 * 60,
          daCheckIn: true,
          daCheckOut: false,
        })
      ).toBe("Quên check-out");

      // Ca đã kết thúc, đủ cả check-in và check-out -> null
      expect(
        phanLoaiQuenChamCong({
          ngayLam: "2098-10-05",
          gioKetThuc: "11:30",
          todayStr: "2098-10-08",
          hienTaiPhut: 10 * 60,
          daCheckIn: true,
          daCheckOut: true,
        })
      ).toBeNull();
    });

    it("layDanhSachQuenChamCong tính đúng từ CSDL theo mốc thời gian đọc (kể cả thay ca)", async () => {
      // Mốc 2098-10-08 18:00 (VN):
      // - testMalich1 (05/10): NV000001 đủ, NV000002 quên check-in
      // - testMalich2 (05/10): NV000001 đủ
      // - testMalich3 (08/10 Sáng): NV000003 đã đổi ca cho NV000002 -> NV000002 quên check-out, NV000003 KHÔNG bị tính
      // - testMalich4 (08/10 Tối 17:00-22:00): chưa kết thúc lúc 18:00 -> KHÔNG bị tính
      const mockNow = new Date(2098, 9, 8, 18, 0, 0);
      const list = await layDanhSachQuenChamCong({
        now: mockNow,
        tuNgay: testDate1,
        denNgay: testDate2,
      });

      expect(list).toHaveLength(3);
      const itemSang05 = list.find(
        (i) => i.malich === testMalich1 && i.manv === "NV000002"
      );
      expect(itemSang05).toBeDefined();
      expect(itemSang05?.loaiQuen).toBe("Quên check-in");

      const itemNv1Sang08 = list.find(
        (i) => i.malich === testMalich3 && i.manv === "NV000001"
      );
      expect(itemNv1Sang08).toBeDefined();
      expect(itemNv1Sang08?.loaiQuen).toBe("Quên check-in");

      const itemSang08 = list.find(
        (i) => i.malich === testMalich3 && i.manv === "NV000002"
      );
      expect(itemSang08).toBeDefined();
      expect(itemSang08?.loaiQuen).toBe("Quên check-out");

      // NV000003 (đã đổi ca) và NV000004 (ca tối chưa kết thúc) không có mặt
      expect(list.some((i) => i.manv === "NV000003")).toBe(false);
      expect(list.some((i) => i.malich === testMalich4)).toBe(false);
    });
  });
});
