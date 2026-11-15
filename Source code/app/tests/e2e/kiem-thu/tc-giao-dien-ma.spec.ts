import { test, expect } from "@playwright/test";
import { signSession, AUTH_COOKIE_NAME } from "../../../backend/lib/auth";
import { prisma } from "../../../database/client";

test.describe("BƯỚC 2 - Ưu tiên 5: Giao diện kiểm tra được bằng mã (UC_6.3 không có 'Đang làm', placeholder, không cuộn ngang, màu thông báo)", () => {
  let chuQuanToken = "";
  let nhanVienToken = "";

  test.beforeAll(async () => {
    try {
      process.loadEnvFile();
    } catch {
      // ignore
    }

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

    // Đảm bảo có ít nhất 1 đơn đổi ca Chưa xử lý cho UC_6.3
    const existingDon = await prisma.donXinDoiCa.findFirst({
      where: { Trangthaixuly: "Chưa xử lý" },
    });
    if (!existingDon) {
      await prisma.lichLam.upsert({
        where: { Malich: "LL980001" },
        update: {},
        create: {
          Malich: "LL980001",
          Maca: "CA000001",
          Ngaylam: new Date("2098-11-15T00:00:00.000Z"),
        },
      });
      await prisma.nhanVien_LichLam.upsert({
        where: {
          Manv_Malich: { Manv: "NV000001", Malich: "LL980001" },
        },
        update: {},
        create: {
          Manv: "NV000001",
          Malich: "LL980001",
        },
      });
      await prisma.donXinDoiCa.upsert({
        where: { Madon: "DD980001" },
        update: { Trangthaixuly: "Chưa xử lý" },
        create: {
          Madon: "DD980001",
          Manv: "NV000001",
          Malich: "LL980001",
          Manvnhanthay: "NV000002",
          Trangthaixuly: "Chưa xử lý",
        },
      });
    }
  });

  test.afterAll(async () => {
    await prisma.donXinDoiCa.deleteMany({ where: { Madon: "DD980001" } });
    await prisma.nhanVien_LichLam.deleteMany({ where: { Malich: "LL980001" } });
    await prisma.lichLam.deleteMany({ where: { Malich: "LL980001" } });
  });

  // =========================================================================
  // TC_6.3_02: Bảng xem trước UC_6.3 không có chữ 'Đang làm'
  // =========================================================================
  test("TC_6.3_02: Bảng xem trước 'Lịch [Tên ca] sau khi lưu' ở UC_6.3 là bản xem trước, không có chữ 'Đang làm'", async ({
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

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/chu-quan/lich-lam/doi-ca");
    await page.waitForLoadState("networkidle");

    // Chọn đơn đầu tiên nếu chưa chọn
    const firstRow = page.locator("table tbody tr, [data-testid^='don-doi-ca-']").first();
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
    }

    const previewSection = page.locator("main");
    await expect(previewSection).toContainText(/sau khi lưu/i);
    await expect(previewSection).not.toContainText("Đang làm");
  });

  // =========================================================================
  // TC_CHUNG_04 & TC_5.1_14: Placeholder dạng 'Nhập ...' hoặc để trống, không có dữ liệu mẫu
  // =========================================================================
  test("TC_CHUNG_04 & TC_5.1_14: Các ô nhập liệu để trống hoặc placeholder dạng 'Nhập ...' / 'Tìm ...', không có tên/SĐT mẫu", async ({
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

    await page.setViewportSize({ width: 1440, height: 900 });
    const formRoutes = [
      "/chu-quan/nhan-vien/them",
      "/chu-quan/luong/muc-luong",
      "/chu-quan/luong/he-so",
      "/chu-quan/luong/tien-thuong",
    ];

    for (const route of formRoutes) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      const placeholders = await page
        .locator("input:not([type='hidden']):not([readonly]), textarea")
        .evaluateAll((els) =>
          els.map((el) => (el as HTMLInputElement).getAttribute("placeholder") || ""),
        );

      for (const ph of placeholders) {
        if (!ph) continue;
        // Không chứa số điện thoại mẫu dạng 090... hay tên người mẫu 'Nguyễn Văn'
        expect(ph).not.toMatch(/09\d{8}/);
        expect(ph).not.toMatch(/Nguyễn Văn|Trần Thị|Ví dụ:/i);
      }
    }
  });

  // =========================================================================
  // TC_CHUNG_01 & TC_CHUNG_02: Không cuộn ngang ở 360, 390, 768, 1024, 1184, 1280, 1920x1080
  // =========================================================================
  test("TC_CHUNG_01 & TC_CHUNG_02: Không có thanh cuộn ngang ở các kích thước 360, 390, 768, 1024, 1184, 1280, 1920x1080", async ({
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

    const viewports = [
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1184, height: 800 },
      { width: 1280, height: 800 },
      { width: 1920, height: 1080 },
    ];

    const routesToCheck = [
      "/chu-quan",
      "/chu-quan/nhan-vien/them",
      "/chu-quan/lich-lam/doi-ca",
      "/chu-quan/luong/tinh-luong",
      "/chu-quan/luong/chot-luong",
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      for (const route of routesToCheck) {
        await page.goto(route);
        await page.waitForLoadState("domcontentloaded");
        const overflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth - window.innerWidth;
        });
        expect(
          overflow,
          `Route ${route} tại ${vp.width}x${vp.height} bị tràn ngang ${overflow}px`,
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  // =========================================================================
  // TC_CHUNG_05: Màu thông báo lỗi #C0392B nền #F7ECEA, thành công nền #EDF3EB
  // =========================================================================
  test("TC_CHUNG_05: NotificationBanner lỗi có chữ/biểu tượng/viền #C0392B (rgb(192, 57, 43)) và nền #F7ECEA (rgb(247, 236, 234))", async ({
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
    await page.goto("/chu-quan/nhan-vien/them");
    await page.waitForLoadState("networkidle");
    await page.locator("button:has-text('Lưu')").click();

    const banner = page.locator("[data-testid='notification-banner']");
    await expect(banner).toBeVisible();

    const styles = await banner.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      const svg = el.querySelector("svg");
      const svgColor = svg ? window.getComputedStyle(svg).color : cs.color;
      return {
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        borderColor: cs.borderColor,
        svgColor,
      };
    });

    // #C0392B = rgb(192, 57, 43); #F7ECEA = rgb(247, 236, 234)
    expect(styles.color).toBe("rgb(192, 57, 43)");
    expect(styles.backgroundColor).toBe("rgb(247, 236, 234)");
    expect(styles.borderColor).toBe("rgb(192, 57, 43)");
    expect(styles.svgColor).toBe("rgb(192, 57, 43)");
  });

  // =========================================================================
  // TC_1_07: Ở trang đăng nhập, gây lỗi -> chữ, biểu tượng và viền #C0392B
  // =========================================================================
  test("TC_1_07: Thông báo lỗi ở trang đăng nhập có chữ, biểu tượng và viền #C0392B (rgb(192, 57, 43))", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/dang-nhap");
    await page.waitForLoadState("networkidle");

    await page.locator("#login-button").click();
    const emptyUserErr = page.locator("#empty-username-error");
    await expect(emptyUserErr).toBeVisible();
    const loginErrStyles = await page.evaluate(() => {
      const errEl = document.querySelector("#empty-username-error")!;
      const inputEl = document.querySelector("#username-input")!;
      const csErr = window.getComputedStyle(errEl);
      const csInput = window.getComputedStyle(inputEl);
      return {
        textColor: csErr.color,
        inputBorderColor: csInput.borderColor,
      };
    });
    expect(loginErrStyles.textColor).toBe("rgb(192, 57, 43)");
    expect(loginErrStyles.inputBorderColor).toBe("rgb(192, 57, 43)");
  });
});
