import { test, expect } from "@playwright/test";
import { signSession, AUTH_COOKIE_NAME } from "../../backend/lib/auth";

test.describe("VIỆC 1: DatePicker dd/mm/yyyy tiếng Việt toàn hệ thống", () => {
  let chuQuanToken: string;

  test.beforeAll(async () => {
    process.env.JWT_SECRET =
      "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";
    chuQuanToken = await signSession({
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Thanh Hà",
    });
  });

  test.beforeEach(async ({ context }) => {
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

  test("Gõ 14112026 tự động thành 14/11/2026, từ chối ngày 31/02/2026, chọn lịch gửi ISO không lệch múi giờ", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/chu-quan/luong/he-so");
    await page.waitForLoadState("networkidle");

    const startInput = page.locator("#input-ngay-bat-dau");
    const endInput = page.locator("#input-ngay-ket-thuc");

    // 1. Placeholder dùng chữ hướng dẫn "Chọn ngày" (không dùng giá trị mẫu)
    await expect(startInput).toHaveAttribute("placeholder", "Chọn ngày");
    await expect(endInput).toHaveAttribute("placeholder", "Chọn ngày");

    // 2. Gõ 14112026 -> tự chèn dấu "/" thành 14/11/2026
    await startInput.click();
    await startInput.pressSequentially("14112026");
    await expect(startInput).toHaveValue("14/11/2026");

    // 3. Nhập ngày không có thật 31/02/2026 -> bị từ chối (aria-invalid="true" và viền #C0392B)
    await startInput.fill("31022026");
    await expect(startInput).toHaveValue("31/02/2026");
    await expect(startInput).toHaveAttribute("aria-invalid", "true");
    await expect(startInput).toHaveClass(/border-\[#C0392B\]/);

    // Bấm Lưu khi có ngày 31/02/2026 -> không gửi được, hiện thông báo lỗi
    await endInput.fill("15/11/2026");
    await page.getByRole("button", { name: "Lưu" }).click();
    await expect(page.locator('[data-testid="notification-banner"]')).toBeVisible();

    // 4. Mở lịch tiếng Việt, kiểm tra tên tháng + thứ T2..CN + vùng bấm >= 44px
    const openCalBtn = page.getByRole("button", { name: "Mở lịch chọn ngày bắt đầu" });
    const btnBox = await openCalBtn.boundingBox();
    expect(btnBox?.width).toBeGreaterThanOrEqual(44);
    expect(btnBox?.height).toBeGreaterThanOrEqual(44);
    await openCalBtn.click();

    const dialog = page.getByRole("dialog", { name: "Lịch chọn ngày" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Tháng \d{1,2} \d{4}/);
    for (const wd of ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]) {
      await expect(dialog.getByRole("columnheader", { name: wd })).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // 5. Chọn ngày 1 và ngày cuối tháng từ lịch -> giá trị dd/mm/yyyy & payload gửi API đúng ISO yyyy-mm-dd
    // Đưa về ngày 15/11/2026 trước để cố định tháng 11/2026
    await startInput.fill("15112026");
    await openCalBtn.click();
    await expect(dialog).toContainText("Tháng 11 2026");

    const day1Btn = dialog.getByRole("gridcell", { name: "Ngày 01/11/2026" });
    const day1Box = await day1Btn.boundingBox();
    expect(day1Box?.height).toBeGreaterThanOrEqual(44);
    await day1Btn.click();
    await expect(startInput).toHaveValue("01/11/2026");

    // Chọn ngày cuối tháng (30/11/2026) cho Ngày kết thúc
    const openEndBtn = page.getByRole("button", { name: "Mở lịch chọn ngày kết thúc" });
    await endInput.fill("10112026");
    await openEndBtn.click();
    const endDialog = page.getByRole("dialog", { name: "Lịch chọn ngày" });
    await endDialog.getByRole("gridcell", { name: "Ngày 30/11/2026" }).click();
    await expect(endInput).toHaveValue("30/11/2026");

    // Kiểm tra payload gửi POST /api/he-so luôn là ISO yyyy-mm-dd (chặn/intercept để không làm bẩn DB thật)
    let postedBody: Record<string, unknown> | null = null;
    await page.route("**/api/he-so", async (route) => {
      if (route.request().method() === "POST") {
        postedBody = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, data: {} }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole("button", { name: "Lưu" }).click();
    await expect.poll(() => postedBody).not.toBeNull();
    expect(postedBody).toMatchObject({
      Ngaybatdau: "2026-11-01",
      Ngayketthuc: "2026-11-30",
    });
  });
});
