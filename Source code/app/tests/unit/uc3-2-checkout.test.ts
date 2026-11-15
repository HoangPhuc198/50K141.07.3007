import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { signSession, AUTH_COOKIE_NAME } from "@backend/lib/auth";
import { CHECKOUT_GRACE_MINUTES, OVERTIME_MAX_MINUTES } from "@backend/lib/time";
import { GET as getHomNay } from "@/app/api/cham-cong/hom-nay/route";
import { POST as postCheckIn } from "@/app/api/cham-cong/check-in/route";
import { POST as postCheckOut } from "@/app/api/cham-cong/check-out/route";
import { GET as getThongBao } from "@/app/api/thong-bao/route";
import { layDanhSachQuenChamCong, layBaoCaoChamCong } from "@backend/services/bao-cao-cham-cong";
import { layCaThieuChamCong } from "@backend/services/bo-sung-cc";
import * as thongBao from "@frontend/config/thong-bao";
import { prisma } from "@database/client";

const execFileAsync = promisify(execFile);

describe("UC_3.2 - Check-out, Tăng ca, Ca thay & Quên check-out", () => {
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

  const testDateStr = "2099-06-15";
  const testDateObj = new Date("2099-06-15T00:00:00Z");
  const testMalichSang = "LL980001";
  const testMalichChieu = "LL980002";
  const testMadonThay = "DD980001";

  const cleanShiftAttendance = async () => {
    await prisma.yeuCauBoSungCC.deleteMany({
      where: { Malich: { in: [testMalichSang, testMalichChieu] } },
    });
    await prisma.chamCong.deleteMany({
      where: { Malich: { in: [testMalichSang, testMalichChieu] } },
    });
  };

  beforeAll(async () => {
    process.env.JWT_SECRET =
      "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";

    await cleanShiftAttendance();
    await prisma.donXinDoiCa.deleteMany({ where: { Madon: testMadonThay } });
    await prisma.nhanVien_LichLam.deleteMany({
      where: { Malich: { in: [testMalichSang, testMalichChieu] } },
    });
    await prisma.lichLam.deleteMany({
      where: { Malich: { in: [testMalichSang, testMalichChieu] } },
    });

    await prisma.lichLam.createMany({
      data: [
        { Malich: testMalichSang, Ngaylam: testDateObj, Maca: "CA000001" },
        { Malich: testMalichChieu, Ngaylam: testDateObj, Maca: "CA000002" },
      ],
    });

    // NV000001 (24.000đ/h) làm ca Sáng; NV000002 (22.000đ/h) xin đổi ca Chiều cho NV000004 (18.000đ/h)
    await prisma.nhanVien_LichLam.createMany({
      data: [
        { Manv: "NV000001", Malich: testMalichSang },
        { Manv: "NV000002", Malich: testMalichChieu },
      ],
    });
    await prisma.donXinDoiCa.create({
      data: {
        Madon: testMadonThay,
        Trangthaixuly: "Đã xử lý",
        Manv: "NV000002",
        Malich: testMalichChieu,
        Manvnhanthay: "NV000004",
      },
    });
  });

  afterAll(async () => {
    vi.useRealTimers();
    await cleanShiftAttendance();
    await prisma.donXinDoiCa.deleteMany({ where: { Madon: testMadonThay } });
    await prisma.nhanVien_LichLam.deleteMany({
      where: { Malich: { in: [testMalichSang, testMalichChieu] } },
    });
    await prisma.lichLam.deleteMany({
      where: { Malich: { in: [testMalichSang, testMalichChieu] } },
    });
  });

  beforeEach(async () => {
    await cleanShiftAttendance();
    vi.useFakeTimers({ shouldAdvanceTime: false });
  });

  afterEach(async () => {
    vi.useRealTimers();
    await cleanShiftAttendance();
  });

  it("Hằng số CHECKOUT_GRACE_MINUTES = 60, OVERTIME_MAX_MINUTES = 210 và thông báo khớp 08-THONG-BAO.md", () => {
    expect(CHECKOUT_GRACE_MINUTES).toBe(60);
    expect(OVERTIME_MAX_MINUTES).toBe(210);

    const mdPath = path.resolve(__dirname, "../../../docs/ke-hoach/08-THONG-BAO.md");
    const md = fs.readFileSync(mdPath, "utf-8");

    expect(thongBao.CHECK_OUT_THANH_CONG).toBe("Check-out thành công");
    expect(thongBao.CHECK_OUT_QUEN).toBe("Bạn đã quên check-out");
    expect(thongBao.CHECK_OUT_HOI_TANG_CA).toBe("Bạn có muốn tăng ca không?");

    expect(md).toContain(thongBao.CHECK_OUT_THANH_CONG);
    expect(md).toContain(thongBao.CHECK_OUT_QUEN);
    expect(md).toContain(thongBao.CHECK_OUT_HOI_TANG_CA);

    expect(thongBao.MAU_THONG_BAO.loi.chu).toBe("#C0392B");
    expect(thongBao.MAU_THONG_BAO["thanh-cong"].chu).toBe("#587554");
  });

  it("401 chưa đăng nhập, 403 Chủ quán & NV không check-out ca người khác", async () => {
    const r401 = await postCheckOut(
      new Request("http://localhost:3000/api/cham-cong/check-out", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tangCa: false }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(r401.status).toBe(401);

    const cqToken = await signChuQuan();
    const r403Cq = await postCheckOut(
      new Request("http://localhost:3000/api/cham-cong/check-out", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${cqToken}`,
        },
        body: JSON.stringify({ tangCa: false }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(r403Cq.status).toBe(403);

    // NV000004 cố check-out ca Sáng của NV000001 -> 403
    vi.setSystemTime(new Date(`${testDateStr}T11:30:00+07:00`));
    const nv4Token = await signNv("NV000004", "Phạm Ngọc Lan");
    const r403Nv = await postCheckOut(
      new Request("http://localhost:3000/api/cham-cong/check-out", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${nv4Token}`,
        },
        body: JSON.stringify({ tangCa: false, malich: testMalichSang }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(r403Nv.status).toBe(403);
  });

  it("Không tăng ca: ghi giờ ra, tính 4 chỉ số dẫn xuất đúng, chặn check-out lặp", async () => {
    vi.setSystemTime(new Date(`${testDateStr}T06:00:00+07:00`));
    const nv1Token = await signNv("NV000001", "Nguyễn Minh Anh");
    const rIn = await postCheckIn(
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
    expect(rIn.status).toBe(200);

    // Check-out đúng 11:30 với tangCa = false
    vi.setSystemTime(new Date(`${testDateStr}T11:30:00+07:00`));
    const rOut = await postCheckOut(
      new Request("http://localhost:3000/api/cham-cong/check-out", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
        },
        body: JSON.stringify({ tangCa: false, malich: testMalichSang }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(rOut.status).toBe(200);
    const jOut = await rOut.json();
    expect(jOut.data.dangTangCa).toBe(false);
    expect(jOut.data.message).toBe(thongBao.CHECK_OUT_THANH_CONG);
    expect(jOut.data.ketQua).toMatchObject({
      gioCheckIn: "06:00",
      gioCheckOut: "11:30",
      tongGioLam: 5.5,
      tongTien: 132000, // 5.5 * 24000 * 1
      heSo: 1,
    });

    // Check-out lần 2 -> 409
    const rDup = await postCheckOut(
      new Request("http://localhost:3000/api/cham-cong/check-out", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
        },
        body: JSON.stringify({ tangCa: false, malich: testMalichSang }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(rDup.status).toBe(409);
  });

  it("Có tăng ca (ca Sáng): tiếp tục tính giờ và tự check-out lúc 15:00", async () => {
    vi.setSystemTime(new Date(`${testDateStr}T06:00:00+07:00`));
    const nv1Token = await signNv("NV000001", "Nguyễn Minh Anh");
    await postCheckIn(
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

    // 11:30 chọn Có tăng ca
    vi.setSystemTime(new Date(`${testDateStr}T11:30:00+07:00`));
    const rTangCa = await postCheckOut(
      new Request("http://localhost:3000/api/cham-cong/check-out", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
        },
        body: JSON.stringify({ tangCa: true, malich: testMalichSang }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(rTangCa.status).toBe(200);
    const jTc = await rTangCa.json();
    expect(jTc.data.dangTangCa).toBe(true);
    expect(jTc.data.ketThucTangCa).toBe("15:00");

    // 13:45 vẫn đang tăng ca, chưa có Thoigiancheckout trong DB
    vi.setSystemTime(new Date(`${testDateStr}T13:45:00+07:00`));
    const ccMid = await prisma.chamCong.findUnique({
      where: { Manv_Malich: { Manv: "NV000001", Malich: testMalichSang } },
    });
    expect(ccMid?.Thoigiancheckout).toBeNull();

    // 15:00 -> tự động check-out ở mốc 15:00 khi truy vấn (ký token mới vì JWT hết hạn sau 8h từ 06:00)
    vi.setSystemTime(new Date(`${testDateStr}T15:00:00+07:00`));
    const nv1TokenAfter = await signNv("NV000001", "Nguyễn Minh Anh");
    const rAfter = await getHomNay(
      new Request("http://localhost:3000/api/cham-cong/hom-nay", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${nv1TokenAfter}` },
      }),
      { params: Promise.resolve({}) }
    );
    expect(rAfter.status).toBe(200);
    const jAfter = await rAfter.json();
    expect(jAfter.data.caCheckOut.daCheckOut).toBe(true);
    expect(jAfter.data.caCheckOut.thoiGianCheckOut).toBe("15:00");
    expect(jAfter.data.caCheckOut.ketQuaCheckOut).toMatchObject({
      gioCheckIn: "06:00",
      gioCheckOut: "15:00",
      tongGioLam: 9,
      tongTien: 216000, // 9 * 24000 * 1
    });
  });

  it("Ca thay (BR04): tính tiền công cho người nhận thay theo mức lương của họ", async () => {
    // NV000004 nhận thay ca Chiều của NV000002; mức lương NV000004 là 18.000đ/h (NV000002 là 22.000đ/h)
    vi.setSystemTime(new Date(`${testDateStr}T11:30:00+07:00`));
    const nv4Token = await signNv("NV000004", "Phạm Ngọc Lan");
    const rIn = await postCheckIn(
      new Request("http://localhost:3000/api/cham-cong/check-in", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${nv4Token}`,
        },
        body: JSON.stringify({ malich: testMalichChieu }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(rIn.status).toBe(200);

    // Làm đến 17:00 (5.5 giờ), tăng ca thử +3.5h -> tối đa 20:30, nhưng chọn không tăng ca -> 5.5 * 18000 = 99000
    vi.setSystemTime(new Date(`${testDateStr}T17:00:00+07:00`));
    const rOut = await postCheckOut(
      new Request("http://localhost:3000/api/cham-cong/check-out", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${nv4Token}`,
        },
        body: JSON.stringify({ tangCa: false, malich: testMalichChieu }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(rOut.status).toBe(200);
    const jOut = await rOut.json();
    expect(jOut.data.ketQua).toMatchObject({
      gioCheckIn: "11:30",
      gioCheckOut: "17:00",
      tongGioLam: 5.5,
      mucLuongTheoGio: 18000,
      tongTien: 99000,
    });
  });

  it("Quên check-out khi quá giờ kết thúc ca > 60 phút -> trả đúng 'Bạn đã quên check-out'", async () => {
    vi.setSystemTime(new Date(`${testDateStr}T06:00:00+07:00`));
    const nv1Token = await signNv("NV000001", "Nguyễn Minh Anh");
    await postCheckIn(
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

    // 12:31 (quá 11:30 đúng 61 phút, chưa đăng ký tăng ca) -> quên check-out
    vi.setSystemTime(new Date(`${testDateStr}T12:31:00+07:00`));
    const rGet = await getHomNay(
      new Request("http://localhost:3000/api/cham-cong/hom-nay", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${nv1Token}` },
      }),
      { params: Promise.resolve({}) }
    );
    const jGet = await rGet.json();
    expect(jGet.data.caCheckOut.trangThaiCheckOut).toBe("quen-check-out");

    const rPost = await postCheckOut(
      new Request("http://localhost:3000/api/cham-cong/check-out", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
        },
        body: JSON.stringify({ tangCa: false, malich: testMalichSang }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(rPost.status).toBe(400);
    const jPost = await rPost.json();
    expect(jPost.error.message).toBe(thongBao.CHECK_OUT_QUEN);
  });

  it("Tăng ca trước/sau mốc giờ (kết thúc sớm + tự chốt qua AppShell polling / báo cáo chấm công)", async () => {
    vi.setSystemTime(new Date(`${testDateStr}T06:00:00+07:00`));
    const nv1Token = await signNv("NV000001", "Nguyễn Minh Anh");
    await postCheckIn(
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

    // 11:45 chọn "Có tăng ca" -> ghi bản ghi đánh dấu OT trong YeuCauBoSungCC, Thoigiancheckout vẫn NULL
    vi.setSystemTime(new Date(`${testDateStr}T11:45:00+07:00`));
    const rStartOt = await postCheckOut(
      new Request("http://localhost:3000/api/cham-cong/check-out", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
        },
        body: JSON.stringify({ tangCa: true, malich: testMalichSang }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(rStartOt.status).toBe(200);
    const jStartOt = await rStartOt.json();
    expect(jStartOt.data.dangTangCa).toBe(true);
    expect(jStartOt.data.ketThucTangCa).toBe("15:00");

    const otBeforeDeadline = await prisma.yeuCauBoSungCC.findMany({
      where: { Manv: "NV000001", Malich: testMalichSang, Mayeucau: { startsWith: "OT" } },
    });
    expect(otBeforeDeadline).toHaveLength(1);
    expect(otBeforeDeadline[0].Trangthai).toBe("Đã xử lý");

    // 13:30 (trước mốc 15:00) -> không báo "Quên check-out" ở bổ sung CC hay danh sách quên CC
    vi.setSystemTime(new Date(`${testDateStr}T13:30:00+07:00`));
    const caThieuMid = await layCaThieuChamCong("NV000001");
    expect(caThieuMid.some((c) => c.malich === testMalichSang)).toBe(false);
    const quenMid = await layDanhSachQuenChamCong({
      tuNgay: testDateStr,
      denNgay: testDateStr,
      manv: "NV000001",
    });
    expect(quenMid.some((q) => q.malich === testMalichSang)).toBe(false);

    // Check-out sớm lúc 13:30 (tangCa: false) -> ghi 13:30 (7.5h) và xóa OT
    const rEarlyOut = await postCheckOut(
      new Request("http://localhost:3000/api/cham-cong/check-out", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
        },
        body: JSON.stringify({ tangCa: false, malich: testMalichSang }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(rEarlyOut.status).toBe(200);
    const jEarlyOut = await rEarlyOut.json();
    expect(jEarlyOut.data.dangTangCa).toBe(false);
    expect(jEarlyOut.data.ketQua).toMatchObject({
      gioCheckIn: "06:00",
      gioCheckOut: "13:30",
      tongGioLam: 7.5,
      tongTien: 180000,
    });
    const otAfterEarly = await prisma.yeuCauBoSungCC.count({
      where: { Manv: "NV000001", Malich: testMalichSang, Mayeucau: { startsWith: "OT" } },
    });
    expect(otAfterEarly).toBe(0);

    // Kịch bản tự chốt qua polling AppShell (/api/thong-bao) khi quá mốc 20:30 trên ca Chiều (11:30 - 17:00 + 210p = 20:30)
    vi.setSystemTime(new Date(`${testDateStr}T11:30:00+07:00`));
    const nv4Token = await signNv("NV000004", "Phạm Ngọc Lan");
    await postCheckIn(
      new Request("http://localhost:3000/api/cham-cong/check-in", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${nv4Token}`,
        },
        body: JSON.stringify({ malich: testMalichChieu }),
      }),
      { params: Promise.resolve({}) }
    );
    vi.setSystemTime(new Date(`${testDateStr}T17:15:00+07:00`));
    const rChieuOt = await postCheckOut(
      new Request("http://localhost:3000/api/cham-cong/check-out", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${nv4Token}`,
        },
        body: JSON.stringify({ tangCa: true, malich: testMalichChieu }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(rChieuOt.status).toBe(200);
    expect((await rChieuOt.json()).data.ketThucTangCa).toBe("20:30");

    // 20:35 (> 20:30): chỉ cần Chủ quán poll /api/thong-bao -> tính lười chốt Thoigiancheckout = 20:30
    vi.setSystemTime(new Date(`${testDateStr}T20:35:00+07:00`));
    const cqToken = await signChuQuan();
    const rPollCq = await getThongBao(
      new Request("http://localhost:3000/api/thong-bao", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` },
      }),
      { params: Promise.resolve({}) }
    );
    expect(rPollCq.status).toBe(200);

    const ccChieuAfterPoll = await prisma.chamCong.findUnique({
      where: { Manv_Malich: { Manv: "NV000004", Malich: testMalichChieu } },
    });
    expect(ccChieuAfterPoll?.Thoigiancheckout?.toISOString().slice(11, 16)).toBe("20:30");
    const bcNgay = await layBaoCaoChamCong({
      mode: "ngay",
      ngay: testDateStr,
      manv: undefined,
      page: 1,
      limit: 20,
    });
    expect(
      bcNgay.items.find(
        (x) => "gioRa" in x && x.manv === "NV000004" && x.gioRa === "20:30"
      )
    ).toBeDefined();
  });

  it("Khởi động lại máy chủ giữa chừng (vi.resetModules): giữ nguyên tăng ca trước 15:00 và tự chốt sau 15:00", async () => {
    vi.setSystemTime(new Date(`${testDateStr}T06:00:00+07:00`));
    const nv1Token = await signNv("NV000001", "Nguyễn Minh Anh");
    await postCheckIn(
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

    vi.setSystemTime(new Date(`${testDateStr}T11:45:00+07:00`));
    const rOt = await postCheckOut(
      new Request("http://localhost:3000/api/cham-cong/check-out", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
        },
        body: JSON.stringify({ tangCa: true, malich: testMalichSang }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(rOt.status).toBe(200);

    // Giả lập máy chủ khởi động lại trước 15:00
    vi.resetModules();
    vi.setSystemTime(new Date(`${testDateStr}T14:10:00+07:00`));
    const { GET: getHomNayFreshBefore } = await import("@/app/api/cham-cong/hom-nay/route");
    const nv1TokenMid = await signNv("NV000001", "Nguyễn Minh Anh");
    const rMid = await getHomNayFreshBefore(
      new Request("http://localhost:3000/api/cham-cong/hom-nay", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${nv1TokenMid}` },
      }),
      { params: Promise.resolve({}) }
    );
    expect(rMid.status).toBe(200);
    const jMid = await rMid.json();
    expect(jMid.data.caCheckOut.dangTangCa).toBe(true);
    expect(jMid.data.caCheckOut.gioKetThucTangCa).toBe("15:00");
    expect(jMid.data.caCheckOut.trangThaiCheckOut).toBe("dang-tang-ca");

    // Giả lập máy chủ khởi động lại lần nữa sau 15:00
    vi.resetModules();
    vi.setSystemTime(new Date(`${testDateStr}T15:05:00+07:00`));
    const { GET: getHomNayFreshAfter } = await import("@/app/api/cham-cong/hom-nay/route");
    const nv1TokenAfter = await signNv("NV000001", "Nguyễn Minh Anh");
    const rAfter = await getHomNayFreshAfter(
      new Request("http://localhost:3000/api/cham-cong/hom-nay", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${nv1TokenAfter}` },
      }),
      { params: Promise.resolve({}) }
    );
    expect(rAfter.status).toBe(200);
    const jAfter = await rAfter.json();
    expect(jAfter.data.caCheckOut.dangTangCa).toBe(false);
    expect(jAfter.data.caCheckOut.daCheckOut).toBe(true);
    expect(jAfter.data.caCheckOut.thoiGianCheckOut).toBe("15:00");
  });

  it(
    "Hai tiến trình độc lập (và chạy đồng thời sau mốc giờ) cho kết quả nhất quán từ CSDL",
    async () => {
      vi.useRealTimers();
      const appDir = path.resolve(__dirname, "../..");
      const viteNodeBin = path.resolve(appDir, "node_modules/vite-node/vite-node.mjs");
      const vitestConfig = path.resolve(appDir, "vitest.config.ts");
      const workerFile = path.resolve(__dirname, "helpers/tang-ca-worker.ts");

      const runWorker = async (
        hhmm: string,
        action: "check-in" | "start-ot" | "hom-nay" | "poll-thong-bao"
      ) => {
        const { stdout } = await execFileAsync(
          process.execPath,
          [viteNodeBin, "-c", vitestConfig, workerFile, action, "NV000001", testMalichSang],
          {
            cwd: appDir,
            env: {
              ...process.env,
              NODE_ENV: "test",
              VISUAL_NOW: `${testDateStr} ${hhmm}:00`,
            },
          }
        );
        const lines = stdout
          .trim()
          .split(/\r?\n/)
          .filter(Boolean);
        return JSON.parse(lines[lines.length - 1]) as {
          pid: number;
          data: Record<string, unknown>;
        };
      };

      // Tiến trình 1: check-in 06:00 rồi bật tăng ca lúc 11:45
      await runWorker("06:00", "check-in");
      const p1 = await runWorker("11:45", "start-ot");
      expect((p1.data as { dangTangCa: boolean }).dangTangCa).toBe(true);

      // Tiến trình 2 hoàn toàn tách biệt (PID khác) hỏi lúc 13:50 -> vẫn thấy đang tăng ca đến 15:00
      const p2 = await runWorker("13:50", "hom-nay");
      expect(p2.pid).not.toBe(p1.pid);
      const caOut2 = (p2.data as { caCheckOut: { dangTangCa: boolean; gioKetThucTangCa: string | null } }).caCheckOut;
      expect(caOut2.dangTangCa).toBe(true);
      expect(caOut2.gioKetThucTangCa).toBe("15:00");

      // Hai tiến trình đồng thời sau 15:00 cùng tính lười chốt tăng ca (advisory lock) -> không lỗi, cùng chốt 15:00
      const [p3Poll, p4HomNay] = await Promise.all([
        runWorker("15:05", "poll-thong-bao"),
        runWorker("15:05", "hom-nay"),
      ]);
      expect(p3Poll.pid).not.toBe(p4HomNay.pid);
      const caOut4 = (p4HomNay.data as { caCheckOut: { daCheckOut: boolean; thoiGianCheckOut: string | null } }).caCheckOut;
      expect(caOut4.daCheckOut).toBe(true);
      expect(caOut4.thoiGianCheckOut).toBe("15:00");

      const ccFinal = await prisma.chamCong.findUnique({
        where: { Manv_Malich: { Manv: "NV000001", Malich: testMalichSang } },
      });
      expect(ccFinal?.Thoigiancheckout?.toISOString().slice(11, 16)).toBe("15:00");
      const remainingOt = await prisma.yeuCauBoSungCC.count({
        where: { Manv: "NV000001", Malich: testMalichSang, Mayeucau: { startsWith: "OT" } },
      });
      expect(remainingOt).toBe(0);
    },
    30_000
  );
});
