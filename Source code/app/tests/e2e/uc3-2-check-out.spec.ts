import { test, expect } from "@playwright/test";
import { signSession, AUTH_COOKIE_NAME } from "../../backend/lib/auth";
import {
  CHECK_IN_THANH_CONG,
  CHECK_OUT_HOI_TANG_CA,
  CHECK_OUT_QUEN,
  CHECK_OUT_THANH_CONG,
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

test.describe("UC_3.2 - Màn hình Check-out (U9)", () => {
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

  test("Điều hướng từ menu Nhân viên -> Chấm công -> Check-out", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/nhan-vien");
    await page.waitForLoadState("networkidle");

    await page.locator("aside button", { hasText: "Chấm công" }).click();
    const checkOutLink = page.locator('aside nav a[href="/nhan-vien/cham-cong/check-out"]');
    await expect(checkOutLink).toBeVisible();
    await checkOutLink.click();

    await page.waitForURL("**/nhan-vien/cham-cong/check-out");
    await page.waitForSelector("[data-hydrated='true']");
    await expect(checkOutLink).toHaveClass(/bg-\[#F7F2EB\]/);
  });

  test("Luồng Check-in -> Check-out (Không tăng ca -> 4 thẻ, Có tăng ca, Quên check-out)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.clock.install({ time: new Date("2026-11-06T06:00:00+07:00") });

    let state: "chua-in" | "dang-lam" | "tang-ca" | "da-out" | "quen-out" = "chua-in";

    await page.route("**/api/cham-cong/hom-nay", async (route) => {
      const caBase = {
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
      };

      const caCheckOut =
        state === "chua-in"
          ? {
              ...caBase,
              daCheckIn: false,
              daCheckOut: false,
              machamcong: null,
              thoiGianCheckIn: null,
              thoiGianCheckOut: null,
              dangTangCa: false,
              gioKetThucTangCa: null,
              trangThai: "co-the-check-in",
              trangThaiCheckOut: "chua-check-in",
              trangThaiHienThi: "Chưa check-in",
              ketQuaCheckOut: null,
            }
          : state === "dang-lam" || state === "tang-ca"
          ? {
              ...caBase,
              daCheckIn: true,
              daCheckOut: false,
              machamcong: "CC000099",
              thoiGianCheckIn: "06:00",
              thoiGianCheckOut: null,
              dangTangCa: state === "tang-ca",
              gioKetThucTangCa: state === "tang-ca" ? "15:00" : null,
              trangThai: "da-check-in",
              trangThaiCheckOut: state === "tang-ca" ? "dang-tang-ca" : "dang-lam-viec",
              trangThaiHienThi: "Check-in thành công",
              ketQuaCheckOut: null,
            }
          : state === "quen-out"
          ? {
              ...caBase,
              daCheckIn: true,
              daCheckOut: false,
              machamcong: "CC000099",
              thoiGianCheckIn: "06:00",
              thoiGianCheckOut: null,
              dangTangCa: false,
              gioKetThucTangCa: null,
              trangThai: "da-check-in",
              trangThaiCheckOut: "quen-check-out",
              trangThaiHienThi: "Check-in thành công",
              ketQuaCheckOut: null,
            }
          : {
              ...caBase,
              daCheckIn: true,
              daCheckOut: true,
              machamcong: "CC000099",
              thoiGianCheckIn: "06:00",
              thoiGianCheckOut: "11:30",
              dangTangCa: false,
              gioKetThucTangCa: null,
              trangThai: "da-check-in",
              trangThaiCheckOut: "da-check-out",
              trangThaiHienThi: "Check-in thành công",
              ketQuaCheckOut: {
                gioCheckIn: "06:00",
                gioCheckOut: "11:30",
                tongGioLam: 5.5,
                tongTien: 110000,
                heSo: 1,
                mucLuongTheoGio: 20000,
              },
            };

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            ngayHomNay: "2026-11-06",
            gioHeThong: "11:30",
            checkinEarlyMinutes: 5,
            caHienTai: caCheckOut,
            caCheckOut,
            danhSachCa: [caCheckOut],
            trangThaiManHinh: state === "chua-in" ? "mac-dinh" : "thanh-cong",
            thongBao:
              state === "chua-in" ? null : { type: "thanh-cong", message: CHECK_IN_THANH_CONG },
          },
        }),
      });
    });

    await page.route("**/api/cham-cong/check-in", async (route) => {
      state = "dang-lam";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            machamcong: "CC000099",
            malich: "LL000001",
            thoigiancheckin: "06:00",
            message: CHECK_IN_THANH_CONG,
          },
        }),
      });
    });

    await page.route("**/api/cham-cong/check-out", async (route) => {
      const body = JSON.parse(route.request().postData() || "{}");
      if (body.tangCa) {
        state = "tang-ca";
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: {
              dangTangCa: true,
              ketThucTangCa: "15:00",
              machamcong: "CC000099",
              malich: "LL000001",
              message: "Đang tăng ca đến 15:00",
              ketQua: null,
              homNay: {
                ngayHomNay: "2026-11-06",
                gioHeThong: "11:30",
                checkinEarlyMinutes: 5,
                caHienTai: null,
                caCheckOut: {
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
                  daCheckOut: false,
                  machamcong: "CC000099",
                  thoiGianCheckIn: "06:00",
                  thoiGianCheckOut: null,
                  dangTangCa: true,
                  gioKetThucTangCa: "15:00",
                  trangThai: "da-check-in",
                  trangThaiCheckOut: "dang-tang-ca",
                  trangThaiHienThi: "Check-in thành công",
                  ketQuaCheckOut: null,
                },
                danhSachCa: [],
                trangThaiManHinh: "thanh-cong",
                thongBao: null,
              },
            },
          }),
        });
      } else {
        state = "da-out";
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: {
              dangTangCa: false,
              machamcong: "CC000099",
              malich: "LL000001",
              message: CHECK_OUT_THANH_CONG,
              ketQua: {
                gioCheckIn: "06:00",
                gioCheckOut: "11:30",
                tongGioLam: 5.5,
                tongTien: 110000,
                heSo: 1,
                mucLuongTheoGio: 20000,
              },
            },
          }),
        });
      }
    });

    // Bước 1: Check-in trước
    await page.goto("/nhan-vien/cham-cong/check-in");
    await page.waitForSelector("[data-hydrated='true']");
    await page.locator("#btn-check-in").click();
    await expect(page.locator('#notification-message [role="alert"]')).toContainText(
      CHECK_IN_THANH_CONG
    );

    // Bước 2: Chuyển sang Check-out qua menu
    await page.locator('aside nav a[href="/nhan-vien/cham-cong/check-out"]').click();
    await page.waitForURL("**/nhan-vien/cham-cong/check-out");
    await page.waitForSelector("[data-hydrated='true']");

    await expect(page.locator("h1")).toHaveText("Check-out");
    await expect(page.locator("#checkout-shift-name")).toHaveText("Ca sáng");
    await expect(page.locator("#checkout-checkin-time")).toHaveText("06:00");
    await expect(page.locator("#checkout-status")).toHaveText("Đang làm việc");
    await expect(page.locator("#btn-check-out")).toBeEnabled();

    // Bước 3: Bấm Check-out -> hiện popup hỏi tăng ca
    await page.locator("#btn-check-out").click();
    await expect(page.locator("#popup-tang-ca-title")).toHaveText(CHECK_OUT_HOI_TANG_CA);

    // Thử chọn "Có tăng ca" trước -> chuyển sang trạng thái Đang tăng ca (đến 15:00)
    await page.locator("#btn-co-tang-ca").click();
    await expect(page.locator("#checkout-status")).toHaveText("Đang tăng ca (đến 15:00)");

    // Bấm Check-out lần nữa và chọn "Không tăng ca" -> hoàn tất check-out & hiện 4 thẻ tổng kết
    await page.locator("#btn-check-out").click();
    await expect(page.locator("#popup-tang-ca-title")).toHaveText(CHECK_OUT_HOI_TANG_CA);
    await page.locator("#btn-khong-tang-ca").click();

    const bannerOk = page.locator('#notification-message [role="alert"]');
    await expect(bannerOk).toContainText(CHECK_OUT_THANH_CONG);
    expect(await bannerOk.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(88, 117, 84)");

    await expect(page.locator("#summary-checkin")).toHaveText("06:00");
    await expect(page.locator("#summary-checkout")).toHaveText("11:30");
    await expect(page.locator("#summary-hours")).toHaveText("5.5 giờ");
    await expect(page.locator("#summary-pay")).toHaveText("110.000đ");
    await expect(page.locator("#btn-dong")).toBeVisible();

    // Bước 4: Kiểm tra trường hợp Quên check-out
    state = "quen-out";
    await page.reload();
    const bannerQuen = page.locator('#notification-message [role="alert"]');
    await expect(bannerQuen).toContainText(CHECK_OUT_QUEN);
    expect(await bannerQuen.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(192, 57, 43)");
    await expect(page.locator("#btn-check-out")).toBeDisabled();
  });

  for (const vp of VIEWPORTS) {
    test(`Responsive không cuộn ngang ở ${vp.name} (API thật)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/nhan-vien/cham-cong/check-out");
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
          path: `../docs/ket-qua/uc-3.2-check-out_${vp.name}.png`,
          fullPage: false,
        });
      }
    });
  }
});
