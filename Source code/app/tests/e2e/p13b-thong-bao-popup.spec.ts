import { test, expect } from "@playwright/test";
import { signSession, AUTH_COOKIE_NAME } from "../../backend/lib/auth";
import {
  THAY_CA_LOI_MOI_TIEU_DE,
  XOA_NV_XAC_NHAN,
} from "../../frontend/config/thong-bao";

const RED_COLOR = "rgb(192, 57, 43)"; // #C0392B
const BORDER_BLUE = "rgb(112, 150, 209)"; // #7096D1
const BG_IVORY = "rgb(255, 249, 240)"; // #FFF9F0

const VIEWPORTS = [
  { width: 360, height: 800, name: "360px" },
  { width: 390, height: 844, name: "390px" },
  { width: 768, height: 1024, name: "768px" },
  { width: 1280, height: 800, name: "1280px" },
  { width: 1920, height: 1080, name: "1920x1080" },
];

test.describe("P13B - Chuông thông báo & Thống nhất popup toàn hệ thống", () => {
  let cqToken = "";
  let nvToken = "";

  test.beforeAll(async () => {
    process.env.JWT_SECRET =
      "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";
    cqToken = await signSession({
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Thanh Hà",
    });
    nvToken = await signSession({
      userId: "NV000001",
      username: "NV000001",
      role: "NhanVien",
      name: "Nguyễn Minh Anh",
    });
  });

  test("1. Chủ quán: chuông hiện số đỏ #C0392B, danh sách 'Thông báo của bạn', Escape/ngoài đóng, bấm mở đúng màn hình", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
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

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/chu-quan");
    await page.waitForLoadState("networkidle");

    const bell = page.locator("#topbar-notification-bell");
    const badge = page.getByTestId("notification-bell-count");
    await expect(bell).toBeVisible();
    await expect(badge).toBeVisible();
    const badgeColor = await badge.evaluate((el) => getComputedStyle(el).color);
    expect(badgeColor).toBe(RED_COLOR);

    const countVal = Number((await badge.innerText()).trim());
    expect(countVal).toBeGreaterThanOrEqual(1);

    // Mở danh sách "Thông báo của bạn"
    await bell.click();
    const popover = page.getByTestId("notification-popover");
    await expect(popover).toBeVisible();
    await expect(popover).toContainText("Thông báo của bạn");

    const popBg = await popover.evaluate((el) => getComputedStyle(el).backgroundColor);
    const popBorder = await popover.evaluate((el) => getComputedStyle(el).borderColor);
    expect(popBg).toBe(BG_IVORY);
    expect(popBorder).toBe(BORDER_BLUE);

    // Đóng bằng phím Escape
    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();

    // Mở lại và đóng khi bấm ra ngoài
    await bell.click();
    await expect(popover).toBeVisible();
    await page.locator("main").click({ position: { x: 20, y: 20 } });
    await expect(popover).toBeHidden();

    // Mở lại và bấm mục thông báo -> điều hướng tới chức năng liên quan (không 404)
    await bell.click();
    await expect(popover).toBeVisible();
    await page.screenshot({
      path: "../docs/ket-qua/p13b_chuong_1920x1080.png",
      fullPage: false,
    });
    const firstLinkItem = popover.locator("a").first();
    const targetHref = await firstLinkItem.getAttribute("href");
    expect(targetHref).toBeTruthy();
    expect(targetHref).not.toBe("/chu-quan/tong-quan");

    await firstLinkItem.click();
    await page.waitForURL(`**${targetHref}`);
    await expect(popover).toBeHidden();
    await expect(page.locator("body")).not.toContainText("404");
  });

  test("2. Nhân viên: chuông hiện đủ mục (lương mới, đổi ca, bổ sung, thay ca gấp) và bấm mở đúng trang", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await context.addCookies([
      {
        name: AUTH_COOKIE_NAME,
        value: nvToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.route("**/api/thong-bao", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            count: 4,
            items: [
              {
                id: "TC-MO-TC000001",
                tieuDe: "Trần Thu Hà · Thay ca gấp",
                thoiGian: "Ca tối (17:00 – 22:00)",
                chiTiet: THAY_CA_LOI_MOI_TIEU_DE,
                link: "/nhan-vien/ca-lam/thay-ca",
              },
              {
                id: "BL-KL202611",
                tieuDe: "Bảng lương tháng 11 đã sẵn sàng",
                thoiGian: "Tháng 11/2026",
                chiTiet: "Dự kiến · 100 giờ · 2.400.000đ",
                link: "/nhan-vien/luong/xem",
              },
              {
                id: "DC-DD000001",
                tieuDe: "Đơn xin đổi ca đã được xử lý",
                thoiGian: "Ca sáng 13/11",
                chiTiet: "Chủ quán đã duyệt thay đổi nhân viên nhận ca",
                link: "/nhan-vien/ca-lam/doi-ca",
              },
              {
                id: "BS-YC000001",
                tieuDe: "Yêu cầu bổ sung chấm công đã xử lý",
                thoiGian: "Ca chiều 12/11",
                chiTiet: "Đã cập nhật dữ liệu chấm công",
                link: "/nhan-vien/cham-cong/bo-sung",
              },
            ],
          },
        }),
      });
    });

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/nhan-vien");
    await page.waitForLoadState("networkidle");

    const badge = page.getByTestId("notification-bell-count");
    await expect(badge).toHaveText("4");
    expect(await badge.evaluate((el) => getComputedStyle(el).color)).toBe(RED_COLOR);

    await page.locator("#topbar-notification-bell").click();
    const popover = page.getByTestId("notification-popover");
    await expect(popover).toBeVisible();
    await expect(popover.locator("a")).toHaveCount(4);
    await expect(popover).toContainText(THAY_CA_LOI_MOI_TIEU_DE);

    // Bấm mục thay ca gấp -> mở /nhan-vien/ca-lam/thay-ca
    await page.getByTestId("notification-item-TC-MO-TC000001").click();
    await page.waitForURL("**/nhan-vien/ca-lam/thay-ca");
    await expect(page.locator("body")).not.toContainText("404");
  });

  test("3. Thống nhất popup: Xóa nhân viên dùng ConfirmDialog chuẩn Figma", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
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

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/chu-quan/nhan-vien/xoa");
    await page.waitForLoadState("networkidle");

    await page.locator("table tbody tr").first().click();
    await page.getByRole("button", { name: "Xóa thông tin" }).click();

    const dialog = page.locator("#dialog-xoa-nhan-vien");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(XOA_NV_XAC_NHAN);

    const bg = await dialog.evaluate((el) => getComputedStyle(el).backgroundColor);
    const borderColor = await dialog.evaluate((el) => getComputedStyle(el).borderColor);
    expect(bg).toBe(BG_IVORY);
    expect(borderColor).toBe(BORDER_BLUE);

    await dialog.getByRole("button", { name: "Hủy" }).click();
    await expect(dialog).toBeHidden();
  });

  for (const vp of VIEWPORTS) {
    test(`4. Responsive ở ${vp.name}: mở chuông 'Thông báo của bạn' không cuộn ngang`, async ({
      page,
      context,
    }) => {
      await context.clearCookies();
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

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/chu-quan");
      await page.waitForLoadState("networkidle");

      const overflowClosed = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(overflowClosed).toBe(false);

      await page.locator("#topbar-notification-bell").click();
      await expect(page.getByTestId("notification-popover")).toBeVisible();

      const overflowOpen = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(
        overflowOpen,
        `Popover chuông thông báo tràn ngang ở ${vp.name}`
      ).toBe(false);

      if (vp.width === 390) {
        await page.screenshot({
          path: "../docs/ket-qua/p13b_chuong_390px.png",
          fullPage: false,
        });
      }
    });
  }
});
