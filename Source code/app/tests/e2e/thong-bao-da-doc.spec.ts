import { test, expect, type Page } from "@playwright/test";
import { signSession, AUTH_COOKIE_NAME } from "../../backend/lib/auth";
import { prisma } from "../../database/client";
import { addDaysVN, formatDateVN, nowVN } from "../../backend/lib/time";
import {
  THONG_BAO_DA_DOC_STORAGE_PREFIX,
  THONG_BAO_TOI_DA_TRONG_DANH_SACH,
  getThongBaoDaDocStorageKey,
  getThongBaoDaHienStorageKey,
} from "../../frontend/lib/thong-bao-da-doc";

function loadLocalEnvSilently(): void {
  try {
    if (typeof process.loadEnvFile === "function") {
      process.loadEnvFile(".env");
    }
  } catch {
    // bỏ qua nếu đã nạp biến môi trường từ tiến trình cha
  }
}

async function attachAuthCookie(
  page: Page,
  token: string
): Promise<void> {
  await page.context().clearCookies();
  await page.context().addCookies([
    {
      name: AUTH_COOKIE_NAME,
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

function trackHydrationAndPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (
        text.toLowerCase().includes("hydration") ||
        text.toLowerCase().includes("did not match")
      ) {
        errors.push(`console.error: ${text}`);
      }
    }
  });
  return errors;
}

const SAMPLE_CQ_NOTIFS = [
  {
    id: "YC-DD970002",
    khoa: "doi-ca:DD970002",
    mocThoiGian: "2026-11-20T08:00:00",
    tieuDe: "Nguyễn Minh Anh · Đổi ca",
    thoiGian: "20/11",
    chiTiet: "Ca sáng 20/11 · Chưa có người thay",
    link: "/chu-quan/lich-lam/doi-ca",
  },
  {
    id: "YC-YC970001",
    khoa: "bo-sung:YC970001:2026-11-18",
    mocThoiGian: "2026-11-18T14:00:00",
    tieuDe: "Trần Thu Hà · Chấm công",
    thoiGian: "18/11",
    chiTiet: "Ca chiều 18/11 · Quên check-out",
    link: "/chu-quan/cham-cong/bo-sung",
  },
  {
    id: "YC-PH970001",
    khoa: "phan-hoi:PH970001:2026-11-16",
    mocThoiGian: "2026-11-16T00:00:00",
    tieuDe: "Lê Quốc Bảo · Lương",
    thoiGian: "16/11",
    chiTiet: "Tháng 11 · Thiếu giờ tăng ca",
    link: "/chu-quan/luong/chinh-sua",
  },
];

function buildSampleNvNotifs() {
  const today = nowVN();
  const recentSwapStr = formatDateVN(addDaysVN(today, 2));
  const recentSupStr = formatDateVN(addDaysVN(today, -1));
  const fmtDdMm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

  return [
    {
      id: "BL-KL202611",
      khoa: "luong:KL202611:Dự kiến",
      suKien: "luong:KL202611",
      nhom: "bang-luong" as const,
      mocThoiGian: `${recentSwapStr}T00:00:00`,
      tieuDe: "Bảng lương tháng 11 đã sẵn sàng",
      thoiGian: "Tháng 11/2026",
      chiTiet: "Dự kiến · 40 giờ · 800.000đ",
      link: "/nhan-vien/luong/xem",
    },
    {
      id: "DC-DD970010",
      khoa: "doi-ca-kq:DD970010:NV000002",
      suKien: "doi-ca:DD970010",
      nhom: "thong-tin" as const,
      mocThoiGian: `${recentSwapStr}T07:00:00`,
      tieuDe: "Đơn xin đổi ca đã được xử lý",
      thoiGian: `Ca sáng ${fmtDdMm(recentSwapStr)}`,
      chiTiet: "Chủ quán đã duyệt thay đổi nhân viên nhận ca",
      link: "/nhan-vien/ca-lam/doi-ca",
    },
    {
      id: "BS-YC970010",
      khoa: `bo-sung-kq:YC970010:${recentSupStr}`,
      suKien: "bo-sung:YC970010",
      nhom: "thong-tin" as const,
      mocThoiGian: `${recentSupStr}T13:00:00`,
      tieuDe: "Yêu cầu bổ sung chấm công đã xử lý",
      thoiGian: `Ca chiều ${fmtDdMm(recentSupStr)}`,
      chiTiet: "Đã cập nhật dữ liệu chấm công",
      link: "/nhan-vien/cham-cong/bo-sung",
    },
  ];
}

const SAMPLE_NV_NOTIFS = buildSampleNvNotifs();

