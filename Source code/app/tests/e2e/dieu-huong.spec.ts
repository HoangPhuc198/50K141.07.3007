import { test, expect, type Page, type Response } from "@playwright/test";
import { signSession, AUTH_COOKIE_NAME } from "../../backend/lib/auth";
import { chuQuanMenu, nhanVienMenu } from "../../frontend/config/menu";

interface HttpErrorEntry {
  status: number;
  url: string;
}

function theoDoiLoiHttp(page: Page) {
  const errors: HttpErrorEntry[] = [];

  const onResponse = (response: Response) => {
    const status = response.status();
    const url = response.url();
    let pathname = "";
    try {
      pathname = new URL(url).pathname;
    } catch {
      pathname = url;
    }
    const isFavicon404 = status === 404 && pathname.endsWith("/favicon.ico");
    if (status >= 500 || (status === 404 && !isFavicon404)) {
      errors.push({ status, url });
    }
  };

  page.on("response", onResponse);

  return {
    reset: () => {
      errors.length = 0;
    },
    consume: () => errors.splice(0, errors.length),
    dispose: () => {
      page.off("response", onResponse);
    },
  };
}

async function kiemTraTrangKhongLoi(
  page: Page,
  theoDoiHttp: ReturnType<typeof theoDoiLoiHttp>,
  expectedHref: string
) {
  await page.waitForLoadState("networkidle");
  expect(page.url()).toContain(expectedHref);

  const httpErrors = theoDoiHttp.consume();
  expect(
    httpErrors,
    `Trang ${expectedHref} có phản hồi HTTP lỗi: ${JSON.stringify(httpErrors)}`
  ).toEqual([]);

  const title = await page.title();
  expect(
    title,
    `Trang ${expectedHref} có tiêu đề trang lỗi: "${title}"`
  ).not.toMatch(/^\s*(404|500)\b|404:\s*This page could not be found|Internal Server Error|Application error/i);

  const errorHeading = page.locator("h1, h2").filter({
    hasText: /^\s*(404|500)\s*$|This page could not be found|Internal Server Error|Application error/i,
  });
  await expect(errorHeading).toHaveCount(0);
}

