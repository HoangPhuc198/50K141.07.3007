import { test, expect } from "@playwright/test";
import { signSession, AUTH_COOKIE_NAME } from "../../backend/lib/auth";
import { prisma } from "../../database/client";
import {
  HE_SO_LUONG_LOI,
  HE_SO_LUONG_THOI_GIAN_SAI,
  HE_SO_LUONG_DA_XOA,
  HE_SO_LUONG_THANH_CONG,
  TIEN_THUONG_THANH_CONG,
  TIEN_THUONG_KHONG_HOP_LE,
  TIEN_THUONG_THIEU_LY_DO,
} from "../../frontend/config/thong-bao";

test.describe("E2E UC 8.4 (Hệ số lương) & UC 8.5 (Tiền thưởng)", () => {
  let chuQuanToken: string;
  let bangLuongSnapshot: Array<{
    Mabangluong: string;
    Tienthuong: number;
    Lydothuong: string | null;
  }> = [];

  test.beforeAll(async () => {
    process.env.JWT_SECRET = "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";

    chuQuanToken = await signSession({
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Hoàng Lan",
    });

    const rows = await prisma.bangLuong.findMany({
      select: { Mabangluong: true, Tienthuong: true, Lydothuong: true },
    });
    bangLuongSnapshot = rows.map((r) => ({
      Mabangluong: r.Mabangluong,
      Tienthuong: Number(r.Tienthuong ?? 0),
      Lydothuong: r.Lydothuong,
    }));
  });

  test.afterAll(async () => {
    await prisma.heSoLuong.deleteMany({
      where: { Ngaybatdau: { gte: new Date("2099-01-01T00:00:00.000Z") } },
    });

    const snapshotMap = new Map(bangLuongSnapshot.map((r) => [r.Mabangluong, r]));
    const currentRows = await prisma.bangLuong.findMany({
      select: { Mabangluong: true },
    });
    const newlyCreatedIds = currentRows
      .map((r) => r.Mabangluong)
      .filter((id) => !snapshotMap.has(id));
    if (newlyCreatedIds.length > 0) {
      await prisma.phanHoiLuong.deleteMany({
        where: { Mabangluong: { in: newlyCreatedIds } },
      });
      await prisma.chiTietBangLuong.deleteMany({
        where: { Mabangluong: { in: newlyCreatedIds } },
      });
      await prisma.bangLuong.deleteMany({
        where: { Mabangluong: { in: newlyCreatedIds } },
      });
    }
    for (const prev of bangLuongSnapshot) {
      await prisma.bangLuong.updateMany({
        where: { Mabangluong: prev.Mabangluong },
        data: { Tienthuong: prev.Tienthuong, Lydothuong: prev.Lydothuong },
      });
    }
  });

  test.beforeEach(async ({ context, page }) => {
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
  });

  test("Điều hướng từ menu: Đăng nhập -> Menu Quản lý lương -> Nhập hệ số lương & Nhập tiền thưởng", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/chu-quan");
    await page.waitForLoadState("domcontentloaded");

    // Mở nhóm Quản lý lương nếu chưa mở
    const groupBtn = page.locator('aside nav button:has-text("Quản lý lương")');
    await expect(groupBtn).toBeVisible();
    const linkHeSo = page.locator('aside nav a[href="/chu-quan/luong/he-so"]');
    const isVisible = await linkHeSo.isVisible().catch(() => false);
    if (!isVisible) {
      await groupBtn.click();
      await expect(linkHeSo).toBeVisible();
    }

    // Bấm menu Nhập hệ số lương
    await linkHeSo.click();
    await page.waitForURL("**/chu-quan/luong/he-so");
    expect(page.url()).toContain("/chu-quan/luong/he-so");
    await expect(page.locator("h2").first()).toContainText("Khoảng áp dụng đã cấu hình");

    // Bấm menu Nhập tiền thưởng
    const linkThuong = page.locator('aside nav a[href="/chu-quan/luong/tien-thuong"]');
    await expect(linkThuong).toBeVisible();
    await linkThuong.click();
    await page.waitForURL("**/chu-quan/luong/tien-thuong");
    expect(page.url()).toContain("/chu-quan/luong/tien-thuong");
    await expect(page.locator("h2").first()).toContainText("Tiền thưởng trong kỳ");
  });

  test("UC 8.4: Kiểm tra nhập hệ số lỗi & thời gian sai trên giao diện", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/chu-quan/luong/he-so");
    await page.waitForLoadState("networkidle");

    // 1. Nhập hệ số < 1
    await page.locator("#input-ngay-bat-dau").fill("24/12/2099");
    await page.locator("#input-ngay-ket-thuc").fill("25/12/2099");
    await page.locator("#input-he-so-luong").fill("0.5");
    await page.getByRole("button", { name: "Lưu" }).click();

    const bannerLoiHeSo = page.locator('[data-testid="notification-banner"]');
    await expect(bannerLoiHeSo).toBeVisible();
    await expect(bannerLoiHeSo).toContainText(HE_SO_LUONG_LOI);
    await expect(page.locator("#input-he-so-luong")).toHaveClass(/border-\[#C0392B\]/);

    // 2. Nhập thời gian kết thúc < ngày bắt đầu
    await page.locator("#input-he-so-luong").fill("2");
    await page.locator("#input-ngay-bat-dau").fill("25/12/2099");
    await page.locator("#input-ngay-ket-thuc").fill("24/12/2099");
    await page.getByRole("button", { name: "Lưu" }).click();

    await expect(bannerLoiHeSo).toBeVisible();
    await expect(bannerLoiHeSo).toContainText(HE_SO_LUONG_THOI_GIAN_SAI);
  });

  test("UC 8.4 (ma trận nhập số): Kiểm tra 0,5 / abc bị chặn và 1 / 1,5 / 2 / 2.5 lưu + hiện 'Đã lưu thành công'", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/chu-quan/luong/he-so");
    await page.waitForLoadState("networkidle");

    const banner = page.locator('[data-testid="notification-banner"]');
    const inputHeSo = page.locator("#input-he-so-luong");

    for (const bad of ["0,5", "abc"]) {
      await page.locator("#input-ngay-bat-dau").fill("24/12/2099");
      await page.locator("#input-ngay-ket-thuc").fill("25/12/2099");
      await inputHeSo.fill(bad);
      await page.getByRole("button", { name: "Lưu" }).click();

      await expect(banner).toBeVisible();
      await expect(banner).toContainText(HE_SO_LUONG_LOI);
      await expect(inputHeSo).toHaveClass(/border-\[#C0392B\]/);
    }

    for (const [raw, expectedNum] of [
      ["1", 1],
      ["1,5", 1.5],
      ["2", 2],
      ["2.5", 2.5],
    ] as const) {
      await page.locator("#input-ngay-bat-dau").fill("24/12/2099");
      await page.locator("#input-ngay-ket-thuc").fill("25/12/2099");
      await inputHeSo.fill(raw);
      await page.getByRole("button", { name: "Lưu" }).click();

      await expect(banner).toBeVisible();
      await expect(banner).toContainText(HE_SO_LUONG_THANH_CONG);

      const savedRow = await prisma.heSoLuong.findFirst({
        where: { Ngaybatdau: new Date("2099-12-24T00:00:00.000Z") },
        orderBy: { Maheso: "desc" },
      });
      expect(Number(savedRow?.Heso)).toBe(expectedNum);

      await prisma.heSoLuong.deleteMany({
        where: { Ngaybatdau: new Date("2099-12-24T00:00:00.000Z") },
      });
    }
  });

  test("UC 8.5: Kiểm tra chọn nhân viên bằng RadioChip, kiểm tra lỗi & lưu thưởng", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/chu-quan/luong/tien-thuong");
    await page.waitForLoadState("networkidle");

    // 1. Kiểm tra trạng thái ban đầu: chưa chọn nhân viên
    await expect(page.locator("h2").nth(1)).toContainText("Chọn 1 nhân viên để nhập tiền thưởng");

    // 2. Bấm chọn 1 dòng nhân viên trong bảng (RadioChip cả hàng)
    const firstRow = page.locator('tbody tr[role="radio"]').first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();

    // Hàng được active aria-checked = true
    await expect(firstRow).toHaveAttribute("aria-checked", "true");
    // Form bên phải cập nhật tiêu đề "Thưởng cho ..."
    await expect(page.locator("h2").nth(1)).toContainText("Thưởng cho");

    // 3. Nhập số tiền lỗi (ví dụ chuỗi âm hoặc chữ)
    await page.locator("#input-so-tien-thuong").fill("-50000");
    await page.locator("#input-ly-do-thuong").fill("Thưởng tết");
    await page.getByRole("button", { name: "Lưu" }).click();

    const banner = page.locator('[data-testid="notification-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(TIEN_THUONG_KHONG_HOP_LE);
    await expect(page.locator("#input-so-tien-thuong")).toHaveClass(/border-\[#C0392B\]/);

    // 4. Để trống lý do thưởng
    await page.locator("#input-so-tien-thuong").fill("100000");
    await page.locator("#input-ly-do-thuong").fill("");
    await page.getByRole("button", { name: "Lưu" }).click();

    await expect(banner).toBeVisible();
    await expect(banner).toContainText(TIEN_THUONG_THIEU_LY_DO);
    await expect(page.locator("#input-ly-do-thuong")).toHaveClass(/border-\[#C0392B\]/);

    // 5. Lưu hợp lệ
    await page.locator("#input-ly-do-thuong").fill("Sinh nhật nhân viên");
    await page.getByRole("button", { name: "Lưu" }).click();

    await expect(banner).toBeVisible();
    await expect(banner).toContainText(TIEN_THUONG_THANH_CONG);

    // 6. Nhập 200000 và 200.000 -> đều hợp lệ; nhập 100.5 và abc -> 'Số tiền không hợp lệ'
    await page.locator("#input-so-tien-thuong").fill("200000");
    await page.locator("#input-ly-do-thuong").fill("Thưởng 200000");
    await page.getByRole("button", { name: "Lưu" }).click();
    await expect(banner).toContainText(TIEN_THUONG_THANH_CONG);

    await page.locator("#input-so-tien-thuong").fill("200.000");
    await page.locator("#input-ly-do-thuong").fill("Thưởng 200.000");
    await page.getByRole("button", { name: "Lưu" }).click();
    await expect(banner).toContainText(TIEN_THUONG_THANH_CONG);

    for (const bad of ["100000.5", "100.5", "abc"]) {
      await page.locator("#input-so-tien-thuong").fill(bad);
      await page.getByRole("button", { name: "Lưu" }).click();
      await expect(banner).toContainText(TIEN_THUONG_KHONG_HOP_LE);
      await expect(page.locator("#input-so-tien-thuong")).toHaveClass(/border-\[#C0392B\]/);
    }
  });

  test("BUG-06 (TC_8.4_09 & TC_8.5_05): Bấm Hủy ở Nhập hệ số lương và Nhập tiền thưởng -> không lưu và quay về /chu-quan", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto("/chu-quan/luong/he-so");
    await page.waitForLoadState("networkidle");
    await page.locator("#input-he-so-luong").fill("3.5");
    await page.getByRole("button", { name: "Hủy" }).click();
    await page.waitForURL("**/chu-quan", { timeout: 10000 });
    expect(new URL(page.url()).pathname).toBe("/chu-quan");

    await page.goto("/chu-quan/luong/tien-thuong");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Hủy" }).click();
    await page.waitForURL("**/chu-quan", { timeout: 10000 });
    expect(new URL(page.url()).pathname).toBe("/chu-quan");
  });

  const VIEWPORTS = [
    { width: 360, height: 800, name: "360px" },
    { width: 390, height: 844, name: "390px" },
    { width: 768, height: 1024, name: "768px" },
    { width: 1280, height: 800, name: "1280px" },
    { width: 1920, height: 1080, name: "1920x1080" },
  ];

  for (const vp of VIEWPORTS) {
    test(`UC 8.4 (/chu-quan/luong/he-so) không cuộn ngang ở ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/chu-quan/luong/he-so");
      await page.waitForLoadState("domcontentloaded");

      const hasHScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasHScroll, `Có thanh cuộn ngang ở ${vp.name}`).toBe(false);

      if (vp.width === 1920 || vp.width === 390) {
        await page.screenshot({
          path: `../docs/ket-qua/uc-8.4-he-so_${vp.name}.png`,
          fullPage: false,
        });
      }
    });

    test(`UC 8.5 (/chu-quan/luong/tien-thuong) không cuộn ngang ở ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/chu-quan/luong/tien-thuong");
      await page.waitForLoadState("domcontentloaded");

      const hasHScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasHScroll, `Có thanh cuộn ngang ở ${vp.name}`).toBe(false);

      if (vp.width === 1920 || vp.width === 390) {
        await page.screenshot({
          path: `../docs/ket-qua/uc-8.5-tien-thuong_${vp.name}.png`,
          fullPage: false,
        });
      }
    });
  }
});
