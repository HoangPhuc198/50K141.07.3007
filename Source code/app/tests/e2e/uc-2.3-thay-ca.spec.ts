/**
 * tests/e2e/uc-2.3-thay-ca.spec.ts
 * Kiểm thử E2E đầy đủ UC_2.3 - Thay ca (báo nghỉ gấp):
 * - Điều hướng từ menu Nhân viên -> Quản lý ca làm -> Thay ca
 * - 5 trạng thái Figma: (1) Chọn ca nghỉ gấp, (2) Popup "Cần người thay ca gấp",
 *   (3) Chấp nhận -> "Đã xác nhận thành công", (4) Người sau gặp "Đã có người nhận thay ca" (#C0392B),
 *   (5) Người xin nghỉ thấy "Đã có nhân viên đồng ý" & "Đã nhận ca"
 * - Dừng polling khi tab ẩn (document.visibilityState === "hidden")
 * - Cảnh báo gấp cho Chủ quán khi sát giờ (≤30 phút) chưa ai nhận
 */
import { test, expect } from "@playwright/test";
import { signSession, AUTH_COOKIE_NAME } from "../../backend/lib/auth";
import { prisma } from "../../database/client";
import { formatDateVN, nowVN } from "../../backend/lib/time";
import * as thongBao from "../../frontend/config/thong-bao";

function toTimeDate(minutesFromMidnight: number): Date {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, minutesFromMidnight));
  const hh = String(Math.floor(clamped / 60)).padStart(2, "0");
  const mm = String(clamped % 60).padStart(2, "0");
  return new Date(`1970-01-01T${hh}:${mm}:00.000Z`);
}

