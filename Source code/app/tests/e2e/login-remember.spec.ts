import { test, expect } from "@playwright/test";
import { REMEMBERED_USERNAMES_KEY } from "../../frontend/lib/remember-username";

test.describe("VIỆC 4 – Nhớ tên tài khoản ở màn đăng nhập", () => {
  test("Đăng nhập thành công lưu tên (không lưu mật khẩu/token), mở lại tự điền & focus mật khẩu; Enter điều hướng đúng", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await context.clearCookies();
    await page.goto("/dang-nhap");
    await page.waitForSelector("[data-hydrated='true']");

    // Ô mật khẩu giữ autocomplete="off"
    await expect(page.locator("#password-input")).toHaveAttribute("autocomplete", "off");

    // Enter ở ô tên đăng nhập đưa focus xuống ô mật khẩu
    await page.locator("#username-input").fill("chuquan");
    await page.locator("#username-input").press("Enter");
    await expect(page.locator("#password-input")).toBeFocused();

    // Đăng nhập thành công
    await page.locator("#password-input").fill("123456");
    await page.locator("#password-input").press("Enter");
    await expect(page).toHaveURL(/\/chu-quan$/);

    // Kiểm tra localStorage chỉ lưu tên đăng nhập, tuyệt đối không lưu mật khẩu hay token
    const lsSnapshot = await page.evaluate(() => {
      const obj: Record<string, string> = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i)!;
        obj[k] = window.localStorage.getItem(k) ?? "";
      }
      return obj;
    });
    expect(JSON.parse(lsSnapshot[REMEMBERED_USERNAMES_KEY])).toEqual(["chuquan"]);
    const joinedValues = Object.values(lsSnapshot).join("|");
    expect(joinedValues).not.toContain("123456");
    expect(joinedValues.toLowerCase()).not.toContain("token");
    expect(joinedValues).not.toContain("eyJ");

    // Đăng xuất / xóa cookie và mở lại /dang-nhap
    await context.clearCookies();
    await page.goto("/dang-nhap");
    await page.waitForSelector("[data-hydrated='true']");

    await expect(page.locator("#username-input")).toHaveValue("chuquan");
    await expect(page.locator("#password-input")).toHaveValue("");
    await expect(page.locator("#password-input")).toBeFocused();
  });

  test("Đăng nhập thất bại không lưu tên tài khoản", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/dang-nhap");
    await page.waitForSelector("[data-hydrated='true']");

    await page.locator("#username-input").fill("NV_KHONG_TON_TAI_TEST");
    await page.locator("#password-input").fill("matkhausai_999");
    await page.locator("#login-button").click();
    await expect(page.locator("#login-error-message")).toBeVisible();

    const stored = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      REMEMBERED_USERNAMES_KEY
    );
    expect(stored).toBeNull();
  });

  test("Hai tài khoản hiển thị đủ, không trùng hoa thường, chọn bằng chuột & nút × xóa hoạt động", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await context.clearCookies();
    await page.goto("/dang-nhap");
    await page.waitForSelector("[data-hydrated='true']");

    // Tài khoản 1: chuquan
    await page.locator("#username-input").fill("chuquan");
    await page.locator("#password-input").fill("123456");
    await page.locator("#login-button").click();
    await expect(page).toHaveURL(/\/chu-quan$/);

    // Đăng xuất & đăng nhập tài khoản 2: NV000001
    await context.clearCookies();
    await page.goto("/dang-nhap");
    await page.waitForSelector("[data-hydrated='true']");
    await page.locator("#username-input").fill("NV000001");
    await page.locator("#password-input").fill("123456");
    await page.locator("#login-button").click();
    await expect(page).toHaveURL(/\/nhan-vien$/);

    // Mở lại /dang-nhap: NV000001 mới nhất được điền sẵn
    await context.clearCookies();
    await page.goto("/dang-nhap");
    await page.waitForSelector("[data-hydrated='true']");
    await expect(page.locator("#username-input")).toHaveValue("NV000001");

    // Bấm vào ô tên đăng nhập: combobox mở danh sách chứa cả 2 tài khoản, mới nhất trước
    await page.locator("#username-input").click();
    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible();
    const options = listbox.getByRole("option");
    await expect(options).toHaveCount(2);
    await expect(options.nth(0)).toHaveText("NV000001");
    await expect(options.nth(1)).toHaveText("chuquan");

    // Vùng bấm >= 44px
    const optBox = await options.nth(0).boundingBox();
    expect(optBox!.height).toBeGreaterThanOrEqual(44);
    const delBtn = page.getByRole("button", { name: "Xóa NV000001 khỏi danh sách" });
    const delBox = await delBtn.boundingBox();
    expect(delBox!.height).toBeGreaterThanOrEqual(44);
    expect(delBox!.width).toBeGreaterThanOrEqual(44);

    // Bấm × xóa NV000001
    await delBtn.click();
    await expect(options).toHaveCount(1);
    await expect(options.nth(0)).toHaveText("chuquan");

    // Chọn chuquan bằng chuột -> tự điền vào ô và đóng danh sách, focus xuống mật khẩu
    await options.nth(0).click();
    await expect(listbox).toBeHidden();
    await expect(page.locator("#username-input")).toHaveValue("chuquan");
    await expect(page.locator("#password-input")).toBeFocused();
  });

  test("15 tài khoản giới hạn 10, cuộn dọc nội bộ ~4–5 dòng, không làm trang cuộn, lọc và phím mũi tên/Enter/Esc", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await context.clearCookies();

    const accounts15 = Array.from({ length: 15 }, (_, i) => `NV${String(i + 1).padStart(6, "0")}`);
    await page.addInitScript(
      ({ key, items }) => {
        window.localStorage.setItem(key, JSON.stringify(items));
      },
      { key: REMEMBERED_USERNAMES_KEY, items: accounts15 }
    );

    await page.goto("/dang-nhap");
    await page.waitForSelector("[data-hydrated='true']");

    // Tự điền tài khoản đầu (từ 15 phần tử bị cắt còn 10)
    await expect(page.locator("#username-input")).toHaveValue("NV000001");

    // Mở danh sách thả xuống
    await page.locator("#username-input").click();
    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible();

    const options = listbox.getByRole("option");
    await expect(options).toHaveCount(10);

    // Chiều cao tối đa ~4–5 dòng và có cuộn dọc nội bộ
    const metrics = await listbox.evaluate((el) => ({
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      docScrollW: document.documentElement.scrollWidth,
      docClientW: document.documentElement.clientWidth,
      docScrollH: document.documentElement.scrollHeight,
      winInnerH: window.innerHeight,
    }));
    expect(metrics.clientHeight).toBeLessThanOrEqual(225);
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
    expect(metrics.docScrollW).toBeLessThanOrEqual(metrics.docClientW);
    expect(metrics.docScrollH).toBeLessThanOrEqual(metrics.winInnerH);

    // Gõ lọc theo chữ
    await page.locator("#username-input").fill("000009");
    await expect(options).toHaveCount(1);
    await expect(options.nth(0)).toHaveText("NV000009");

    // Xóa hết chữ -> hiện đủ 10, thử phím ArrowDown + Enter chọn dòng thứ 2
    await page.locator("#username-input").fill("");
    await expect(options).toHaveCount(10);
    await page.locator("#username-input").press("ArrowDown");
    await page.locator("#username-input").press("ArrowDown");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    await page.locator("#username-input").press("Enter");
    await expect(page.locator("#username-input")).toHaveValue("NV000002");
    await expect(listbox).toBeHidden();

    // Esc đóng dropdown
    await page.locator("#username-input").click();
    await expect(listbox).toBeVisible();
    await page.locator("#username-input").press("Escape");
    await expect(listbox).toBeHidden();
  });

  test("Hoạt động bình thường khi localStorage bị chặn", async ({ page, context }) => {
    await context.clearCookies();
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() {
          throw new DOMException("Storage disabled", "SecurityError");
        },
      });
    });

    await page.goto("/dang-nhap");
    await page.waitForSelector("[data-hydrated='true']");
    await page.locator("#username-input").fill("chuquan");
    await page.locator("#password-input").fill("123456");
    await page.locator("#login-button").click();
    await expect(page).toHaveURL(/\/chu-quan$/);
  });
});
