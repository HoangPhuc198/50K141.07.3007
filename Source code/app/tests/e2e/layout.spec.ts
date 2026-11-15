import { test, expect } from "@playwright/test";
import { signSession, AUTH_COOKIE_NAME } from "../../backend/lib/auth";
import fs from "node:fs";
import path from "node:path";

const VIEWPORTS = [
  { width: 360, height: 800, name: "360px" },
  { width: 390, height: 844, name: "390px" },
  { width: 768, height: 1024, name: "768px" },
  { width: 1280, height: 800, name: "1280px" },
  { width: 1920, height: 1080, name: "1920x1080" },
];

test.describe("Kiểm tra Responsive & Bố cục không có cuộn ngang", () => {
  let chuQuanToken: string;
  let nhanVienToken: string;

  test.beforeAll(async () => {
    process.env.JWT_SECRET = "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";

    chuQuanToken = await signSession({
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Thanh Hà",
    });

    nhanVienToken = await signSession({
      userId: "NV000001",
      username: "NV000001",
      role: "NhanVien",
      name: "Nguyễn Minh Anh",
    });

    // Đảm bảo thư mục docs/ket-qua tồn tại
    const resultDir = path.resolve(__dirname, "../../../docs/ket-qua");
    if (!fs.existsSync(resultDir)) {
      fs.mkdirSync(resultDir, { recursive: true });
    }
  });

  for (const vp of VIEWPORTS) {
    test(`Màn hình /dang-nhap ở ${vp.name} không bị cuộn ngang`, async ({ page, context }) => {
      await context.clearCookies();
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/dang-nhap");
      await page.waitForLoadState("domcontentloaded");

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      expect(
        hasHorizontalScroll,
        `Trang /dang-nhap có thanh cuộn ngang ở ${vp.name} (scrollWidth > clientWidth)`
      ).toBe(false);

      if (vp.width === 1920 || vp.width === 390) {
        await page.screenshot({
          path: `../docs/ket-qua/dang-nhap_${vp.name}.png`,
          fullPage: false,
        });
      }
    });

    test(`Màn hình /chu-quan ở ${vp.name} không bị cuộn ngang`, async ({ page, context }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

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

      await page.goto("/chu-quan");
      await page.waitForLoadState("domcontentloaded");

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      expect(
        hasHorizontalScroll,
        `Trang /chu-quan có thanh cuộn ngang ở ${vp.name} (scrollWidth > clientWidth)`
      ).toBe(false);

      if (vp.width === 1920 || vp.width === 390) {
        await page.screenshot({
          path: `../docs/ket-qua/chu-quan_${vp.name}.png`,
          fullPage: false,
        });
      }
    });

    test(`Màn hình /nhan-vien ở ${vp.name} không bị cuộn ngang`, async ({ page, context }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      await context.addCookies([
        {
          name: AUTH_COOKIE_NAME,
          value: nhanVienToken,
          domain: "localhost",
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);

      await page.goto("/nhan-vien");
      await page.waitForLoadState("domcontentloaded");

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      expect(
        hasHorizontalScroll,
        `Trang /nhan-vien có thanh cuộn ngang ở ${vp.name} (scrollWidth > clientWidth)`
      ).toBe(false);

      if (vp.width === 1920 || vp.width === 390) {
        await page.screenshot({
          path: `../docs/ket-qua/nhan-vien_${vp.name}.png`,
          fullPage: false,
        });
      }
    });
  }

  test("Kiểm tra 3 trạng thái Figma trên giao diện /dang-nhap", async ({ page, context }) => {
    await context.clearCookies();
    await context.addCookies([
      {
        name: AUTH_COOKIE_NAME,
        value: "",
        domain: "localhost",
        path: "/",
        expires: 0,
      },
    ]);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dang-nhap");
    await page.waitForLoadState("domcontentloaded");

    // 1. Trạng thái 1: Mặc định
    await expect(page.locator("#username-input")).toBeVisible();
    await expect(page.locator("#password-input")).toBeVisible();
    await expect(page.locator("#login-button")).toBeVisible();

    // 2. Trạng thái 2: Lỗi để trống 2 ô
    await page.locator("#login-button").click();
    await expect(page.locator("#empty-username-error")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("#empty-username-error")).toHaveText("Không được để trống");
    await expect(page.locator("#empty-password-error")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("#empty-password-error")).toHaveText("Không được để trống");

    // 3. Trạng thái 3: Sai thông tin
    await page.locator("#username-input").fill("CQ000001");
    await page.locator("#password-input").fill("sai_mat_khau_123");
    await page.locator("#login-button").click();

    await expect(
      page.locator("#login-error-message")
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator("#login-error-message")
    ).toHaveText("Tên đăng nhập hoặc mật khẩu không đúng");
  });

  test("Chặn chuyển trang theo vai trò (Middleware)", async ({ page, context }) => {
    // Nhân viên không vào được /chu-quan
    await context.addCookies([
      {
        name: AUTH_COOKIE_NAME,
        value: nhanVienToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.goto("/chu-quan");
    await page.waitForURL("**/nhan-vien");
    expect(page.url()).toContain("/nhan-vien");

    // Chủ quán không vào được /nhan-vien
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

    await page.goto("/nhan-vien");
    await page.waitForURL("**/chu-quan");
    expect(page.url()).toContain("/chu-quan");
  });

  test.describe("Xử lý phím Enter & enterKeyHint trên màn hình /dang-nhap", () => {
    test.beforeEach(async ({ context }) => {
      await context.clearCookies();
    });

    test("enterKeyHint và thứ tự Tab trên các ô nhập", async ({ page }) => {
      await page.goto("/dang-nhap");
      await page.waitForLoadState("domcontentloaded");

      const usernameInput = page.locator("#username-input");
      const passwordInput = page.locator("#password-input");
      const loginButton = page.locator("#login-button");

      await expect(usernameInput).toHaveAttribute("enterkeyhint", "next");
      await expect(passwordInput).toHaveAttribute("enterkeyhint", "go");

      // Kiểm tra thứ tự Tab: username -> password -> login button
      await usernameInput.focus();
      await expect(usernameInput).toBeFocused();

      await page.keyboard.press("Tab");
      await expect(passwordInput).toBeFocused();

      await page.keyboard.press("Tab");
      await expect(loginButton).toBeFocused();
    });

    test("Gõ tên rồi Enter: focus chuyển sang ô mật khẩu và chưa gửi đăng nhập", async ({ page }) => {
      await page.goto("/dang-nhap");
      await page.waitForLoadState("domcontentloaded");

      const usernameInput = page.locator("#username-input");
      const passwordInput = page.locator("#password-input");

      await usernameInput.fill("CQ000001");
      await usernameInput.press("Enter");

      // Con trỏ chuyển xuống ô mật khẩu
      await expect(passwordInput).toBeFocused();

      // Chưa gửi đăng nhập: không hiện lỗi trống mật khẩu, vẫn ở màn hình /dang-nhap
      await expect(page.locator("#empty-password-error")).not.toBeVisible();
      await expect(page.locator("#login-error-message")).not.toBeVisible();
      expect(page.url()).toContain("/dang-nhap");
    });

    test("Để trống rồi Enter ở mật khẩu: hiện lỗi đúng chữ Figma", async ({ page }) => {
      await page.goto("/dang-nhap");
      await page.waitForLoadState("domcontentloaded");

      const passwordInput = page.locator("#password-input");

      // Trường hợp 1: cả 2 ô đều trống, focus ô mật khẩu rồi nhấn Enter
      await passwordInput.focus();
      await passwordInput.press("Enter");

      await expect(page.locator("#empty-username-error")).toBeVisible({ timeout: 5000 });
      await expect(page.locator("#empty-username-error")).toHaveText("Không được để trống");
      await expect(page.locator("#empty-password-error")).toBeVisible({ timeout: 5000 });
      await expect(page.locator("#empty-password-error")).toHaveText("Không được để trống");

      // Trường hợp 2: đã gõ tên nhưng để trống mật khẩu rồi nhấn Enter ở mật khẩu
      await page.goto("/dang-nhap");
      await page.waitForLoadState("domcontentloaded");

      await page.locator("#username-input").fill("CQ000001");
      await page.locator("#username-input").press("Enter");
      await expect(passwordInput).toBeFocused();
      await passwordInput.press("Enter");

      await expect(page.locator("#empty-password-error")).toBeVisible({ timeout: 5000 });
      await expect(page.locator("#empty-password-error")).toHaveText("Không được để trống");
      await expect(page.locator("#empty-username-error")).not.toBeVisible();
    });

    test("Gõ mật khẩu rồi Enter: vào được trang theo vai trò (Chủ quán & Nhân viên)", async ({ page }) => {
      // 1. Chủ quán
      await page.goto("/dang-nhap");
      await page.waitForLoadState("domcontentloaded");

      await page.locator("#username-input").fill("CQ000001");
      await page.locator("#username-input").press("Enter");
      await expect(page.locator("#password-input")).toBeFocused();

      await page.locator("#password-input").fill("123456");
      await page.locator("#password-input").press("Enter");

      await page.waitForURL("**/chu-quan", { timeout: 10000 });
      expect(page.url()).toContain("/chu-quan");

      // 2. Nhân viên
      await page.context().clearCookies();
      await page.goto("/dang-nhap");
      await page.waitForLoadState("domcontentloaded");

      await page.locator("#username-input").fill("NV000001");
      await page.locator("#username-input").press("Enter");
      await expect(page.locator("#password-input")).toBeFocused();

      await page.locator("#password-input").fill("123456");
      await page.locator("#password-input").press("Enter");

      await page.waitForURL("**/nhan-vien", { timeout: 10000 });
      expect(page.url()).toContain("/nhan-vien");
    });
  });

  // ============================================================
  // ĐỒNG BỘ GIAO DIỆN THEO RULES.md MỤC A.5 (UC_6.3 và UC_2.2)
  // ============================================================
  test.describe("Đồng bộ giao diện theo RULES.md (UC_6.3 và UC_2.2)", () => {
    // (a) Không có thanh cuộn dọc trang ở 1920x1080 (so sánh với màn chuẩn P6 /chu-quan/cham-cong/bo-sung)
    test("So sánh với màn chuẩn P6: UC_6.3 không có cuộn dọc trang ở 1920x1080", async ({ page, context }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });

      // 1. Màn chuẩn P6
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
      await page.goto("/chu-quan/cham-cong/bo-sung");
      await page.waitForLoadState("networkidle");
      const p6HasVScroll = await page.evaluate(() => {
        const main = document.querySelector("main");
        return main ? main.scrollHeight > main.clientHeight : false;
      });

      // 2. Màn UC_6.3 (/chu-quan/lich-lam/doi-ca)
      await page.goto("/chu-quan/lich-lam/doi-ca");
      await page.waitForLoadState("networkidle");
      const uc63HasVScroll = await page.evaluate(() => {
        const main = document.querySelector("main");
        return main ? main.scrollHeight > main.clientHeight : false;
      });

      // (a) màn mới không có cuộn dọc trang nếu màn chuẩn không có
      if (!p6HasVScroll) {
        expect(uc63HasVScroll, "UC_6.3 không có cuộn dọc trang ở 1920x1080").toBe(false);
      }
    });

    test("Màn UC_2.2 không có cuộn dọc trang ở 1920x1080", async ({ page, context }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await context.addCookies([
        {
          name: AUTH_COOKIE_NAME,
          value: nhanVienToken,
          domain: "localhost",
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      await page.goto("/nhan-vien/ca-lam/doi-ca");
      await page.waitForLoadState("networkidle");
      const uc22HasVScroll = await page.evaluate(() => {
        const main = document.querySelector("main");
        return main ? main.scrollHeight > main.clientHeight : false;
      });
      expect(uc22HasVScroll, "UC_2.2 không có cuộn dọc trang ở 1920x1080").toBe(false);
    });

    // (b) Không cuộn ngang ở mọi viewport (360, 390, 768, 1280, 1920)
    for (const vp of VIEWPORTS) {
      test(`Màn UC_6.3 ở ${vp.name} không bị cuộn ngang`, async ({ page, context }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
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
        await page.goto("/chu-quan/lich-lam/doi-ca");
        await page.waitForLoadState("networkidle");
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        expect(hasHorizontalScroll, `Trang UC_6.3 có thanh cuộn ngang ở ${vp.name}`).toBe(false);
      });

      test(`Màn UC_2.2 ở ${vp.name} không bị cuộn ngang`, async ({ page, context }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await context.addCookies([
          {
            name: AUTH_COOKIE_NAME,
            value: nhanVienToken,
            domain: "localhost",
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
          },
        ]);
        await page.goto("/nhan-vien/ca-lam/doi-ca");
        await page.waitForLoadState("networkidle");
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        expect(hasHorizontalScroll, `Trang UC_2.2 có thanh cuộn ngang ở ${vp.name}`).toBe(false);
      });
    }

    // (c) Khoảng cách dọc giữa các khối chính khớp token (sai số tối đa 4px)
    test("Khoảng cách dọc giữa các khối chính màn UC_6.3 khớp token (sai số <= 4px)", async ({ page, context }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
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
      await page.goto("/chu-quan/lich-lam/doi-ca");
      await page.waitForLoadState("networkidle");

      const distances = await page.evaluate(() => {
        const title = document.getElementById("title-yeu-cau-chua-xu-ly");
        const count = document.getElementById("count-yeu-cau");
        const table = document.querySelector("#card-yeu-cau-chua-xu-ly .overflow-hidden");
        const detail = document.getElementById("block-chi-tiet-don");

        const res: Record<string, number> = {};
        if (title && count) {
          const titleRect = title.getBoundingClientRect();
          const countRect = count.getBoundingClientRect();
          res.titleToCount = countRect.top - titleRect.bottom;
        }
        if (title && table) {
          const headerEl = count?.parentElement || title.parentElement || title;
          const headerRect = headerEl.getBoundingClientRect();
          const tableRect = table.getBoundingClientRect();
          res.headerToTable = tableRect.top - headerRect.bottom;
        }
        if (table && detail) {
          const tableRect = table.getBoundingClientRect();
          const detailRect = detail.getBoundingClientRect();
          res.tableToDetail = detailRect.top - tableRect.bottom;
        }
        return res;
      });

      // Token: space-block = 16px, space-item = 4px. Sai số tối đa 4px.
      if (distances.titleToCount !== undefined) {
        expect(Math.abs(distances.titleToCount - 4)).toBeLessThanOrEqual(4);
      }
      if (distances.headerToTable !== undefined) {
        expect(Math.abs(distances.headerToTable - 16)).toBeLessThanOrEqual(4);
      }
      if (distances.tableToDetail !== undefined) {
        expect(Math.abs(distances.tableToDetail - 16)).toBeLessThanOrEqual(4);
      }
    });

    test("Khoảng cách dọc giữa các khối chính màn UC_2.2 khớp token (sai số <= 4px)", async ({ page, context }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await context.addCookies([
        {
          name: AUTH_COOKIE_NAME,
          value: nhanVienToken,
          domain: "localhost",
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      await page.goto("/nhan-vien/ca-lam/doi-ca");
      await page.waitForLoadState("networkidle");

      const distances = await page.evaluate(() => {
        const title = document.getElementById("title-yeu-cau-doi-ca");
        const table = document.querySelector("#card-form-doi-ca .overflow-hidden");
        const res: Record<string, number> = {};
        if (title && table) {
          const headerRect = (title.parentElement || title).getBoundingClientRect();
          const tableRect = table.getBoundingClientRect();
          res.headerToTable = tableRect.top - headerRect.bottom;
        }
        return res;
      });

      if (distances.headerToTable !== undefined) {
        expect(Math.abs(distances.headerToTable - 16)).toBeLessThanOrEqual(4);
      }
    });

    test("Màn hình /nhan-vien/ca-lam/thay-ca không bị cuộn ngang trên các viewport", async ({ page, context }) => {
      await context.addCookies([
        {
          name: AUTH_COOKIE_NAME,
          value: nhanVienToken,
          domain: "localhost",
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);

      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto("/nhan-vien/ca-lam/thay-ca");
        await page.waitForLoadState("networkidle");

        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });

        expect(
          hasHorizontalScroll,
          `Trang /nhan-vien/ca-lam/thay-ca có thanh cuộn ngang ở ${vp.name}`
        ).toBe(false);
      }
    });

    test("Khoảng cách dọc giữa các khối chính màn UC_2.3 khớp token (sai số <= 4px)", async ({ page, context }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await context.addCookies([
        {
          name: AUTH_COOKIE_NAME,
          value: nhanVienToken,
          domain: "localhost",
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      await page.goto("/nhan-vien/ca-lam/thay-ca");
      await page.waitForLoadState("networkidle");

      const distances = await page.evaluate(() => {
        const title = document.getElementById("title-nguoi-ranh");
        const table = document.querySelector("#card-nguoi-ranh .overflow-hidden");
        const res: Record<string, number> = {};
        if (title && table) {
          const headerRect = (title.parentElement || title).getBoundingClientRect();
          const tableRect = table.getBoundingClientRect();
          res.headerToTable = tableRect.top - headerRect.bottom;
        }
        return res;
      });

      if (distances.headerToTable !== undefined) {
        expect(Math.abs(distances.headerToTable - 16)).toBeLessThanOrEqual(4);
      }
    });
  });

  test.describe("Chống tự zoom trên điện thoại khi đăng nhập", () => {
    test("Mobile 390px: viewport đúng, ô nhập >= 16px và sau đăng nhập không bị phóng to hay tràn ngang", async ({ browser }) => {
      const mobileContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      });
      const page = await mobileContext.newPage();

      try {
        await page.goto("/dang-nhap");
        await page.waitForSelector("[data-hydrated='true']", { timeout: 10000 });

        const viewportContent = await page.locator('meta[name="viewport"]').getAttribute("content");
        expect(viewportContent).toContain("width=device-width");
        expect(viewportContent).toContain("initial-scale=1");
        expect(viewportContent).toContain("maximum-scale=1");

        const inputFontSizes = await page.evaluate(() => {
          const userEl = document.getElementById("username-input");
          const passEl = document.getElementById("password-input");
          return {
            user: userEl ? parseFloat(getComputedStyle(userEl).fontSize) : 0,
            pass: passEl ? parseFloat(getComputedStyle(passEl).fontSize) : 0,
          };
        });
        expect(inputFontSizes.user).toBeGreaterThanOrEqual(16);
        expect(inputFontSizes.pass).toBeGreaterThanOrEqual(16);

        await page.locator("#username-input").tap();
        await page.locator("#username-input").fill("CQ000001");
        await page.locator("#password-input").tap();
        await page.locator("#password-input").fill("123456");
        await page.locator("#login-button").tap();

        await page.waitForURL("**/chu-quan", { timeout: 10000 });
        await page.waitForLoadState("networkidle");

        const postLoginMetrics = await page.evaluate(() => ({
          scale: window.visualViewport?.scale ?? 1,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(postLoginMetrics.scale).toBe(1);
        expect(postLoginMetrics.scrollWidth).toBeLessThanOrEqual(postLoginMetrics.clientWidth);
      } finally {
        await mobileContext.close();
      }
    });
  });

  test.describe("UC_4.2 Phản hồi sai sót lương: ô co theo thẻ, không cắt/đè nhau", () => {
    const UC42_VIEWPORTS = [
      { width: 360, height: 800, name: "360px" },
      { width: 390, height: 844, name: "390px" },
      { width: 768, height: 1024, name: "768px" },
      { width: 1024, height: 768, name: "1024px" },
      { width: 1184, height: 800, name: "1184px" },
      { width: 1280, height: 800, name: "1280px" },
      { width: 1920, height: 1080, name: "1920x1080" },
    ];

    for (const vp of UC42_VIEWPORTS) {
      test(`UC_4.2 ở ${vp.name}: không cuộn ngang, 2 thẻ không đè nhau, 2 ô vừa khít thẻ trái`, async ({
        page,
        context,
      }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await context.addCookies([
          {
            name: AUTH_COOKIE_NAME,
            value: nhanVienToken,
            domain: "localhost",
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
          },
        ]);

        await page.goto("/nhan-vien/luong/phan-hoi");
        await page.waitForLoadState("networkidle");
        await page.waitForSelector("#uc42-card-phan-hoi", { timeout: 10000 });

        const metrics = await page.evaluate(() => {
          const leftCard = document.getElementById("uc42-card-phan-hoi");
          const rightCard = document.getElementById("uc42-card-ky-luong");
          const nvBox = document.getElementById("uc42-box-nhan-vien");
          const klBox = document.getElementById("uc42-box-ky-luong");
          const cancelBtn = Array.from(document.querySelectorAll("button")).find(
            (b) => b.textContent?.trim() === "Hủy"
          );
          const submitBtn = Array.from(document.querySelectorAll("button")).find(
            (b) => b.textContent?.trim() === "Gửi"
          );
          if (!leftCard || !rightCard || !nvBox || !klBox || !cancelBtn || !submitBtn) {
            return null;
          }
          const lc = leftCard.getBoundingClientRect();
          const rc = rightCard.getBoundingClientRect();
          const nv = nvBox.getBoundingClientRect();
          const kl = klBox.getBoundingClientRect();
          const nvIcon = nvBox.querySelector("svg")?.getBoundingClientRect();
          const klIcon = klBox.querySelector("svg")?.getBoundingClientRect();
          const nvText = nvBox.querySelector("span")?.getBoundingClientRect();
          const klText = klBox.querySelector("span")?.getBoundingClientRect();

          const overlapX = Math.max(0, Math.min(lc.right, rc.right) - Math.max(lc.left, rc.left));
          const overlapY = Math.max(0, Math.min(lc.bottom, rc.bottom) - Math.max(lc.top, rc.top));
          const fieldOverlapX = Math.max(0, Math.min(nv.right, kl.right) - Math.max(nv.left, kl.left));
          const fieldOverlapY = Math.max(0, Math.min(nv.bottom, kl.bottom) - Math.max(nv.top, kl.top));

          return {
            hasHorizontalScroll:
              document.documentElement.scrollWidth > document.documentElement.clientWidth,
            cardsOverlapArea: overlapX * overlapY,
            fieldsOverlapArea: fieldOverlapX * fieldOverlapY,
            lc: { left: lc.left, right: lc.right, top: lc.top, bottom: lc.bottom },
            rc: { left: rc.left, right: rc.right, top: rc.top, bottom: rc.bottom },
            nv: { left: nv.left, right: nv.right, top: nv.top, height: nv.height, scrollWidth: nvBox.scrollWidth, clientWidth: nvBox.clientWidth },
            kl: { left: kl.left, right: kl.right, top: kl.top, height: kl.height, scrollWidth: klBox.scrollWidth, clientWidth: klBox.clientWidth },
            nvIconRight: nvIcon?.right ?? 0,
            klIconRight: klIcon?.right ?? 0,
            nvTextOverflow: nvText && nvIcon ? nvText.right > nvIcon.left + 1 : false,
            klTextOverflow: klText && klIcon ? klText.right > klIcon.left + 1 : false,
            cancelHeight: cancelBtn.getBoundingClientRect().height,
            submitHeight: submitBtn.getBoundingClientRect().height,
          };
        });

        expect(metrics).not.toBeNull();
        if (!metrics) return;

        expect(metrics.hasHorizontalScroll).toBe(false);
        expect(metrics.cardsOverlapArea).toBeLessThanOrEqual(1);
        expect(metrics.fieldsOverlapArea).toBeLessThanOrEqual(1);
        // Hai ô nằm gọn bên trong thẻ trái
        expect(metrics.nv.left).toBeGreaterThanOrEqual(metrics.lc.left - 1);
        expect(metrics.nv.right).toBeLessThanOrEqual(metrics.lc.right + 1);
        expect(metrics.kl.left).toBeGreaterThanOrEqual(metrics.lc.left - 1);
        expect(metrics.kl.right).toBeLessThanOrEqual(metrics.lc.right + 1);
        expect(metrics.nv.scrollWidth).toBeLessThanOrEqual(metrics.nv.clientWidth + 1);
        expect(metrics.kl.scrollWidth).toBeLessThanOrEqual(metrics.kl.clientWidth + 1);
        // Icon ổ khóa không bị đẩy ra ngoài
        expect(metrics.nvIconRight).toBeLessThanOrEqual(metrics.nv.right + 1);
        expect(metrics.klIconRight).toBeLessThanOrEqual(metrics.kl.right + 1);
        expect(metrics.nvTextOverflow).toBe(false);
        expect(metrics.klTextOverflow).toBe(false);
        // Vùng bấm >= 44px
        expect(metrics.cancelHeight).toBeGreaterThanOrEqual(44);
        expect(metrics.submitHeight).toBeGreaterThanOrEqual(44);

        // Ở 1920x1080 giữ bố cục Figma: 2 thẻ ngang hàng, 2 ô trong thẻ trái xếp ngang
        if (vp.width === 1920) {
          expect(metrics.lc.right).toBeLessThanOrEqual(metrics.rc.left);
          expect(Math.abs(metrics.nv.top - metrics.kl.top)).toBeLessThanOrEqual(4);
          expect(metrics.nv.right).toBeLessThanOrEqual(metrics.kl.left);
        }
      });
    }
  });

  test.describe("UC_3.3 Bổ sung chấm công: cặp ô Giờ vào / Giờ kết thúc co theo thẻ, không bị cắt", () => {
    const UC33_VIEWPORTS = [
      { width: 360, height: 800, name: "360px", expectHorizontalPair: false },
      { width: 390, height: 844, name: "390px", expectHorizontalPair: false },
      { width: 768, height: 1024, name: "768px", expectHorizontalPair: true },
      { width: 1024, height: 768, name: "1024px", expectHorizontalPair: false },
      { width: 1184, height: 800, name: "1184px", expectHorizontalPair: false },
      { width: 1280, height: 800, name: "1280px", expectHorizontalPair: false },
      { width: 1920, height: 1080, name: "1920x1080", expectHorizontalPair: true },
    ];

    const MOCK_CA_THIEU = [
      {
        malich: "LLTEST01",
        ngayLam: "2026-11-10",
        ngayHienThi: "10/11/2026",
        ngayNgan: "10/11",
        maca: "CA000001",
        loaica: "Ca sáng",
        tenCa: "Ca sáng (07:00 - 12:00)",
        gioBatDau: "07:00",
        gioKetThuc: "12:00",
        loaiThieu: "Quên check-in",
        gioDaCheckIn: null,
      },
    ];

    for (const vp of UC33_VIEWPORTS) {
      test(`UC_3.3 ở ${vp.name}: không cuộn ngang, ô Giờ vào & Giờ kết thúc không bị cắt ở cả 2 chế độ`, async ({
        page,
        context,
      }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await context.addCookies([
          {
            name: AUTH_COOKIE_NAME,
            value: nhanVienToken,
            domain: "localhost",
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
          },
        ]);

        await page.route("**/api/bo-sung-cc/ca-thieu", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ ok: true, data: { items: MOCK_CA_THIEU } }),
          });
        });

        await page.goto("/nhan-vien/cham-cong/bo-sung");
        await page.waitForLoadState("networkidle");
        await page.waitForSelector("#input-gio-vao", { timeout: 10000 });

        const measureUC33 = async (mode: "check-in" | "check-out") => {
          return page.evaluate((m) => {
            const sections = Array.from(document.querySelectorAll("section"));
            const leftCard = sections[0];
            const rightCard = sections[1];
            const gioVaoEl =
              m === "check-in"
                ? document.getElementById("input-gio-vao")
                : document.getElementById("readonly-gio-vao");
            const gioVaoBox =
              m === "check-in" ? gioVaoEl?.parentElement : gioVaoEl;
            const gioRaInput = document.getElementById("input-gio-ket-thuc");
            const gioRaBox = gioRaInput?.parentElement;
            if (!leftCard || !rightCard || !gioVaoEl || !gioVaoBox || !gioRaInput || !gioRaBox) {
              return null;
            }
            const lc = leftCard.getBoundingClientRect();
            const rc = rightCard.getBoundingClientRect();
            const b1 = gioVaoBox.getBoundingClientRect();
            const b2 = gioRaBox.getBoundingClientRect();
            const rIn1 = gioVaoEl.getBoundingClientRect();
            const rIn2 = gioRaInput.getBoundingClientRect();
            const svg1 = gioVaoBox.querySelector("svg")?.getBoundingClientRect();
            const svg2 = gioRaBox.querySelector("svg")?.getBoundingClientRect();
            const prefix1 = gioVaoBox.querySelector("span")?.getBoundingClientRect();
            const prefix2 = gioRaBox.querySelector("span")?.getBoundingClientRect();

            const cardsOverlapX = Math.max(0, Math.min(lc.right, rc.right) - Math.max(lc.left, rc.left));
            const cardsOverlapY = Math.max(0, Math.min(lc.bottom, rc.bottom) - Math.max(lc.top, rc.top));
            const pairOverlapX = Math.max(0, Math.min(b1.right, b2.right) - Math.max(b1.left, b2.left));
            const pairOverlapY = Math.max(0, Math.min(b1.bottom, b2.bottom) - Math.max(b1.top, b2.top));

            return {
              hasHorizontalScroll:
                document.documentElement.scrollWidth > document.documentElement.clientWidth,
              cardsOverlapArea: cardsOverlapX * cardsOverlapY,
              pairOverlapArea: pairOverlapX * pairOverlapY,
              rc: { left: rc.left, right: rc.right },
              b1: { left: b1.left, right: b1.right, top: b1.top, bottom: b1.bottom, width: b1.width },
              b2: { left: b2.left, right: b2.right, top: b2.top, bottom: b2.bottom, width: b2.width },
              in1: {
                left: rIn1.left,
                right: rIn1.right,
                clientWidth: gioVaoEl.clientWidth,
                scrollWidth: gioVaoEl.scrollWidth,
              },
              in2: {
                left: rIn2.left,
                right: rIn2.right,
                clientWidth: gioRaInput.clientWidth,
                scrollWidth: gioRaInput.scrollWidth,
              },
              svg1Right: svg1?.right ?? 0,
              svg1Left: svg1?.left ?? b1.right,
              svg2Right: svg2?.right ?? 0,
              svg2Left: svg2?.left ?? b2.right,
              prefix1Right: prefix1?.right ?? 0,
              prefix2Right: prefix2?.right ?? 0,
            };
          }, mode);
        };

        // 1. Chế độ "Quên check-in" (#input-gio-vao + #input-gio-ket-thuc)
        const mIn = await measureUC33("check-in");
        expect(mIn).not.toBeNull();
        if (!mIn) return;

        expect(mIn.hasHorizontalScroll).toBe(false);
        expect(mIn.cardsOverlapArea).toBeLessThanOrEqual(1);
        expect(mIn.pairOverlapArea).toBeLessThanOrEqual(1);
        expect(mIn.b1.left).toBeGreaterThanOrEqual(mIn.rc.left - 1);
        expect(mIn.b1.right).toBeLessThanOrEqual(mIn.rc.right + 1);
        expect(mIn.b2.left).toBeGreaterThanOrEqual(mIn.rc.left - 1);
        expect(mIn.b2.right).toBeLessThanOrEqual(mIn.rc.right + 1);
        expect(mIn.b1.width).toBeGreaterThanOrEqual(240);
        expect(mIn.b2.width).toBeGreaterThanOrEqual(240);
        expect(mIn.in1.clientWidth).toBeGreaterThanOrEqual(100);
        expect(mIn.in2.clientWidth).toBeGreaterThanOrEqual(100);
        expect(mIn.in1.scrollWidth).toBeLessThanOrEqual(mIn.in1.clientWidth + 1);
        expect(mIn.in2.scrollWidth).toBeLessThanOrEqual(mIn.in2.clientWidth + 1);
        expect(mIn.svg1Right).toBeLessThanOrEqual(mIn.b1.right + 1);
        expect(mIn.svg2Right).toBeLessThanOrEqual(mIn.b2.right + 1);
        expect(mIn.prefix1Right).toBeLessThanOrEqual(mIn.in1.left + 1);
        expect(mIn.prefix2Right).toBeLessThanOrEqual(mIn.in2.left + 1);
        expect(mIn.in1.right).toBeLessThanOrEqual(mIn.svg1Left + 1);
        expect(mIn.in2.right).toBeLessThanOrEqual(mIn.svg2Left + 1);
        if (vp.expectHorizontalPair) {
          expect(Math.abs(mIn.b1.top - mIn.b2.top)).toBeLessThanOrEqual(4);
          expect(mIn.b1.right).toBeLessThanOrEqual(mIn.b2.left + 1);
        } else {
          expect(mIn.b1.bottom).toBeLessThanOrEqual(mIn.b2.top + 1);
        }

        // 2. Chuyển sang "Quên check-out" (#readonly-gio-vao + #input-gio-ket-thuc)
        await page.selectOption("#select-loai-yeu-cau", "Quên check-out");
        await page.waitForSelector("#readonly-gio-vao", { timeout: 5000 });
        const mOut = await measureUC33("check-out");
        expect(mOut).not.toBeNull();
        if (!mOut) return;

        expect(mOut.hasHorizontalScroll).toBe(false);
        expect(mOut.pairOverlapArea).toBeLessThanOrEqual(1);
        expect(mOut.b1.width).toBeGreaterThanOrEqual(240);
        expect(mOut.b2.width).toBeGreaterThanOrEqual(240);
        expect(mOut.in2.clientWidth).toBeGreaterThanOrEqual(100);
        expect(mOut.in2.scrollWidth).toBeLessThanOrEqual(mOut.in2.clientWidth + 1);
        expect(mOut.svg1Right).toBeLessThanOrEqual(mOut.b1.right + 1);
        expect(mOut.svg2Right).toBeLessThanOrEqual(mOut.b2.right + 1);
        if (vp.expectHorizontalPair) {
          expect(Math.abs(mOut.b1.top - mOut.b2.top)).toBeLessThanOrEqual(4);
          expect(mOut.b1.right).toBeLessThanOrEqual(mOut.b2.left + 1);
        } else {
          expect(mOut.b1.bottom).toBeLessThanOrEqual(mOut.b2.top + 1);
        }
      });
    }
  });

  test.describe("UC_7.1 Duyệt bổ sung chấm công: cặp ô co theo thẻ, không bị bóp hẹp", () => {
    const UC71_VIEWPORTS = [
      { width: 360, height: 800, name: "360px", expectHorizontalPair: false },
      { width: 390, height: 844, name: "390px", expectHorizontalPair: false },
      { width: 768, height: 1024, name: "768px", expectHorizontalPair: true },
      { width: 1024, height: 768, name: "1024px", expectHorizontalPair: false },
      { width: 1184, height: 800, name: "1184px", expectHorizontalPair: false },
      { width: 1280, height: 800, name: "1280px", expectHorizontalPair: false },
      { width: 1920, height: 1080, name: "1920x1080", expectHorizontalPair: true },
    ];

    const MOCK_YEU_CAU = [
      {
        mayeucau: "YCTEST01",
        manv: "NV000001",
        tenNhanVien: "Nguyễn Minh Anh",
        malich: "LLTEST01",
        ngayLam: "2026-11-10",
        ngayHienThi: "10/11/2026",
        loaica: "Ca sáng",
        caLam: "Ca sáng (07:00 - 12:00)",
        loaiYeuCau: "Quên check-out",
        giovaobosung: null,
        giorabosung: "12:05",
        gioCheckInHienTai: "07:01",
        gioBatDauCa: "07:00",
        gioKetThucCa: "12:00",
        lydo: "Quên bấm ra ca",
        trangthai: "Chưa xử lý",
      },
      {
        mayeucau: "YCTEST02",
        manv: "NV000002",
        tenNhanVien: "Trần Thu Hà",
        malich: "LLTEST02",
        ngayLam: "2026-11-11",
        ngayHienThi: "11/11/2026",
        loaica: "Ca tối",
        caLam: "Ca tối (17:00 - 22:00)",
        loaiYeuCau: "Quên check-in",
        giovaobosung: "17:05",
        giorabosung: "22:00",
        gioCheckInHienTai: null,
        gioBatDauCa: "17:00",
        gioKetThucCa: "22:00",
        lydo: "Máy hết pin lúc vào ca",
        trangthai: "Chưa xử lý",
      },
    ];

    for (const vp of UC71_VIEWPORTS) {
      test(`UC_7.1 ở ${vp.name}: không cuộn ngang, cặp ô không cắt ở Quên check-out & Quên check-in`, async ({
        page,
        context,
      }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
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

        await page.route("**/api/bo-sung-cc/xu-ly", async (route) => {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ ok: true, data: { items: MOCK_YEU_CAU } }),
          });
        });

        await page.goto("/chu-quan/cham-cong/bo-sung");
        await page.waitForLoadState("networkidle");
        await page.waitForSelector("#detail-ca-lam", { timeout: 10000 });

        const measureUC71 = async (mode: "check-out" | "check-in") => {
          return page.evaluate((m) => {
            const sections = Array.from(document.querySelectorAll("section"));
            const leftCard = sections[0];
            const rightCard = sections[1];
            const firstEl =
              m === "check-out"
                ? document.getElementById("detail-ca-lam")
                : document.getElementById("input-gio-bat-dau");
            const secondEl = document.getElementById("input-gio-ket-thuc");
            if (!leftCard || !rightCard || !firstEl || !secondEl) return null;

            const lc = leftCard.getBoundingClientRect();
            const rc = rightCard.getBoundingClientRect();
            const b1 = firstEl.getBoundingClientRect();
            const b2 = secondEl.getBoundingClientRect();
            const label1 = firstEl.parentElement?.querySelector("label")?.getBoundingClientRect();
            const label2 = secondEl.parentElement?.querySelector("label")?.getBoundingClientRect();

            const cardsOverlapX = Math.max(0, Math.min(lc.right, rc.right) - Math.max(lc.left, rc.left));
            const cardsOverlapY = Math.max(0, Math.min(lc.bottom, rc.bottom) - Math.max(lc.top, rc.top));
            const pairOverlapX = Math.max(0, Math.min(b1.right, b2.right) - Math.max(b1.left, b2.left));
            const pairOverlapY = Math.max(0, Math.min(b1.bottom, b2.bottom) - Math.max(b1.top, b2.top));

            return {
              hasHorizontalScroll:
                document.documentElement.scrollWidth > document.documentElement.clientWidth,
              cardsOverlapArea: cardsOverlapX * cardsOverlapY,
              pairOverlapArea: pairOverlapX * pairOverlapY,
              rc: { left: rc.left, right: rc.right },
              b1: { left: b1.left, right: b1.right, top: b1.top, bottom: b1.bottom, width: b1.width, clientWidth: firstEl.clientWidth, scrollWidth: firstEl.scrollWidth },
              b2: { left: b2.left, right: b2.right, top: b2.top, bottom: b2.bottom, width: b2.width, clientWidth: secondEl.clientWidth, scrollWidth: secondEl.scrollWidth },
              label1Height: label1?.height ?? 0,
              label2Height: label2?.height ?? 0,
            };
          }, mode);
        };

        // 1. Dòng 1: Quên check-out (#detail-ca-lam + #input-gio-ket-thuc)
        const mOut = await measureUC71("check-out");
        expect(mOut).not.toBeNull();
        if (!mOut) return;

        expect(mOut.hasHorizontalScroll).toBe(false);
        expect(mOut.cardsOverlapArea).toBeLessThanOrEqual(1);
        expect(mOut.pairOverlapArea).toBeLessThanOrEqual(1);
        expect(mOut.b1.left).toBeGreaterThanOrEqual(mOut.rc.left - 1);
        expect(mOut.b1.right).toBeLessThanOrEqual(mOut.rc.right + 1);
        expect(mOut.b2.left).toBeGreaterThanOrEqual(mOut.rc.left - 1);
        expect(mOut.b2.right).toBeLessThanOrEqual(mOut.rc.right + 1);
        expect(mOut.b1.width).toBeGreaterThanOrEqual(190);
        expect(mOut.b2.width).toBeGreaterThanOrEqual(190);
        expect(mOut.b2.clientWidth).toBeGreaterThanOrEqual(150);
        expect(mOut.b2.scrollWidth).toBeLessThanOrEqual(mOut.b2.clientWidth + 1);
        expect(mOut.label2Height).toBeLessThanOrEqual(28);
        if (vp.expectHorizontalPair) {
          expect(Math.abs(mOut.b1.top - mOut.b2.top)).toBeLessThanOrEqual(4);
          expect(mOut.b1.right).toBeLessThanOrEqual(mOut.b2.left + 1);
        } else {
          expect(mOut.b1.bottom).toBeLessThanOrEqual(mOut.b2.top + 1);
        }

        // 2. Chọn dòng 2: Quên check-in (#input-gio-bat-dau + #input-gio-ket-thuc)
        if (vp.width >= 768) {
          await page.click('[data-testid="yeu-cau-row-YCTEST02"]');
        } else {
          await page.click('button:has-text("Trần Thu Hà")');
        }
        await page.waitForSelector("#input-gio-bat-dau", { timeout: 5000 });

        const mIn = await measureUC71("check-in");
        expect(mIn).not.toBeNull();
        if (!mIn) return;

        expect(mIn.hasHorizontalScroll).toBe(false);
        expect(mIn.pairOverlapArea).toBeLessThanOrEqual(1);
        expect(mIn.b1.width).toBeGreaterThanOrEqual(190);
        expect(mIn.b2.width).toBeGreaterThanOrEqual(190);
        expect(mIn.b1.clientWidth).toBeGreaterThanOrEqual(150);
        expect(mIn.b2.clientWidth).toBeGreaterThanOrEqual(150);
        expect(mIn.b1.scrollWidth).toBeLessThanOrEqual(mIn.b1.clientWidth + 1);
        expect(mIn.b2.scrollWidth).toBeLessThanOrEqual(mIn.b2.clientWidth + 1);
        expect(mIn.label1Height).toBeLessThanOrEqual(28);
        expect(mIn.label2Height).toBeLessThanOrEqual(28);
        if (vp.expectHorizontalPair) {
          expect(Math.abs(mIn.b1.top - mIn.b2.top)).toBeLessThanOrEqual(4);
          expect(mIn.b1.right).toBeLessThanOrEqual(mIn.b2.left + 1);
        } else {
          expect(mIn.b1.bottom).toBeLessThanOrEqual(mIn.b2.top + 1);
        }
      });
    }
  });
});
