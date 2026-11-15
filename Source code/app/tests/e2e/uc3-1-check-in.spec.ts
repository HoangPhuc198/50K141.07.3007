import { test, expect } from "@playwright/test";
import { signSession, AUTH_COOKIE_NAME } from "../../backend/lib/auth";
import {
  CHECK_IN_THANH_CONG,
  CHECK_IN_QUEN,
  CHECK_IN_CHUA_DEN_GIO,
  CHECK_IN_KHONG_CO_CA,
} from "../../frontend/config/thong-bao";
import fs from "node:fs";
import path from "node:path";

const VIEWPORTS = [
  { width: 360, height: 800, name: "360px" },
  { width: 390, height: 844, name: "390px" },
  { width: 768, height: 1024, name: "768px" },
  { width: 1280, height: 800, name: "1280px" },
  { width: 1920, height: 1080, name: "1920x1080" },
];

test.describe("UC_3.1 - Màn hình Check-in (U8)", () => {
  let nhanVienToken: string;

  test.beforeAll(async () => {
    process.env.JWT_SECRET =
      "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";
    nhanVienToken = await signSession({
      userId: "NV000001",
      username: "NV000001",
      role: "NhanVien",
      name: "Nguyễn Minh Anh",
    });

    const resultDir = path.resolve(__dirname, "../../../docs/ket-qua");
    if (!fs.existsSync(resultDir)) {
      fs.mkdirSync(resultDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ context }) => {
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
  });

  test("Điều hướng từ menu Nhân viên -> Chấm công -> Check-in", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/nhan-vien");
    await page.waitForLoadState("networkidle");

    await page.locator("aside button", { hasText: "Chấm công" }).click();
    const checkInLink = page.locator('aside nav a[href="/nhan-vien/cham-cong/check-in"]');
    await expect(checkInLink).toBeVisible();
    await checkInLink.click();

    await page.waitForURL("**/nhan-vien/cham-cong/check-in");
    await page.waitForSelector("[data-hydrated='true']");
    await expect(checkInLink).toHaveClass(/bg-\[#F7F2EB\]/);
  });

  test("Hiển thị đủ 5 trạng thái Figma & thông báo đúng chữ, đúng màu (#C0392B / #587554)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.clock.install({ time: new Date("2026-11-06T05:56:00+07:00") });

    // 1. Trạng thái 1 -> bấm Check-in -> Trạng thái 2
    await page.route("**/api/cham-cong/hom-nay", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            ngayHomNay: "2026-11-06",
            gioHeThong: "05:56",
            checkinEarlyMinutes: 5,
            caHienTai: {
              malich: "LL000001",
              maca: "CA000001",
              tenCa: "Ca sáng",
              loaica: "Sáng",
              ngayLam: "2026-11-06",
              gioBatDau: "06:00",
              gioKetThuc: "11:30",
              khungGio: "06:00 – 11:30",
              duocCheckInTu: "05:55",
              laCaNhanThay: false,
              daCheckIn: false,
              machamcong: null,
              thoiGianCheckIn: null,
              trangThai: "co-the-check-in",
              trangThaiHienThi: "Chưa check-in",
            },
            danhSachCa: [],
            trangThaiManHinh: "mac-dinh",
            thongBao: null,
          },
        }),
      });
    });

    await page.route("**/api/cham-cong/check-in", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            machamcong: "CC000099",
            malich: "LL000001",
            thoigiancheckin: "05:56",
            message: CHECK_IN_THANH_CONG,
            homNay: {
              ngayHomNay: "2026-11-06",
              gioHeThong: "05:56",
              checkinEarlyMinutes: 5,
              caHienTai: {
                malich: "LL000001",
                maca: "CA000001",
                tenCa: "Ca sáng",
                loaica: "Sáng",
                ngayLam: "2026-11-06",
                gioBatDau: "06:00",
                gioKetThuc: "11:30",
                khungGio: "06:00 – 11:30",
                duocCheckInTu: "05:55",
                laCaNhanThay: false,
                daCheckIn: true,
                machamcong: "CC000099",
                thoiGianCheckIn: "05:56",
                trangThai: "da-check-in",
                trangThaiHienThi: "Check-in thành công",
              },
              danhSachCa: [],
              trangThaiManHinh: "thanh-cong",
              thongBao: { type: "thanh-cong", message: CHECK_IN_THANH_CONG },
            },
          },
        }),
      });
    });

    await page.goto("/nhan-vien/cham-cong/check-in");
    await page.waitForSelector("[data-hydrated='true']");

    await expect(page.locator("h1")).toHaveText("Check-in");
    await expect(page.locator("#checkin-clock")).toHaveText("05:56");
    await expect(page.locator("#checkin-date")).toHaveText("Thứ Sáu, 06/11/2026");
    await expect(page.locator("#checkin-shift-name")).toHaveText("Ca sáng");
    await expect(page.locator("#checkin-shift-time")).toHaveText("06:00 – 11:30");
    await expect(page.locator("#checkin-early-time")).toHaveText("05:55");
    await expect(page.locator("#checkin-status")).toHaveText("Chưa check-in");
    await expect(page.locator("#btn-check-in")).toBeEnabled();
    await expect(page.locator("#btn-quay-lai")).toHaveCount(0);

    // Bấm Check-in -> Trạng thái 2 (thành công)
    await page.locator("#btn-check-in").click();
    const banner2 = page.locator('#notification-message [role="alert"]');
    await expect(banner2).toBeVisible();
    await expect(banner2).toContainText(CHECK_IN_THANH_CONG);
    expect(await banner2.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(88, 117, 84)");
    await expect(page.locator("#btn-check-in")).toBeDisabled();
    await expect(page.locator("#checkin-status")).toHaveText("Check-in thành công");
    await expect(page.locator("#btn-quay-lai")).toBeVisible();

    // 3. Trạng thái 3: Quên check-in
    await page.unroute("**/api/cham-cong/hom-nay");
    await page.route("**/api/cham-cong/hom-nay", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            ngayHomNay: "2026-11-06",
            gioHeThong: "11:45",
            checkinEarlyMinutes: 5,
            caHienTai: {
              malich: "LL000001",
              maca: "CA000001",
              tenCa: "Ca sáng",
              loaica: "Sáng",
              ngayLam: "2026-11-06",
              gioBatDau: "06:00",
              gioKetThuc: "11:30",
              khungGio: "06:00 – 11:30",
              duocCheckInTu: "05:55",
              laCaNhanThay: false,
              daCheckIn: false,
              machamcong: null,
              thoiGianCheckIn: null,
              trangThai: "quen-check-in",
              trangThaiHienThi: "Chưa check-in",
            },
            danhSachCa: [],
            trangThaiManHinh: "quen-check-in",
            thongBao: { type: "loi", message: CHECK_IN_QUEN },
          },
        }),
      });
    });
    await page.reload();
    const banner3 = page.locator('#notification-message [role="alert"]');
    await expect(banner3).toContainText(CHECK_IN_QUEN);
    expect(await banner3.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(192, 57, 43)");
    await expect(page.locator("#btn-check-in")).toBeDisabled();
    await expect(page.locator("#checkin-status")).toHaveText("Chưa check-in");

    // 4. Trạng thái 4: Chưa đến giờ
    await page.unroute("**/api/cham-cong/hom-nay");
    await page.route("**/api/cham-cong/hom-nay", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            ngayHomNay: "2026-11-06",
            gioHeThong: "05:30",
            checkinEarlyMinutes: 5,
            caHienTai: {
              malich: "LL000001",
              maca: "CA000001",
              tenCa: "Ca sáng",
              loaica: "Sáng",
              ngayLam: "2026-11-06",
              gioBatDau: "06:00",
              gioKetThuc: "11:30",
              khungGio: "06:00 – 11:30",
              duocCheckInTu: "05:55",
              laCaNhanThay: false,
              daCheckIn: false,
              machamcong: null,
              thoiGianCheckIn: null,
              trangThai: "chua-den-gio",
              trangThaiHienThi: "Chưa check-in",
            },
            danhSachCa: [],
            trangThaiManHinh: "chua-den-gio",
            thongBao: { type: "loi", message: CHECK_IN_CHUA_DEN_GIO },
          },
        }),
      });
    });
    await page.reload();
    const banner4 = page.locator('#notification-message [role="alert"]');
    await expect(banner4).toContainText(CHECK_IN_CHUA_DEN_GIO);
    expect(await banner4.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(192, 57, 43)");
    await expect(page.locator("#btn-check-in")).toBeDisabled();

    // 5. Trạng thái 5: Không có ca làm hôm nay
    await page.unroute("**/api/cham-cong/hom-nay");
    await page.route("**/api/cham-cong/hom-nay", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            ngayHomNay: "2026-11-06",
            gioHeThong: "05:52",
            checkinEarlyMinutes: 5,
            caHienTai: null,
            danhSachCa: [],
            trangThaiManHinh: "khong-co-ca",
            thongBao: { type: "loi", message: CHECK_IN_KHONG_CO_CA },
          },
        }),
      });
    });
    await page.reload();
    const banner5 = page.locator('#notification-message [role="alert"]');
    await expect(banner5).toContainText(CHECK_IN_KHONG_CO_CA);
    expect(await banner5.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(192, 57, 43)");
    await expect(page.locator("#checkin-shift-name")).toHaveText("Không có ca làm hôm nay");
    await expect(page.locator("#checkin-shift-time")).toHaveText("—");
    await expect(page.locator("#checkin-early-time")).toHaveText("—");
    await expect(page.locator("#checkin-status")).toHaveText("Không có ca làm");
    await expect(page.locator("#btn-check-in")).toBeDisabled();
  });

  for (const vp of VIEWPORTS) {
    test(`Responsive không cuộn ngang ở ${vp.name} (API thật)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/nhan-vien/cham-cong/check-in");
      await page.waitForSelector("[data-hydrated='true']");
      await page.waitForLoadState("networkidle");

      const hasHScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasHScroll, `Có cuộn ngang ở ${vp.name}`).toBe(false);

      if (vp.width === 1280 || vp.width === 1920) {
        const docHeight = await page.evaluate(() => document.documentElement.scrollHeight);
        expect(docHeight).toBeLessThanOrEqual(vp.height);
        const mainHasVScroll = await page.evaluate(() => {
          const main = document.querySelector("main");
          return main ? main.scrollHeight > main.clientHeight : false;
        });
        expect(mainHasVScroll, `Có cuộn dọc trong <main> ở ${vp.name}`).toBe(false);
      }

      if (vp.width === 390 || vp.width === 1920) {
        await page.screenshot({
          path: `../docs/ket-qua/uc-3.1-check-in_${vp.name}.png`,
          fullPage: false,
        });
      }
    });
  }
});