test.describe("Chuông thông báo - Đã đọc / Chưa đọc (Production E2E)", () => {
  let cqToken = "";
  let nv1Token = "";
  let nv2Token = "";

  const testMaca = "CA970001";
  const testMalich = "LL970001";
  const testYeuCau = "YC970001";
  const testYeuCauNv2 = "YC970002";
  const testDonDoiCa = "DD970001";

  async function cleanupDbArtifacts() {
    await prisma.donXinDoiCa.deleteMany({ where: { Madon: testDonDoiCa } });
    await prisma.yeuCauBoSungCC.deleteMany({
      where: { Mayeucau: { in: [testYeuCau, testYeuCauNv2] } },
    });
    await prisma.chamCong.deleteMany({ where: { Malich: testMalich } });
    await prisma.nhanVien_LichLam.deleteMany({ where: { Malich: testMalich } });
    await prisma.lichLam.deleteMany({ where: { Malich: testMalich } });
    await prisma.caLam.deleteMany({ where: { Maca: testMaca } });
  }

  test.beforeAll(async () => {
    loadLocalEnvSilently();
    cqToken = await signSession({
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Thanh Hà",
    });
    nv1Token = await signSession({
      userId: "NV000001",
      username: "NV000001",
      role: "NhanVien",
      name: "Nguyễn Minh Anh",
    });
    nv2Token = await signSession({
      userId: "NV000002",
      username: "NV000002",
      role: "NhanVien",
      name: "Trần Thu Hà",
    });
    await cleanupDbArtifacts();
  });

  test.afterAll(async () => {
    await cleanupDbArtifacts();
  });

  test("1. Chủ quán: 3 thông báo -> bấm 1 còn 2, mờ và xếp xuống dưới, tải lại vẫn còn 2, vùng bấm >= 44px", async ({
    page,
  }) => {
    const errors = trackHydrationAndPageErrors(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await attachAuthCookie(page, cqToken);

    await page.route("**/api/thong-bao", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: { count: SAMPLE_CQ_NOTIFS.length, items: SAMPLE_CQ_NOTIFS },
        }),
      });
    });

    await page.goto("/chu-quan");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    const bell = page.locator("#topbar-notification-bell");
    const bellCount = page.getByTestId("notification-bell-count");
    await expect(bellCount).toHaveText("3");

    // Mở danh sách thông báo
    await bell.click();
    const popover = page.getByTestId("notification-popover");
    await expect(popover).toBeVisible();

    const items = popover.locator("[data-testid^='notification-item-']");
    await expect(items).toHaveCount(3);

    // Kiểm tra thứ tự mới nhất trước & trạng thái chưa đọc + vùng bấm >= 44px
    await expect(items.nth(0)).toHaveAttribute("data-notification-key", "doi-ca:DD970002");
    await expect(items.nth(0)).toHaveAttribute("data-read", "false");
    await expect(items.nth(0).getByTestId("notification-unread-dot")).toBeVisible();

    const box = await items.nth(0).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    const unreadTitleWeight = await items
      .nth(0)
      .locator("p")
      .first()
      .evaluate((el) => Number(window.getComputedStyle(el).fontWeight));
    expect(unreadTitleWeight).toBeGreaterThanOrEqual(700);

    // Bấm thông báo đầu tiên (doi-ca:DD970002) -> số giảm còn 2 và điều hướng
    await items.nth(0).click();
    await expect(bellCount).toHaveText("2");
    await expect(page).toHaveURL(/\/chu-quan\/lich-lam\/doi-ca/);

    // Mở chuông kiểm tra item đã đọc bị mờ và xếp xuống dưới cùng
    await bell.click();
    await expect(popover).toBeVisible();
    const afterClickItems = popover.locator("[data-testid^='notification-item-']");
    await expect(afterClickItems).toHaveCount(3);
    await expect(afterClickItems.nth(0)).toHaveAttribute("data-read", "false");
    await expect(afterClickItems.nth(1)).toHaveAttribute("data-read", "false");
    await expect(afterClickItems.nth(2)).toHaveAttribute(
      "data-notification-key",
      "doi-ca:DD970002"
    );
    await expect(afterClickItems.nth(2)).toHaveAttribute("data-read", "true");
    await expect(
      afterClickItems.nth(2).getByTestId("notification-unread-dot")
    ).toHaveCount(0);

    const readStyles = await afterClickItems.nth(2).evaluate((el) => {
      const titleEl = el.querySelector("p");
      return {
        rowOpacity: parseFloat(window.getComputedStyle(el).opacity),
        titleWeight: titleEl
          ? Number(window.getComputedStyle(titleEl).fontWeight)
          : 0,
      };
    });
    expect(readStyles.rowOpacity).toBeLessThan(1);
    expect(readStyles.titleWeight).toBeLessThan(600);

    // Tải lại trang vẫn còn 2 và giữ đúng vị trí + trạng thái đã đọc
    await page.reload();
    await expect(bellCount).toHaveText("2");
    await bell.click();
    await expect(
      popover.locator("[data-testid^='notification-item-']").nth(2)
    ).toHaveAttribute("data-read", "true");

    // Kiểm tra localStorage chỉ lưu khóa theo mã CQ000001
    const storedRaw = await page.evaluate(
      (k) => window.localStorage.getItem(k),
      getThongBaoDaDocStorageKey("CQ000001")
    );
    expect(storedRaw).toBe(JSON.stringify(["doi-ca:DD970002"]));
    expect(errors).toEqual([]);
  });

  test("2. Bàn phím Enter / Space, đồng bộ giữa 2 tab cùng trình duyệt và hiển thị 99+ khi > 99", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    try {
      await context.addCookies([
        {
          name: AUTH_COOKIE_NAME,
          value: cqToken,
          domain: "localhost",
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);

      await context.route("**/api/thong-bao", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: { count: SAMPLE_CQ_NOTIFS.length, items: SAMPLE_CQ_NOTIFS },
          }),
        });
      });

      await page1.goto("/chu-quan");
      await page1.evaluate(() => window.localStorage.clear());
      await page1.reload();
      await page2.goto("/chu-quan");

      await expect(page1.getByTestId("notification-bell-count")).toHaveText("3");
      await expect(page2.getByTestId("notification-bell-count")).toHaveText("3");

      // Focus thông báo bằng bàn phím và nhấn Space ở tab 1
      await page1.locator("#topbar-notification-bell").click();
      const secondItem = page1
        .getByTestId("notification-popover")
        .locator("[data-testid^='notification-item-']")
        .nth(1);
      await secondItem.focus();
      await secondItem.press("Space");

      await expect(page1.getByTestId("notification-bell-count")).toHaveText("2");
      // Tab 2 tự giảm theo sự kiện storage
      await expect(page2.getByTestId("notification-bell-count")).toHaveText("2");

      // Kiểm tra Enter ở tab 2 đọc tiếp 1 thông báo nữa -> cả 2 tab còn 1
      await page2.locator("#topbar-notification-bell").click();
      const firstUnreadInTab2 = page2
        .getByTestId("notification-popover")
        .locator("[data-testid^='notification-item-'][data-read='false']")
        .first();
      await firstUnreadInTab2.focus();
      await firstUnreadInTab2.press("Enter");
      await expect(page2.getByTestId("notification-bell-count")).toHaveText("1");
      await expect(page1.getByTestId("notification-bell-count")).toHaveText("1");

      // Kiểm tra > 99 hiển thị "99+"
      const manyItems = Array.from({ length: 105 }, (_, i) => ({
        id: `YC-DD98${String(i).padStart(4, "0")}`,
        khoa: `doi-ca:DD98${String(i).padStart(4, "0")}`,
        mocThoiGian: "2026-11-20T08:00:00",
        tieuDe: `Thông báo #${i + 1}`,
        thoiGian: "20/11",
        chiTiet: "Chi tiết",
        link: "/chu-quan",
      }));
      await context.unroute("**/api/thong-bao");
      await context.route("**/api/thong-bao", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: { count: manyItems.length, items: manyItems },
          }),
        });
      });

      await page1.reload();
      await expect(page1.getByTestId("notification-bell-count")).toHaveText("99+");
    } finally {
      await context.close();
    }
  });

  test("3. Tài khoản khác trên cùng trình duyệt có số độc lập; Nhân viên hoạt động tương tự", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.route("**/api/thong-bao", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: { count: SAMPLE_NV_NOTIFS.length, items: SAMPLE_NV_NOTIFS },
        }),
      });
    });

    // Đăng nhập NV000001 -> đọc 1 thông báo -> số còn 2, mờ và xếp dưới
    await attachAuthCookie(page, nv1Token);
    await page.goto("/nhan-vien");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    const bell = page.locator("#topbar-notification-bell");
    const bellCount = page.getByTestId("notification-bell-count");
    await expect(bellCount).toHaveText("3");

    await bell.click();
    const popover = page.getByTestId("notification-popover");
    await popover.locator("[data-testid^='notification-item-']").nth(0).click();
    await expect(bellCount).toHaveText("2");

    await page.reload();
    await expect(bellCount).toHaveText("2");
    await bell.click();
    await expect(
      popover.locator("[data-testid^='notification-item-']").nth(2)
    ).toHaveAttribute("data-read", "true");

    // Đăng nhập NV000002 trên CÙNG trình duyệt -> số phải độc lập = 3 (chưa đọc hết)
    await attachAuthCookie(page, nv2Token);
    await page.goto("/nhan-vien");
    await expect(bellCount).toHaveText("3");

    await bell.click();
    const nv2Items = popover.locator("[data-testid^='notification-item-']");
    await expect(nv2Items).toHaveCount(3);
    for (let i = 0; i < 3; i += 1) {
      await expect(nv2Items.nth(i)).toHaveAttribute("data-read", "false");
    }

    // Xác minh localStorage giữ khóa riêng của từng tài khoản
    const storageKeys = await page.evaluate((prefix) => {
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(prefix)) keys.push(k);
      }
      return keys;
    }, THONG_BAO_DA_DOC_STORAGE_PREFIX);
    expect(storageKeys).toEqual(["thanhha:tb-da-doc:NV000001"]);
  });

  test("4. CSDL thật: tạo yêu cầu mới -> số tăng 1 và chưa đọc; xử lý xong -> thông báo biến mất và khóa cũ được dọn", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await attachAuthCookie(page, cqToken);

    try {
      await cleanupDbArtifacts();

      await page.goto("/chu-quan");
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();

      const bell = page.locator("#topbar-notification-bell");
      const bellCount = page.getByTestId("notification-bell-count");
      await expect
        .poll(async () => Number((await bellCount.textContent()) ?? "0"))
        .toBeGreaterThan(0);

      const initialCount = Number((await bellCount.textContent()) ?? "0");

      // Đọc 1 thông báo hiện có từ CSDL thật -> giảm đi 1
      await bell.click();
      const popover = page.getByTestId("notification-popover");
      const firstExistingKey = await popover
        .locator("[data-testid^='notification-item-']")
        .first()
        .getAttribute("data-notification-key");
      expect(firstExistingKey).toBeTruthy();

      await popover.locator("[data-testid^='notification-item-']").first().click();
      await expect(bellCount).toHaveText(String(initialCount - 1));

      // Tạo thêm một yêu cầu bổ sung chấm công mới trong CSDL thật (ngày tương lai để không phát sinh QCC)
      await prisma.caLam.create({
        data: {
          Maca: testMaca,
          Loaica: "Thử nghiệm 97",
          Giobatdau: new Date("1970-01-01T08:00:00.000Z"),
          Gioketthuc: new Date("1970-01-01T12:00:00.000Z"),
          Sonvquydinh: 1,
        },
      });

      const futureStr = formatDateVN(new Date(nowVN().getTime() + 30 * 86400_000));
      await prisma.lichLam.create({
        data: {
          Malich: testMalich,
          Ngaylam: new Date(`${futureStr}T00:00:00Z`),
          Maca: testMaca,
        },
      });
      await prisma.nhanVien_LichLam.create({
        data: { Manv: "NV000001", Malich: testMalich },
      });
      await prisma.yeuCauBoSungCC.create({
        data: {
          Mayeucau: testYeuCau,
          Giovaobosung: null,
          Giorabosung: new Date("1970-01-01T12:00:00.000Z"),
          Lydo: "E2E thông báo mới",
          Trangthai: "Chưa xử lý",
          Manv: "NV000001",
          Malich: testMalich,
        },
      });

      // Tải lại để nhận thông báo mới -> số tăng lại +1 và yêu cầu mới là CHƯA ĐỌC
      await page.goto("/chu-quan");
      await expect(bellCount).toHaveText(String(initialCount));

      await bell.click();
      const newNotifItem = popover.getByTestId(`notification-item-YC-${testYeuCau}`);
      await expect(newNotifItem).toBeVisible();
      await expect(newNotifItem).toHaveAttribute("data-read", "false");
      await expect(newNotifItem.getByTestId("notification-unread-dot")).toBeVisible();

      // Đọc thông báo mới -> số giảm 1, khóa được lưu trong localStorage
      await newNotifItem.click();
      await expect(bellCount).toHaveText(String(initialCount - 1));
      const newNotifKey = `bo-sung:${testYeuCau}:${futureStr}`;
      const savedBeforeResolve = await page.evaluate(
        (k) => window.localStorage.getItem(k),
        getThongBaoDaDocStorageKey("CQ000001")
      );
      expect(savedBeforeResolve).toContain(newNotifKey);

      // Xử lý xong yêu cầu trong CSDL -> thông báo tự biến mất khỏi danh sách và khóa thừa bị dọn
      await prisma.yeuCauBoSungCC.update({
        where: { Mayeucau: testYeuCau },
        data: { Trangthai: "Đã xử lý" },
      });

      await page.goto("/chu-quan");
      await expect(bellCount).toHaveText(String(initialCount - 1));
      await bell.click();
      await expect(popover.getByTestId(`notification-item-YC-${testYeuCau}`)).toHaveCount(0);

      // Khóa thừa không còn trong danh sách đã được tự động dọn khỏi localStorage
      const savedAfterResolve = await page.evaluate(
        (k) => window.localStorage.getItem(k),
        getThongBaoDaDocStorageKey("CQ000001")
      );
      expect(savedAfterResolve).not.toContain(newNotifKey);
      expect(savedAfterResolve).toContain(firstExistingKey!);
    } finally {
      await cleanupDbArtifacts();
    }
  });

  test("5. Nhân viên (CSDL thật): số chuông độc lập theo tài khoản, bấm 1 thông báo tự giảm và giữ sau khi tải lại", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    try {
      await cleanupDbArtifacts();

      // Trên DB seed mặc định chưa có thông báo cho NV000001 -> hiện 0
      await attachAuthCookie(page, nv1Token);
      await page.goto("/nhan-vien");
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();
      const bell = page.locator("#topbar-notification-bell");
      const bellCount = page.getByTestId("notification-bell-count");
      await expect(bellCount).toHaveText("0");

      // Tạo dữ liệu thông báo thật cho NV000001 (2 thông báo) và NV000002 (1 thông báo)
      await prisma.caLam.create({
        data: {
          Maca: testMaca,
          Loaica: "Thử nghiệm 97",
          Giobatdau: new Date("1970-01-01T08:00:00.000Z"),
          Gioketthuc: new Date("1970-01-01T12:00:00.000Z"),
          Sonvquydinh: 2,
        },
      });
      const futureStr = formatDateVN(new Date(nowVN().getTime() + 30 * 86400_000));
      await prisma.lichLam.create({
        data: {
          Malich: testMalich,
          Ngaylam: new Date(`${futureStr}T00:00:00Z`),
          Maca: testMaca,
        },
      });
      await prisma.nhanVien_LichLam.createMany({
        data: [
          { Manv: "NV000001", Malich: testMalich },
          { Manv: "NV000002", Malich: testMalich },
        ],
      });
      await prisma.donXinDoiCa.create({
        data: {
          Madon: testDonDoiCa,
          Trangthaixuly: "Đã xử lý",
          Manv: "NV000001",
          Malich: testMalich,
          Manvnhanthay: "NV000003",
        },
      });
      await prisma.yeuCauBoSungCC.createMany({
        data: [
          {
            Mayeucau: testYeuCau,
            Giovaobosung: null,
            Giorabosung: new Date("1970-01-01T12:00:00.000Z"),
            Lydo: "E2E NV1 đã xử lý",
            Trangthai: "Đã xử lý",
            Manv: "NV000001",
            Malich: testMalich,
          },
          {
            Mayeucau: testYeuCauNv2,
            Giovaobosung: null,
            Giorabosung: new Date("1970-01-01T12:00:00.000Z"),
            Lydo: "E2E NV2 đã xử lý",
            Trangthai: "Đã xử lý",
            Manv: "NV000002",
            Malich: testMalich,
          },
        ],
      });

      await page.reload();
      await expect(bellCount).toHaveText("2");

      await bell.click();
      const popover = page.getByTestId("notification-popover");
      await expect(
        popover.locator("[data-testid^='notification-item-']")
      ).toHaveCount(2);
      await popover.locator("[data-testid^='notification-item-']").first().click();
      await expect(bellCount).toHaveText("1");

      await page.goto("/nhan-vien");
      await expect(bellCount).toHaveText("1");
      await bell.click();
      await expect(
        popover.locator("[data-testid^='notification-item-']").nth(1)
      ).toHaveAttribute("data-read", "true");

      // Tài khoản nhân viên khác (NV000002) trên cùng trình duyệt có số chưa đọc độc lập = 1
      await attachAuthCookie(page, nv2Token);
      await page.goto("/nhan-vien");
      await expect(bellCount).toHaveText("1");
      await bell.click();
      await expect(
        popover.getByTestId(`notification-item-BS-${testYeuCauNv2}`)
      ).toHaveAttribute("data-read", "false");
    } finally {
      await cleanupDbArtifacts();
    }
  });

  test("6. CSDL rỗng (không có thông báo): Chủ quán và Nhân viên đều hiện số 0 và danh sách trống", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.route("**/api/thong-bao", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: { count: 0, items: [] },
        }),
      });
    });

    // Chủ quán rỗng
    await attachAuthCookie(page, cqToken);
    await page.goto("/chu-quan");
    await expect(page.getByTestId("notification-bell-count")).toHaveText("0");
    await page.locator("#topbar-notification-bell").click();
    const popover = page.getByTestId("notification-popover");
    await expect(popover.locator("[data-testid^='notification-item-']")).toHaveCount(0);
    await expect(popover).toContainText("–");

    // Nhân viên rỗng
    await attachAuthCookie(page, nv1Token);
    await page.goto("/nhan-vien");
    await expect(page.getByTestId("notification-bell-count")).toHaveText("0");
    await page.locator("#topbar-notification-bell").click();
    await expect(popover.locator("[data-testid^='notification-item-']")).toHaveCount(0);
    await expect(popover).toContainText("–");
  });

  test("7. Chống lặp popup thay ca gấp, ổn định đọc khi có người từ chối, đóng banner cảnh báo CQ & không bật ở trang con", async ({
    browser,
  }) => {
    test.setTimeout(90000);

    const cas = ["CA960001", "CA960002"];
    const mls = ["LL960001", "LL960002"];
    const lrs = ["LR960001", "LR960002"];

    async function cleanupTest7() {
      await prisma.yeuCauBoSungCC.deleteMany({ where: { Malich: { in: mls } } });
      await prisma.donXinDoiCa.deleteMany({ where: { Malich: { in: mls } } });
      await prisma.chamCong.deleteMany({ where: { Malich: { in: mls } } });
      await prisma.nhanVien_LichLam.deleteMany({ where: { Malich: { in: mls } } });
      await prisma.lichLam.deleteMany({ where: { Malich: { in: mls } } });
      await prisma.lichRanh.deleteMany({ where: { Malichranh: { in: lrs } } });
      await prisma.caLam.deleteMany({ where: { Maca: { in: cas } } });
    }

    const now = nowVN();
    const todayStr = formatDateVN(now);
    const todayDb = new Date(`${todayStr}T00:00:00.000Z`);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const toTimeDate = (totalMin: number) => {
      const hh = String(Math.floor(totalMin / 60)).padStart(2, "0");
      const mm = String(totalMin % 60).padStart(2, "0");
      return new Date(`1970-01-01T${hh}:${mm}:00.000Z`);
    };

    const normalStart =
      nowMin + 40 < 23 * 60 + 55 ? nowMin + 40 : Math.min(nowMin + 20, 23 * 60 + 57);
    const urgentStart = Math.min(nowMin + 15, 23 * 60 + 57);
    const endMin = 23 * 60 + 59;

    const ctxSender = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const ctxInvitee = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const ctxCq = await browser.newContext({ viewport: { width: 1280, height: 800 } });

    const pageSender = await ctxSender.newPage();
    const pageInvitee = await ctxInvitee.newPage();
    const pageCq = await ctxCq.newPage();

    try {
      await cleanupTest7();

      await prisma.caLam.createMany({
        data: [
          {
            Maca: "CA960001",
            Loaica: "Thay ca 96",
            Giobatdau: toTimeDate(normalStart),
            Gioketthuc: toTimeDate(endMin),
            Sonvquydinh: 2,
          },
          {
            Maca: "CA960002",
            Loaica: "Sát giờ 96",
            Giobatdau: toTimeDate(urgentStart),
            Gioketthuc: toTimeDate(endMin),
            Sonvquydinh: 2,
          },
        ],
      });
      await prisma.lichLam.createMany({
        data: [
          { Malich: "LL960001", Ngaylam: todayDb, Maca: "CA960001" },
          { Malich: "LL960002", Ngaylam: todayDb, Maca: "CA960002" },
        ],
      });
      await prisma.nhanVien_LichLam.createMany({
        data: [
          { Manv: "NV000001", Malich: "LL960001" },
          { Manv: "NV000001", Malich: "LL960002" },
        ],
      });
      await prisma.lichRanh.create({
        data: {
          Malichranh: "LR960001",
          Manv: "NV000002",
          Ngayranh: todayDb,
          Caranh: "CA960001",
        },
      });

      const cookieBase = {
        name: AUTH_COOKIE_NAME,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax" as const,
      };
      await ctxSender.addCookies([{ ...cookieBase, value: nv1Token }]);
      await ctxInvitee.addCookies([{ ...cookieBase, value: nv2Token }]);
      await ctxCq.addCookies([{ ...cookieBase, value: cqToken }]);

      for (const p of [pageSender, pageInvitee, pageCq]) {
        await p.goto("/dang-nhap");
        await p.evaluate(() => window.localStorage.clear());
      }

      // NV2 đang ở trang nhân viên trước khi NV1 gửi yêu cầu thay ca
      await pageInvitee.goto("/nhan-vien");
      await expect(pageInvitee.locator("#topbar-notification-bell")).toBeVisible();

      // NV1 gửi yêu cầu thay ca LL960001
      await pageSender.goto("/nhan-vien/ca-lam/thay-ca");
      await pageSender.selectOption("#thay-ca-select-shift", "LL960001");
      await pageSender.fill("#thay-ca-ly-do", "Bận việc đột xuất 96");
      await pageSender.click("#btn-gui-thay-ca");
      await expect(pageSender.locator("#btn-quay-lai-thay-ca")).toBeVisible();

      // NV1 đánh dấu đã đọc thông báo TC-YC-* của mình trong chuông
      await pageSender.locator("#topbar-notification-bell").click();
      const senderPopover = pageSender.getByTestId("notification-popover");
      const senderYcItem = senderPopover
        .locator("[data-testid^='notification-item-TC-YC-']")
        .first();
      await expect(senderYcItem).toBeVisible();
      const senderYcKey = await senderYcItem.getAttribute("data-notification-key");
      expect(senderYcKey).toBeTruthy();
      await senderYcItem.click();

      await pageSender.goto("/nhan-vien");
      await pageSender.locator("#topbar-notification-bell").click();
      await expect(
        senderPopover.locator(`[data-notification-key='${senderYcKey}']`)
      ).toHaveAttribute("data-read", "true");

      // NV2 nhận popup tự động 1 lần qua polling
      await expect(pageInvitee.locator("#thay-ca-invite-title")).toBeVisible({
        timeout: 10000,
      });

      // NV2 đóng popup bằng nút Quay lại (chưa từ chối/chấp nhận) -> lưu tb-da-hien, không tự bật lại
      await pageInvitee.locator("#btn-quay-lai-thay-ca").click();
      await expect(pageInvitee.locator("#dialog-thay-ca-loi-moi")).toHaveCount(0);

      const shownRaw = await pageInvitee.evaluate(
        (k) => window.localStorage.getItem(k),
        getThongBaoDaHienStorageKey("NV000002")
      );
      expect(shownRaw || "").toContain("popup:thay-ca:");

      // Chuyển 3 mục menu + ẩn/hiện tab + tải lại + chờ 1 chu kỳ poll 6s -> popup KHÔNG tự bật lại
      await pageInvitee.getByRole("button", { name: "Quản lý ca làm" }).click();
      await pageInvitee.getByRole("link", { name: "Đăng ký lịch rảnh", exact: true }).click();
      await expect(pageInvitee).toHaveURL(/\/nhan-vien\/ca-lam\/lich-ranh$/);
      await expect(pageInvitee.locator("#dialog-thay-ca-loi-moi")).toHaveCount(0);

      await pageInvitee.getByRole("link", { name: "Yêu cầu đổi ca", exact: true }).click();
      await expect(pageInvitee).toHaveURL(/\/nhan-vien\/ca-lam\/doi-ca$/);
      await expect(pageInvitee.locator("#dialog-thay-ca-loi-moi")).toHaveCount(0);

      await pageInvitee.getByRole("link", { name: "Thay ca", exact: true }).click();
      await expect(pageInvitee).toHaveURL(/\/nhan-vien\/ca-lam\/thay-ca$/);
      await expect(pageInvitee.locator("#dialog-thay-ca-loi-moi")).toHaveCount(0);

      await pageInvitee.evaluate(() => {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "hidden",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await pageInvitee.waitForTimeout(100);
      await pageInvitee.evaluate(() => {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => "visible",
        });
        document.dispatchEvent(new Event("visibilitychange"));
      });

      await pageInvitee.waitForTimeout(6600);
      await expect(pageInvitee.locator("#dialog-thay-ca-loi-moi")).toHaveCount(0);

      await pageInvitee.reload();
      await pageInvitee.waitForTimeout(6600);
      await expect(pageInvitee.locator("#dialog-thay-ca-loi-moi")).toHaveCount(0);

      // Lời mời hợp lệ vẫn nằm trong chuông để bấm chủ động
      await pageInvitee.locator("#topbar-notification-bell").click();
      const inviteBellItem = pageInvitee
        .getByTestId("notification-popover")
        .locator("[data-testid^='notification-item-TC-MO-']")
        .first();
      await expect(inviteBellItem).toBeVisible();
      await inviteBellItem.click();
      await expect(pageInvitee.locator("#dialog-thay-ca-loi-moi")).toBeVisible();

      // Bấm Không chấp nhận -> đóng vĩnh viễn + biến mất khỏi chuông
      await pageInvitee.locator("#btn-tu-choi-thay-ca").click();
      await expect(pageInvitee.locator("#dialog-thay-ca-loi-moi")).toHaveCount(0);
      await pageInvitee.reload();
      await pageInvitee.waitForTimeout(6600);
      await expect(pageInvitee.locator("#dialog-thay-ca-loi-moi")).toHaveCount(0);

      // Người gửi NV1 vẫn giữ trạng thái đã đọc (không bị reset do từ chối tăng số lượng)
      await pageSender.reload();
      await pageSender.waitForTimeout(6600);
      await pageSender.locator("#topbar-notification-bell").click();
      await expect(
        pageSender
          .getByTestId("notification-popover")
          .locator(`[data-notification-key='${senderYcKey}']`)
      ).toHaveAttribute("data-read", "true");

      // NV1 gửi ca sát giờ LL960002 (không có người rảnh) -> Chủ quán thấy banner ở Dashboard, không có ở trang con
      await pageSender.goto("/nhan-vien/ca-lam/thay-ca");
      await pageSender.selectOption("#thay-ca-select-shift", "LL960002");
      await pageSender.fill("#thay-ca-ly-do", "Sát giờ 96");
      await pageSender.click("#btn-gui-thay-ca");
      await expect(pageSender.locator("#btn-quay-lai-thay-ca")).toBeVisible();

      await pageCq.goto("/chu-quan/nhan-vien/xem");
      await expect(pageCq.getByTestId("notification-banner")).toHaveCount(0);

      await pageCq.goto("/chu-quan");
      const cqBanner = pageCq.getByTestId("notification-banner").first();
      await expect(cqBanner).toBeVisible({ timeout: 10000 });
      await cqBanner.getByRole("button", { name: "Đóng thông báo" }).click();
      await expect(pageCq.getByTestId("notification-banner")).toHaveCount(0);

      const cqShownRaw = await pageCq.evaluate(
        (k) => window.localStorage.getItem(k),
        getThongBaoDaHienStorageKey("CQ000001")
      );
      expect(cqShownRaw || "").toContain("banner:thay-ca-cb:");

      await pageCq.reload();
      await pageCq.waitForTimeout(6600);
      await expect(pageCq.getByTestId("notification-banner")).toHaveCount(0);
    } finally {
      await cleanupTest7();
      await ctxSender.close();
      await ctxInvitee.close();
      await ctxCq.close();
    }
  });

  test("8. Thông tin hết hạn > 7 ngày, > 99 hiện 99+ không tràn khung/cuộn ngang ở 360px/1280px, giới hạn 50 giữ việc cần hành động", async ({
    browser,
  }) => {
    test.setTimeout(90000);

    const expiryShiftIds = ["LL960011", "LL960012"];
    const expiryDonIds = ["DD960011", "DD960012"];
    const expiryYcIds = ["YC960011", "YC960012"];
    const bulkShiftCount = 105;
    const bulkCaIds = Array.from(
      { length: bulkShiftCount },
      (_, i) => `C96${String(i + 1).padStart(5, "0")}`
    );
    const bulkLlIds = Array.from(
      { length: bulkShiftCount },
      (_, i) => `L96${String(i + 1).padStart(5, "0")}`
    );

    async function cleanupTest8() {
      await prisma.donXinDoiCa.deleteMany({ where: { Madon: { in: expiryDonIds } } });
      await prisma.yeuCauBoSungCC.deleteMany({ where: { Mayeucau: { in: expiryYcIds } } });
      await prisma.chamCong.deleteMany({
        where: { Malich: { in: [...expiryShiftIds, ...bulkLlIds] } },
      });
      await prisma.nhanVien_LichLam.deleteMany({
        where: { Malich: { in: [...expiryShiftIds, ...bulkLlIds] } },
      });
      await prisma.lichLam.deleteMany({
        where: { Malich: { in: [...expiryShiftIds, ...bulkLlIds] } },
      });
      await prisma.caLam.deleteMany({
        where: { Maca: { in: ["CA960011", ...bulkCaIds] } },
      });
    }

    const now = nowVN();
    const recentDate = addDaysVN(now, -2);
    const expiredDate = addDaysVN(now, -10);
    const recentDateStr = formatDateVN(recentDate);
    const expiredDateStr = formatDateVN(expiredDate);
    const expiredDdMm = `${expiredDateStr.slice(8, 10)}/${expiredDateStr.slice(5, 7)}`;

    const qccDay =
      now.getDate() > 1 && now.getHours() === 0 && now.getMinutes() < 15
        ? addDaysVN(now, -1)
        : now;
    const qccDateDb = new Date(`${formatDateVN(qccDay)}T00:00:00.000Z`);

    try {
      await cleanupTest8();

      // Phần A: Dữ liệu thật hết hạn > 7 ngày (ẩn) vs <= 7 ngày (còn) trên Nhân viên
      await prisma.caLam.create({
        data: {
          Maca: "CA960011",
          Loaica: "Ca test hạn 96",
          Giobatdau: new Date("1970-01-01T06:00:00.000Z"),
          Gioketthuc: new Date("1970-01-01T11:30:00.000Z"),
          Sonvquydinh: 1,
        },
      });
      await prisma.lichLam.createMany({
        data: [
          {
            Malich: "LL960011",
            Ngaylam: new Date(`${recentDateStr}T00:00:00.000Z`),
            Maca: "CA960011",
          },
          {
            Malich: "LL960012",
            Ngaylam: new Date(`${expiredDateStr}T00:00:00.000Z`),
            Maca: "CA960011",
          },
        ],
      });
      await prisma.nhanVien_LichLam.createMany({
        data: [
          { Manv: "NV000001", Malich: "LL960011" },
          { Manv: "NV000001", Malich: "LL960012" },
        ],
      });
      await prisma.donXinDoiCa.createMany({
        data: [
          {
            Madon: "DD960011",
            Trangthaixuly: "Đã xử lý",
            Manv: "NV000001",
            Malich: "LL960011",
            Manvnhanthay: "NV000002",
          },
          {
            Madon: "DD960012",
            Trangthaixuly: "Đã xử lý",
            Manv: "NV000001",
            Malich: "LL960012",
            Manvnhanthay: "NV000002",
          },
        ],
      });
      await prisma.yeuCauBoSungCC.createMany({
        data: [
          {
            Mayeucau: "YC960011",
            Giovaobosung: null,
            Giorabosung: new Date("1970-01-01T11:30:00.000Z"),
            Lydo: "Gần 96",
            Trangthai: "Đã xử lý",
            Manv: "NV000001",
            Malich: "LL960011",
          },
          {
            Mayeucau: "YC960012",
            Giovaobosung: null,
            Giorabosung: new Date("1970-01-01T11:30:00.000Z"),
            Lydo: "Quá hạn 96",
            Trangthai: "Đã xử lý",
            Manv: "NV000001",
            Malich: "LL960012",
          },
        ],
      });

      const ctxNv = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const pageNv = await ctxNv.newPage();
      try {
        await ctxNv.addCookies([
          {
            name: AUTH_COOKIE_NAME,
            value: nv1Token,
            domain: "localhost",
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
          },
        ]);
        await pageNv.goto("/nhan-vien");
        await pageNv.evaluate(() => window.localStorage.clear());
        await pageNv.reload();

        const nvBell = pageNv.locator("#topbar-notification-bell");
        const nvBellCount = pageNv.getByTestId("notification-bell-count");
        await expect(nvBellCount).toBeVisible();
        const initialNvCount = Number(await nvBellCount.innerText());
        expect(initialNvCount).toBeGreaterThanOrEqual(2);

        await nvBell.click();
        const nvPopover = pageNv.getByTestId("notification-popover");
        await expect(nvPopover.getByTestId("notification-item-DC-DD960011")).toBeVisible();
        await expect(nvPopover.getByTestId("notification-item-BS-YC960011")).toBeVisible();
        await expect(nvPopover.getByTestId("notification-item-DC-DD960012")).toHaveCount(0);
        await expect(nvPopover.getByTestId("notification-item-BS-YC960012")).toHaveCount(0);

        // Card Thông báo trên Dashboard NV cũng loại bỏ mục quá 7 ngày
        const nvThongBaoCard = pageNv
          .locator("main h3", { hasText: "Thông báo của bạn" })
          .locator("..");
        await expect(nvThongBaoCard).toBeVisible();
        await expect(nvThongBaoCard).not.toContainText(expiredDdMm);

        // Đọc 1 thông báo còn hạn -> số chuông giảm đúng 1
        await nvPopover.getByTestId("notification-item-DC-DD960011").click();
        await expect(nvBellCount).toHaveText(String(initialNvCount - 1));
      } finally {
        await ctxNv.close();
      }

      // Phần B: Dữ liệu thật > 100 QCC trên CSDL -> Chủ quán hiện "99+", không tràn/cuộn ngang ở 360px & 1280px
      await prisma.caLam.createMany({
        data: bulkCaIds.map((id, i) => ({
          Maca: id,
          Loaica: `C96-${String(i + 1).padStart(3, "0")}`,
          Giobatdau: new Date("1970-01-01T00:01:00.000Z"),
          Gioketthuc: new Date("1970-01-01T00:05:00.000Z"),
          Sonvquydinh: 1,
        })),
      });
      await prisma.lichLam.createMany({
        data: bulkLlIds.map((id, i) => ({
          Malich: id,
          Ngaylam: qccDateDb,
          Maca: bulkCaIds[i],
        })),
      });
      await prisma.nhanVien_LichLam.createMany({
        data: bulkLlIds.map((id) => ({
          Manv: "NV000001",
          Malich: id,
        })),
      });

      const ctxCq = await browser.newContext({ viewport: { width: 360, height: 800 } });
      const pageCq = await ctxCq.newPage();
      try {
        await ctxCq.addCookies([
          {
            name: AUTH_COOKIE_NAME,
            value: cqToken,
            domain: "localhost",
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
          },
        ]);

        for (const vp of [
          { width: 360, height: 800 },
          { width: 1280, height: 800 },
        ]) {
          await pageCq.setViewportSize(vp);
          await pageCq.goto("/chu-quan");
          const bellCount = pageCq.getByTestId("notification-bell-count");
          await expect(bellCount).toHaveText("99+");

          const hasScrollClosed = await pageCq.evaluate(
            () => document.documentElement.scrollWidth > document.documentElement.clientWidth
          );
          expect(hasScrollClosed).toBe(false);

          const badgeBox = await bellCount.boundingBox();
          expect(badgeBox).not.toBeNull();
          expect(badgeBox!.x).toBeGreaterThanOrEqual(0);
          expect(badgeBox!.x + badgeBox!.width).toBeLessThanOrEqual(vp.width);

          await pageCq.locator("#topbar-notification-bell").click();
          const popover = pageCq.getByTestId("notification-popover");
          await expect(popover).toBeVisible();

          const popBox = await popover.boundingBox();
          expect(popBox).not.toBeNull();
          expect(popBox!.x).toBeGreaterThanOrEqual(0);
          expect(popBox!.x + popBox!.width).toBeLessThanOrEqual(vp.width);

          const hasScrollOpen = await pageCq.evaluate(
            () => document.documentElement.scrollWidth > document.documentElement.clientWidth
          );
          expect(hasScrollOpen).toBe(false);
        }

        // Phần C: 120 thông báo thông tin + 5 thông báo cần hành động -> giới hạn 50, giữ đủ 5 cần hành động
        const recentIso = `${recentDateStr}T10:00:00`;
        const todayIso = `${formatDateVN(now)}T12:00:00`;
        const cappedPayload = [
          ...Array.from({ length: 120 }, (_, i) => ({
            id: `DC-DD96T${String(i).padStart(3, "0")}`,
            khoa: `doi-ca-kq:DD96T${String(i).padStart(3, "0")}:NV000002`,
            suKien: `doi-ca:DD96T${String(i).padStart(3, "0")}`,
            nhom: "thong-tin",
            mocThoiGian: recentIso,
            tieuDe: "Đơn xin đổi ca đã được xử lý",
            thoiGian: `Ca sáng ${String(i + 1)}`,
            chiTiet: "Chủ quán đã duyệt thay đổi nhân viên nhận ca",
            link: "/chu-quan/lich-lam/doi-ca",
          })),
          ...Array.from({ length: 5 }, (_, i) => ({
            id: `YC-DD96A${String(i).padStart(3, "0")}`,
            khoa: `doi-ca:DD96A${String(i).padStart(3, "0")}`,
            suKien: `doi-ca:DD96A${String(i).padStart(3, "0")}`,
            nhom: "can-hanh-dong",
            mocThoiGian: todayIso,
            tieuDe: "Nguyễn Minh Anh · Đổi ca",
            thoiGian: "Hôm nay",
            chiTiet: "Ca sáng · Chưa có người thay",
            link: "/chu-quan/lich-lam/doi-ca",
          })),
        ];

        await pageCq.route("**/api/thong-bao", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              ok: true,
              data: { count: cappedPayload.length, items: cappedPayload },
            }),
          });
        });

        await pageCq.evaluate(() => window.localStorage.clear());
        await pageCq.setViewportSize({ width: 360, height: 800 });
        await pageCq.reload();

        await expect(pageCq.getByTestId("notification-bell-count")).toHaveText(
          String(THONG_BAO_TOI_DA_TRONG_DANH_SACH)
        );
        await pageCq.locator("#topbar-notification-bell").click();
        const cappedPopover = pageCq.getByTestId("notification-popover");
        await expect(
          cappedPopover.locator("[data-testid^='notification-item-']")
        ).toHaveCount(THONG_BAO_TOI_DA_TRONG_DANH_SACH);

        for (let i = 0; i < 5; i++) {
          await expect(
            cappedPopover.getByTestId(`notification-item-YC-DD96A${String(i).padStart(3, "0")}`)
          ).toBeVisible();
        }
        const noScroll360 = await pageCq.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth
        );
        expect(noScroll360).toBe(false);

        // Đọc 1 mục trong 50 mục -> chuông giảm xuống 49
        await cappedPopover.getByTestId("notification-item-YC-DD96A000").click();
        await expect(pageCq.getByTestId("notification-bell-count")).toHaveText(
          String(THONG_BAO_TOI_DA_TRONG_DANH_SACH - 1)
        );
      } finally {
        await ctxCq.close();
      }
    } finally {
      await cleanupTest8();
    }
  });
});
