import { test, expect } from "@playwright/test";
import { signSession, AUTH_COOKIE_NAME } from "../../backend/lib/auth";
import { BAO_CAO_CHAM_CONG_TRONG } from "../../frontend/config/thong-bao";
import { prisma } from "../../database/client";
import fs from "node:fs";
import path from "node:path";

const BLUE_COLOR = "rgb(51, 78, 172)"; // #334EAC

const VIEWPORTS = [
  { width: 360, height: 800, name: "360px" },
  { width: 390, height: 844, name: "390px" },
  { width: 768, height: 1024, name: "768px" },
  { width: 1280, height: 800, name: "1280px" },
  { width: 1920, height: 1080, name: "1920x1080" },
];

test.describe("UC_7.2 (U22) - Xem báo cáo chấm công", () => {
  let chuQuanToken: string;

  const testDate = "2097-10-15";
  const testDateDisplay = "15/10/2097";
  const testMalich = "LL979001";
  const testCC = "CC979001";

  test.beforeAll(async () => {
    process.env.JWT_SECRET =
      "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";

    chuQuanToken = await signSession({
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Thanh Hà",
    });

    const resultDir = path.resolve(__dirname, "../../../docs/ket-qua");
    if (!fs.existsSync(resultDir)) {
      fs.mkdirSync(resultDir, { recursive: true });
    }

    await prisma.chamCong.deleteMany({ where: { Machamcong: testCC } });
    await prisma.nhanVien_LichLam.deleteMany({ where: { Malich: testMalich } });
    await prisma.lichLam.deleteMany({ where: { Malich: testMalich } });

    await prisma.lichLam.create({
      data: {
        Malich: testMalich,
        Ngaylam: new Date(`${testDate}T00:00:00Z`),
        Maca: "CA000001",
      },
    });

    await prisma.nhanVien_LichLam.create({
      data: {
        Manv: "NV000001",
        Malich: testMalich,
      },
    });

    await prisma.chamCong.create({
      data: {
        Machamcong: testCC,
        Manv: "NV000001",
        Malich: testMalich,
        Thoigiancheckin: new Date(`${testDate}T06:00:00Z`),
        Thoigiancheckout: new Date(`${testDate}T11:30:00Z`),
      },
    });
  });

  test.afterAll(async () => {
    await prisma.chamCong.deleteMany({ where: { Machamcong: testCC } });
    await prisma.nhanVien_LichLam.deleteMany({ where: { Malich: testMalich } });
    await prisma.lichLam.deleteMany({ where: { Malich: testMalich } });
  });

  test("1. Điều hướng từ menu, xem theo ngày, theo tháng, chi tiết nhân viên, trạng thái trống và nút Đóng", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await context.addCookies([
      {
        name: AUTH_COOKIE_NAME,
        value: chuQuanToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.setViewportSize({ width: 1280, height: 800 });

    // Mở từ menu: đăng nhập -> menu -> Quản lý chấm công -> Xem báo cáo chấm công
    await page.goto("/chu-quan");
    await page.waitForLoadState("networkidle");

    await page
      .locator("aside nav button:has-text('Quản lý chấm công')")
      .click();
    const menuItem = page.locator(
      "aside nav a[href='/chu-quan/cham-cong/bao-cao']"
    );
    await expect(menuItem).toBeVisible();
    await menuItem.click();
    await page.waitForURL("**/chu-quan/cham-cong/bao-cao");
    await page.waitForSelector("[data-hydrated='true']");

    // Mục đang đứng sáng lên
    await expect(menuItem).toHaveClass(/bg-\[#F7F2EB\]/);
    await expect(menuItem).toHaveClass(/text-\[#334EAC\]/);

    // Chọn ngày có dữ liệu test (15/10/2097)
    const dateInput = page.locator("#input-ngay-bao-cao");
    await dateInput.fill(testDateDisplay);
    await dateInput.press("Enter");

    await expect(page.locator("h2", { hasText: "Chấm công ngày 15/10" })).toBeVisible();
    const dailyRow = page.locator("table tbody tr").first();
    await expect(dailyRow).toContainText("Nguyễn Minh Anh");
    await expect(dailyRow).toContainText("Sáng");
    await expect(dailyRow).toContainText("06:00");
    await expect(dailyRow).toContainText("11:30");
    await expect(dailyRow).toContainText("5,5 giờ");

    // Chọn ngày không có dữ liệu (25/12/2097) -> Không có dữ liệu
    await dateInput.fill("25/12/2097");
    await dateInput.press("Enter");
    const emptyBox = page.locator("[data-testid='empty-bao-cao']");
    await expect(emptyBox).toBeVisible();
    const emptyText = emptyBox.locator("p");
    await expect(emptyText).toHaveText(BAO_CAO_CHAM_CONG_TRONG);
    const emptyColor = await emptyText.evaluate(
      (el) => window.getComputedStyle(el).color
    );
    expect(emptyColor).toBe(BLUE_COLOR);

    // Chuyển Xem theo -> Tháng
    await page.locator("#select-xem-theo").selectOption("thang");
    // Chuyển năm đến 2097 và chọn Tháng 10
    const nextYearBtn = page.locator("button[aria-label='Năm sau']");
    const prevYearBtn = page.locator("button[aria-label='Năm trước']");
    for (let i = 0; i < 80; i++) {
      const yrText = await page.locator("text=/Năm \\d{4}/").textContent();
      const currentYr = parseInt(yrText?.replace(/\D/g, "") || "2026", 10);
      if (currentYr === 2097) break;
      if (currentYr < 2097) await nextYearBtn.click();
      else await prevYearBtn.click();
    }
    await page.locator("button", { hasText: /^Tháng 10$/ }).click();

    await expect(
      page.locator("h2", { hasText: "Chấm công tháng 10/2097" })
    ).toBeVisible();
    const monthlyRow = page.locator("table tbody tr").first();
    await expect(monthlyRow).toContainText("Nguyễn Minh Anh");
    await expect(monthlyRow).toContainText("1");
    await expect(monthlyRow).toContainText("5,5 giờ");

    // Nhấn Chi tiết -> mở UC_7.2_03
    await monthlyRow.locator("button", { hasText: "Chi tiết" }).click();
    await expect(
      page.locator("h2", { hasText: "Chi tiết chấm công - Nguyễn Minh Anh" })
    ).toBeVisible();
    await expect(page.locator("#pagination-summary")).toContainText("1/1 ngày");
    const detailRow = page.locator("table tbody tr").first();
    await expect(detailRow).toContainText("15/10/2097");
    await expect(detailRow).toContainText("Ca sáng");
    await expect(detailRow).toContainText("06:00");
    await expect(detailRow).toContainText("11:30");
    await expect(detailRow).toContainText("5,5 giờ");

    // Nhấn Đóng từ Chi tiết -> quay lại bảng theo tháng
    await page.locator("#btn-dong").click();
    await expect(
      page.locator("h2", { hasText: "Chấm công tháng 10/2097" })
    ).toBeVisible();

    // Chọn Tháng 12/2097 không có dữ liệu -> Không có dữ liệu
    await page.locator("button", { hasText: /^Tháng 12$/ }).click();
    await expect(emptyBox).toBeVisible();
    await expect(emptyText).toHaveText(BAO_CAO_CHAM_CONG_TRONG);

    // Nhấn Đóng từ màn chính -> quay lại Quản lý chấm công (/chu-quan/cham-cong -> /chu-quan/cham-cong/bo-sung)
    await page.locator("#btn-dong").click();
    await page.waitForURL("**/chu-quan/cham-cong/bo-sung");
  });

  test("2. Responsive 360/390/768/1280/1920px: không cuộn ngang, bảng thành thẻ trên điện thoại & chụp ảnh kiểm tra", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await context.addCookies([
      {
        name: AUTH_COOKIE_NAME,
        value: chuQuanToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/chu-quan/cham-cong/bao-cao");
      await page.waitForSelector("[data-hydrated='true']");
      await page.waitForLoadState("networkidle");

      // Chọn ngày có dữ liệu test để kiểm tra bảng/thẻ thật
      const dateInput = page.locator("#input-ngay-bao-cao");
      await dateInput.fill(testDateDisplay);
      await dateInput.press("Enter");
      await page.waitForTimeout(300);

      const hasHScroll = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
      );
      expect(hasHScroll, `UC_7.2 bị cuộn ngang ở ${vp.name}`).toBe(false);

      if (vp.width < 768) {
        await expect(page.locator("table")).toBeHidden();
        await expect(page.locator(".md\\:hidden").first()).toBeVisible();
      } else {
        await expect(page.locator("table")).toBeVisible();
      }

      if (vp.width === 1920) {
        const shellHeight = await page.evaluate(
          () => document.documentElement.clientHeight
        );
        expect(shellHeight).toBeLessThanOrEqual(1080);
      }

      if (vp.width === 390 || vp.width === 1920) {
        await page.screenshot({
          path: `../docs/ket-qua/uc7-2-bao-cao_${vp.name}.png`,
          fullPage: false,
        });
      }
    }
  });
});
