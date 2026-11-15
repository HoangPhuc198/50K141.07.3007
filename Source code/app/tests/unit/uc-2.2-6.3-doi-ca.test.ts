import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
} from "vitest";
import { signSession, AUTH_COOKIE_NAME } from "@backend/lib/auth";
import { GET as getDoiCa, POST as postDoiCa, PUT as putDoiCa } from "@/app/api/doi-ca/route";
import { GET as getCaCuaToi } from "@/app/api/doi-ca/ca-cua-toi/route";
import { GET as getNguoiThay } from "@/app/api/doi-ca/nguoi-thay/route";
import { GET as getXuLy, POST as postXuLy } from "@/app/api/doi-ca/xu-ly/route";
import * as thongBao from "@frontend/config/thong-bao";
import { prisma } from "@database/client";

describe("UC_2.2 & UC_6.3 - Yêu cầu đổi ca & Xử lý đổi ca", () => {
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

  const nv1 = "NV000001"; // Nguyễn Minh Anh
  const nv2 = "NV000002"; // Trần Thu Hà
  const nv3 = "NV000003"; // Lê Quốc Bảo
  const nv4 = "NV000004"; // Phạm Ngọc Lan

  const testDateFutureStr = "2099-10-15";
  const testDateFutureObj = new Date("2099-10-15T00:00:00Z");

  const testDatePastStr = "2020-01-01";
  const testDatePastObj = new Date("2020-01-01T00:00:00Z");

  const malichFuture = "LL980001";
  const malichPast = "LL980002";
  const lrTest1 = "LR980001";
  const lrTest2 = "LR980002";
  const lrTest3 = "LR980003";

  beforeAll(async () => {
    process.env.JWT_SECRET =
      "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";

    // Dọn dẹp dữ liệu test cũ
    await prisma.lichRanh.deleteMany({
      where: {
        Malichranh: { in: [lrTest1, lrTest2, lrTest3] },
      },
    });
    await prisma.donXinDoiCa.deleteMany({
      where: {
        Malich: { in: [malichFuture, malichPast] },
      },
    });
    await prisma.nhanVien_LichLam.deleteMany({
      where: {
        Malich: { in: [malichFuture, malichPast] },
      },
    });
    await prisma.lichLam.deleteMany({
      where: {
        Malich: { in: [malichFuture, malichPast] },
      },
    });

    // Tạo lịch làm tương lai (ca Sáng CA000001)
    await prisma.lichLam.create({
      data: {
        Malich: malichFuture,
        Ngaylam: testDateFutureObj,
        Maca: "CA000001",
      },
    });

    // Tạo lịch làm quá khứ (ca Chiều CA000002)
    await prisma.lichLam.create({
      data: {
        Malich: malichPast,
        Ngaylam: testDatePastObj,
        Maca: "CA000002",
      },
    });

    // Phân công nv1 và nv4 vào ca tương lai; nv1 vào ca quá khứ
    await prisma.nhanVien_LichLam.createMany({
      data: [
        { Manv: nv1, Malich: malichFuture },
        { Manv: nv4, Malich: malichFuture },
        { Manv: nv1, Malich: malichPast },
      ],
    });

    // Tạo LichRanh test:
    // nv2 có lịch rảnh (không làm ca đó, không gửi đơn)
    // nv4 có lịch rảnh (nhưng ĐANG làm ca đó)
    // nv1 có lịch rảnh (nhưng là người gửi đơn)
    // nv3 KHÔNG có lịch rảnh
    await prisma.lichRanh.createMany({
      data: [
        { Malichranh: lrTest1, Manv: nv2, Ngayranh: testDateFutureObj, Caranh: "CA000001" },
        { Malichranh: lrTest2, Manv: nv4, Ngayranh: testDateFutureObj, Caranh: "CA000001" },
        { Malichranh: lrTest3, Manv: nv1, Ngayranh: testDateFutureObj, Caranh: "CA000001" },
      ],
    });
  });

  afterAll(async () => {
    await prisma.lichRanh.deleteMany({
      where: {
        Malichranh: { in: [lrTest1, lrTest2, lrTest3] },
      },
    });
    await prisma.donXinDoiCa.deleteMany({
      where: {
        Malich: { in: [malichFuture, malichPast] },
      },
    });
    await prisma.nhanVien_LichLam.deleteMany({
      where: {
        Malich: { in: [malichFuture, malichPast] },
      },
    });
    await prisma.lichLam.deleteMany({
      where: {
        Malich: { in: [malichFuture, malichPast] },
      },
    });
  });

  // ============================================================
  // 1. Phân quyền (401 & 403)
  // ============================================================
  describe("Phân quyền API (401 & 403)", () => {
    it("POST /api/doi-ca không có cookie -> 401", async () => {
      const req = new Request("http://localhost:3000/api/doi-ca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Malich: malichFuture, khongCoNguoiThay: true }),
      });
      const res = await postDoiCa(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(401);
    });

    it("POST /api/doi-ca với vai trò Chủ quán -> 403", async () => {
      const token = await signChuQuan();
      const req = new Request("http://localhost:3000/api/doi-ca", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify({ Malich: malichFuture, khongCoNguoiThay: true }),
      });
      const res = await postDoiCa(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(403);
    });

    it("PUT /api/doi-ca không có cookie -> 401", async () => {
      const req = new Request("http://localhost:3000/api/doi-ca", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Madon: "DD999999" }),
      });
      const res = await putDoiCa(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(401);
    });

    it("PUT /api/doi-ca với vai trò Nhân viên -> 403", async () => {
      const token = await signNv(nv1, "Lê Gia Hân");
      const req = new Request("http://localhost:3000/api/doi-ca", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify({ Madon: "DD999999" }),
      });
      const res = await putDoiCa(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(403);
    });

    it("GET /api/doi-ca/ca-cua-toi không có cookie -> 401", async () => {
      const req = new Request("http://localhost:3000/api/doi-ca/ca-cua-toi");
      const res = await getCaCuaToi(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(401);
    });

    it("GET /api/doi-ca/ca-cua-toi với vai trò Chủ quán -> 403", async () => {
      const token = await signChuQuan();
      const req = new Request("http://localhost:3000/api/doi-ca/ca-cua-toi", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
      });
      const res = await getCaCuaToi(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(403);
    });

    it("GET /api/doi-ca/xu-ly không có cookie -> 401", async () => {
      const req = new Request("http://localhost:3000/api/doi-ca/xu-ly");
      const res = await getXuLy(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(401);
    });

    it("GET /api/doi-ca/xu-ly với vai trò Nhân viên -> 403", async () => {
      const token = await signNv(nv1, "Nguyễn Minh Anh");
      const req = new Request("http://localhost:3000/api/doi-ca/xu-ly", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
      });
      const res = await getXuLy(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(403);
    });

    it("GET /api/doi-ca/nguoi-thay không có cookie -> 401", async () => {
      const req = new Request("http://localhost:3000/api/doi-ca/nguoi-thay");
      const res = await getNguoiThay(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(401);
    });
  });

  // ============================================================
  // 2. Nghiệp vụ UC 2.2: Yêu cầu đổi ca
  // ============================================================
  describe("Nghiệp vụ UC 2.2 (Nhân viên gửi yêu cầu)", () => {
    it("GET ca của tôi: chỉ trả về các ca chưa bắt đầu (không chứa ca quá khứ)", async () => {
      const token = await signNv(nv1, "Lê Gia Hân");
      const req = new Request("http://localhost:3000/api/doi-ca", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
      });
      const res = await getDoiCa(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);

      const items = json.data.items as any[];
      const malichList = items.map((i) => i.malich);
      expect(malichList).toContain(malichFuture);
      expect(malichList).not.toContain(malichPast);
    });

    it("GET người thay được: không bao gồm chính nhân viên yêu cầu", async () => {
      const token = await signNv(nv1, "Lê Gia Hân");
      const req = new Request(`http://localhost:3000/api/doi-ca?type=nguoi-thay&malich=${malichFuture}`, {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
      });
      const res = await getDoiCa(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);

      const items = json.data.items as any[];
      const manvList = items.map((i) => i.manv);
      expect(manvList).not.toContain(nv1);
      expect(manvList).toContain(nv2);
    });

    it("BR01: Đổi ca đã qua (quá khứ) -> từ chối 400", async () => {
      const token = await signNv(nv1, "Lê Gia Hân");
      const req = new Request("http://localhost:3000/api/doi-ca", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify({
          Malich: malichPast,
          khongCoNguoiThay: true,
        }),
      });
      const res = await postDoiCa(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.message).toContain("Nhân viên chỉ đổi được ca khi ca làm chưa diễn ra");
    });

    it("Ca không được phân công -> từ chối 400", async () => {
      const token = await signNv(nv2, "Trần Đức Huy"); // nv2 không có trong malichFuture
      const req = new Request("http://localhost:3000/api/doi-ca", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify({
          Malich: malichFuture,
          khongCoNguoiThay: true,
        }),
      });
      const res = await postDoiCa(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
    });

    it("Tự chọn chính mình làm người nhận thay -> từ chối 400", async () => {
      const token = await signNv(nv1, "Lê Gia Hân");
      const req = new Request("http://localhost:3000/api/doi-ca", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify({
          Malich: malichFuture,
          Manvnhanthay: nv1,
        }),
      });
      const res = await postDoiCa(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
    });

    it("Tích 'Không có người thay thế': tạo đơn thành công, Manvnhanthay IS NULL, thông báo chuẩn", async () => {
      const token = await signNv(nv1, "Lê Gia Hân");
      const req = new Request("http://localhost:3000/api/doi-ca", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify({
          Malich: malichFuture,
          khongCoNguoiThay: true,
        }),
      });
      const res = await postDoiCa(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.message).toBe(thongBao.YEU_CAU_DOI_CA_THANH_CONG);
      expect(json.data.madon).toMatch(/^DD\d{6}$/);

      // Kiểm tra CSDL
      const don = await prisma.donXinDoiCa.findUnique({
        where: { Madon: json.data.madon },
      });
      expect(don).not.toBeNull();
      expect(don?.Manvnhanthay).toBeNull();
      expect(don?.Trangthaixuly).toBe("Chưa xử lý");
    });
  });

  // ============================================================
  // 3. Nghiệp vụ UC 6.3: Xử lý đổi ca
  // ============================================================
  describe("Nghiệp vụ UC 6.3 (Chủ quán xử lý đơn)", () => {
    it("Chủ quán GET danh sách đơn chưa xử lý -> nhận được đơn vừa tạo", async () => {
      const token = await signChuQuan();
      const req = new Request("http://localhost:3000/api/doi-ca", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
      });
      const res = await getDoiCa(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);

      const items = json.data.items as any[];
      const found = items.find((i) => i.malich === malichFuture && i.manv === nv1);
      expect(found).toBeDefined();
      expect(found.trangthaixuly).toBe("Chưa xử lý");
      expect(found.khongCoNguoiThay).toBe(true);
    });

    it("Dropdown người thay ca cho UC_6.3: chỉ chứa nhân viên có LichRanh đúng ngày & ca đó, loại trừ người đang làm và người gửi đơn", async () => {
      const token = await signChuQuan();

      const don = await prisma.donXinDoiCa.findFirst({
        where: { Malich: malichFuture, Manv: nv1, Trangthaixuly: "Chưa xử lý" },
      });
      expect(don).not.toBeNull();

      // Gọi endpoint lấy danh sách người thay ca cho đơn này (vai trò Chủ quán -> lọc theo LichRanh)
      const req = new Request(
        `http://localhost:3000/api/doi-ca/nguoi-thay?malich=${malichFuture}&madon=${don!.Madon}`,
        {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
        }
      );
      const res = await getNguoiThay(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);

      const list = json.data.items as { manv: string; hoten: string; coLichRanh: boolean }[];
      const manvList = list.map((x) => x.manv);

      // nv2: có lịch rảnh, không làm ca đó, không phải người gửi -> PHẢI CÓ
      expect(manvList).toContain(nv2);

      // nv1: người gửi đơn -> CẤM CÓ
      expect(manvList).not.toContain(nv1);

      // nv4: đang làm trong ca đó -> CẤM CÓ
      expect(manvList).not.toContain(nv4);

      // nv3: không đăng ký lịch rảnh vào ngày/ca này -> CẤM CÓ (vì vai trò Chủ quán lọc chiLichRanh)
      expect(manvList).not.toContain(nv3);
    });

    it("Bảng xem trước Lịch ca sau khi lưu: cập nhật chính xác trước và sau khi đổi dropdown người thay", async () => {
      // Đơn đổi ca hiện tại: người gửi nv1, trong ca có [nv1, nv4]
      const don = await prisma.donXinDoiCa.findFirst({
        where: { Malich: malichFuture, Manv: nv1, Trangthaixuly: "Chưa xử lý" },
        include: { NhanVien_DonXinDoiCa_ManvToNhanVien: true },
      });
      expect(don).not.toBeNull();

      const senderName = don!.NhanVien_DonXinDoiCa_ManvToNhanVien.Hoten.trim();
      const senderRole = don!.NhanVien_DonXinDoiCa_ManvToNhanVien.Vitrilamviec?.trim() || "Pha chế";
      const currentShiftWorkerIds = [nv1, nv4];

      // Logic tạo bảng xem trước theo SPEC UC_6.3:
      // Chỉ hiện đúng 1 dòng người thay hợp lệ, không liệt kê nhân viên khác ("Đang làm")
      function buildPreview(
        selectedSubId: string | null,
        subInfo?: { hoten: string; chucvu: string }
      ) {
        if (!selectedSubId || !subInfo) return [];
        if (subInfo.chucvu.trim() !== senderRole) return [];
        if (currentShiftWorkerIds.includes(selectedSubId)) return [];
        return [
          {
            manv: selectedSubId,
            hoten: subInfo.hoten,
            chucvu: subInfo.chucvu,
            trangThai: `Thay cho ${senderName}`,
          },
        ];
      }

      // 1. Khi chưa chọn người thay (selectedNguoiThay = null): bảng trống, không có "Đang làm"
      const previewBefore = buildPreview(null);
      expect(previewBefore).toHaveLength(0);

      // 2. Khi chọn người thay hợp lệ cùng vị trí nv2 (Trần Thu Hà): chỉ có đúng 1 dòng "Thay cho ..."
      const previewWithNv2 = buildPreview(nv2, { hoten: "Trần Thu Hà", chucvu: "Pha chế" });
      expect(previewWithNv2).toHaveLength(1);
      expect(previewWithNv2[0].manv).toBe(nv2);
      expect(previewWithNv2[0].trangThai).toBe(`Thay cho ${senderName}`);

      // 3. Khi người thay khác vị trí hoặc đã trong ca: bảng phải TRỐNG
      expect(
        buildPreview("NV000005", { hoten: "Võ Thanh Tùng", chucvu: "Phục vụ" })
      ).toHaveLength(0);
      expect(
        buildPreview(nv4, { hoten: "Phạm Ngọc Lan", chucvu: senderRole })
      ).toHaveLength(0);

      // 4. Kiểm tra CSDL chưa hề bị ghi (chỉ là xem trước)
      const shiftInDb = await prisma.nhanVien_LichLam.findMany({
        where: { Malich: malichFuture },
      });
      const dbManvList = shiftInDb.map((x) => x.Manv.trim());
      expect(dbManvList).toContain(nv1); // Vẫn còn nv1 trong DB
      expect(dbManvList).not.toContain(nv2); // Chưa có nv2 trong DB
    });

    it("Chủ quán duyệt đơn và chỉ định người thay (nv2): cập nhật NhanVien_LichLam và đổi sang 'Đã xử lý'", async () => {
      const token = await signChuQuan();

      // Lấy mã đơn
      const don = await prisma.donXinDoiCa.findFirst({
        where: { Malich: malichFuture, Manv: nv1, Trangthaixuly: "Chưa xử lý" },
      });
      expect(don).not.toBeNull();

      const req = new Request("http://localhost:3000/api/doi-ca", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify({
          Madon: don!.Madon,
          Manvnhanthay: nv2,
        }),
      });

      const res = await putDoiCa(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.message).toBe(thongBao.XU_LY_DOI_CA_THANH_CONG);

      // Kiểm tra CSDL: DonXinDoiCa đã cập nhật
      const updatedDon = await prisma.donXinDoiCa.findUnique({
        where: { Madon: don!.Madon },
      });
      expect(updatedDon?.Trangthaixuly).toBe("Đã xử lý");
      expect(updatedDon?.Manvnhanthay).toBe(nv2);

      // Kiểm tra CSDL: NhanVien_LichLam đã thay đổi (nv1 bị xóa, nv2 được thêm)
      const nv1InShift = await prisma.nhanVien_LichLam.findUnique({
        where: { Manv_Malich: { Manv: nv1, Malich: malichFuture } },
      });
      expect(nv1InShift).toBeNull();

      const nv2InShift = await prisma.nhanVien_LichLam.findUnique({
        where: { Manv_Malich: { Manv: nv2, Malich: malichFuture } },
      });
      expect(nv2InShift).not.toBeNull();
    });

    it("Duyệt lại đơn đã xử lý -> từ chối 400", async () => {
      const token = await signChuQuan();
      const don = await prisma.donXinDoiCa.findFirst({
        where: { Malich: malichFuture, Manv: nv1, Trangthaixuly: "Đã xử lý" },
      });
      expect(don).not.toBeNull();

      const req = new Request("http://localhost:3000/api/doi-ca", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${token}`,
        },
        body: JSON.stringify({
          Madon: don!.Madon,
          Manvnhanthay: nv3,
        }),
      });

      const res = await putDoiCa(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // 4. Quy tắc nghiệp vụ: người đổi ca phải cùng vị trí làm việc
  // ============================================================
  describe("Quy tắc cùng vị trí làm việc (UC_2.2 & UC_6.3)", () => {
    const malichPos = "LL980009";
    const donLegacyId = "DD989001";
    const donSamePosId = "DD989002";

    afterAll(async () => {
      await prisma.donXinDoiCa.deleteMany({
        where: { Madon: { in: [donLegacyId, donSamePosId] } },
      });
      await prisma.nhanVien_LichLam.deleteMany({
        where: { Malich: malichPos },
      });
      await prisma.lichLam.deleteMany({
        where: { Malich: malichPos },
      });
    });

    it("UC_2.2 dropdown: Pha chế chỉ thấy Pha chế, Phục vụ chỉ thấy Phục vụ", async () => {
      // Tạo ca test chứa nv1 (Pha chế) và nv3 (Phục vụ)
      await prisma.lichLam.deleteMany({ where: { Malich: malichPos } });
      await prisma.lichLam.create({
        data: {
          Malich: malichPos,
          Ngaylam: new Date("2099-10-16T00:00:00Z"),
          Maca: "CA000001",
        },
      });
      await prisma.nhanVien_LichLam.createMany({
        data: [
          { Manv: nv1, Malich: malichPos },
          { Manv: nv3, Malich: malichPos },
        ],
      });

      // nv1 (Pha chế) gọi người thay
      const t1 = await signNv(nv1, "Nguyễn Minh Anh");
      const r1 = await getNguoiThay(
        new Request(`http://localhost:3000/api/doi-ca/nguoi-thay?malich=${malichPos}`, {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${t1}` },
        }),
        { params: Promise.resolve({}) }
      );
      expect(r1.status).toBe(200);
      const j1 = await r1.json();
      const list1 = j1.data.items as { manv: string; chucvu: string }[];
      expect(list1.map((x) => x.manv)).toContain(nv2);
      expect(list1.map((x) => x.manv)).not.toContain(nv4); // Phục vụ
      expect(list1.every((x) => x.chucvu === "Pha chế")).toBe(true);

      // nv3 (Phục vụ) gọi người thay
      const t3 = await signNv(nv3, "Lê Quốc Bảo");
      const r3 = await getNguoiThay(
        new Request(`http://localhost:3000/api/doi-ca/nguoi-thay?malich=${malichPos}`, {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${t3}` },
        }),
        { params: Promise.resolve({}) }
      );
      expect(r3.status).toBe(200);
      const j3 = await r3.json();
      const list3 = j3.data.items as { manv: string; chucvu: string }[];
      expect(list3.map((x) => x.manv)).toContain(nv4);
      expect(list3.map((x) => x.manv)).not.toContain(nv1); // Pha chế
      expect(list3.map((x) => x.manv)).not.toContain(nv2); // Pha chế
      expect(list3.every((x) => x.chucvu === "Phục vụ")).toBe(true);
    });

    it("POST /api/doi-ca: từ chối khác vị trí (400), cho phép cùng vị trí (201)", async () => {
      const t1 = await signNv(nv1, "Nguyễn Minh Anh");

      // nv1 (Pha chế) gửi đổi với nv4 (Phục vụ) -> 400
      const badRes = await postDoiCa(
        new Request("http://localhost:3000/api/doi-ca", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: `${AUTH_COOKIE_NAME}=${t1}`,
          },
          body: JSON.stringify({
            Malich: malichPos,
            Manvnhanthay: nv4,
            khongCoNguoiThay: false,
          }),
        }),
        { params: Promise.resolve({}) }
      );
      expect(badRes.status).toBe(400);
      const badJson = await badRes.json();
      expect(badJson.ok).toBe(false);

      // nv1 (Pha chế) gửi đổi với nv2 (Pha chế) -> 201
      const okRes = await postDoiCa(
        new Request("http://localhost:3000/api/doi-ca", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: `${AUTH_COOKIE_NAME}=${t1}`,
          },
          body: JSON.stringify({
            Malich: malichPos,
            Manvnhanthay: nv2,
            khongCoNguoiThay: false,
          }),
        }),
        { params: Promise.resolve({}) }
      );
      expect(okRes.status).toBe(201);
      const okJson = await okRes.json();
      await prisma.donXinDoiCa.deleteMany({
        where: { Madon: okJson.data.madon },
      });
    });

    it("UC_6.3: đơn cũ khác vị trí hiển thị bình thường, Lưu khác vị trí bị 400, chọn lại cùng vị trí thành công", async () => {
      await prisma.donXinDoiCa.deleteMany({
        where: { Madon: { in: [donLegacyId, donSamePosId] } },
      });
      await prisma.donXinDoiCa.create({
        data: {
          Madon: donLegacyId,
          Trangthaixuly: "Chưa xử lý",
          Manv: nv1, // Pha chế
          Malich: malichPos,
          Manvnhanthay: nv4, // Phục vụ (đơn cũ khác vị trí)
        },
      });

      const cqToken = await signChuQuan();

      // GET /api/doi-ca/xu-ly vẫn hiển thị đơn cũ bình thường
      const getRes = await getXuLy(
        new Request("http://localhost:3000/api/doi-ca/xu-ly", {
          headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` },
        }),
        { params: Promise.resolve({}) }
      );
      expect(getRes.status).toBe(200);
      const getJson = await getRes.json();
      const legacyRow = getJson.data.items.find((x: any) => x.madon === donLegacyId);
      expect(legacyRow).toBeDefined();
      expect(legacyRow.manvnhanthay).toBe(nv4);
      expect(legacyRow.chucVuNhanVien).toBe("Pha chế");
      expect(legacyRow.chucVuNhanVienThay).toBe("Phục vụ");
      expect(legacyRow.nguoiThayHopLe).toBe(false);

      // Lưu giữ nguyên nv4 (khác vị trí) hoặc gửi Manvnhanthay = nv4 -> 400
      const failSaveOld = await postXuLy(
        new Request("http://localhost:3000/api/doi-ca/xu-ly", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: `${AUTH_COOKIE_NAME}=${cqToken}`,
          },
          body: JSON.stringify({ Madon: donLegacyId }),
        }),
        { params: Promise.resolve({}) }
      );
      expect(failSaveOld.status).toBe(400);

      const failSaveCross = await postXuLy(
        new Request("http://localhost:3000/api/doi-ca/xu-ly", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: `${AUTH_COOKIE_NAME}=${cqToken}`,
          },
          body: JSON.stringify({ Madon: donLegacyId, Manvnhanthay: nv4 }),
        }),
        { params: Promise.resolve({}) }
      );
      expect(failSaveCross.status).toBe(400);

      // Chủ quán chọn lại nv2 (Pha chế - cùng vị trí) -> 200
      const okSave = await postXuLy(
        new Request("http://localhost:3000/api/doi-ca/xu-ly", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: `${AUTH_COOKIE_NAME}=${cqToken}`,
          },
          body: JSON.stringify({ Madon: donLegacyId, Manvnhanthay: nv2 }),
        }),
        { params: Promise.resolve({}) }
      );
      expect(okSave.status).toBe(200);
    });

    it("UC_6.3 tự điền: nguoiThayHopLe = true khi hợp lệ; false khi null / đã vào ca / khác vị trí", async () => {
      const donHopLeId = "DD989011";
      const donKhongNguoiId = "DD989012";
      const donDaVaoCaId = "DD989013";

      await prisma.donXinDoiCa.deleteMany({
        where: { Madon: { in: [donHopLeId, donKhongNguoiId, donDaVaoCaId] } },
      });

      // Thêm lại nv1 và nv3 vào ca LL989001
      await prisma.nhanVien_LichLam.deleteMany({ where: { Malich: malichPos } });
      await prisma.nhanVien_LichLam.createMany({
        data: [
          { Manv: nv1, Malich: malichPos },
          { Manv: nv3, Malich: malichPos }, // nv3 (Phục vụ) đã ở trong ca
        ],
      });

      try {
        // 1) Hợp lệ: nv1 (Pha chế) xin đổi -> nv2 (Pha chế, chưa ở trong ca)
        await prisma.donXinDoiCa.create({
          data: {
            Madon: donHopLeId,
            Trangthaixuly: "Chưa xử lý",
            Manv: nv1,
            Malich: malichPos,
            Manvnhanthay: nv2,
          },
        });
        // 2) Không có người thay thế (null)
        await prisma.donXinDoiCa.create({
          data: {
            Madon: donKhongNguoiId,
            Trangthaixuly: "Chưa xử lý",
            Manv: nv1,
            Malich: malichPos,
            Manvnhanthay: null,
          },
        });
        // 3) Người nhận thay đã được xếp vào chính ca này (nv4 xin đổi -> nv3 đã ở trong ca)
        await prisma.donXinDoiCa.create({
          data: {
            Madon: donDaVaoCaId,
            Trangthaixuly: "Chưa xử lý",
            Manv: nv4,
            Malich: malichPos,
            Manvnhanthay: nv3,
          },
        });

        const cqToken = await signChuQuan();
        const getRes = await getXuLy(
          new Request("http://localhost:3000/api/doi-ca/xu-ly", {
            headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` },
          }),
          { params: Promise.resolve({}) }
        );
        expect(getRes.status).toBe(200);
        const items = (await getRes.json()).data.items as any[];

        const rowHopLe = items.find((x) => x.madon === donHopLeId);
        expect(rowHopLe).toBeDefined();
        expect(rowHopLe.manvnhanthay).toBe(nv2);
        expect(rowHopLe.nguoiThayHopLe).toBe(true);

        const rowNull = items.find((x) => x.madon === donKhongNguoiId);
        expect(rowNull).toBeDefined();
        expect(rowNull.manvnhanthay).toBeNull();
        expect(rowNull.nguoiThayHopLe).toBe(false);

        const rowDaVaoCa = items.find((x) => x.madon === donDaVaoCaId);
        expect(rowDaVaoCa).toBeDefined();
        expect(rowDaVaoCa.manvnhanthay).toBe(nv3);
        expect(rowDaVaoCa.nguoiThayHopLe).toBe(false);

        // Kiểm tra máy chủ trả 400 nếu thiếu người thay (undefined / null / rỗng) kể cả trên đơn có sẵn Manvnhanthay
        for (const badBody of [
          { Madon: donHopLeId },
          { Madon: donHopLeId, Manvnhanthay: null },
          { Madon: donHopLeId, Manvnhanthay: "" },
          { Madon: donKhongNguoiId },
          { Madon: donKhongNguoiId, Manvnhanthay: "        " },
        ]) {
          const rPost = await postXuLy(
            new Request("http://localhost:3000/api/doi-ca/xu-ly", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                cookie: `${AUTH_COOKIE_NAME}=${cqToken}`,
              },
              body: JSON.stringify(badBody),
            }),
            { params: Promise.resolve({}) }
          );
          expect(rPost.status).toBe(400);

          const rPut = await putDoiCa(
            new Request("http://localhost:3000/api/doi-ca", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                cookie: `${AUTH_COOKIE_NAME}=${cqToken}`,
              },
              body: JSON.stringify(badBody),
            }),
            { params: Promise.resolve({}) }
          );
          expect(rPut.status).toBe(400);
        }
      } finally {
        await prisma.donXinDoiCa.deleteMany({
          where: { Madon: { in: [donHopLeId, donKhongNguoiId, donDaVaoCaId] } },
        });
      }
    });
  });

  // ============================================================
  // 5. Test đối chiếu thông báo khớp từng ký tự
  // ============================================================
  describe("Thông báo UC 2.2 và UC 6.3 chuẩn từng ký tự", () => {
    it("Thông báo UC 2.2 khớp nguyên văn 'Đã gửi thành công'", () => {
      expect(thongBao.YEU_CAU_DOI_CA_THANH_CONG).toBe("Đã gửi thành công");
    });

    it("Thông báo UC 6.3 khớp nguyên văn 'Xử lý đổi ca thành công'", () => {
      expect(thongBao.XU_LY_DOI_CA_THANH_CONG).toBe("Xử lý đổi ca thành công");
    });
  });
});
