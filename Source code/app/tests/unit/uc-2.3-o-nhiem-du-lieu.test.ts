import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { prisma } from "@database/client";
import { signSession, AUTH_COOKIE_NAME, UserPayload } from "@backend/lib/auth";
import { POST as postThayCa } from "@/app/api/thay-ca/route";
import { POST as postChapNhan } from "@/app/api/thay-ca/[id]/chap-nhan/route";
import { POST as postTuChoi } from "@/app/api/thay-ca/[id]/tu-choi/route";
import { GET as getXuLyDoiCa, POST as postXuLyDoiCa } from "@/app/api/doi-ca/xu-ly/route";
import { GET as getNguoiThay } from "@/app/api/doi-ca/nguoi-thay/route";
import { GET as getCaCuaToi } from "@/app/api/doi-ca/ca-cua-toi/route";
import { POST as postDoiCa } from "@/app/api/doi-ca/route";
import { GET as getXuLyBoSung, POST as postXuLyBoSung } from "@/app/api/bo-sung-cc/xu-ly/route";
import { GET as getChuQuanTongQuan } from "@/app/api/chu-quan/tong-quan/route";
import { GET as getNhanVienTongQuanApi } from "@/app/api/nhan-vien/tong-quan/route";
import { GET as getThongBao } from "@/app/api/thong-bao/route";
import { GET as getBaoCaoChamCong } from "@/app/api/bao-cao/cham-cong/route";
import { DELETE as deleteNhanVienRoute } from "@/app/api/chu-quan/nhan-vien/[id]/route";
import {
  clearThayCaMapForTest,
  layCaTrongNgayChoThayCa,
  layYeuCauThayCaDangMo,
  layCanhBaoThayCaChoChuQuan,
} from "@backend/services/thay-ca";
import { layCaThieuChamCong, guiYeuCauBoSungCC } from "@backend/services/bo-sung-cc";
import { layDanhSachQuenChamCong } from "@backend/services/bao-cao-cham-cong";
import { getYeuCauCanXuLyList } from "@backend/services/yeu-cau-can-xu-ly";
import { getNhanVienThongBaoList } from "@backend/services/tong-quan";
import { xemTruocTinhLuong, guiBangLuongDuKien } from "@backend/services/tinh-luong";
import { layBangLuongMoiNhat } from "@backend/services/xem-bang-luong";