test.describe("UC_2.3 - Thay ca (E2E đầy đủ 5 trạng thái, polling, 2 người bấm, cảnh báo CQ)", () => {
  const caNormalId = "CA980001";
  const caUrgentId = "CA980002";
  const llNormalId = "LL980001";
  const llUrgentId = "LL980002";
  const lrIds = ["LR980001", "LR980002", "LR980003", "LR980004"];

  const nvXinNghi = "NV000001";
  const nvRanh1 = "NV000002";
  const nvRanh2 = "NV980001";
  const nvKhacViTri = "NV000003";

  let cqToken = "";
  let nv1Token = "";
  let nv2Token = "";
  let nv3Token = "";
  let nvKhacViTriToken = "";

  async function cleanupTestData() {
    const mls = [llNormalId, llUrgentId];
    await prisma.chamCong.deleteMany({ where: { Malich: { in: mls } } });
    await prisma.donXinDoiCa.deleteMany({ where: { Malich: { in: mls } } });
    await prisma.yeuCauBoSungCC.deleteMany({ where: { Malich: { in: mls } } });
    await prisma.nhanVien_LichLam.deleteMany({ where: { Malich: { in: mls } } });
    await prisma.lichLam.deleteMany({ where: { Malich: { in: mls } } });
    await prisma.lichRanh.deleteMany({ where: { Malichranh: { in: lrIds } } });
    await prisma.caLam.deleteMany({ where: { Maca: { in: [caNormalId, caUrgentId] } } });
    await prisma.nhanVien.deleteMany({ where: { Manv: nvRanh2 } });
  }

  test.beforeAll(async () => {
    cqToken = await signSession({
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Hoàng Lan",
    });
    nv1Token = await signSession({
      userId: nvXinNghi,
      username: nvXinNghi,
      role: "NhanVien",
      name: "Nguyễn Minh Anh",
    });
    nv2Token = await signSession({
      userId: nvRanh1,
      username: nvRanh1,
      role: "NhanVien",
      name: "Trần Thu Hà",
    });
    nv3Token = await signSession({
      userId: nvRanh2,
      username: nvRanh2,
      role: "NhanVien",
      name: "Phạm Minh Khoa",
    });
    nvKhacViTriToken = await signSession({
      userId: nvKhacViTri,
      username: nvKhacViTri,
      role: "NhanVien",
      name: "Lê Quốc Bảo",
    });

    await cleanupTestData();

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
        Sdt: "0998000001",
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

    const now = nowVN();
    const todayStr = formatDateVN(now);
    const todayDb = new Date(`${todayStr}T00:00:00.000Z`);
    const nowMin = now.getHours() * 60 + now.getMinutes();

    // Tạo 1 ca còn > 30 phút (hoặc gần cuối ngày nếu đã muộn) và 1 ca sát giờ (<= 30 phút)
    const urgentStart = Math.min(nowMin + 15, 23 * 60 + 57);
    const urgentEnd = 23 * 60 + 59;
    const normalStart = nowMin + 40 < 23 * 60 + 55 ? nowMin + 40 : Math.min(nowMin + 20, 23 * 60 + 58);
    const normalEnd = 23 * 60 + 59;

    await prisma.caLam.createMany({
      data: [
        {
          Maca: caNormalId,
          Loaica: "Thay ca E2E",
          Giobatdau: toTimeDate(normalStart),
          Gioketthuc: toTimeDate(normalEnd),
          Sonvquydinh: 2,
        },
        {
          Maca: caUrgentId,
          Loaica: "Sát giờ E2E",
          Giobatdau: toTimeDate(urgentStart),
          Gioketthuc: toTimeDate(urgentEnd),
          Sonvquydinh: 2,
        },
      ],
    });

    await prisma.lichLam.createMany({
      data: [
        { Malich: llNormalId, Ngaylam: todayDb, Maca: caNormalId },
        { Malich: llUrgentId, Ngaylam: todayDb, Maca: caUrgentId },
      ],
    });

    await prisma.nhanVien_LichLam.createMany({
      data: [
        { Manv: nvXinNghi, Malich: llNormalId },
        { Manv: nvXinNghi, Malich: llUrgentId },
      ],
    });

    await prisma.lichRanh.createMany({
      data: [
        { Malichranh: lrIds[0], Manv: nvRanh1, Ngayranh: todayDb, Caranh: caNormalId },
        { Malichranh: lrIds[1], Manv: nvRanh2, Ngayranh: todayDb, Caranh: caNormalId },
        { Malichranh: lrIds[2], Manv: nvRanh1, Ngayranh: todayDb, Caranh: caUrgentId },
        { Malichranh: lrIds[3], Manv: nvKhacViTri, Ngayranh: todayDb, Caranh: caNormalId },
      ],
    });
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test("Luồng đầy đủ 5 trạng thái qua polling, 2 người bấm cùng phiên, người gửi & NV khác vị trí không nhận, và dừng poll khi tab ẩn", async ({
    browser,
  }) => {
    const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const ctx3 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const ctxKhac = await browser.newContext({ viewport: { width: 1440, height: 900 } });

    const cookieBase = {
      name: AUTH_COOKIE_NAME,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax" as const,
    };

    await ctx1.addCookies([{ ...cookieBase, value: nv1Token }]);
    await ctx2.addCookies([{ ...cookieBase, value: nv2Token }]);
    await ctx3.addCookies([{ ...cookieBase, value: nv3Token }]);
    await ctxKhac.addCookies([{ ...cookieBase, value: nvKhacViTriToken }]);

    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();
    const page3 = await ctx3.newPage();
    const pageKhac = await ctxKhac.newPage();

    const pageErrors: string[] = [];
    for (const p of [page1, page2, page3, pageKhac]) {
      p.on("pageerror", (err) => pageErrors.push(err.message));
    }

    try {
      // NV1 điều hướng từ trang chính qua sidebar menu tới UC_2.3 Thay ca
      await page1.goto("/nhan-vien");
      await page1.waitForLoadState("networkidle");
      await page1.getByRole("button", { name: "Quản lý ca làm" }).click();
      await page1.getByRole("link", { name: "Thay ca", exact: true }).click();
      await expect(page1).toHaveURL(/\/nhan-vien\/ca-lam\/thay-ca$/);

      // NV2, NV3 & NV khác vị trí đang ở trang chủ nhân viên
      await page2.goto("/nhan-vien");
      await page3.goto("/nhan-vien");
      await pageKhac.goto("/nhan-vien");

      // Trạng thái 01: chọn ca & danh sách người rảnh hiển thị đầy đủ mã NV000002 / NV980001
      await expect(page1.locator("#title-chon-ca-nghi-gap")).toHaveText("Chọn ca nghỉ gấp");
      await page1.selectOption("#thay-ca-select-shift", llNormalId);
      await expect(page1.locator("#card-nguoi-ranh")).toContainText("Trần Thu Hà · NV000002");
      await expect(page1.locator("#card-nguoi-ranh")).toContainText("Phạm Minh Khoa · NV980001");
      await expect(page1.locator("#card-nguoi-ranh")).toContainText("Chờ phản hồi");

      // NV1 nhập lý do & bấm Gửi
      await page1.fill("#thay-ca-ly-do", "Sốt cao đột xuất");
      await page1.click("#btn-gui-thay-ca");
      await expect(page1.locator("#btn-quay-lai-thay-ca")).toBeVisible();

      // Trạng thái 02: Cả NV2 và NV3 tự nhận popup qua polling (tối đa 10 giây)
      await expect(page2.locator("#thay-ca-invite-title")).toHaveText(
        thongBao.THAY_CA_LOI_MOI_TIEU_DE,
        { timeout: 10000 }
      );
      await expect(page3.locator("#thay-ca-invite-title")).toHaveText(
        thongBao.THAY_CA_LOI_MOI_TIEU_DE,
        { timeout: 10000 }
      );
      await expect(page2.getByText("Sốt cao đột xuất")).toBeVisible();

      // Người gửi (page1) và nhân viên khác vị trí (pageKhac) KHÔNG BAO GIỜ nhận popup lời mời
      await expect(page1.locator("#thay-ca-invite-title")).toHaveCount(0);
      await expect(pageKhac.locator("#thay-ca-invite-title")).toHaveCount(0);

      // Trạng thái 03: NV2 bấm Chấp nhận trước -> "Đã xác nhận thành công" (xanh)
      await page2.click("#btn-chap-nhan-thay-ca");
      const banner2 = page2.getByRole("dialog").getByTestId("notification-banner");
      await expect(banner2).toHaveText(thongBao.THAY_CA_XAC_NHAN_THANH_CONG);
      await expect(page2.locator("#btn-chap-nhan-thay-ca-disabled")).toBeDisabled();

      // Trạng thái 04: NV3 bấm Chấp nhận sau -> "Đã có người nhận thay ca" (đỏ #C0392B)
      await page3.click("#btn-chap-nhan-thay-ca");
      const banner3 = page3.getByRole("dialog").getByTestId("notification-banner");
      await expect(banner3).toHaveText(thongBao.THAY_CA_DA_CO_NGUOI_NHAN);
      await expect(banner3).toHaveCSS("color", "rgb(192, 57, 43)");
      await expect(page3.locator("#btn-chap-nhan-thay-ca-disabled")).toBeDisabled();

      // Trạng thái 05: NV1 tự cập nhật qua polling -> thấy "Đã có nhân viên đồng ý" & "Đã nhận ca"
      await expect(page1.getByTestId("notification-banner")).toHaveText(
        thongBao.THAY_CA_DA_CO_NV_DONG_Y,
        { timeout: 10000 }
      );
      await expect(page1.locator("#card-nguoi-ranh")).toContainText("Đã nhận ca");
      await expect(page1.locator("#title-chon-ca-nghi-gap")).toHaveText("Chọn ca cần nghỉ gấp");

      // Kiểm tra CSDL: NV000002 đã nằm trong NhanVien_LichLam mà không cần CQ duyệt
      const assigned = await prisma.nhanVien_LichLam.findUnique({
        where: { Manv_Malich: { Manv: nvRanh1, Malich: llNormalId } },
      });
      expect(assigned).not.toBeNull();

      // Kiểm tra dừng polling khi tab ẩn (visibilityState === "hidden")
      let pollCountWhileHidden = 0;
      await page2.route("**/api/thay-ca/dang-mo", async (route) => {
        pollCountWhileHidden += 1;
        await route.continue();
      });

      await page2.evaluate(() => {
        Object.defineProperty(document, "visibilityState", {
          value: "hidden",
          configurable: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      pollCountWhileHidden = 0;
      await page2.waitForTimeout(7000);
      expect(pollCountWhileHidden).toBe(0);

      // Mở lại tab -> polling tiếp tục
      await page2.evaluate(() => {
        Object.defineProperty(document, "visibilityState", {
          value: "visible",
          configurable: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await expect.poll(() => pollCountWhileHidden, { timeout: 5000 }).toBeGreaterThanOrEqual(1);

      expect(pageErrors).toEqual([]);
    } finally {
      await ctx1.close();
      await ctx2.close();
      await ctx3.close();
      await ctxKhac.close();
    }
  });

  test("Bấm Không chấp nhận không hiện lại khi chuyển 3 mục menu & tải lại trang; sát giờ (≤30 phút) cảnh báo Chủ quán", async ({
    browser,
  }) => {
    const ctxNv = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const ctxNv2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const ctxCq = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const cookieBase = {
      name: AUTH_COOKIE_NAME,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax" as const,
    };

    await ctxNv.addCookies([{ ...cookieBase, value: nv1Token }]);
    await ctxNv2.addCookies([{ ...cookieBase, value: nv2Token }]);
    await ctxCq.addCookies([{ ...cookieBase, value: cqToken }]);

    const pageNv = await ctxNv.newPage();
    const pageNv2 = await ctxNv2.newPage();
    const pageCq = await ctxCq.newPage();

    const pageErrors: string[] = [];
    for (const p of [pageNv, pageNv2, pageCq]) {
      p.on("pageerror", (err) => pageErrors.push(err.message));
    }

    try {
      await pageNv2.goto("/nhan-vien");
      await pageNv.goto("/nhan-vien/ca-lam/thay-ca");
      await pageNv.waitForLoadState("networkidle");
      await pageNv.selectOption("#thay-ca-select-shift", llUrgentId);
      await pageNv.fill("#thay-ca-ly-do", "Kẹt xe sát giờ");
      await pageNv.click("#btn-gui-thay-ca");
      await expect(pageNv.locator("#btn-quay-lai-thay-ca")).toBeVisible();

      // NV2 nhận popup lời mời -> bấm "Không chấp nhận" 1 lần -> hộp thoại đóng ngay
      await expect(pageNv2.locator("#thay-ca-invite-title")).toHaveText(
        thongBao.THAY_CA_LOI_MOI_TIEU_DE,
        { timeout: 10000 }
      );
      await pageNv2.click("#btn-tu-choi-thay-ca");
      await expect(pageNv2.locator("#thay-ca-invite-title")).toHaveCount(0);

      // Chuyển qua 3 mục trong menu "Quản lý ca làm" và tải lại trang -> hộp thoại KHÔNG BAO GIỜ hiện lại
      await pageNv2.getByRole("button", { name: "Quản lý ca làm" }).click();
      await pageNv2.getByRole("link", { name: "Đăng ký lịch rảnh", exact: true }).click();
      await expect(pageNv2).toHaveURL(/\/nhan-vien\/ca-lam\/lich-ranh$/);
      await expect(pageNv2.locator("#thay-ca-invite-title")).toHaveCount(0);

      await pageNv2.getByRole("link", { name: "Yêu cầu đổi ca", exact: true }).click();
      await expect(pageNv2).toHaveURL(/\/nhan-vien\/ca-lam\/doi-ca$/);
      await expect(pageNv2.locator("#thay-ca-invite-title")).toHaveCount(0);

      await pageNv2.getByRole("link", { name: "Thay ca", exact: true }).click();
      await expect(pageNv2).toHaveURL(/\/nhan-vien\/ca-lam\/thay-ca$/);
      await expect(pageNv2.locator("#thay-ca-invite-title")).toHaveCount(0);

      await pageNv2.reload();
      await pageNv2.waitForLoadState("networkidle");
      await expect(pageNv2.locator("#thay-ca-invite-title")).toHaveCount(0);

      await pageCq.goto("/chu-quan");
      await pageCq.waitForLoadState("networkidle");
      await expect(pageCq.getByTestId("notification-banner").first()).toContainText(
        thongBao.THAY_CA_CANH_BAO_SAT_GIO
      );

      expect(pageErrors).toEqual([]);
    } finally {
      await ctxNv.close();
      await ctxNv2.close();
      await ctxCq.close();
    }
  });
});