test.describe("Kiểm tra Điều hướng & Menu một nguồn (dieu-huong.spec.ts)", () => {
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
  });

  test.describe("Vai trò Chủ quán: Điều hướng qua sidebar & kiểm tra active", () => {
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
      await page.setViewportSize({ width: 1920, height: 1080 });
    });

    test("Bấm lần lượt mọi mục menu của Chủ quán: đúng route, không 404/500, mục sáng lên", async ({ page }) => {
      const loiHttp = theoDoiLoiHttp(page);
      try {
        await page.goto("/chu-quan");
        await kiemTraTrangKhongLoi(page, loiHttp, "/chu-quan");

        for (const group of chuQuanMenu) {
          if (group.href) {
            // Mục đơn (Màn hình chính)
            const link = page.locator(`aside nav a[href="${group.href}"]`);
            await expect(link).toBeVisible();
            loiHttp.reset();
            await link.click();
            await page.waitForURL(`**${group.href}`);

            // Không bị lỗi 404 hay 500 theo HTTP status và tiêu đề/heading trang lỗi
            await kiemTraTrangKhongLoi(page, loiHttp, group.href);

            // Mục sáng lên (active)
            await expect(link).toHaveClass(/bg-\[#F7F2EB\]/);
            await expect(link).toHaveClass(/text-\[#334EAC\]/);
          } else if (group.items) {
            // Nhóm cha: Mở nhóm nếu chưa mở
            const groupBtn = page.locator(`aside nav button:has-text("${group.title}")`);
            await expect(groupBtn).toBeVisible();

            // Kiểm tra xem mục con đầu tiên đã hiển thị chưa, nếu chưa thì click để mở
            const firstItemLink = page.locator(`aside nav a[href="${group.items[0].href}"]`);
            const isVisible = await firstItemLink.isVisible().catch(() => false);
            if (!isVisible) {
              await groupBtn.click();
              await expect(firstItemLink).toBeVisible();
            }

            for (const item of group.items) {
              const itemLink = page.locator(`aside nav a[href="${item.href}"]`);
              await expect(itemLink).toBeVisible();
              loiHttp.reset();
              await itemLink.click();
              await page.waitForURL(`**${item.href}`);

              // Không bị lỗi 404 hay 500 theo HTTP status và tiêu đề/heading trang lỗi
              await kiemTraTrangKhongLoi(page, loiHttp, item.href);

              // Mục con sáng lên (active)
              await expect(itemLink).toHaveClass(/bg-\[#F7F2EB\]/);
              await expect(itemLink).toHaveClass(/text-\[#334EAC\]/);
            }
          }
        }
      } finally {
        loiHttp.dispose();
      }
    });

    test("Không có thanh cuộn ngang trên mọi trang của Chủ quán ở 1920px và 390px", async ({ page }) => {
      const allRoutes = chuQuanMenu.flatMap((g) => (g.href ? [g.href] : (g.items || []).map((i) => i.href)));

      for (const width of [1920, 390]) {
        await page.setViewportSize({ width, height: width === 1920 ? 1080 : 844 });
        for (const route of allRoutes) {
          await page.goto(route);
          await page.waitForLoadState("domcontentloaded");

          const hasHScroll = await page.evaluate(
            () => document.documentElement.scrollWidth > document.documentElement.clientWidth
          );
          expect(hasHScroll, `Trang ${route} bị cuộn ngang ở ${width}px`).toBe(false);
        }
      }
    });
  });

  test.describe("Vai trò Nhân viên: Điều hướng qua sidebar & kiểm tra active", () => {
    test.beforeEach(async ({ context, page }) => {
      await context.clearCookies();
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
      await page.setViewportSize({ width: 1920, height: 1080 });
    });

    test("Bấm lần lượt mọi mục menu của Nhân viên: đúng route, không 404/500, mục sáng lên", async ({ page }) => {
      const loiHttp = theoDoiLoiHttp(page);
      try {
        await page.goto("/nhan-vien");
        await kiemTraTrangKhongLoi(page, loiHttp, "/nhan-vien");

        for (const group of nhanVienMenu) {
          if (group.href) {
            const link = page.locator(`aside nav a[href="${group.href}"]`);
            await expect(link).toBeVisible();
            loiHttp.reset();
            await link.click();
            await page.waitForURL(`**${group.href}`);

            await kiemTraTrangKhongLoi(page, loiHttp, group.href);

            await expect(link).toHaveClass(/bg-\[#F7F2EB\]/);
            await expect(link).toHaveClass(/text-\[#334EAC\]/);
          } else if (group.items) {
            const groupBtn = page.locator(`aside nav button:has-text("${group.title}")`);
            await expect(groupBtn).toBeVisible();

            const firstItemLink = page.locator(`aside nav a[href="${group.items[0].href}"]`);
            const isVisible = await firstItemLink.isVisible().catch(() => false);
            if (!isVisible) {
              await groupBtn.click();
              await expect(firstItemLink).toBeVisible();
            }

            for (const item of group.items) {
              const itemLink = page.locator(`aside nav a[href="${item.href}"]`);
              await expect(itemLink).toBeVisible();
              loiHttp.reset();
              await itemLink.click();
              await page.waitForURL(`**${item.href}`);

              await kiemTraTrangKhongLoi(page, loiHttp, item.href);

              await expect(itemLink).toHaveClass(/bg-\[#F7F2EB\]/);
              await expect(itemLink).toHaveClass(/text-\[#334EAC\]/);
            }
          }
        }
      } finally {
        loiHttp.dispose();
      }
    });

    test("Không có thanh cuộn ngang trên mọi trang của Nhân viên ở 1920px và 390px", async ({ page }) => {
      const allRoutes = nhanVienMenu.flatMap((g) => (g.href ? [g.href] : (g.items || []).map((i) => i.href)));

      for (const width of [1920, 390]) {
        await page.setViewportSize({ width, height: width === 1920 ? 1080 : 844 });
        for (const route of allRoutes) {
          await page.goto(route);
          await page.waitForLoadState("domcontentloaded");

          const hasHScroll = await page.evaluate(
            () => document.documentElement.scrollWidth > document.documentElement.clientWidth
          );
          expect(hasHScroll, `Trang ${route} bị cuộn ngang ở ${width}px`).toBe(false);
        }
      }
    });
  });

  test.describe("Chặn chéo vai trò khi gõ thẳng địa chỉ (Middleware)", () => {
    test("Nhân viên gõ thẳng địa chỉ của Chủ quán (/chu-quan/...) bị chặn và chuyển về /nhan-vien", async ({ context, page }) => {
      await context.clearCookies();
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

      const chuQuanTargets = [
        "/chu-quan",
        "/chu-quan/nhan-vien/them",
        "/chu-quan/nhan-vien/sua",
        "/chu-quan/nhan-vien/xem",
        "/chu-quan/nhan-vien/xoa",
        "/chu-quan/lich-lam/xep-lich",
        "/chu-quan/luong/tinh-luong",
      ];

      for (const target of chuQuanTargets) {
        await page.goto(target);
        await page.waitForURL("**/nhan-vien");
        expect(page.url()).toContain("/nhan-vien");
      }
    });

    test("Chủ quán gõ thẳng địa chỉ của Nhân viên (/nhan-vien/...) bị chặn và chuyển về /chu-quan", async ({ context, page }) => {
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

      const nhanVienTargets = [
        "/nhan-vien",
        "/nhan-vien/ca-lam/lich-ranh",
        "/nhan-vien/cham-cong/check-in",
        "/nhan-vien/luong/xem",
      ];

      for (const target of nhanVienTargets) {
        await page.goto(target);
        await page.waitForURL("**/chu-quan");
        expect(page.url()).toContain("/chu-quan");
      }
    });
  });
});
