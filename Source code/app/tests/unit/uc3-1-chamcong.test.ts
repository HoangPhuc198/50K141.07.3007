import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  tinhGioLam,
  tinhTienCong,
  chonHeSoTheoNgay,
  xetTrangThaiCheckIn,
  truPhutHHmm,
} from "@backend/calc/chamcong";
import { CHECKIN_EARLY_MINUTES, nowVN, formatDateVN, formatTimeVN } from "@backend/lib/time";
import { signSession, AUTH_COOKIE_NAME } from "@backend/lib/auth";
import { GET as getHomNay } from "@/app/api/cham-cong/hom-nay/route";
import { POST as postCheckIn } from "@/app/api/cham-cong/check-in/route";
import { getNhanVienTongQuan } from "@backend/services/tong-quan";
import * as thongBao from "@frontend/config/thong-bao";
import { prisma } from "@database/client";

describe("UC_3.1 - Tính toán chấm công & Quy tắc Check-in", () => {
  // ============================================================
  // 1. Unit tests: backend/calc/chamcong.ts
  // ============================================================
  describe("backend/calc/chamcong.ts", () => {
    it("tinhGioLam = ra − vào, làm tròn 2 số lẻ", () => {
      const vao1 = new Date("2026-11-12T06:00:00Z");
      const ra1 = new Date("2026-11-12T11:30:00Z");
      expect(tinhGioLam(vao1, ra1)).toBe(5.5);

      // 2 giờ 20 phút = 2.3333... -> 2.33
      const vao2 = new Date("2026-11-12T06:00:00Z");
      const ra2 = new Date("2026-11-12T08:20:00Z");
      expect(tinhGioLam(vao2, ra2)).toBe(2.33);

      // 1 giờ 40 phút = 1.6666... -> 1.67
      const ra3 = new Date("2026-11-12T07:40:00Z");
      expect(tinhGioLam(vao2, ra3)).toBe(1.67);

      // Nếu ra <= vào -> 0
      expect(tinhGioLam(ra1, vao1)).toBe(0);
    });

    it("tinhTienCong = giờ × Mucluongtheogio × hệ số (mặc định 1)", () => {
      expect(tinhTienCong(5.5, 24000)).toBe(132000);
      expect(tinhTienCong(5.5, 24000, 2)).toBe(264000);
      expect(tinhTienCong(2.33, 17500, 1.5)).toBe(61162.5);
    });

    it("chonHeSoTheoNgay: tìm hệ số theo ngày lễ, không có trả về mặc định 1", () => {
      const ds = [
        {
          Ngaybatdau: new Date("2026-09-02T00:00:00Z"),
          Ngayketthuc: new Date("2026-09-02T00:00:00Z"),
          Heso: 2,
        },
        {
          Ngaybatdau: new Date("2026-12-31T00:00:00Z"),
          Ngayketthuc: new Date("2027-01-01T00:00:00Z"),
          Heso: "1.50",
        },
      ];
      expect(chonHeSoTheoNgay(new Date("2026-09-02T00:00:00Z"), ds)).toBe(2);
      expect(chonHeSoTheoNgay("2027-01-01", ds)).toBe(1.5);
      expect(chonHeSoTheoNgay(new Date("2026-11-12T00:00:00Z"), ds)).toBe(1);
    });

    it("Hằng số CHECKIN_EARLY_MINUTES = 5 và truPhutHHmm tính đúng", () => {
      expect(CHECKIN_EARLY_MINUTES).toBe(5);
      expect(truPhutHHmm("06:00", CHECKIN_EARLY_MINUTES)).toBe("05:55");
      expect(truPhutHHmm("11:30", CHECKIN_EARLY_MINUTES)).toBe("11:25");
      expect(truPhutHHmm("17:00", CHECKIN_EARLY_MINUTES)).toBe("16:55");
    });

    it("xetTrangThaiCheckIn: kiểm tra biên 5 phút và quên check-in", () => {
      // Ca 06:00 (360) - 11:30 (690)
      expect(
        xetTrangThaiCheckIn({
          batDauPhut: 360,
          ketThucPhut: 690,
          hienTaiPhut: 354, // 05:54
          daCheckIn: false,
          somPhut: CHECKIN_EARLY_MINUTES,
        })
      ).toBe("chua-den-gio");

      expect(
        xetTrangThaiCheckIn({
          batDauPhut: 360,
          ketThucPhut: 690,
          hienTaiPhut: 355, // 05:55
          daCheckIn: false,
          somPhut: CHECKIN_EARLY_MINUTES,
        })
      ).toBe("co-the-check-in");

      expect(
        xetTrangThaiCheckIn({
          batDauPhut: 360,
          ketThucPhut: 690,
          hienTaiPhut: 690, // 11:30
          daCheckIn: false,
          somPhut: CHECKIN_EARLY_MINUTES,
        })
      ).toBe("quen-check-in");

      expect(
        xetTrangThaiCheckIn({
          batDauPhut: 360,
          ketThucPhut: 690,
          hienTaiPhut: 700,
          daCheckIn: true,
          somPhut: CHECKIN_EARLY_MINUTES,
        })
      ).toBe("da-check-in");
    });
  });

  // ============================================================
  // 2. Đối chiếu thông báo 08-THONG-BAO.md từng ký tự và màu
  // ============================================================
  describe("Thông báo UC_3.1 khớp 08-THONG-BAO.md", () => {
    it("So khớp nguyên văn từng ký tự thông báo Check-in và màu sắc", () => {
      const mdPath = path.resolve(__dirname, "../../../docs/ke-hoach/08-THONG-BAO.md");
      const md = fs.readFileSync(mdPath, "utf-8");

      expect(thongBao.CHECK_IN_THANH_CONG).toBe("Check-in thành công");
      expect(thongBao.CHECK_IN_QUEN).toBe("Bạn đã quên check-in");
      expect(thongBao.CHECK_IN_CHUA_DEN_GIO).toBe(
        "Chưa đến giờ vào ca, bạn chỉ được check-in trước giờ làm tối đa 5 phút"
      );
      expect(thongBao.CHECK_IN_KHONG_CO_CA).toBe(
        "Hiện bạn không có ca làm để check-in"
      );

      expect(md).toContain(`| Check-in 2 | ${thongBao.CHECK_IN_THANH_CONG} |`);
      expect(md).toContain(`| Check-in 3 | ${thongBao.CHECK_IN_QUEN} |`);
      expect(md).toContain(`| Check-in 4 | ${thongBao.CHECK_IN_CHUA_DEN_GIO} |`);
      expect(md).toContain(`| Check-in 5 | ${thongBao.CHECK_IN_KHONG_CO_CA} |`);

      expect(thongBao.MAU_THONG_BAO.loi.chu).toBe("#C0392B");
      expect(thongBao.MAU_THONG_BAO.loi.nen).toBe("#F7ECEA");
      expect(thongBao.MAU_THONG_BAO["thanh-cong"].chu).toBe("#587554");
      expect(thongBao.MAU_THONG_BAO["thanh-cong"].nen).toBe("#EDF3EB");
    });
  });

  // ============================================================
  // 3. Phân quyền 401/403 & Nghiệp vụ API với giờ giả
  // ============================================================
  describe("API /api/cham-cong/hom-nay & /api/cham-cong/check-in", () => {
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

    const testDateStr = "2099-05-10";
    const testDateObj = new Date("2099-05-10T00:00:00Z");
    const testMalichSang = "LL990001";
    const testMalichChieu = "LL990002";
    const testMalichToi = "LL990003";
    const testMadonDaDuyet = "DD990001";
    const testMadonChuaDuyet = "DD990002";

    beforeAll(async () => {
      process.env.JWT_SECRET =
        "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";

      // Dọn dữ liệu test cũ (nếu có) và tạo dữ liệu ngày giả 2099-05-10
      await prisma.chamCong.deleteMany({
        where: { Malich: { in: [testMalichSang, testMalichChieu, testMalichToi] } },
      });
      await prisma.donXinDoiCa.deleteMany({
        where: { Madon: { in: [testMadonDaDuyet, testMadonChuaDuyet] } },
      });
      await prisma.nhanVien_LichLam.deleteMany({
        where: { Malich: { in: [testMalichSang, testMalichChieu, testMalichToi] } },
      });
      await prisma.lichLam.deleteMany({
        where: { Malich: { in: [testMalichSang, testMalichChieu, testMalichToi] } },
      });

      await prisma.lichLam.createMany({
        data: [
          { Malich: testMalichSang, Ngaylam: testDateObj, Maca: "CA000001" },
          { Malich: testMalichChieu, Ngaylam: testDateObj, Maca: "CA000002" },
          { Malich: testMalichToi, Ngaylam: testDateObj, Maca: "CA000003" },
        ],
      });

      // NV000001 làm ca Sáng; NV000002 làm ca Chiều (và nhờ NV000001 nhận thay qua DonXinDoiCa đã xử lý)
      // NV000003 làm ca Tối (và tạo 1 đơn chưa xử lý cho NV000001)
      await prisma.nhanVien_LichLam.createMany({
        data: [
          { Manv: "NV000001", Malich: testMalichSang },
          { Manv: "NV000002", Malich: testMalichChieu },
          { Manv: "NV000003", Malich: testMalichToi },
        ],
      });

      await prisma.donXinDoiCa.createMany({
        data: [
          {
            Madon: testMadonDaDuyet,
            Trangthaixuly: "Đã xử lý",
            Manv: "NV000002",
            Malich: testMalichChieu,
            Manvnhanthay: "NV000001",
          },
        ],
      });
    });

    afterAll(async () => {
      vi.useRealTimers();
      await prisma.chamCong.deleteMany({
        where: { Malich: { in: [testMalichSang, testMalichChieu, testMalichToi] } },
      });
      await prisma.donXinDoiCa.deleteMany({
        where: { Madon: { in: [testMadonDaDuyet, testMadonChuaDuyet] } },
      });
      await prisma.nhanVien_LichLam.deleteMany({
        where: { Malich: { in: [testMalichSang, testMalichChieu, testMalichToi] } },
      });
      await prisma.lichLam.deleteMany({
        where: { Malich: { in: [testMalichSang, testMalichChieu, testMalichToi] } },
      });
    });

    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: false });
    });

    afterEach(async () => {
      vi.useRealTimers();
      await prisma.chamCong.deleteMany({
        where: { Malich: { in: [testMalichSang, testMalichChieu, testMalichToi] } },
      });
    });

    it("401 khi chưa đăng nhập gọi GET /hom-nay và POST /check-in", async () => {
      const r1 = await getHomNay(
        new Request("http://localhost:3000/api/cham-cong/hom-nay"),
        { params: Promise.resolve({}) }
      );
      expect(r1.status).toBe(401);

      const r2 = await postCheckIn(
        new Request("http://localhost:3000/api/cham-cong/check-in", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        }),
        { params: Promise.resolve({}) }
      );
      expect(r2.status).toBe(401);
    });

    it("403 khi Chủ quán gọi GET /hom-nay và POST /check-in", async () => {
      const chuQuanToken = await signChuQuan();
      const r1 = await getHomNay(
        new Request("http://localhost:3000/api/cham-cong/hom-nay", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
        }),
        { params: Promise.resolve({}) }
      );
      expect(r1.status).toBe(403);

      const r2 = await postCheckIn(
        new Request("http://localhost:3000/api/cham-cong/check-in", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
          },
          body: JSON.stringify({}),
        }),
        { params: Promise.resolve({}) }
      );
      expect(r2.status).toBe(403);
    });

    it("NV không thể check-in hộ ca của người khác (403) hoặc đơn chưa duyệt", async () => {
      await prisma.donXinDoiCa.create({
        data: {
          Madon: testMadonChuaDuyet,
          Trangthaixuly: "Chưa xử lý",
          Manv: "NV000003",
          Malich: testMalichToi,
          Manvnhanthay: "NV000001",
        },
      });
      try {
        vi.setSystemTime(new Date(`${testDateStr}T16:56:00+07:00`));
        const nv1Token = await signNv("NV000001", "Nguyễn Minh Anh");
        const nv3Token = await signNv("NV000003", "Lê Quốc Bảo");

        // NV000001 cố check-in ca Tối (của NV000003, đơn mới 'Chưa xử lý') -> 403
        const r1 = await postCheckIn(
          new Request("http://localhost:3000/api/cham-cong/check-in", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
            },
            body: JSON.stringify({ malich: testMalichToi }),
          }),
          { params: Promise.resolve({}) }
        );
        expect(r1.status).toBe(403);
        const j1 = await r1.json();
        expect(j1.ok).toBe(false);
        expect(j1.error.message).toBe(thongBao.CHECK_IN_KHONG_CO_CA);

        // NV000003 cố check-in ca Sáng (của NV000001) lúc 05:56 -> 403
        vi.setSystemTime(new Date(`${testDateStr}T05:56:00+07:00`));
        const r2 = await postCheckIn(
          new Request("http://localhost:3000/api/cham-cong/check-in", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              cookie: `${AUTH_COOKIE_NAME}=${nv3Token}`,
            },
            body: JSON.stringify({ malich: testMalichSang }),
          }),
          { params: Promise.resolve({}) }
        );
        expect(r2.status).toBe(403);
      } finally {
        await prisma.donXinDoiCa.deleteMany({
          where: { Madon: testMadonChuaDuyet },
        });
      }
    });

    it("Quy tắc 5 phút: 05:54 từ chối đúng chữ SRS, 05:55 check-in thành công, lần 2 bị chặn", async () => {
      // Giờ giả: 05:54 (sớm 6 phút)
      vi.setSystemTime(new Date(`${testDateStr}T05:54:00+07:00`));
      const nv1Token = await signNv("NV000001", "Nguyễn Minh Anh");
      expect(formatDateVN(nowVN())).toBe(testDateStr);
      expect(formatTimeVN(nowVN())).toBe("05:54:00");

      const getEarly = await getHomNay(
        new Request("http://localhost:3000/api/cham-cong/hom-nay", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${nv1Token}` },
        }),
        { params: Promise.resolve({}) }
      );
      expect(getEarly.status).toBe(200);
      const jEarly = await getEarly.json();
      expect(jEarly.data.trangThaiManHinh).toBe("chua-den-gio");
      expect(jEarly.data.caHienTai.duocCheckInTu).toBe("05:55");
      expect(jEarly.data.thongBao.message).toBe(thongBao.CHECK_IN_CHUA_DEN_GIO);

      const postEarly = await postCheckIn(
        new Request("http://localhost:3000/api/cham-cong/check-in", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
          },
          body: JSON.stringify({ malich: testMalichSang }),
        }),
        { params: Promise.resolve({}) }
      );
      expect(postEarly.status).toBe(400);
      const jPostEarly = await postEarly.json();
      expect(jPostEarly.error.message).toBe(thongBao.CHECK_IN_CHUA_DEN_GIO);

      // Giờ giả: 05:55 (đúng biên 5 phút trước 06:00)
      vi.setSystemTime(new Date(`${testDateStr}T05:55:00+07:00`));
      const getOk = await getHomNay(
        new Request("http://localhost:3000/api/cham-cong/hom-nay", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${nv1Token}` },
        }),
        { params: Promise.resolve({}) }
      );
      const jOk = await getOk.json();
      expect(jOk.data.trangThaiManHinh).toBe("mac-dinh");

      const postOk = await postCheckIn(
        new Request("http://localhost:3000/api/cham-cong/check-in", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
          },
          body: JSON.stringify({ malich: testMalichSang }),
        }),
        { params: Promise.resolve({}) }
      );
      expect(postOk.status).toBe(200);
      const jPostOk = await postOk.json();
      expect(jPostOk.ok).toBe(true);
      expect(jPostOk.data.message).toBe(thongBao.CHECK_IN_THANH_CONG);
      expect(jPostOk.data.thoigiancheckin).toBe("05:55");
      expect(jPostOk.data.homNay.trangThaiManHinh).toBe("thanh-cong");

      // Kiểm tra CSDL đã lưu đúng giờ VN
      const dbRec = await prisma.chamCong.findUnique({
        where: { Manv_Malich: { Manv: "NV000001", Malich: testMalichSang } },
      });
      expect(dbRec).not.toBeNull();
      expect(dbRec!.Thoigiancheckin!.toISOString().slice(0, 16)).toBe(
        `${testDateStr}T05:55`
      );

      // Check-in lần 2 cùng ca -> bị chặn (BR03)
      const postDup = await postCheckIn(
        new Request("http://localhost:3000/api/cham-cong/check-in", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
          },
          body: JSON.stringify({ malich: testMalichSang }),
        }),
        { params: Promise.resolve({}) }
      );
      expect(postDup.status).toBe(409);
    });

    it("Quên check-in khi quá giờ kết thúc ca & ca nhận thay đã xử lý", async () => {
      // Lúc 11:30: ca Sáng hết giờ (quên check-in), ca Chiều (nhận thay đã xử lý) mở lúc 11:25 -> có thể check-in!
      vi.setSystemTime(new Date(`${testDateStr}T11:30:00+07:00`));
      const nv1Token = await signNv("NV000001", "Nguyễn Minh Anh");
      const nv2Token = await signNv("NV000002", "Trần Thu Hà");

      const getCaNhanThay = await getHomNay(
        new Request("http://localhost:3000/api/cham-cong/hom-nay", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${nv1Token}` },
        }),
        { params: Promise.resolve({}) }
      );
      const jNhanThay = await getCaNhanThay.json();
      expect(jNhanThay.data.danhSachCa.map((c: { malich: string }) => c.malich)).toEqual([
        testMalichSang,
        testMalichChieu,
      ]);
      expect(jNhanThay.data.caHienTai.malich).toBe(testMalichChieu);
      expect(jNhanThay.data.caHienTai.laCaNhanThay).toBe(true);

      // Cố check-in ca Sáng đã hết giờ -> "Bạn đã quên check-in"
      const postQuen = await postCheckIn(
        new Request("http://localhost:3000/api/cham-cong/check-in", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
          },
          body: JSON.stringify({ malich: testMalichSang }),
        }),
        { params: Promise.resolve({}) }
      );
      expect(postQuen.status).toBe(400);
      const jQuen = await postQuen.json();
      expect(jQuen.error.message).toBe(thongBao.CHECK_IN_QUEN);

      // Check-in ca Chiều nhận thay -> thành công
      const postNhanThay = await postCheckIn(
        new Request("http://localhost:3000/api/cham-cong/check-in", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
          },
          body: JSON.stringify({ malich: testMalichChieu }),
        }),
        { params: Promise.resolve({}) }
      );
      expect(postNhanThay.status).toBe(200);

      // Còn NV000002 đã nhường ca Chiều (DonXinDoiCa Đã xử lý) -> hôm nay không còn ca
      const getNv2 = await getHomNay(
        new Request("http://localhost:3000/api/cham-cong/hom-nay", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${nv2Token}` },
        }),
        { params: Promise.resolve({}) }
      );
      const jNv2 = await getNv2.json();
      expect(jNv2.data.trangThaiManHinh).toBe("khong-co-ca");
      expect(jNv2.data.caHienTai).toBeNull();
      expect(jNv2.data.thongBao.message).toBe(thongBao.CHECK_IN_KHONG_CO_CA);

      const postNv2 = await postCheckIn(
        new Request("http://localhost:3000/api/cham-cong/check-in", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `${AUTH_COOKIE_NAME}=${nv2Token}`,
          },
          body: JSON.stringify({}),
        }),
        { params: Promise.resolve({}) }
      );
      expect(postNv2.status).toBe(400);
      const jPostNv2 = await postNv2.json();
      expect(jPostNv2.error.message).toBe(thongBao.CHECK_IN_KHONG_CO_CA);
    });

    it("Ngày không có ca làm trả về khong-co-ca và CHECK_IN_KHONG_CO_CA", async () => {
      vi.setSystemTime(new Date("2099-05-11T08:00:00+07:00"));
      const nv1Token = await signNv("NV000001", "Nguyễn Minh Anh");
      const r = await getHomNay(
        new Request("http://localhost:3000/api/cham-cong/hom-nay", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${nv1Token}` },
        }),
        { params: Promise.resolve({}) }
      );
      expect(r.status).toBe(200);
      const j = await r.json();
      expect(j.data.trangThaiManHinh).toBe("khong-co-ca");
      expect(j.data.thongBao.message).toBe(thongBao.CHECK_IN_KHONG_CO_CA);
    });

    it("getNhanVienTongQuan phản ánh đúng sau khi check-in sau 17h VN (không fallback 06:00)", async () => {
      vi.setSystemTime(new Date(`${testDateStr}T21:08:00+07:00`));
      const nv3User = {
        userId: "NV000003",
        username: "NV000003",
        role: "NhanVien" as const,
        name: "Lê Quốc Bảo",
      };
      const before = await getNhanVienTongQuan(nv3User);
      expect(before.caHienTai?.thoiGianCheckIn).toBeNull();
      expect(before.caHienTai?.nutHanhDong).toBe("Check-in");
      expect(before.caHienTai?.trangThai).toBe("Chưa vào ca");

      const nv3Token = await signNv("NV000003", "Lê Quốc Bảo");
      const rCheckIn = await postCheckIn(
        new Request("http://localhost:3000/api/cham-cong/check-in", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `${AUTH_COOKIE_NAME}=${nv3Token}`,
          },
          body: JSON.stringify({ malich: testMalichToi }),
        }),
        { params: Promise.resolve({}) }
      );
      expect(rCheckIn.status).toBe(200);

      vi.setSystemTime(new Date(`${testDateStr}T21:20:00+07:00`));
      const after = await getNhanVienTongQuan(nv3User);
      expect(after.caHienTai?.thoiGianCheckIn).toBe("21:08");
      expect(after.caHienTai?.nutHanhDong).toBe("Check-out");
      expect(after.caHienTai?.trangThai).toBe("Đang trong ca");
      expect(after.caHienTai?.thoiGianLam).toBe("0 giờ 12 phút");
    });
  });
});
