import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { signSession, AUTH_COOKIE_NAME, UserPayload } from "@backend/lib/auth";
import {
  getTuanLamViec,
  getTuanHienThiLichRanh,
  LICH_RANH_CHUYEN_TUAN,
  nowVN,
} from "@backend/lib/time";
import {
  GET as getLichRanh,
  POST as postLichRanh,
  DELETE as deleteLichRanh,
} from "@/app/api/nhan-vien/lich-ranh/route";
import { GET as getLichLam, POST as postLichLam } from "@/app/api/chu-quan/lich-lam/route";
import { GET as getXepCa, POST as postXepCa } from "@/app/api/chu-quan/lich-lam/xep-ca/route";
import {
  DANG_KY_LICH_RANH_CHUA_CHON,
  DANG_KY_LICH_RANH_THANH_CONG,
  XEP_LICH_LAM_THANH_CONG,
} from "@frontend/config/thong-bao";
import { prisma } from "@database/client";

describe("UC_2.1, UC_6.1, UC_6.2 - Lịch rảnh, Xếp lịch, Xếp ca", () => {
  let chuQuanToken: string;
  let nhanVienToken: string;
  const testManv = "NV000001";
  const testWeekStart = "2026-11-02";
  const testWeekEnd = "2026-11-08";
  const preExistingNovMalichs = new Set<string>();
  const initialVisualNow = process.env.VISUAL_NOW;

  beforeAll(async () => {
    process.env.JWT_SECRET = "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";

    const chuQuanPayload: UserPayload = {
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Thanh Hà",
    };

    const nhanVienPayload: UserPayload = {
      userId: testManv,
      username: testManv,
      role: "NhanVien",
      name: "Nguyễn Minh Anh",
    };

    chuQuanToken = await signSession(chuQuanPayload);
    nhanVienToken = await signSession(nhanVienPayload);

    const existingNov = await prisma.lichLam.findMany({
      where: {
        Ngaylam: {
          in: [new Date("2026-11-02T00:00:00Z"), new Date("2026-11-03T00:00:00Z")],
        },
      },
      select: { Malich: true },
    });
    for (const row of existingNov) {
      if (Number.parseInt(row.Malich.trim().replace(/^LL/, ""), 10) <= 45) {
        preExistingNovMalichs.add(row.Malich);
      }
    }
  });

  afterAll(async () => {
    if (initialVisualNow === undefined) {
      delete process.env.VISUAL_NOW;
    } else {
      process.env.VISUAL_NOW = initialVisualNow;
    }

    await prisma.lichRanh.deleteMany({
      where: {
        Manv: testManv,
        OR: [
          {
            Ngayranh: {
              gte: new Date("2027-02-01T00:00:00Z"),
              lte: new Date("2027-02-14T23:59:59Z"),
            },
          },
          {
            Ngayranh: {
              gte: new Date("2027-03-01T00:00:00Z"),
              lte: new Date("2027-03-07T23:59:59Z"),
            },
          },
        ],
      },
    });

    const testLichs = await prisma.lichLam.findMany({
      where: {
        OR: [
          {
            Ngaylam: {
              in: [new Date("2026-11-02T00:00:00Z"), new Date("2026-11-03T00:00:00Z")],
            },
          },
          {
            Ngaylam: {
              gte: new Date("2027-03-01T00:00:00Z"),
              lte: new Date("2027-03-07T23:59:59Z"),
            },
          },
        ],
      },
      select: { Malich: true },
    });

    const mlToDelete = testLichs
      .map((l) => l.Malich)
      .filter((id) => !preExistingNovMalichs.has(id));
    if (mlToDelete.length > 0) {
      await prisma.yeuCauBoSungCC.deleteMany({ where: { Malich: { in: mlToDelete } } });
      await prisma.donXinDoiCa.deleteMany({ where: { Malich: { in: mlToDelete } } });
      await prisma.chamCong.deleteMany({ where: { Malich: { in: mlToDelete } } });
      await prisma.nhanVien_LichLam.deleteMany({ where: { Malich: { in: mlToDelete } } });
      await prisma.lichLam.deleteMany({ where: { Malich: { in: mlToDelete } } });
    }
  });

  // ============================================================
  // 1. Phân quyền (401 & 403)
  // ============================================================
  describe("Phân quyền 401 & 403", () => {
    it("Chưa đăng nhập gọi GET /api/nhan-vien/lich-ranh phải trả về 401", async () => {
      const req = new Request("http://localhost:3000/api/nhan-vien/lich-ranh");
      const res = await getLichRanh(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    it("Chủ quán gọi GET /api/nhan-vien/lich-ranh phải trả về 403", async () => {
      const req = new Request("http://localhost:3000/api/nhan-vien/lich-ranh", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
      });
      const res = await getLichRanh(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe("FORBIDDEN");
    });

    it("Chưa đăng nhập gọi GET /api/chu-quan/lich-lam phải trả về 401", async () => {
      const req = new Request("http://localhost:3000/api/chu-quan/lich-lam");
      const res = await getLichLam(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(401);
    });

    it("Nhân viên gọi GET /api/chu-quan/lich-lam phải trả về 403", async () => {
      const req = new Request("http://localhost:3000/api/chu-quan/lich-lam", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}` },
      });
      const res = await getLichLam(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(403);
    });

    it("Nhân viên gọi GET /api/chu-quan/lich-lam/xep-ca phải trả về 403", async () => {
      const req = new Request("http://localhost:3000/api/chu-quan/lich-lam/xep-ca", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}` },
      });
      const res = await getXepCa(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(403);
    });
  });

  // ============================================================
  // 2. UC_2.1: Đăng ký lịch rảnh
  // ============================================================
  describe("UC_2.1: Đăng ký lịch rảnh (Nhân viên)", () => {
    it("Không chọn ca rảnh nào -> Báo lỗi đúng thông báo 'Chọn ít nhất một ca rảnh trong tuần'", async () => {
      const tuan = getTuanHienThiLichRanh(nowVN());
      const req = new Request("http://localhost:3000/api/nhan-vien/lich-ranh", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          startDate: tuan.startDate,
          endDate: tuan.endDate,
          danhSach: [],
        }),
      });

      const res = await postLichRanh(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error.message).toContain(DANG_KY_LICH_RANH_CHUA_CHON);
    });

    it("Chọn các ca rảnh -> Lưu thành công, trả về 'Đăng ký thành công', xóa cũ ghi mới trong 1 transaction", async () => {
      const tuan = getTuanHienThiLichRanh(nowVN());
      const day0 = tuan.days[0].fullDate;
      const day1 = tuan.days[1].fullDate;
      const day2 = tuan.days[2].fullDate;

      const backup = await prisma.lichRanh.findMany({
        where: {
          Manv: testManv,
          Ngayranh: {
            gte: new Date(tuan.startDate + "T00:00:00Z"),
            lte: new Date(tuan.endDate + "T23:59:59Z"),
          },
        },
      });

      try {
        const payload = {
          startDate: tuan.startDate,
          endDate: tuan.endDate,
          danhSach: [
            { ngay: day0, maCa: "CA000001" },
            { ngay: day0, maCa: "CA000002" },
            { ngay: day1, maCa: "CA000001" },
          ],
        };

        const req = new Request("http://localhost:3000/api/nhan-vien/lich-ranh", {
          method: "POST",
          headers: {
            cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const res = await postLichRanh(req, { params: Promise.resolve({}) });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.ok).toBe(true);
        expect(json.data.message).toBe(DANG_KY_LICH_RANH_THANH_CONG);
        expect(json.data.count).toBe(3);

        // Kiểm tra trong CSDL: bản ghi có định dạng CHAR(8) LRxxxxxx
        const savedInDb = await prisma.lichRanh.findMany({
          where: {
            Manv: testManv,
            Ngayranh: {
              gte: new Date(tuan.startDate + "T00:00:00Z"),
              lte: new Date(tuan.endDate + "T23:59:59Z"),
            },
          },
        });
        expect(savedInDb.length).toBe(3);
        for (const row of savedInDb) {
          expect(row.Malichranh.trim()).toMatch(/^LR\d{6}$/);
        }

        // Đăng ký lại (thay đổi lựa chọn) -> ghi đè đúng 1 ca mới
        const req2 = new Request("http://localhost:3000/api/nhan-vien/lich-ranh", {
          method: "POST",
          headers: {
            cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            startDate: tuan.startDate,
            endDate: tuan.endDate,
            danhSach: [{ ngay: day2, maCa: "CA000003" }],
          }),
        });

        const res2 = await postLichRanh(req2, { params: Promise.resolve({}) });
        expect(res2.status).toBe(200);
        const json2 = await res2.json();
        expect(json2.ok).toBe(true);
        expect(json2.data.count).toBe(1);

        // Kiểm tra CSDL: các ca cũ đã bị xóa, chỉ còn 1 ca mới
        const afterOverwrite = await prisma.lichRanh.findMany({
          where: {
            Manv: testManv,
            Ngayranh: {
              gte: new Date(tuan.startDate + "T00:00:00Z"),
              lte: new Date(tuan.endDate + "T23:59:59Z"),
            },
          },
        });
        expect(afterOverwrite.length).toBe(1);
        expect(afterOverwrite[0].Caranh.trim()).toBe("CA000003");
      } finally {
        await prisma.lichRanh.deleteMany({
          where: {
            Manv: testManv,
            Ngayranh: {
              gte: new Date(tuan.startDate + "T00:00:00Z"),
              lte: new Date(tuan.endDate + "T23:59:59Z"),
            },
          },
        });
        if (backup.length > 0) {
          await prisma.lichRanh.createMany({ data: backup });
        }
      }
    });

    it("Mốc 18:00 Thứ bảy (nowVN giả lập): không khóa đăng ký, GET trả về tuần hiển thị đúng, POST ngoài tuần trả 400", async () => {
      const prevVisualNow = process.env.VISUAL_NOW;
      const cleanupStart = new Date("2027-02-01T00:00:00Z");
      const cleanupEnd = new Date("2027-02-14T23:59:59Z");

      try {
        // 1) T7 17:59:59 -> tuần đang chạy (2027-02-01 .. 2027-02-07)
        process.env.VISUAL_NOW = "2027-02-06T17:59:59";
        const resGetBefore = await getLichRanh(
          new Request("http://localhost:3000/api/nhan-vien/lich-ranh", {
            headers: { cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}` },
          }),
          { params: Promise.resolve({}) }
        );
        expect(resGetBefore.status).toBe(200);
        const jsonGetBefore = await resGetBefore.json();
        expect(jsonGetBefore.data.tuan.startDate).toBe("2027-02-01");
        expect(jsonGetBefore.data.tuan.endDate).toBe("2027-02-07");

        // Không khóa đăng ký trước 18:00 T7 -> gửi ngày trong tuần hiển thị thành công
        const resPostBeforeOk = await postLichRanh(
          new Request("http://localhost:3000/api/nhan-vien/lich-ranh", {
            method: "POST",
            headers: {
              cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              startDate: "2027-02-01",
              endDate: "2027-02-07",
              danhSach: [{ ngay: "2027-02-07", maCa: "CA000001" }],
            }),
          }),
          { params: Promise.resolve({}) }
        );
        expect(resPostBeforeOk.status).toBe(200);

        // Ngày thuộc tuần sau khi chưa sang 18:00 T7 -> trả 400
        const resPostBeforeBad = await postLichRanh(
          new Request("http://localhost:3000/api/nhan-vien/lich-ranh", {
            method: "POST",
            headers: {
              cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              startDate: "2027-02-08",
              endDate: "2027-02-14",
              danhSach: [{ ngay: "2027-02-08", maCa: "CA000001" }],
            }),
          }),
          { params: Promise.resolve({}) }
        );
        expect(resPostBeforeBad.status).toBe(400);
        const jsonBeforeBad = await resPostBeforeBad.json();
        expect(jsonBeforeBad.ok).toBe(false);
        expect(jsonBeforeBad.error.code).toBe("INVALID_WEEK");

        // 2) T7 18:00:00 -> tự chuyển sang tuần sau (2027-02-08 .. 2027-02-14), vẫn không khóa
        process.env.VISUAL_NOW = "2027-02-06T18:00:00";
        const resGetAfter = await getLichRanh(
          new Request("http://localhost:3000/api/nhan-vien/lich-ranh", {
            headers: { cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}` },
          }),
          { params: Promise.resolve({}) }
        );
        expect(resGetAfter.status).toBe(200);
        const jsonGetAfter = await resGetAfter.json();
        expect(jsonGetAfter.data.tuan.startDate).toBe("2027-02-08");
        expect(jsonGetAfter.data.tuan.endDate).toBe("2027-02-14");

        // Gửi ngày của tuần cũ -> trả 400
        const resPostAfterOldWeek = await postLichRanh(
          new Request("http://localhost:3000/api/nhan-vien/lich-ranh", {
            method: "POST",
            headers: {
              cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              startDate: "2027-02-01",
              endDate: "2027-02-07",
              danhSach: [{ ngay: "2027-02-07", maCa: "CA000001" }],
            }),
          }),
          { params: Promise.resolve({}) }
        );
        expect(resPostAfterOldWeek.status).toBe(400);
        const jsonAfterOld = await resPostAfterOldWeek.json();
        expect(jsonAfterOld.ok).toBe(false);
        expect(jsonAfterOld.error.code).toBe("INVALID_WEEK");

        // Gửi ngày thuộc tuần hiển thị mới (kể cả hỗn hợp sai startDate nhưng ngày ngoài tuần -> 400, ngày trong tuần -> 200)
        const resPostAfterMixedDay = await postLichRanh(
          new Request("http://localhost:3000/api/nhan-vien/lich-ranh", {
            method: "POST",
            headers: {
              cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              startDate: "2027-02-08",
              endDate: "2027-02-14",
              danhSach: [{ ngay: "2027-02-15", maCa: "CA000001" }],
            }),
          }),
          { params: Promise.resolve({}) }
        );
        expect(resPostAfterMixedDay.status).toBe(400);

        const resPostAfterOk = await postLichRanh(
          new Request("http://localhost:3000/api/nhan-vien/lich-ranh", {
            method: "POST",
            headers: {
              cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              startDate: "2027-02-08",
              endDate: "2027-02-14",
              danhSach: [
                { ngay: "2027-02-08", maCa: "CA000001" },
                { ngay: "2027-02-14", maCa: "CA000002" },
              ],
            }),
          }),
          { params: Promise.resolve({}) }
        );
        expect(resPostAfterOk.status).toBe(200);
      } finally {
        if (prevVisualNow === undefined) {
          delete process.env.VISUAL_NOW;
        } else {
          process.env.VISUAL_NOW = prevVisualNow;
        }
        await prisma.lichRanh.deleteMany({
          where: {
            Manv: testManv,
            Ngayranh: { gte: cleanupStart, lte: cleanupEnd },
          },
        });
      }
    });
  });

  // ============================================================
  // 3. UC_6.1: Xếp lịch làm (Chủ quán)
  // ============================================================
  describe("UC_6.1: Xếp lịch làm (Chủ quán)", () => {
    it("Lấy dữ liệu xếp lịch trả về 3 ca làm và lịch rảnh nhân viên", async () => {
      const req = new Request(`http://localhost:3000/api/chu-quan/lich-lam?startDate=${testWeekStart}&endDate=${testWeekEnd}`, {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
      });
      const res = await getLichLam(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.caLams.length).toBe(3);
      expect(json.data.caLams.map((c: any) => c.Loaica)).toEqual(["Sáng", "Chiều", "Tối"]);
    });

    it("Lưu xếp lịch làm tạo LichLam từ 3 ca CaLam, không trùng lặp (Ngaylam, Maca)", async () => {
      const targetDays = ["2026-11-02", "2026-11-03"];
      const req = new Request("http://localhost:3000/api/chu-quan/lich-lam", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          cacNgay: targetDays,
        }),
      });

      const res = await postLichLam(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.message).toBe(XEP_LICH_LAM_THANH_CONG);

      // Kiểm tra trong CSDL: mỗi ngày có đúng 3 ca, mã dạng LLxxxxxx
      for (const d of targetDays) {
        const dLich = await prisma.lichLam.findMany({
          where: { Ngaylam: new Date(d + "T00:00:00Z") },
        });
        expect(dLich.length).toBe(3);
        for (const l of dLich) {
          expect(l.Malich.trim()).toMatch(/^LL\d{6}$/);
        }
      }

      // Lưu lại lần nữa không bị lỗi duplicate key
      const reqAgain = new Request("http://localhost:3000/api/chu-quan/lich-lam", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          cacNgay: targetDays,
        }),
      });
      const resAgain = await postLichLam(reqAgain, { params: Promise.resolve({}) });
      expect(resAgain.status).toBe(200);
    });
  });

  // ============================================================
  // 4. UC_6.2: Xếp ca làm (Chủ quán)
  // ============================================================
  describe("UC_6.2: Xếp ca làm (Chủ quán)", () => {
    it("Lấy thông tin 3 ca của ngày, thấy số người quy định và nhân viên rảnh", async () => {
      const req = new Request("http://localhost:3000/api/chu-quan/lich-lam/xep-ca?ngay=2026-11-02", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
      });
      const res = await getXepCa(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.caDetails.length).toBe(3);
      // Quy định: sáng 3, chiều 2, tối 2
      expect(json.data.caDetails[0].Sonvquydinh).toBe(3);
      expect(json.data.caDetails[1].Sonvquydinh).toBe(2);
      expect(json.data.caDetails[2].Sonvquydinh).toBe(2);
    });

    it("Ngày chưa có dữ liệu xếp ca: trả về đủ 3 ca với đúng Sonvquydinh (sáng 3, chiều 2, tối 2) và nhanVienDaXep rỗng", async () => {
      // Dùng một ngày chưa từng được xếp trong CSDL
      const ngayChuaXep = "2026-12-25";
      const req = new Request(`http://localhost:3000/api/chu-quan/lich-lam/xep-ca?ngay=${ngayChuaXep}`, {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
      });
      const res = await getXepCa(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.caDetails.length).toBe(3);
      const [caSang, caChieu, caToi] = json.data.caDetails;
      expect(caSang.Loaica).toBe("Sáng");
      expect(caSang.Sonvquydinh).toBe(3);
      expect(caSang.nhanVienDaXep).toEqual([]);
      expect(caChieu.Loaica).toBe("Chiều");
      expect(caChieu.Sonvquydinh).toBe(2);
      expect(caChieu.nhanVienDaXep).toEqual([]);
      expect(caToi.Loaica).toBe("Tối");
      expect(caToi.Sonvquydinh).toBe(2);
      expect(caToi.nhanVienDaXep).toEqual([]);
    });

    it("Gán nhân viên vào ca qua NhanVien_LichLam, không chặn cứng thiếu/thừa", async () => {
      const payload = {
        ngay: "2026-11-02",
        phanCong: [
          { maCa: "CA000001", nhanVienIds: ["NV000001", "NV000002"] }, // Thiếu 1 người (cần 3) nhưng vẫn lưu được
          { maCa: "CA000002", nhanVienIds: ["NV000003", "NV000004", "NV000005"] }, // Thừa 1 người (cần 2) nhưng vẫn lưu được
          { maCa: "CA000003", nhanVienIds: ["NV000006", "NV000007"] },
        ],
      };

      const req = new Request("http://localhost:3000/api/chu-quan/lich-lam/xep-ca", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const res = await postXepCa(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.message).toBe("Đã lưu");

      // Đọc lại để kiểm tra phân công đã được cập nhật
      const reqGet = new Request("http://localhost:3000/api/chu-quan/lich-lam/xep-ca?ngay=2026-11-02", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
      });
      const resGet = await getXepCa(reqGet, { params: Promise.resolve({}) });
      const jsonGet = await resGet.json();
      expect(jsonGet.data.caDetails[0].nhanVienDaXep.length).toBe(2);
      expect(jsonGet.data.caDetails[1].nhanVienDaXep.length).toBe(3);
      expect(jsonGet.data.caDetails[2].nhanVienDaXep.length).toBe(2);
    });

    it("Đổi qua lại giữa ngày đã xếp và ngày chưa xếp không lẫn dữ liệu", async () => {
      const ngayDaXep = "2026-11-02";
      const ngayChuaXep = "2026-12-26";

      // 1. Đọc ngày đã xếp
      const resDaXep = await getXepCa(
        new Request(`http://localhost:3000/api/chu-quan/lich-lam/xep-ca?ngay=${ngayDaXep}`, {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
        }),
        { params: Promise.resolve({}) }
      );
      const jsonDaXep = await resDaXep.json();
      expect(jsonDaXep.data.caDetails[0].nhanVienDaXep.length).toBeGreaterThan(0);

      // 2. Đọc ngày chưa xếp
      const resChuaXep = await getXepCa(
        new Request(`http://localhost:3000/api/chu-quan/lich-lam/xep-ca?ngay=${ngayChuaXep}`, {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
        }),
        { params: Promise.resolve({}) }
      );
      const jsonChuaXep = await resChuaXep.json();
      expect(jsonChuaXep.data.caDetails[0].nhanVienDaXep).toEqual([]);
      expect(jsonChuaXep.data.caDetails[1].nhanVienDaXep).toEqual([]);
      expect(jsonChuaXep.data.caDetails[2].nhanVienDaXep).toEqual([]);

      // 3. Đọc lại ngày đã xếp: dữ liệu vẫn nguyên vẹn
      const resDaXep2 = await getXepCa(
        new Request(`http://localhost:3000/api/chu-quan/lich-lam/xep-ca?ngay=${ngayDaXep}`, {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
        }),
        { params: Promise.resolve({}) }
      );
      const jsonDaXep2 = await resDaXep2.json();
      expect(jsonDaXep2.data.caDetails[0].nhanVienDaXep.length).toBe(
        jsonDaXep.data.caDetails[0].nhanVienDaXep.length
      );
    });
  });

  // ============================================================
  // 5. Tự đổi tuần sau khi kết thúc ngày Thứ 7
  // ============================================================
  describe("Tự đổi tuần khi kết thúc ngày Thứ 7", () => {
    it("Thứ 5 (12/11/2026) và Thứ 7 (14/11/2026) hiển thị tuần 09–15/11/2026; sang Chủ nhật (15/11/2026) tự đổi sang 16–22/11/2026", () => {
      const thu5 = getTuanLamViec(new Date(2026, 10, 12, 12, 0, 0));
      expect(thu5.startDate).toBe("2026-11-09");
      expect(thu5.endDate).toBe("2026-11-15");
      expect(thu5.titleRange).toBe("09–15/11/2026");

      const thu7CuoiNgay = getTuanLamViec(new Date(2026, 10, 14, 23, 59, 59));
      expect(thu7CuoiNgay.startDate).toBe("2026-11-09");
      expect(thu7CuoiNgay.endDate).toBe("2026-11-15");

      // Kết thúc Thứ 7 -> 00:00 Chủ nhật 15/11/2026: tự đổi sang tuần tiếp theo
      const chuNhat = getTuanLamViec(new Date(2026, 10, 15, 0, 0, 0));
      expect(chuNhat.startDate).toBe("2026-11-16");
      expect(chuNhat.endDate).toBe("2026-11-22");
      expect(chuNhat.titleRange).toBe("16–22/11/2026");
      expect(chuNhat.days[0].label).toBe("Thứ hai");
      expect(chuNhat.days[6].label).toBe("Chủ nhật");

      const thu2TuanSau = getTuanLamViec(new Date(2026, 10, 16, 8, 0, 0));
      expect(thu2TuanSau.startDate).toBe("2026-11-16");
      expect(thu2TuanSau.endDate).toBe("2026-11-22");
    });
  });

  // ============================================================
  // 6. UC_2.1: getTuanHienThiLichRanh tự chuyển tuần sau từ 18:00 Thứ bảy
  // ============================================================
  describe("UC_2.1: getTuanHienThiLichRanh chuyển tuần từ 18:00 Thứ bảy (giờ VN)", () => {
    it("Hằng số LICH_RANH_CHUYEN_TUAN là Thứ bảy (6), 18:00:00", () => {
      expect(LICH_RANH_CHUYEN_TUAN).toEqual({
        dayOfWeek: 6,
        hour: 18,
        minute: 0,
        second: 0,
      });
    });

    it("T2 00:00 -> tuần đang chạy; T7 17:59:59 -> tuần đang chạy; T7 18:00:00 -> tuần sau; CN 23:59:59 -> tuần sau; T2 00:00:00 kế tiếp -> giữ nguyên tuần đó", () => {
      // T2 09/11/2026 00:00:00 -> tuần 09–15/11/2026
      const t2 = getTuanHienThiLichRanh(new Date(2026, 10, 9, 0, 0, 0));
      expect(t2.startDate).toBe("2026-11-09");
      expect(t2.endDate).toBe("2026-11-15");

      // T7 14/11/2026 17:59:59 -> vẫn tuần 09–15/11/2026
      const t7Truoc18h = getTuanHienThiLichRanh(new Date(2026, 10, 14, 17, 59, 59));
      expect(t7Truoc18h.startDate).toBe("2026-11-09");
      expect(t7Truoc18h.endDate).toBe("2026-11-15");

      // T7 14/11/2026 18:00:00 -> tự chuyển sang tuần sau 16–22/11/2026
      const t7Luc18h = getTuanHienThiLichRanh(new Date(2026, 10, 14, 18, 0, 0));
      expect(t7Luc18h.startDate).toBe("2026-11-16");
      expect(t7Luc18h.endDate).toBe("2026-11-22");
      expect(t7Luc18h.titleRange).toBe("16–22/11/2026");

      // CN 15/11/2026 23:59:59 -> vẫn là tuần 16–22/11/2026
      const cnCuoiNgay = getTuanHienThiLichRanh(new Date(2026, 10, 15, 23, 59, 59));
      expect(cnCuoiNgay.startDate).toBe("2026-11-16");
      expect(cnCuoiNgay.endDate).toBe("2026-11-22");

      // T2 16/11/2026 00:00:00 kế tiếp -> tuần đó trở thành tuần đang chạy (không đổi thêm)
      const t2KeTiep = getTuanHienThiLichRanh(new Date(2026, 10, 16, 0, 0, 0));
      expect(t2KeTiep.startDate).toBe("2026-11-16");
      expect(t2KeTiep.endDate).toBe("2026-11-22");
    });

    it("Giao tuần/tháng/năm (31/12 -> 01/01) vẫn tính đúng thứ hai đến chủ nhật", () => {
      // Thứ 4 31/12/2025 -> tuần 29/12/2025 – 04/01/2026
      const giaoNamThu4 = getTuanHienThiLichRanh(new Date(2025, 11, 31, 23, 59, 59));
      expect(giaoNamThu4.startDate).toBe("2025-12-29");
      expect(giaoNamThu4.endDate).toBe("2026-01-04");
      expect(giaoNamThu4.days[2].fullDate).toBe("2025-12-31");
      expect(giaoNamThu4.days[3].fullDate).toBe("2026-01-01");

      // Thứ 7 26/12/2026 17:59:59 -> tuần 21–27/12/2026
      const truocGiaoNam = getTuanHienThiLichRanh(new Date(2026, 11, 26, 17, 59, 59));
      expect(truocGiaoNam.startDate).toBe("2026-12-21");
      expect(truocGiaoNam.endDate).toBe("2026-12-27");

      // Thứ 7 26/12/2026 18:00:00 -> tuần giao năm 28/12/2026 – 03/01/2027
      const sangGiaoNam = getTuanHienThiLichRanh(new Date(2026, 11, 26, 18, 0, 0));
      expect(sangGiaoNam.startDate).toBe("2026-12-28");
      expect(sangGiaoNam.endDate).toBe("2027-01-03");
      expect(sangGiaoNam.days[3].fullDate).toBe("2026-12-31");
      expect(sangGiaoNam.days[4].fullDate).toBe("2027-01-01");

      // Thứ 5 31/12/2026 và Thứ 6 01/01/2027 giữ nguyên tuần 28/12/2026 – 03/01/2027
      expect(getTuanHienThiLichRanh(new Date(2026, 11, 31, 23, 59, 59)).startDate).toBe("2026-12-28");
      expect(getTuanHienThiLichRanh(new Date(2027, 0, 1, 0, 0, 0)).startDate).toBe("2026-12-28");
    });

    it("Giả lập nowVN() qua VISUAL_NOW: getTuanHienThiLichRanh() tự dùng nowVN() khi không truyền tham số", () => {
      const prevVisualNow = process.env.VISUAL_NOW;
      try {
        process.env.VISUAL_NOW = "2026-11-14T17:59:59";
        expect(getTuanHienThiLichRanh().startDate).toBe("2026-11-09");

        process.env.VISUAL_NOW = "2026-11-14T18:00:00";
        expect(getTuanHienThiLichRanh().startDate).toBe("2026-11-16");
      } finally {
        if (prevVisualNow === undefined) {
          delete process.env.VISUAL_NOW;
        } else {
          process.env.VISUAL_NOW = prevVisualNow;
        }
      }
    });
  });

  // ============================================================
  // 7. UC_2.1: Khóa chỉnh sửa lịch rảnh của ngày đã được chủ quán lưu lịch làm (UC_6.1)
  // ============================================================
  describe("UC_2.1: Khóa ngày đã được chủ quán lưu lịch làm, mở khóa khi bỏ ngày", () => {
    it("Ngày chưa duyệt sửa được; ngày đã duyệt bị chặn thêm/sửa/xóa ở máy chủ (409); chủ quán bỏ ngày thì mở khóa lại", async () => {
      const prevVisualNow = process.env.VISUAL_NOW;
      const wStart = "2027-03-01";
      const wEnd = "2027-03-07";
      const dayMon = "2027-03-01";
      const dayTue = "2027-03-02";
      const dayWed = "2027-03-03";

      try {
        process.env.VISUAL_NOW = "2027-03-01T09:00:00";

        // 1. Khi chưa duyệt: đăng ký ngày Thứ 2 và Thứ 3 thành công
        const resInit = await postLichRanh(
          new Request("http://localhost:3000/api/nhan-vien/lich-ranh", {
            method: "POST",
            headers: {
              cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              startDate: wStart,
              endDate: wEnd,
              danhSach: [
                { ngay: dayMon, maCa: "CA000001" },
                { ngay: dayTue, maCa: "CA000002" },
              ],
            }),
          }),
          { params: Promise.resolve({}) }
        );
        expect(resInit.status).toBe(200);

        // 2. Chủ quán lưu lịch làm (UC_6.1) cho ngày Thứ 2 (dayMon) và Thứ 3 (dayTue)
        const resApprove = await postLichLam(
          new Request("http://localhost:3000/api/chu-quan/lich-lam", {
            method: "POST",
            headers: {
              cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              cacNgay: [dayMon, dayTue],
            }),
          }),
          { params: Promise.resolve({}) }
        );
        expect(resApprove.status).toBe(200);

        // 3. GET /api/nhan-vien/lich-ranh trả về ngayDaKhoa chứa dayMon và dayTue
        const resGetLocked = await getLichRanh(
          new Request("http://localhost:3000/api/nhan-vien/lich-ranh", {
            headers: { cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}` },
          }),
          { params: Promise.resolve({}) }
        );
        const jsonGetLocked = await resGetLocked.json();
        expect(jsonGetLocked.data.ngayDaKhoa).toContain(dayMon);
        expect(jsonGetLocked.data.ngayDaKhoa).toContain(dayTue);
        expect(jsonGetLocked.data.ngayDaKhoa).not.toContain(dayWed);

        // 4. Nhân viên gọi API trực tiếp để sửa/thêm lịch rảnh của ngày đã khóa (dayMon) -> bị chặn 409
        const resEditLocked = await postLichRanh(
          new Request("http://localhost:3000/api/nhan-vien/lich-ranh", {
            method: "POST",
            headers: {
              cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              startDate: wStart,
              endDate: wEnd,
              danhSach: [{ ngay: dayMon, maCa: "CA000003" }],
            }),
          }),
          { params: Promise.resolve({}) }
        );
        expect(resEditLocked.status).toBe(409);

        // 5. Nhân viên gọi DELETE trực tiếp lên ngày đã khóa (dayMon) -> bị chặn 409
        const resDelLocked = await deleteLichRanh(
          new Request(`http://localhost:3000/api/nhan-vien/lich-ranh?ngay=${dayMon}`, {
            method: "DELETE",
            headers: { cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}` },
          }),
          { params: Promise.resolve({}) }
        );
        expect(resDelLocked.status).toBe(409);

        // 6. Ngày chưa được duyệt (dayWed) vẫn đăng ký và sửa bình thường, đồng thời KHÔNG làm mất dữ liệu ngày đã khóa
        const resEditUnlocked = await postLichRanh(
          new Request("http://localhost:3000/api/nhan-vien/lich-ranh", {
            method: "POST",
            headers: {
              cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              startDate: wStart,
              endDate: wEnd,
              danhSach: [{ ngay: dayWed, maCa: "CA000003" }],
            }),
          }),
          { params: Promise.resolve({}) }
        );
        expect(resEditUnlocked.status).toBe(200);

        const lrInDb = await prisma.lichRanh.findMany({
          where: {
            Manv: testManv,
            Ngayranh: {
              gte: new Date(wStart + "T00:00:00Z"),
              lte: new Date(wEnd + "T23:59:59Z"),
            },
          },
        });
        const datesInDb = lrInDb.map((r) => r.Ngayranh.toISOString().split("T")[0]).sort();
        expect(datesInDb).toEqual([dayMon, dayTue, dayWed].sort());

        // 7. Chủ quán lưu lại lịch làm chỉ giữ dayMon (bỏ dayTue khỏi lịch) -> dayTue được mở khóa lại
        const resUnapproveTue = await postLichLam(
          new Request("http://localhost:3000/api/chu-quan/lich-lam", {
            method: "POST",
            headers: {
              cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              cacNgay: [dayMon],
            }),
          }),
          { params: Promise.resolve({}) }
        );
        expect(resUnapproveTue.status).toBe(200);

        // Bây giờ nhân viên sửa lịch rảnh của dayTue thành công (200), còn dayMon vẫn bị chặn (409)
        const resEditTueNowUnlocked = await postLichRanh(
          new Request("http://localhost:3000/api/nhan-vien/lich-ranh", {
            method: "POST",
            headers: {
              cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              startDate: wStart,
              endDate: wEnd,
              danhSach: [{ ngay: dayTue, maCa: "CA000001" }],
            }),
          }),
          { params: Promise.resolve({}) }
        );
        expect(resEditTueNowUnlocked.status).toBe(200);

        const resEditMonStillLocked = await postLichRanh(
          new Request("http://localhost:3000/api/nhan-vien/lich-ranh", {
            method: "POST",
            headers: {
              cookie: `${AUTH_COOKIE_NAME}=${nhanVienToken}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              startDate: wStart,
              endDate: wEnd,
              danhSach: [{ ngay: dayMon, maCa: "CA000002" }],
            }),
          }),
          { params: Promise.resolve({}) }
        );
        expect(resEditMonStillLocked.status).toBe(409);
      } finally {
        if (prevVisualNow === undefined) {
          delete process.env.VISUAL_NOW;
        } else {
          process.env.VISUAL_NOW = prevVisualNow;
        }
        await prisma.lichRanh.deleteMany({
          where: {
            Manv: testManv,
            Ngayranh: {
              gte: new Date(wStart + "T00:00:00Z"),
              lte: new Date(wEnd + "T23:59:59Z"),
            },
          },
        });
        const lls = await prisma.lichLam.findMany({
          where: {
            Ngaylam: {
              gte: new Date(wStart + "T00:00:00Z"),
              lte: new Date(wEnd + "T23:59:59Z"),
            },
          },
        });
        if (lls.length > 0) {
          const mlIds = lls.map((l) => l.Malich);
          await prisma.nhanVien_LichLam.deleteMany({ where: { Malich: { in: mlIds } } });
          await prisma.lichLam.deleteMany({ where: { Malich: { in: mlIds } } });
        }
      }
    });
  });
});
