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
import { signSession, AUTH_COOKIE_NAME } from "@backend/lib/auth";
import { prisma } from "@database/client";
import { GET as getCaTrongNgay } from "@/app/api/thay-ca/ca-trong-ngay/route";
import { GET as getDangMo } from "@/app/api/thay-ca/dang-mo/route";
import { POST as postThayCa } from "@/app/api/thay-ca/route";
import { POST as postChapNhan } from "@/app/api/thay-ca/[id]/chap-nhan/route";
import { POST as postTuChoi } from "@/app/api/thay-ca/[id]/tu-choi/route";
import { GET as getThongBao } from "@/app/api/thong-bao/route";
import { GET as getChuQuanTongQuan } from "@/app/api/chu-quan/tong-quan/route";
import { clearThayCaMapForTest, getThayCaMap } from "@backend/services/thay-ca";
import * as thongBao from "@frontend/config/thong-bao";

describe("UC_2.3 - Thay ca (báo nghỉ gấp, polling Map, đua 2 người bấm, cảnh báo CQ ≤30 phút, 401/403)", () => {
  const signChuQuan = () =>
    signSession({
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Hoàng Lan",
    });

  const signNv = (manv: string, name: string) =>
    signSession({
      userId: manv,
      username: manv,
      role: "NhanVien",
      name,
    });

  // Dùng nhân viên hạt giống + 1 NV Pha chế tạm để test 2 người cùng vị trí
  const nvXinNghi = "NV000001"; // Nguyễn Minh Anh (Pha chế)
  const nvRanh1 = "NV000002"; // Trần Thu Hà (Pha chế)
  const nvRanh2 = "NV970001"; // Phạm Minh Khoa (Pha chế - tạo trong test)
  const nvKhacViTri = "NV000003"; // Lê Quốc Bảo (Phục vụ - phải bị loại)
  const nvKhongRanh = "NV000004"; // Phạm Ngọc Lan
  const nvDangLamCungCa = "NV000005"; // Đã được xếp cùng ca nên không được mời

  // Cố định ngày kiểm thử (giờ VN) để không phụ thuộc giờ thật khi chạy test:
  // Ngày 2099-12-20, ca Tối CA000003 (17:00 - 22:00)
  const testDateStr = "2099-12-20";
  const testDateDb = new Date(`${testDateStr}T00:00:00Z`);
  const testMalich = "LL970001";
  const testMaca = "CA000003"; // Tối: 17:00 - 22:00

  const lr1 = "LR970001";
  const lr2 = "LR970002";
  const lr3 = "LR970003";
  const lr4 = "LR970004";
  const lrKhacViTri = "LR970005";

  let cqToken = "";
  let nv1Token = "";
  let nv2Token = "";
  let nv3Token = "";
  let nvKhacViTriToken = "";
  let nv4Token = "";
  let nv5Token = "";

  async function seedShiftAndAvailability() {
    await prisma.chamCong.deleteMany({ where: { Malich: testMalich } });
    await prisma.donXinDoiCa.deleteMany({ where: { Malich: testMalich } });
    await prisma.yeuCauBoSungCC.deleteMany({ where: { Malich: testMalich } });
    await prisma.nhanVien_LichLam.deleteMany({ where: { Malich: testMalich } });
    await prisma.lichLam.deleteMany({ where: { Malich: testMalich } });
    await prisma.lichRanh.deleteMany({
      where: { Malichranh: { in: [lr1, lr2, lr3, lr4, lrKhacViTri] } },
    });

    await prisma.nhanVien.upsert({
      where: { Manv: nvRanh2 },
      update: {
        Hoten: "Phạm Minh Khoa",
        Vitrilamviec: "Pha chế",
        Trangthai: "Chính thức",
      },
      create: {
        Manv: nvRanh2,
        Tendangnhap: nvRanh2,
        Matkhau: "test:tag:cipher",
        Hoten: "Phạm Minh Khoa",
        Sdt: "0997000001",
        Diachi: "Đà Nẵng",
        Truonghoc: "ĐH Bách khoa",
        Vitrilamviec: "Pha chế",
        Hinhthuclam: "Part-time",
        Ngayvaolam: new Date("2024-01-01T00:00:00Z"),
        Kinhnghiem: "1 năm",
        Trangthai: "Chính thức",
        Mucluongtheogio: 20000,
      },
    });

    await prisma.lichLam.create({
      data: {
        Malich: testMalich,
        Ngaylam: testDateDb,
        Maca: testMaca,
      },
    });

    await prisma.nhanVien_LichLam.createMany({
      data: [
        { Manv: nvXinNghi, Malich: testMalich },
        { Manv: nvDangLamCungCa, Malich: testMalich },
      ],
    });

    await prisma.lichRanh.createMany({
      data: [
        { Malichranh: lr1, Manv: nvRanh1, Ngayranh: testDateDb, Caranh: testMaca },
        { Malichranh: lr2, Manv: nvRanh2, Ngayranh: testDateDb, Caranh: testMaca },
        // nvKhacViTri có lịch rảnh nhưng là Phục vụ -> phải bị loại khi Pha chế xin thay
        { Malichranh: lrKhacViTri, Manv: nvKhacViTri, Ngayranh: testDateDb, Caranh: testMaca },
        // nvDangLamCungCa có lịch rảnh nhưng ĐANG làm ca này -> phải bị loại
        { Malichranh: lr3, Manv: nvDangLamCungCa, Ngayranh: testDateDb, Caranh: testMaca },
        // nvXinNghi có lịch rảnh -> phải bị loại
        { Malichranh: lr4, Manv: nvXinNghi, Ngayranh: testDateDb, Caranh: testMaca },
      ],
    });
  }

  beforeAll(async () => {
    process.env.JWT_SECRET =
      "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${testDateStr}T08:00:00Z`));

    cqToken = await signChuQuan();
    nv1Token = await signNv(nvXinNghi, "Nguyễn Minh Anh");
    nv2Token = await signNv(nvRanh1, "Trần Thu Hà");
    nv3Token = await signNv(nvRanh2, "Phạm Minh Khoa");
    nvKhacViTriToken = await signNv(nvKhacViTri, "Lê Quốc Bảo");
    nv4Token = await signNv(nvKhongRanh, "Phạm Ngọc Lan");
    nv5Token = await signNv(nvDangLamCungCa, "Hoàng Văn Nam");

    await seedShiftAndAvailability();
  });

  afterAll(async () => {
    vi.useRealTimers();
    await clearThayCaMapForTest();
    await prisma.chamCong.deleteMany({ where: { Malich: testMalich } });
    await prisma.donXinDoiCa.deleteMany({ where: { Malich: testMalich } });
    await prisma.yeuCauBoSungCC.deleteMany({ where: { Malich: testMalich } });
    await prisma.nhanVien_LichLam.deleteMany({ where: { Malich: testMalich } });
    await prisma.lichLam.deleteMany({ where: { Malich: testMalich } });
    await prisma.lichRanh.deleteMany({
      where: { Malichranh: { in: [lr1, lr2, lr3, lr4, lrKhacViTri] } },
    });
    await prisma.nhanVien.deleteMany({ where: { Manv: nvRanh2 } });
  });

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 15:00 giờ VN (tức 08:00 UTC) -> còn 120 phút trước ca Tối (17:00)
    vi.setSystemTime(new Date(`${testDateStr}T08:00:00Z`));
    await clearThayCaMapForTest();
    await seedShiftAndAvailability();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("1. Phân quyền 401 / 403", () => {
    it("Chưa đăng nhập gọi các endpoint thay ca đều trả 401", async () => {
      const r1 = await getCaTrongNgay(
        new Request("http://localhost:3000/api/thay-ca/ca-trong-ngay"),
        { params: Promise.resolve({}) }
      );
      expect(r1.status).toBe(401);

      const r2 = await getDangMo(
        new Request("http://localhost:3000/api/thay-ca/dang-mo"),
        { params: Promise.resolve({}) }
      );
      expect(r2.status).toBe(401);

      const r3 = await postThayCa(
        new Request("http://localhost:3000/api/thay-ca", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ malich: testMalich, lyDo: "Ốm" }),
        }),
        { params: Promise.resolve({}) }
      );
      expect(r3.status).toBe(401);

      const r4 = await postChapNhan(
        new Request("http://localhost:3000/api/thay-ca/TC000001/chap-nhan", {
          method: "POST",
        }),
        { params: Promise.resolve({ id: "TC000001" }) }
      );
      expect(r4.status).toBe(401);

      const r5 = await postTuChoi(
        new Request("http://localhost:3000/api/thay-ca/TC000001/tu-choi", {
          method: "POST",
        }),
        { params: Promise.resolve({ id: "TC000001" }) }
      );
      expect(r5.status).toBe(401);
    });

    it("Chủ quán gọi các endpoint thay ca của Nhân viên đều bị chặn 403", async () => {
      const headers = { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` };

      const r1 = await getCaTrongNgay(
        new Request("http://localhost:3000/api/thay-ca/ca-trong-ngay", { headers }),
        { params: Promise.resolve({}) }
      );
      expect(r1.status).toBe(403);

      const r2 = await getDangMo(
        new Request("http://localhost:3000/api/thay-ca/dang-mo", { headers }),
        { params: Promise.resolve({}) }
      );
      expect(r2.status).toBe(403);

      const r3 = await postThayCa(
        new Request("http://localhost:3000/api/thay-ca", {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({ malich: testMalich, lyDo: "Ốm" }),
        }),
        { params: Promise.resolve({}) }
      );
      expect(r3.status).toBe(403);

      const r4 = await postChapNhan(
        new Request("http://localhost:3000/api/thay-ca/TC000001/chap-nhan", {
          method: "POST",
          headers,
        }),
        { params: Promise.resolve({ id: "TC000001" }) }
      );
      expect(r4.status).toBe(403);

      const r5 = await postTuChoi(
        new Request("http://localhost:3000/api/thay-ca/TC000001/tu-choi", {
          method: "POST",
          headers,
        }),
        { params: Promise.resolve({ id: "TC000001" }) }
      );
      expect(r5.status).toBe(403);
    });
  });

  describe("2. Xem trước ca trong ngày & Tạo yêu cầu thay ca gấp (Map)", () => {
    it("GET /api/thay-ca/ca-trong-ngay chỉ đọc không ghi Map/DB, lọc đúng người có lịch rảnh", async () => {
      const res = await getCaTrongNgay(
        new Request("http://localhost:3000/api/thay-ca/ca-trong-ngay", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${nv1Token}` },
        }),
        { params: Promise.resolve({}) }
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(getThayCaMap().size).toBe(0);

      const ca = json.data.danhSachCa.find((c: any) => c.malich === testMalich);
      expect(ca).toBeDefined();
      const manvs = ca.nhanViensRanh.map((x: any) => x.manv).sort();
      expect(manvs).toEqual([nvRanh1, nvRanh2].sort());
      expect(manvs).not.toContain(nvKhacViTri);
    });

    it("POST /api/thay-ca lưu bền trong CSDL và GET /api/thay-ca/dang-mo chỉ trả cho NV cùng vị trí có lịch rảnh đúng ca", async () => {
      const createRes = await postThayCa(
        new Request("http://localhost:3000/api/thay-ca", {
          method: "POST",
          headers: {
            cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            malich: testMalich,
            lyDo: "Có việc gia đình đột xuất",
          }),
        }),
        { params: Promise.resolve({}) }
      );
      expect(createRes.status).toBe(201);
      const created = await createRes.json();
      expect(created.ok).toBe(true);
      expect(created.data.yeuCau.lyDo).toBe("Có việc gia đình đột xuất");
      const dbCount = await prisma.donXinDoiCa.count({
        where: { Malich: testMalich, Madon: { startsWith: "TC" } },
      });
      expect(dbCount).toBe(1);

      // Người gửi (nvXinNghi) KHÔNG BAO GIỜ nhận lời mời của chính mình
      const pollSender = await getDangMo(
        new Request("http://localhost:3000/api/thay-ca/dang-mo", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${nv1Token}` },
        }),
        { params: Promise.resolve({}) }
      );
      const dSender = await pollSender.json();
      expect(dSender.data.loiMoi).toHaveLength(0);

      // NV có lịch rảnh thấy lời mời
      const pollNv2 = await getDangMo(
        new Request("http://localhost:3000/api/thay-ca/dang-mo", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${nv2Token}` },
        }),
        { params: Promise.resolve({}) }
      );
      const d2 = await pollNv2.json();
      expect(d2.data.loiMoi).toHaveLength(1);
      expect(d2.data.loiMoi[0].tenNhanVienXinNghi).toBe("Nguyễn Minh Anh");

      // NV không có lịch rảnh KHÔNG thấy lời mời
      const pollNv4 = await getDangMo(
        new Request("http://localhost:3000/api/thay-ca/dang-mo", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${nv4Token}` },
        }),
        { params: Promise.resolve({}) }
      );
      const d4 = await pollNv4.json();
      expect(d4.data.loiMoi).toHaveLength(0);

      // NV đang làm cùng ca KHÔNG thấy lời mời
      const pollNv5 = await getDangMo(
        new Request("http://localhost:3000/api/thay-ca/dang-mo", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${nv5Token}` },
        }),
        { params: Promise.resolve({}) }
      );
      const d5 = await pollNv5.json();
      expect(d5.data.loiMoi).toHaveLength(0);

      // NV khác vị trí (Phục vụ) KHÔNG thấy lời mời và bấm Chấp nhận bị chặn
      const pollKhac = await getDangMo(
        new Request("http://localhost:3000/api/thay-ca/dang-mo", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${nvKhacViTriToken}` },
        }),
        { params: Promise.resolve({}) }
      );
      const dKhac = await pollKhac.json();
      expect(dKhac.data.loiMoi).toHaveLength(0);

      const rejKhac = await postChapNhan(
        new Request(`http://localhost:3000/api/thay-ca/${created.data.yeuCau.id}/chap-nhan`, {
          method: "POST",
          headers: { cookie: `${AUTH_COOKIE_NAME}=${nvKhacViTriToken}` },
        }),
        { params: Promise.resolve({ id: created.data.yeuCau.id }) }
      );
      expect([400, 403]).toContain(rejKhac.status);
    });

    it("NV bấm Không chấp nhận chỉ ẩn với NV đó, vẫn mở cho NV rảnh khác", async () => {
      const createRes = await postThayCa(
        new Request("http://localhost:3000/api/thay-ca", {
          method: "POST",
          headers: {
            cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ malich: testMalich, lyDo: "Bận việc gấp" }),
        }),
        { params: Promise.resolve({}) }
      );
      const id = (await createRes.json()).data.yeuCau.id;

      const decRes = await postTuChoi(
        new Request(`http://localhost:3000/api/thay-ca/${id}/tu-choi`, {
          method: "POST",
          headers: { cookie: `${AUTH_COOKIE_NAME}=${nv2Token}` },
        }),
        { params: Promise.resolve({ id }) }
      );
      expect(decRes.status).toBe(200);

      const pollNv2 = await (
        await getDangMo(
          new Request("http://localhost:3000/api/thay-ca/dang-mo", {
            headers: { cookie: `${AUTH_COOKIE_NAME}=${nv2Token}` },
          }),
          { params: Promise.resolve({}) }
        )
      ).json();
      expect(pollNv2.data.loiMoi).toHaveLength(0);

      const pollNv3 = await (
        await getDangMo(
          new Request("http://localhost:3000/api/thay-ca/dang-mo", {
            headers: { cookie: `${AUTH_COOKIE_NAME}=${nv3Token}` },
          }),
          { params: Promise.resolve({}) }
        )
      ).json();
      expect(pollNv3.data.loiMoi).toHaveLength(1);
    });
  });

  describe("3. Đua 2 người bấm Chấp nhận cùng lúc & cập nhật NhanVien_LichLam", () => {
    it("Hai người bấm cùng lúc chỉ MỘT người thắng, thêm vào NhanVien_LichLam không cần CQ duyệt, người sau gặp 'Đã có người nhận thay ca'", async () => {
      const createRes = await postThayCa(
        new Request("http://localhost:3000/api/thay-ca", {
          method: "POST",
          headers: {
            cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ malich: testMalich, lyDo: "Ốm đột xuất" }),
        }),
        { params: Promise.resolve({}) }
      );
      const id = (await createRes.json()).data.yeuCau.id;

      const [resA, resB] = await Promise.all([
        postChapNhan(
          new Request(`http://localhost:3000/api/thay-ca/${id}/chap-nhan`, {
            method: "POST",
            headers: { cookie: `${AUTH_COOKIE_NAME}=${nv2Token}` },
          }),
          { params: Promise.resolve({ id }) }
        ),
        postChapNhan(
          new Request(`http://localhost:3000/api/thay-ca/${id}/chap-nhan`, {
            method: "POST",
            headers: { cookie: `${AUTH_COOKIE_NAME}=${nv3Token}` },
          }),
          { params: Promise.resolve({ id }) }
        ),
      ]);

      const statuses = [resA.status, resB.status].sort((a, b) => a - b);
      expect(statuses).toEqual([200, 409]);

      const jsonA = await resA.json();
      const jsonB = await resB.json();

      const winnerManv = resA.status === 200 ? nvRanh1 : nvRanh2;
      const loserManv = resA.status === 200 ? nvRanh2 : nvRanh1;
      const winnerJson = resA.status === 200 ? jsonA : jsonB;
      const loserJson = resA.status === 200 ? jsonB : jsonA;

      expect(winnerJson.ok).toBe(true);
      expect(winnerJson.data.message).toBe(thongBao.THAY_CA_XAC_NHAN_THANH_CONG);
      expect(loserJson.ok).toBe(false);
      expect(loserJson.error.message).toBe(thongBao.THAY_CA_DA_CO_NGUOI_NHAN);

      // Kiểm tra CSDL NhanVien_LichLam: người thắng đã vào ca, người thua không vào ca
      const nvll = await prisma.nhanVien_LichLam.findMany({
        where: { Malich: testMalich },
        select: { Manv: true },
      });
      const assignedManvs = nvll.map((x) => x.Manv.trim());
      expect(assignedManvs).toContain(winnerManv);
      expect(assignedManvs).not.toContain(loserManv);

      // Người xin nghỉ thấy trạng thái "Đã nhận" và dòng người nhận là "Đã nhận ca"
      const pollSender = await (
        await getDangMo(
          new Request("http://localhost:3000/api/thay-ca/dang-mo", {
            headers: { cookie: `${AUTH_COOKIE_NAME}=${nv1Token}` },
          }),
          { params: Promise.resolve({}) }
        )
      ).json();
      expect(pollSender.data.yeuCauCuaToi).toHaveLength(1);
      expect(pollSender.data.yeuCauCuaToi[0].trangThai).toBe("Đã nhận");
      const acceptedRow = pollSender.data.yeuCauCuaToi[0].nguoiDuocMoi.find(
        (n: any) => n.manv === winnerManv
      );
      expect(acceptedRow.trangThai).toBe("Đã nhận ca");
    });
  });

  describe("4. Cảnh báo gấp cho Chủ quán (≤30 phút trước ca hoặc 0 người rảnh)", () => {
    it("Sát giờ (≤30 phút trước ca) chưa ai nhận thì cảnh báo gấp cho Chủ quán", async () => {
      // Tạo yêu cầu lúc 15:00 (còn 120 phút -> chưa sát giờ)
      await postThayCa(
        new Request("http://localhost:3000/api/thay-ca", {
          method: "POST",
          headers: {
            cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ malich: testMalich, lyDo: "Xe hỏng" }),
        }),
        { params: Promise.resolve({}) }
      );

      // Kiểm tra trước mốc 30 phút: chưa cảnh báo sát giờ
      const tbEarly = await (
        await getThongBao(
          new Request("http://localhost:3000/api/thong-bao", {
            headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` },
          }),
          { params: Promise.resolve({}) }
        )
      ).json();
      expect(
        tbEarly.data.items.some((i: any) => i.id.startsWith("TC-CB-"))
      ).toBe(false);

      // Tua tới 16:35 VN (09:35 UTC) -> còn 25 phút <= 30 phút
      vi.setSystemTime(new Date(`${testDateStr}T09:35:00Z`));

      const tbUrgent = await (
        await getThongBao(
          new Request("http://localhost:3000/api/thong-bao", {
            headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` },
          }),
          { params: Promise.resolve({}) }
        )
      ).json();
      const urgentItem = tbUrgent.data.items.find((i: any) =>
        i.id.startsWith("TC-CB-")
      );
      expect(urgentItem).toBeDefined();
      expect(urgentItem.chiTiet).toContain(thongBao.THAY_CA_CANH_BAO_SAT_GIO);

      const dashUrgent = await (
        await getChuQuanTongQuan(
          new Request("http://localhost:3000/api/chu-quan/tong-quan", {
            headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` },
          }),
          { params: Promise.resolve({}) }
        )
      ).json();
      expect(dashUrgent.data.canhBaoThayCa.length).toBeGreaterThanOrEqual(1);
      expect(dashUrgent.data.canhBaoThayCa[0].noiDungCanhBao).toBe(
        thongBao.THAY_CA_CANH_BAO_SAT_GIO
      );
    });

    it("Không có nhân viên rảnh thì cảnh báo ngay cho Chủ quán", async () => {
      await prisma.lichRanh.deleteMany({
        where: { Malichranh: { in: [lr1, lr2] } },
      });

      const res = await postThayCa(
        new Request("http://localhost:3000/api/thay-ca", {
          method: "POST",
          headers: {
            cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ malich: testMalich, lyDo: "Nghỉ đột xuất" }),
        }),
        { params: Promise.resolve({}) }
      );
      expect(res.status).toBe(201);

      const tb = await (
        await getThongBao(
          new Request("http://localhost:3000/api/thong-bao", {
            headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` },
          }),
          { params: Promise.resolve({}) }
        )
      ).json();
      const urgentItem = tb.data.items.find((i: any) =>
        i.id.startsWith("TC-CB-")
      );
      expect(urgentItem).toBeDefined();
      expect(urgentItem.chiTiet).toContain(
        thongBao.THAY_CA_CANH_BAO_KHONG_NGUOI_RANH
      );
    });
  });

  describe("5. Mô phỏng nhiều instance Vercel Serverless (vi.resetModules giữa các request)", () => {
    it("Reset module giữa Tạo -> Từ chối -> Poll lại -> Chấp nhận vẫn giữ đúng trạng thái bền trong CSDL", async () => {
      // Instance 1: tạo yêu cầu thay ca
      vi.resetModules();
      const mod1 = await import("@backend/services/thay-ca");
      const created = await mod1.taoYeuCauThayCa(nvXinNghi, {
        malich: testMalich,
        lyDo: "Kiểm thử serverless nhiều instance",
      });
      expect(created.yeuCau.id).toMatch(/^TC\d{6}$/);

      // Instance 2: nvRanh1 bấm Không chấp nhận
      vi.resetModules();
      const mod2 = await import("@backend/services/thay-ca");
      const declined = await mod2.tuChoiThayCa(created.yeuCau.id, nvRanh1);
      expect(declined.ok).toBe(true);

      // Instance 3: nvRanh1 poll lại -> không còn hiện lời mời; nvXinNghi poll -> không nhận lời mời của mình; nvRanh2 poll -> vẫn thấy lời mời
      vi.resetModules();
      const mod3 = await import("@backend/services/thay-ca");
      const pollRanh1 = await mod3.layYeuCauThayCaDangMo(nvRanh1);
      expect(pollRanh1.loiMoi).toHaveLength(0);

      const pollSender = await mod3.layYeuCauThayCaDangMo(nvXinNghi);
      expect(pollSender.loiMoi).toHaveLength(0);
      const senderItem = pollSender.yeuCauCuaToi.find((x) => x.id === created.yeuCau.id);
      expect(senderItem).toBeDefined();
      expect(
        senderItem?.nguoiDuocMoi.find((n) => n.manv === nvRanh1)?.trangThai
      ).toBe("Đã từ chối");

      const pollRanh2 = await mod3.layYeuCauThayCaDangMo(nvRanh2);
      expect(pollRanh2.loiMoi.some((x) => x.id === created.yeuCau.id)).toBe(true);

      // Instance 4: nvRanh2 bấm Chấp nhận thành công
      vi.resetModules();
      const mod4 = await import("@backend/services/thay-ca");
      const accepted = await mod4.chapNhanThayCa(created.yeuCau.id, nvRanh2);
      expect(accepted.yeuCau.trangThai).toBe("Đã nhận");
      expect(accepted.yeuCau.manvNhanThay).toBe(nvRanh2);
    });
  });
});