describe("UC_2.3 - Kiểm tra chống ô nhiễm dữ liệu, hết hạn, không trùng mã, xóa NV & khóa pooled", () => {
  const testDateStr = "2098-11-20";
  const testPastDateStr = "2098-11-19";
  const testFutureDateStr = "2098-11-25";

  const nvSender = "NV980001"; // Pha chế - xin thay ca gấp (TC)
  const nvDecliner = "NV980002"; // Pha chế - rảnh, từ chối (TD)
  const nvAccepter = "NV980003"; // Pha chế - rảnh, chấp nhận (TC -> Manvnhanthay)
  const nvOther = "NV980004"; // Pha chế - test UC_2.2, UC_7.1/3.3, UC_7.2, lương, TC hết hạn

  const llToi = "LL980001"; // 2098-11-20 Ca Tối (17:00-22:00)
  const llSang = "LL980002"; // 2098-11-20 Ca Sáng (06:00-11:30) -> hết hạn ở 15:00
  const llChieu = "LL980005"; // 2098-11-20 Ca Chiều (11:30-17:00) -> còn mở ở 15:00 để đua song song
  const llFuture = "LL980003"; // 2098-11-25 Ca Chiều (11:30-17:00) -> ca tương lai
  const llPast = "LL980004"; // 2098-11-19 Ca Sáng (06:00-11:30) -> có CC + thiếu CC test

  const lr1 = "LR980001";
  const lr2 = "LR980002";
  const lr3 = "LR980003";
  const lr4 = "LR980004";
  const ccValid = "CC980001";
  const klTest = "KL981101";

  const trackedDonIds: string[] = [];
  const trackedYcIds: string[] = [];

  let cqToken = "";
  let nvSenderToken = "";
  let nvDeclinerToken = "";
  let nvAccepterToken = "";
  let nvOtherToken = "";

  const cqUser: UserPayload = {
    userId: "CQ000001",
    username: "chuquan",
    role: "ChuQuan",
    name: "Hoàng Lan",
  };

  async function cleanupTestData() {
    const allNvs = [nvSender, nvDecliner, nvAccepter, nvOther];
    const allLichs = [llToi, llSang, llChieu, llFuture, llPast];
    const allLrs = [lr1, lr2, lr3, lr4];

    const bangLuongs = await prisma.bangLuong.findMany({
      where: {
        OR: [{ Makyluong: klTest }, { Manv: { in: allNvs } }],
      },
      select: { Mabangluong: true },
    });
    const bangIds = bangLuongs.map((b) => b.Mabangluong);
    if (bangIds.length > 0) {
      await prisma.phanHoiLuong.deleteMany({
        where: { Mabangluong: { in: bangIds } },
      });
      await prisma.chiTietBangLuong.deleteMany({
        where: { Mabangluong: { in: bangIds } },
      });
      await prisma.bangLuong.deleteMany({
        where: { Mabangluong: { in: bangIds } },
      });
    }
    await prisma.kyLuong.deleteMany({ where: { Makyluong: klTest } });

    await prisma.yeuCauBoSungCC.deleteMany({
      where: {
        OR: [
          { Mayeucau: { in: ["TC990001", ...trackedYcIds, ...trackedDonIds] } },
          { Malich: { in: allLichs } },
          { Manv: { in: allNvs } },
        ],
      },
    });
    await prisma.donXinDoiCa.deleteMany({
      where: {
        OR: [
          { Madon: { in: ["TC990001", "TD990001", ...trackedDonIds] } },
          { Malich: { in: allLichs } },
          { Manv: { in: allNvs } },
          { Manvnhanthay: { in: allNvs } },
        ],
      },
    });
    await prisma.chamCong.deleteMany({
      where: {
        OR: [
          { Machamcong: ccValid },
          { Malich: { in: allLichs } },
          { Manv: { in: allNvs } },
        ],
      },
    });
    await prisma.nhanVien_LichLam.deleteMany({
      where: {
        OR: [{ Malich: { in: allLichs } }, { Manv: { in: allNvs } }],
      },
    });
    await prisma.lichLam.deleteMany({ where: { Malich: { in: allLichs } } });
    await prisma.lichRanh.deleteMany({
      where: {
        OR: [{ Malichranh: { in: allLrs } }, { Manv: { in: allNvs } }],
      },
    });
    await prisma.nhanVien.deleteMany({ where: { Manv: { in: allNvs } } });
  }

  async function seedBaseScenario() {
    await cleanupTestData();

    const makeNv = (manv: string, hoten: string, sdt: string) => ({
      Manv: manv,
      Tendangnhap: manv,
      Matkhau: "test:tag:cipher",
      Hoten: hoten,
      Sdt: sdt,
      Diachi: "Đà Nẵng",
      Truonghoc: "ĐH Bách khoa",
      Vitrilamviec: "Pha chế",
      Hinhthuclam: "Part-time",
      Ngayvaolam: new Date("2025-01-01T00:00:00Z"),
      Kinhnghiem: "1 năm",
      Trangthai: "Chính thức",
      Mucluongtheogio: 20000,
    });

    await prisma.nhanVien.createMany({
      data: [
        makeNv(nvSender, "NV Test Gui TC", "0998000001"),
        makeNv(nvDecliner, "NV Test Tu Choi TD", "0998000002"),
        makeNv(nvAccepter, "NV Test Nhan TC", "0998000003"),
        makeNv(nvOther, "NV Test Khac", "0998000004"),
      ],
    });

    const todayDb = new Date(`${testDateStr}T00:00:00Z`);
    const pastDb = new Date(`${testPastDateStr}T00:00:00Z`);
    const futureDb = new Date(`${testFutureDateStr}T00:00:00Z`);

    await prisma.lichLam.createMany({
      data: [
        { Malich: llToi, Ngaylam: todayDb, Maca: "CA000003" },
        { Malich: llSang, Ngaylam: todayDb, Maca: "CA000001" },
        { Malich: llChieu, Ngaylam: todayDb, Maca: "CA000002" },
        { Malich: llFuture, Ngaylam: futureDb, Maca: "CA000002" },
        { Malich: llPast, Ngaylam: pastDb, Maca: "CA000001" },
      ],
    });

    await prisma.nhanVien_LichLam.createMany({
      data: [
        { Manv: nvSender, Malich: llToi },
        { Manv: nvSender, Malich: llFuture },
        { Manv: nvOther, Malich: llSang },
        { Manv: nvOther, Malich: llChieu },
        { Manv: nvOther, Malich: llPast },
        { Manv: nvAccepter, Malich: llFuture },
      ],
    });

    await prisma.lichRanh.createMany({
      data: [
        { Malichranh: lr1, Manv: nvDecliner, Ngayranh: todayDb, Caranh: "CA000003" },
        { Malichranh: lr2, Manv: nvAccepter, Ngayranh: todayDb, Caranh: "CA000003" },
        { Malichranh: lr3, Manv: nvDecliner, Ngayranh: futureDb, Caranh: "CA000002" },
        { Malichranh: lr4, Manv: nvDecliner, Ngayranh: todayDb, Caranh: "CA000001" },
      ],
    });
  }

  async function createUrgentInvite(token: string, malich: string, lyDo: string) {
    const res = await postThayCa(
      new Request("http://localhost:3000/api/thay-ca", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ malich, lyDo }),
      }),
      { params: Promise.resolve({}) }
    );
    const json = await res.json();
    if (res.status === 201 && json?.data?.yeuCau?.id) {
      trackedDonIds.push(json.data.yeuCau.id);
    }
    return { res, json };
  }

  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || randomBytes(32).toString("hex");

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${testDateStr}T08:00:00Z`)); // 15:00 VN

    cqToken = await signSession(cqUser);
    nvSenderToken = await signSession({
      userId: nvSender,
      username: nvSender,
      role: "NhanVien",
      name: "NV Test Gui TC",
    });
    nvDeclinerToken = await signSession({
      userId: nvDecliner,
      username: nvDecliner,
      role: "NhanVien",
      name: "NV Test Tu Choi TD",
    });
    nvAccepterToken = await signSession({
      userId: nvAccepter,
      username: nvAccepter,
      role: "NhanVien",
      name: "NV Test Nhan TC",
    });
    nvOtherToken = await signSession({
      userId: nvOther,
      username: nvOther,
      role: "NhanVien",
      name: "NV Test Khac",
    });
  });

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 15:00 VN -> Ca Tối (17:00-22:00) chưa bắt đầu, Ca Sáng (06:00-11:30) đã kết thúc
    vi.setSystemTime(new Date(`${testDateStr}T08:00:00Z`));
    await clearThayCaMapForTest();
    trackedDonIds.length = 0;
    trackedYcIds.length = 0;
    await seedBaseScenario();
  });

  afterAll(async () => {
    vi.useRealTimers();
    await clearThayCaMapForTest();
    await cleanupTestData();
  });

  it("1. Dữ liệu TC/TD của UC_2.3 KHÔNG lọt vào UC_6.3, UC_7.1, màn hình chính, thông báo, UC_7.2 và UC_2.2", async () => {
    // Tạo 1 TC đang mở (llToi), 1 TD từ chối bởi nvDecliner
    const { res: createRes, json: createJson } = await createUrgentInvite(
      nvSenderToken,
      llToi,
      "Test chống ô nhiễm TC/TD"
    );
    expect(createRes.status).toBe(201);
    const tcOpenId = createJson.data.yeuCau.id as string;
    expect(tcOpenId).toMatch(/^TC\d{6}$/);

    const decRes = await postTuChoi(
      new Request(`http://localhost:3000/api/thay-ca/${tcOpenId}/tu-choi`, {
        method: "POST",
        headers: { cookie: `${AUTH_COOKIE_NAME}=${nvDeclinerToken}` },
      }),
      { params: Promise.resolve({ id: tcOpenId }) }
    );
    expect(decRes.status).toBe(200);

    const tdRow = await prisma.donXinDoiCa.findFirst({
      where: {
        Madon: { startsWith: "TD" },
        Manv: nvSender,
        Malich: llToi,
        Manvnhanthay: nvDecliner,
      },
      select: { Madon: true },
    });
    expect(tdRow).not.toBeNull();
    const tdId = tdRow!.Madon.trim();
    trackedDonIds.push(tdId);

    // Chèn thêm 1 dòng TC hết hạn ở Ca Sáng hôm nay (chưa được đóng) để xác minh lọc/đóng
    const expiredTcId = "TC980999";
    trackedDonIds.push(expiredTcId);
    await prisma.donXinDoiCa.create({
      data: {
        Madon: expiredTcId,
        Trangthaixuly: "Chưa xử lý",
        Manv: nvOther,
        Malich: llSang,
        Manvnhanthay: null,
      },
    });
    await prisma.yeuCauBoSungCC.create({
      data: {
        Mayeucau: expiredTcId,
        Giovaobosung: null,
        Giorabosung: new Date("1970-01-01T10:00:00Z"),
        Lydo: "Yêu cầu hết hạn test",
        Trangthai: "Đã xử lý",
        Manv: nvOther,
        Malich: llSang,
      },
    });

    // (a) UC_6.3 Xử lý đổi ca: danh sách & số đếm KHÔNG chứa TC/TD; POST xử lý & gợi ý theo madon từ chối TC/TD
    const uc63Res = await getXuLyDoiCa(
      new Request("http://localhost:3000/api/doi-ca/xu-ly", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` },
      }),
      { params: Promise.resolve({}) }
    );
    expect(uc63Res.status).toBe(200);
    const uc63Json = await uc63Res.json();
    const uc63Ids = (uc63Json.data.items as Array<{ madon: string }>).map((x) => x.madon);
    expect(uc63Ids).not.toContain(tcOpenId);
    expect(uc63Ids).not.toContain(tdId);
    expect(uc63Ids).not.toContain(expiredTcId);
    expect(uc63Ids.every((id) => id.startsWith("DD"))).toBe(true);

    const ddPendingDbCount = await prisma.donXinDoiCa.count({
      where: { Madon: { startsWith: "DD" }, Trangthaixuly: "Chưa xử lý" },
    });
    expect(uc63Json.data.items).toHaveLength(ddPendingDbCount);

    for (const nonDdId of [tcOpenId, tdId]) {
      const rejectProcess = await postXuLyDoiCa(
        new Request("http://localhost:3000/api/doi-ca/xu-ly", {
          method: "POST",
          headers: {
            cookie: `${AUTH_COOKIE_NAME}=${cqToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ Madon: nonDdId, Manvnhanthay: nvAccepter }),
        }),
        { params: Promise.resolve({}) }
      );
      expect(rejectProcess.status).toBe(404);
    }

    const nguoiThayWrongMadon = await getNguoiThay(
      new Request(
        `http://localhost:3000/api/doi-ca/nguoi-thay?madon=${tcOpenId}&malich=${llFuture}`,
        { headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` } }
      ),
      { params: Promise.resolve({}) }
    );
    const ntJson = await nguoiThayWrongMadon.json();
    expect(ntJson.data.items).toEqual([]);

    const nguoiThayOnlyTcMadon = await getNguoiThay(
      new Request(
        `http://localhost:3000/api/doi-ca/nguoi-thay?madon=${tdId}`,
        { headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` } }
      ),
      { params: Promise.resolve({}) }
    );
    expect((await nguoiThayOnlyTcMadon.json()).data.items).toEqual([]);

    // Chèn 1 TC (không phải YC) vào YeuCauBoSungCC cho (nvOther, llPast) để kiểm tra UC_3.3 + UC_7.1 lọc đúng loại
    await prisma.yeuCauBoSungCC.create({
      data: {
        Mayeucau: "TC980777",
        Giovaobosung: null,
        Giorabosung: new Date("1970-01-01T10:00:00Z"),
        Lydo: "Dòng TC dùng chung bảng trên ca thiếu CC",
        Trangthai: "Đã xử lý",
        Manv: nvOther,
        Malich: llPast,
      },
    });
    trackedYcIds.push("TC980777");

    // nvOther vẫn gửi được yêu cầu YC hợp lệ trên llPast (không bị TC980777 chặn trùng)
    const ycReal = await guiYeuCauBoSungCC(nvOther, {
      malich: llPast,
      loaiYeuCau: "Quên check-in",
      giovaobosung: "06:00",
      giorabosung: "11:30",
      lydo: "Test UC_3.3 cùng tồn tại TC",
    });
    trackedYcIds.push(ycReal.mayeucau);
    expect(ycReal.mayeucau).toMatch(/^YC\d{6}$/);

    // (b) UC_7.1 Bổ sung chấm công: danh sách & số đếm KHÔNG chứa TC; POST xử lý từ chối mã TC
    const uc71Res = await getXuLyBoSung(
      new Request("http://localhost:3000/api/bo-sung-cc/xu-ly?page=1&limit=100", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` },
      }),
      { params: Promise.resolve({}) }
    );
    expect(uc71Res.status).toBe(200);
    const uc71Json = await uc71Res.json();
    const uc71Ids = (uc71Json.data.items as Array<{ mayeucau: string }>).map(
      (x) => x.mayeucau
    );
    expect(uc71Ids).toContain(ycReal.mayeucau);
    expect(uc71Ids).not.toContain(tcOpenId);
    expect(uc71Ids).not.toContain(expiredTcId);
    expect(uc71Ids).not.toContain("TC980777");
    expect(uc71Ids.every((id) => id.startsWith("YC"))).toBe(true);

    const ycPendingDbCount = await prisma.yeuCauBoSungCC.count({
      where: { Mayeucau: { startsWith: "YC" }, Trangthai: "Chưa xử lý" },
    });
    expect(uc71Json.data.total).toBe(ycPendingDbCount);

    const rejectYcProcess = await postXuLyBoSung(
      new Request("http://localhost:3000/api/bo-sung-cc/xu-ly", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${cqToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          mayeucau: tcOpenId,
          giorabosung: "22:00",
        }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(rejectYcProcess.status).toBe(404);

    // Người từ chối (TD) không bị nhận nhầm quyền bổ sung chấm công ca llToi
    const declinerMissing = await layCaThieuChamCong(nvDecliner);
    expect(declinerMissing.some((c) => c.malich === llToi)).toBe(false);

    // (c) Màn hình chính Chủ quán, Nhân viên & Chuông thông báo
    const cqDashRes = await getChuQuanTongQuan(
      new Request("http://localhost:3000/api/chu-quan/tong-quan", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` },
      }),
      { params: Promise.resolve({}) }
    );
    expect(cqDashRes.status).toBe(200);
    const cqDash = (await cqDashRes.json()).data;

    const phPendingCount = await prisma.phanHoiLuong.count({
      where: { Trangthai: "Chưa xử lý" },
    });
    expect(cqDash.thongKe.yeuCauCanXuLy).toBe(
      ddPendingDbCount + ycPendingDbCount + phPendingCount
    );
    expect(cqDash.danhSachYeuCau).toHaveLength(cqDash.thongKe.yeuCauCanXuLy);
    expect(
      cqDash.danhSachYeuCau.some(
        (y: { id: string }) => y.id.startsWith("TC") || y.id.startsWith("TD")
      )
    ).toBe(false);

    const rawYeuCauList = await getYeuCauCanXuLyList();
    expect(
      rawYeuCauList.some((y) => y.id.startsWith("TC") || y.id.startsWith("TD"))
    ).toBe(false);

    // Dòng TC hết hạn đã được đóng và KHÔNG nằm trong cảnh báo hay thông báo chủ quán
    expect(
      (cqDash.canhBaoThayCa ?? []).some((c: { id: string }) => c.id === expiredTcId)
    ).toBe(false);

    const cqBellRes = await getThongBao(
      new Request("http://localhost:3000/api/thong-bao", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` },
      }),
      { params: Promise.resolve({}) }
    );
    const cqBellItems = (await cqBellRes.json()).data.items as Array<{ id: string }>;
    expect(cqBellItems.some((i) => i.id.includes(expiredTcId))).toBe(false);
    expect(cqBellItems.some((i) => i.id.includes(tcOpenId))).toBe(false);
    expect(
      cqBellItems.some(
        (i) => i.id === `YC-${tcOpenId}` || i.id === `YC-${tdId}`
      )
    ).toBe(false);

    // Thông báo & tổng quan nhân viên (người gửi TC hết hạn, người từ chối TD, người được mời)
    const otherNotifs = await getNhanVienThongBaoList(nvOther);
    expect(otherNotifs.some((n) => n.id.includes(expiredTcId))).toBe(false);
    expect(
      otherNotifs.some((n) => n.id.startsWith("DC-TC") || n.id.startsWith("BS-TC"))
    ).toBe(false);

    const declinerNvDashRes = await getNhanVienTongQuanApi(
      new Request("http://localhost:3000/api/nhan-vien/tong-quan", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${nvDeclinerToken}` },
      }),
      { params: Promise.resolve({}) }
    );
    expect(declinerNvDashRes.status).toBe(200);
    const declinerDash = (await declinerNvDashRes.json()).data;
    expect(
      (declinerDash.thongBao ?? []).some(
        (n: { id: string }) =>
          n.id.includes(tcOpenId) || n.id.includes(tdId) || n.id.includes(expiredTcId)
      )
    ).toBe(false);

    // (d) UC_7.2 Báo cáo chấm công & Danh sách quên chấm công
    const bcRes = await getBaoCaoChamCong(
      new Request(
        `http://localhost:3000/api/bao-cao/cham-cong?mode=ngay&ngay=${testDateStr}`,
        { headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` } }
      ),
      { params: Promise.resolve({}) }
    );
    const bcJson = await bcRes.json();
    const reportedManvs = (bcJson.data.items as Array<{ manv: string }>).map(
      (i) => i.manv
    );
    expect(reportedManvs).not.toContain(nvSender);
    expect(reportedManvs).not.toContain(nvDecliner);

    const bcThangRes = await getBaoCaoChamCong(
      new Request(
        `http://localhost:3000/api/bao-cao/cham-cong?mode=thang&thang=2098-11`,
        { headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` } }
      ),
      { params: Promise.resolve({}) }
    );
    expect(bcThangRes.status).toBe(200);
    const bcThangJson = await bcThangRes.json();
    const monthManvs = (bcThangJson.data.items as Array<{ manv: string }>).map(
      (i) => i.manv
    );
    expect(monthManvs).not.toContain(nvSender);
    expect(monthManvs).not.toContain(nvDecliner);

    const quenList = await layDanhSachQuenChamCong({ manv: nvDecliner });
    expect(quenList.some((q) => q.malich === llToi || q.malich === llSang)).toBe(false);
    const quenSenderToday = await layDanhSachQuenChamCong({ manv: nvSender });
    expect(quenSenderToday.some((q) => q.malich === llToi)).toBe(false);

    // (g) UC_2.2 Yêu cầu đổi ca của nhân viên: thêm TC/TD ở llFuture không gây nhầm là đơn DD đang chờ
    await prisma.donXinDoiCa.create({
      data: {
        Madon: "TC980888",
        Trangthaixuly: "Chưa xử lý",
        Manv: nvSender,
        Malich: llFuture,
        Manvnhanthay: null,
      },
    });
    await prisma.donXinDoiCa.create({
      data: {
        Madon: "TD980888",
        Trangthaixuly: "Đã xử lý",
        Manv: nvSender,
        Malich: llFuture,
        Manvnhanthay: nvDecliner,
      },
    });
    trackedDonIds.push("TC980888", "TD980888");

    const caCuaToiRes = await getCaCuaToi(
      new Request("http://localhost:3000/api/doi-ca/ca-cua-toi", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${nvSenderToken}` },
      }),
      { params: Promise.resolve({}) }
    );
    expect(caCuaToiRes.status).toBe(200);
    const caFutureItem = (await caCuaToiRes.json()).data.items.find(
      (c: { malich: string }) => c.malich === llFuture
    );
    expect(caFutureItem).toBeDefined();
    expect(caFutureItem.daGuiYeuCau).toBe(false);

    const postDdRes = await postDoiCa(
      new Request("http://localhost:3000/api/doi-ca", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${nvSenderToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ Malich: llFuture, Manvnhanthay: nvDecliner }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(postDdRes.status).toBe(201);
    const postDdJson = await postDdRes.json();
    expect(postDdJson.data.madon).toMatch(/^DD\d{6}$/);
    trackedDonIds.push(postDdJson.data.madon);
  });

  it("2. Sinh mã TC/TD không trùng mã DD/YC; TC hết hạn được đánh dấu Đã xử lý và không hiện lại", async () => {
    // Tạo sẵn mã TC990001 / TD990001 cao để kiểm tra DD và YC KHÔNG bị nhảy số hay trùng mã
    await prisma.donXinDoiCa.create({
      data: {
        Madon: "TC990001",
        Trangthaixuly: "Đã xử lý",
        Manv: nvOther,
        Malich: llSang,
        Manvnhanthay: null,
      },
    });
    await prisma.yeuCauBoSungCC.create({
      data: {
        Mayeucau: "TC990001",
        Giovaobosung: null,
        Giorabosung: new Date("1970-01-01T10:00:00Z"),
        Lydo: "Giả lập mã TC cao",
        Trangthai: "Đã xử lý",
        Manv: nvOther,
        Malich: llSang,
      },
    });
    await prisma.donXinDoiCa.create({
      data: {
        Madon: "TD990001",
        Trangthaixuly: "Đã xử lý",
        Manv: nvOther,
        Malich: llSang,
        Manvnhanthay: nvDecliner,
      },
    });
    trackedDonIds.push("TC990001", "TD990001");

    const { json: tcNew } = await createUrgentInvite(
      nvSenderToken,
      llToi,
      "Kiểm tra không trùng mã"
    );
    const newTcId = tcNew.data.yeuCau.id as string;
    expect(newTcId).toBe("TC990002");

    // Sinh DD (UC_2.2) và YC (UC_3.3) -> hoàn toàn tách tiền tố với TC990002 / TD990001
    const postDd = await postDoiCa(
      new Request("http://localhost:3000/api/doi-ca", {
        method: "POST",
        headers: {
          cookie: `${AUTH_COOKIE_NAME}=${nvSenderToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ Malich: llFuture, Manvnhanthay: nvDecliner }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(postDd.status).toBe(201);
    const ddId = (await postDd.json()).data.madon as string;
    trackedDonIds.push(ddId);
    expect(ddId).toMatch(/^DD\d{6}$/);
    expect(Number(ddId.slice(2))).toBeLessThan(990000);

    const ycRes = await guiYeuCauBoSungCC(nvOther, {
      malich: llPast,
      loaiYeuCau: "Quên check-in",
      giovaobosung: "06:00",
      giorabosung: "11:30",
      lydo: "Kiểm tra không trùng mã YC",
    });
    trackedYcIds.push(ycRes.mayeucau);
    expect(ycRes.mayeucau).toMatch(/^YC\d{6}$/);
    expect(Number(ycRes.mayeucau.slice(2))).toBeLessThan(990000);

    // Kiểm tra lời mời hết hạn: tua thời gian vượt quá 22:00 giờ VN (15:05 UTC = 22:05 VN)
    vi.setSystemTime(new Date(`${testDateStr}T15:05:00Z`));

    // Bấm nhận sau khi ca đã kết thúc -> trả 400 và đánh dấu dòng TC thành Đã xử lý (Đã hủy)
    const lateAccept = await postChapNhan(
      new Request(`http://localhost:3000/api/thay-ca/${newTcId}/chap-nhan`, {
        method: "POST",
        headers: { cookie: `${AUTH_COOKIE_NAME}=${nvAccepterToken}` },
      }),
      { params: Promise.resolve({ id: newTcId }) }
    );
    expect(lateAccept.status).toBe(400);

    const dbAfterExpire = await prisma.donXinDoiCa.findUnique({
      where: { Madon: newTcId },
      select: { Trangthaixuly: true, Manvnhanthay: true },
    });
    expect(dbAfterExpire?.Trangthaixuly).toBe("Đã xử lý");
    expect(dbAfterExpire?.Manvnhanthay).toBeNull();

    // Không còn hiện lại trong các danh sách đang mở, ca trong ngày hoặc cảnh báo chủ quán
    const [dangMoAcc, dangMoSender, caTrongNgay, canhBaoCq] = await Promise.all([
      layYeuCauThayCaDangMo(nvAccepter),
      layYeuCauThayCaDangMo(nvSender),
      layCaTrongNgayChoThayCa(nvSender),
      layCanhBaoThayCaChoChuQuan(),
    ]);
    expect(dangMoAcc.loiMoi.some((x) => x.id === newTcId)).toBe(false);
    expect(dangMoSender.yeuCauCuaToi.some((x) => x.id === newTcId)).toBe(false);
    expect(caTrongNgay.danhSachCa.some((c) => c.yeuCauHienTai?.id === newTcId)).toBe(
      false
    );
    expect(canhBaoCq.canhBaoList.some((x) => x.id === newTcId)).toBe(false);
  });

  it("3. Tính lương, Bảng lương (2098-11) KHÔNG bị ảnh hưởng bởi TC/TD; UC_5.3 xóa NV dọn sạch TC/TD không lỗi FK", async () => {
    // Tạo TC + TD + TC đã chấp nhận
    const { json: c1 } = await createUrgentInvite(nvSenderToken, llToi, "Tính lương + xóa NV");
    const tcId = c1.data.yeuCau.id as string;

    await postTuChoi(
      new Request(`http://localhost:3000/api/thay-ca/${tcId}/tu-choi`, {
        method: "POST",
        headers: { cookie: `${AUTH_COOKIE_NAME}=${nvDeclinerToken}` },
      }),
      { params: Promise.resolve({ id: tcId }) }
    );

    const acc = await postChapNhan(
      new Request(`http://localhost:3000/api/thay-ca/${tcId}/chap-nhan`, {
        method: "POST",
        headers: { cookie: `${AUTH_COOKIE_NAME}=${nvAccepterToken}` },
      }),
      { params: Promise.resolve({ id: tcId }) }
    );
    expect(acc.status).toBe(200);

    // Chấm công thực tế cho riêng nvOther ở llPast (06:00 -> 11:30 = 5.5 giờ)
    await prisma.chamCong.create({
      data: {
        Machamcong: ccValid,
        Manv: nvOther,
        Malich: llPast,
        Thoigiancheckin: new Date(`${testPastDateStr}T06:00:00Z`),
        Thoigiancheckout: new Date(`${testPastDateStr}T11:30:00Z`),
      },
    });

    await prisma.kyLuong.create({
      data: {
        Makyluong: klTest,
        Thang: 11,
        Nam: 2098,
        Trangthai: "Chưa tính",
      },
    });

    const preview = await xemTruocTinhLuong(klTest);
    const otherRow = preview.BangLuong.find((b) => b.Manv === nvOther);
    const senderRow = preview.BangLuong.find((b) => b.Manv === nvSender);
    const declinerRow = preview.BangLuong.find((b) => b.Manv === nvDecliner);
    const accepterRow = preview.BangLuong.find((b) => b.Manv === nvAccepter);

    expect(otherRow?.Tonggiolam).toBe(5.5);
    expect(otherRow?.Tongluong).toBe(110000);
    expect(senderRow).toBeUndefined();
    expect(declinerRow).toBeUndefined();
    expect(accepterRow).toBeUndefined();

    const savedPayroll = await guiBangLuongDuKien(klTest);
    expect(savedPayroll.Tongluong).toBe(110000);
    expect(
      savedPayroll.BangLuong.some((b) =>
        [nvSender, nvDecliner, nvAccepter].includes(b.Manv)
      )
    ).toBe(false);

    const latestForOther = await layBangLuongMoiNhat(nvOther, 1, 10);
    expect(latestForOther.bangLuong?.tonggiolam).toBe(5.5);
    expect(latestForOther.bangLuong?.tongluong).toBe(110000);

    // Dọn kỳ lương test trước khi test xóa NV (do BR02 cấm xóa NV nếu còn kỳ chưa chốt)
    await prisma.chiTietBangLuong.deleteMany({
      where: { BangLuong: { Makyluong: klTest } },
    });
    await prisma.bangLuong.deleteMany({ where: { Makyluong: klTest } });
    await prisma.kyLuong.deleteMany({ where: { Makyluong: klTest } });

    // UC_5.3: Kiểm tra xóa (1) người gửi trước khi xóa người nhận/người từ chối -> phải dọn sạch TC/TD không lỗi FK
    const delSenderFirstRes = await deleteNhanVienRoute(
      new Request(`http://localhost:3000/api/chu-quan/nhan-vien/${nvSender}`, {
        method: "DELETE",
        headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` },
      }),
      { params: Promise.resolve({ id: nvSender }) }
    );
    expect(delSenderFirstRes.status).toBe(200);

    const remainSenderDon = await prisma.donXinDoiCa.count({
      where: { Manv: nvSender },
    });
    const remainSenderYc = await prisma.yeuCauBoSungCC.count({
      where: { Manv: nvSender },
    });
    expect(remainSenderDon).toBe(0);
    expect(remainSenderYc).toBe(0);

    // Tạo lại một yêu cầu TC mới từ nvOther trên llChieu có TD từ nvDecliner và TC được nvAccepter nhận để test xóa người từ chối & người nhận thay
    const { json: c2 } = await createUrgentInvite(nvOtherToken, llChieu, "Test xóa NV nhận/từ chối");
    const tcId2 = c2.data.yeuCau.id as string;
    await prisma.lichRanh.create({
      data: { Malichranh: "LR980009", Manv: nvAccepter, Ngayranh: new Date(`${testDateStr}T00:00:00Z`), Caranh: "CA000002" },
    }).catch(() => undefined);
    await prisma.donXinDoiCa.create({
      data: {
        Madon: "TD980777",
        Trangthaixuly: "Đã xử lý",
        Manv: nvOther,
        Malich: llChieu,
        Manvnhanthay: nvDecliner,
      },
    });
    trackedDonIds.push("TD980777");
    await prisma.donXinDoiCa.update({
      where: { Madon: tcId2 },
      data: { Trangthaixuly: "Đã xử lý", Manvnhanthay: nvAccepter },
    });

    const delDeclinerRes = await deleteNhanVienRoute(
      new Request(`http://localhost:3000/api/chu-quan/nhan-vien/${nvDecliner}`, {
        method: "DELETE",
        headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` },
      }),
      { params: Promise.resolve({ id: nvDecliner }) }
    );
    expect(delDeclinerRes.status).toBe(200);

    // Không để lại dòng TD mồ côi Manvnhanthay = null
    const orphanTd = await prisma.donXinDoiCa.count({
      where: { Madon: { startsWith: "TD" }, Manvnhanthay: null },
    });
    expect(orphanTd).toBe(0);

    const delAccepterRes = await deleteNhanVienRoute(
      new Request(`http://localhost:3000/api/chu-quan/nhan-vien/${nvAccepter}`, {
        method: "DELETE",
        headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` },
      }),
      { params: Promise.resolve({ id: nvAccepter }) }
    );
    expect(delAccepterRes.status).toBe(200);

    await prisma.lichRanh.deleteMany({ where: { Malichranh: "LR980009" } });
  });

  it("4. Đồng thời hóa bằng pg_advisory_xact_lock + cập nhật có điều kiện khi đua Chấp nhận và tạo đơn song song", async () => {
    for (const rel of [
      "backend/services/doi-ca.ts",
      "backend/services/thay-ca.ts",
      "backend/services/bo-sung-cc.ts",
    ]) {
      const src = fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
      expect(src).not.toMatch(/LOCK\s+TABLE/i);
      expect(src).toContain("acquireAdvisoryXactLock");
      expect(src).toContain("SHORT_TX_OPTIONS");
    }

    const [createA, createB, createDd, createYc] = await Promise.all([
      createUrgentInvite(nvSenderToken, llToi, "Song song 1"),
      createUrgentInvite(nvOtherToken, llChieu, "Song song 2"),
      postDoiCa(
        new Request("http://localhost:3000/api/doi-ca", {
          method: "POST",
          headers: {
            cookie: `${AUTH_COOKIE_NAME}=${nvSenderToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ Malich: llFuture, Manvnhanthay: nvDecliner }),
        }),
        { params: Promise.resolve({}) }
      ),
      guiYeuCauBoSungCC(nvOther, {
        malich: llPast,
        loaiYeuCau: "Quên check-in",
        giovaobosung: "06:00",
        giorabosung: "11:30",
        lydo: "Song song YC",
      }),
    ]);
    expect(createA.res.status).toBe(201);
    expect(createB.res.status).toBe(201);
    expect(createDd.status).toBe(201);
    expect(createYc.mayeucau).toMatch(/^YC\d{6}$/);
    trackedYcIds.push(createYc.mayeucau);
    const idA = createA.json.data.yeuCau.id as string;
    const idB = createB.json.data.yeuCau.id as string;
    const ddJson = await createDd.json();
    trackedDonIds.push(ddJson.data.madon);
    expect(idA).not.toBe(idB);
    expect(ddJson.data.madon).toMatch(/^DD\d{6}$/);

    const [accept1, accept2] = await Promise.all([
      postChapNhan(
        new Request(`http://localhost:3000/api/thay-ca/${idA}/chap-nhan`, {
          method: "POST",
          headers: { cookie: `${AUTH_COOKIE_NAME}=${nvDeclinerToken}` },
        }),
        { params: Promise.resolve({ id: idA }) }
      ),
      postChapNhan(
        new Request(`http://localhost:3000/api/thay-ca/${idA}/chap-nhan`, {
          method: "POST",
          headers: { cookie: `${AUTH_COOKIE_NAME}=${nvAccepterToken}` },
        }),
        { params: Promise.resolve({ id: idA }) }
      ),
    ]);
    expect([accept1.status, accept2.status].sort((a, b) => a - b)).toEqual([
      200, 409,
    ]);
  });
});
