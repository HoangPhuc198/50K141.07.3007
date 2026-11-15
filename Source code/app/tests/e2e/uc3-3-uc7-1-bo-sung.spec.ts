import { test, expect } from "@playwright/test";
import { signSession, AUTH_COOKIE_NAME } from "../../backend/lib/auth";
import {
  BO_SUNG_CC_GUI_THANH_CONG,
  BO_SUNG_CC_THANH_CONG,
  BO_SUNG_CC_THIEU_TRUONG,
} from "../../frontend/config/thong-bao";
import fs from "node:fs";
import path from "node:path";

const RED_COLOR = "rgb(192, 57, 43)"; // #C0392B
const GREEN_COLOR = "rgb(88, 117, 84)"; // #587554

const VIEWPORTS = [
  { width: 360, height: 800, name: "360px" },
  { width: 390, height: 844, name: "390px" },
  { width: 768, height: 1024, name: "768px" },
  { width: 1280, height: 800, name: "1280px" },
  { width: 1920, height: 1080, name: "1920x1080" },
];

test.describe("UC_3.3 (U10) & UC_7.1 (U21) - Bổ sung chấm công", () => {
  let nhanVienToken: string;
  let chuQuanToken: string;

  test.beforeAll(async () => {
    process.env.JWT_SECRET =
      "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";

    nhanVienToken = await signSession({
      userId: "NV000001",
      username: "NV000001",
      role: "NhanVien",
      name: "Nguyễn Minh Anh",
    });

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
  });

  test("UC_3.3: Điều hướng menu, RadioChip bấm ngoài & ô tick, lỗi thiếu trường (#C0392B), gửi 2 nhánh", async ({
    page,
    context,
  }) => {
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

    const mockItems = [
      {
        malich: "LL000001",
        ngayLam: "2026-10-30",
        ngayHienThi: "30/10/2026",
        ngayNgan: "30/10",
        maca: "CA000001",
        loaica: "Sáng",
        tenCa: "Ca sáng",
        gioBatDau: "06:00",
        gioKetThuc: "11:30",
        loaiThieu: "Quên check-out",
        gioDaCheckIn: "06:00",
      },
      {
        malich: "LL000002",
        ngayLam: "2026-10-28",
        ngayHienThi: "28/10/2026",
        ngayNgan: "28/10",
        maca: "CA000002",
        loaica: "Chiều",
        tenCa: "Ca chiều",
        gioBatDau: "11:30",
        gioKetThuc: "17:00",
        loaiThieu: "Quên check-in",
        gioDaCheckIn: null,
      },
    ];

    let submittedPayloads: Array<Record<string, unknown>> = [];
    let currentItems = [...mockItems];

    await page.route("**/api/bo-sung-cc/ca-thieu", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: { items: currentItems } }),
      });
    });

    await page.route("**/api/bo-sung-cc", async (route) => {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      submittedPayloads.push(payload);
      currentItems = currentItems.filter((i) => i.malich !== payload.malich);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            mayeucau: "YC000099",
            ...payload,
            trangthai: "Chưa xử lý",
            message: BO_SUNG_CC_GUI_THANH_CONG,
          },
        }),
      });
    });

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/nhan-vien");
    await page.waitForLoadState("networkidle");

    // Điều hướng qua menu: Chấm công -> Yêu cầu bổ sung chấm công
    await page.locator("aside button", { hasText: "Chấm công" }).click();
    const link = page.locator('aside nav a[href="/nhan-vien/cham-cong/bo-sung"]');
    await expect(link).toBeVisible();
    await link.click();

    await page.waitForURL("**/nhan-vien/cham-cong/bo-sung");
    await page.waitForSelector("[data-hydrated='true']");
    await expect(link).toHaveClass(/bg-\[#F7F2EB\]/);

    // Kiểm tra RadioChip mặc định chọn dòng 1 (Quên check-out)
    const row1 = page.locator('[role="radio"][data-value="LL000001"]');
    const row2 = page.locator('[role="radio"][data-value="LL000002"]');
    await expect(row1).toHaveAttribute("aria-checked", "true");
    await expect(row2).toHaveAttribute("aria-checked", "false");
    await expect(page.locator("#select-loai-yeu-cau")).toHaveValue("Quên check-out");
    await expect(page.locator("#readonly-gio-vao")).toContainText("30/10/2026 · 06:00");

    // Test bấm vào vùng chữ (NGOÀI ô tick tròn) của dòng 2 -> đổi chọn đúng 1 lần
    await row2.locator("text=28/10 · Chiều").click();
    await expect(row2).toHaveAttribute("aria-checked", "true");
    await expect(row1).toHaveAttribute("aria-checked", "false");
    await expect(page.locator("#select-loai-yeu-cau")).toHaveValue("Quên check-in");
    await expect(page.locator("#input-gio-vao")).toBeVisible();

    // Test bấm vào vùng ô tick tròn của dòng 1 -> quay về dòng 1
    await row1.locator('[data-testid="radio-dot"]').click();
    await expect(row1).toHaveAttribute("aria-checked", "true");
    await expect(row2).toHaveAttribute("aria-checked", "false");
    await expect(page.locator("#select-loai-yeu-cau")).toHaveValue("Quên check-out");

    // Test bàn phím ArrowDown chuyển sang dòng 2 rồi ArrowUp quay lại dòng 1
    await row1.focus();
    await page.keyboard.press("ArrowDown");
    await expect(row2).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("ArrowUp");
    await expect(row1).toHaveAttribute("aria-checked", "true");

    // Lỗi thiếu lý do -> thông báo "Vui lòng nhập đầy đủ" màu đỏ #C0392B
    await page.locator("#btn-xac-nhan").click();
    const bannerErr1 = page.locator('[data-testid="notification-banner"]');
    await expect(bannerErr1).toBeVisible();
    await expect(bannerErr1).toHaveText(BO_SUNG_CC_THIEU_TRUONG);
    expect(await bannerErr1.evaluate((el) => getComputedStyle(el).color)).toBe(RED_COLOR);
    await expect(page.locator("#input-ly-do")).toHaveAttribute(
      "placeholder",
      "Nhập lý do quên chấm công"
    );

    // Nhập lý do nhưng xóa trống Giờ kết thúc -> lỗi "Vui lòng nhập đầy đủ" màu đỏ #C0392B
    await page.locator("#input-ly-do").fill("Em quên check-out ca sáng");
    await page.locator("#input-gio-ket-thuc").fill("");
    await page.locator("#btn-xac-nhan").click();
    const bannerErr2 = page.locator('[data-testid="notification-banner"]');
    await expect(bannerErr2).toBeVisible();
    await expect(bannerErr2).toHaveText(BO_SUNG_CC_THIEU_TRUONG);
    expect(await bannerErr2.evaluate((el) => getComputedStyle(el).color)).toBe(RED_COLOR);

    // Điền đủ và gửi thành công -> "Gửi yêu cầu thành công" màu xanh #587554
    await page.locator("#input-gio-ket-thuc").fill("11:30");
    await page.locator("#btn-xac-nhan").click();

    const bannerOk = page.locator('[data-testid="notification-banner"]');
    await expect(bannerOk).toBeVisible();
    await expect(bannerOk).toHaveText(BO_SUNG_CC_GUI_THANH_CONG);
    expect(await bannerOk.evaluate((el) => getComputedStyle(el).color)).toBe(GREEN_COLOR);

    expect(submittedPayloads[0]).toEqual({
      malich: "LL000001",
      loaiYeuCau: "Quên check-out",
      giovaobosung: null,
      giorabosung: "11:30",
      lydo: "Em quên check-out ca sáng",
    });

    // Ca còn lại (LL000002 - Quên check-in) tự nạp lên form; gửi thành công
    await expect(page.locator("#select-loai-yeu-cau")).toHaveValue("Quên check-in");
    await page.locator("#input-gio-vao").fill("11:30");
    await page.locator("#input-gio-ket-thuc").fill("17:00");
    await page.locator("#input-ly-do").fill("Em quên check-in ca chiều");
    await page.locator("#btn-xac-nhan").click();

    await expect(bannerOk).toHaveText(BO_SUNG_CC_GUI_THANH_CONG);
    expect(submittedPayloads[1]).toEqual({
      malich: "LL000002",
      loaiYeuCau: "Quên check-in",
      giovaobosung: "11:30",
      giorabosung: "17:00",
      lydo: "Em quên check-in ca chiều",
    });
  });

  test("UC_7.1: Điều hướng menu, 2 nhánh chi tiết, giờ ra <= giờ vào báo lỗi đỏ, lưu thành công (#587554)", async ({
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

    const mockPending = [
      {
        mayeucau: "YC000001",
        manv: "NV000003",
        tenNhanVien: "Trần Quốc Bảo",
        malich: "LL000001",
        ngayLam: "2026-10-26",
        ngayHienThi: "26/10/2026",
        loaica: "Sáng",
        caLam: "Ca sáng",
        loaiYeuCau: "Quên check-out",
        giovaobosung: null,
        giorabosung: "11:00",
        gioCheckInHienTai: "06:00",
        gioBatDauCa: "06:00",
        gioKetThucCa: "11:30",
        lydo: "Em quên check-out sau khi bàn giao ca sáng.",
        trangthai: "Chưa xử lý",
      },
      {
        mayeucau: "YC000002",
        manv: "NV000005",
        tenNhanVien: "Phạm Đức Huy",
        malich: "LL000002",
        ngayLam: "2026-10-15",
        ngayHienThi: "15/10/2026",
        loaica: "Chiều",
        caLam: "Ca chiều",
        loaiYeuCau: "Quên check-in",
        giovaobosung: "11:00",
        giorabosung: "17:00",
        gioCheckInHienTai: null,
        gioBatDauCa: "11:30",
        gioKetThucCa: "17:00",
        lydo: "Em quên check-in vì đi muộn",
        trangthai: "Chưa xử lý",
      },
    ];

    let currentPending = [...mockPending];
    const savedCalls: Array<Record<string, unknown>> = [];

    await page.route("**/api/bo-sung-cc/xu-ly", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: {
              items: currentPending,
              total: currentPending.length,
              page: 1,
              limit: 50,
            },
          }),
        });
        return;
      }

      const payload = route.request().postDataJSON() as Record<string, unknown>;
      savedCalls.push(payload);
      currentPending = currentPending.filter(
        (x) => x.mayeucau !== payload.mayeucau
      );
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            mayeucau: payload.mayeucau,
            machamcong: "CC000099",
            trangthai: "Đã xử lý",
            message: BO_SUNG_CC_THANH_CONG,
          },
        }),
      });
    });

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/chu-quan");
    await page.waitForLoadState("networkidle");

    // Điều hướng menu: Quản lý chấm công -> Bổ sung chấm công
    await page.locator("aside button", { hasText: "Quản lý chấm công" }).click();
    const link = page.locator('aside nav a[href="/chu-quan/cham-cong/bo-sung"]');
    await expect(link).toBeVisible();
    await link.click();

    await page.waitForURL("**/chu-quan/cham-cong/bo-sung");
    await page.waitForSelector("[data-hydrated='true']");
    await expect(link).toHaveClass(/bg-\[#F7F2EB\]/);

    // Nhánh 1: Quên check-out (đang chọn YC000001)
    await expect(page.locator("#detail-ten-nhan-vien")).toHaveText("Trần Quốc Bảo");
    await expect(page.locator("#detail-ca-lam")).toHaveText("Ca sáng");
    await expect(page.locator("#input-gio-ket-thuc")).toHaveValue("11:00");
    await expect(page.locator("#input-gio-bat-dau")).toHaveCount(0);
    await expect(page.locator("#detail-ly-do")).toHaveText(
      "Em quên check-out sau khi bàn giao ca sáng."
    );

    // Chuyển sang nhánh 2: Quên check-in (bấm YC000002) -> giờ bắt đầu & kết thúc được điền sẵn
    await page.locator('[data-testid="yeu-cau-row-YC000002"]').click();
    await expect(page.locator("#detail-ten-nhan-vien")).toHaveText("Phạm Đức Huy");
    await expect(page.locator("#detail-ca-lam")).toHaveText("Ca chiều");
    await expect(page.locator("#input-gio-bat-dau")).toHaveValue("11:00");
    await expect(page.locator("#input-gio-ket-thuc")).toHaveValue("17:00");

    // Thiếu Giờ bắt đầu hoặc Giờ kết thúc -> KHÔNG hiện thanh "Vui lòng nhập đầy đủ", chỉ tô viền đỏ #C0392B và chặn lưu
    await page.locator("#input-gio-bat-dau").fill("");
    await page.locator("#input-gio-ket-thuc").fill("");
    await page.locator("#btn-luu").click();
    await expect(page.locator('[data-testid="notification-banner"]')).toHaveCount(0);
    expect(
      await page.locator("#input-gio-bat-dau").evaluate((el) => getComputedStyle(el).borderColor)
    ).toBe(RED_COLOR);
    expect(
      await page.locator("#input-gio-ket-thuc").evaluate((el) => getComputedStyle(el).borderColor)
    ).toBe(RED_COLOR);
    expect(savedCalls).toHaveLength(0);

    // Nhập giờ ra <= giờ vào -> báo lỗi màu đỏ #C0392B
    await page.locator("#input-gio-bat-dau").fill("17:00");
    await page.locator("#input-gio-ket-thuc").fill("11:00");
    await page.locator("#btn-luu").click();

    const bannerErr = page.locator('[data-testid="notification-banner"]');
    await expect(bannerErr).toBeVisible();
    expect(await bannerErr.evaluate((el) => getComputedStyle(el).color)).toBe(RED_COLOR);

    // Chỉnh giờ hợp lệ rồi lưu -> "Bổ sung chấm công thành công" màu xanh #587554
    await page.locator("#input-gio-bat-dau").fill("11:30");
    await page.locator("#input-gio-ket-thuc").fill("17:15");
    await page.locator("#btn-luu").click();

    const bannerOk = page.locator('[data-testid="notification-banner"]');
    await expect(bannerOk).toBeVisible();
    await expect(bannerOk).toHaveText(BO_SUNG_CC_THANH_CONG);
    expect(await bannerOk.evaluate((el) => getComputedStyle(el).color)).toBe(GREEN_COLOR);

    expect(savedCalls[0]).toEqual({
      mayeucau: "YC000002",
      giovaobosung: "11:30",
      giorabosung: "17:15",
    });

    // Tiếp tục lưu YC000001 (Quên check-out)
    await expect(page.locator("#detail-ten-nhan-vien")).toHaveText("Trần Quốc Bảo");
    await page.locator("#input-gio-ket-thuc").fill("11:20");
    await page.locator("#btn-luu").click();
    await expect(bannerOk).toHaveText(BO_SUNG_CC_THANH_CONG);
    expect(savedCalls[1]).toEqual({
      mayeucau: "YC000001",
      giovaobosung: null,
      giorabosung: "11:20",
    });
  });

  test("Responsive 360/390/768/1280/1920 không cuộn ngang và chụp ảnh UC_3.3 + UC_7.1", async ({
    page,
    context,
  }) => {
    for (const vp of VIEWPORTS) {
      // 1. Nhân viên UC_3.3
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
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/nhan-vien/cham-cong/bo-sung");
      await page.waitForSelector("[data-hydrated='true']");
      await page.waitForLoadState("networkidle");

      const nvScroll = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
      }));
      expect(
        nvScroll.scrollWidth,
        `UC_3.3 cuộn ngang ở ${vp.name}`
      ).toBeLessThanOrEqual(nvScroll.clientWidth);
      if (vp.width === 1920) {
        expect(nvScroll.scrollHeight).toBeLessThanOrEqual(1080);
      }
      if (vp.width === 390 || vp.width === 1920) {
        await page.screenshot({
          path: `../docs/ket-qua/uc3-3_${vp.name}.png`,
          fullPage: false,
        });
      }

      // 2. Chủ quán UC_7.1
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
      await page.goto("/chu-quan/cham-cong/bo-sung");
      await page.waitForSelector("[data-hydrated='true']");
      await page.waitForLoadState("networkidle");

      const cqScroll = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
      }));
      expect(
        cqScroll.scrollWidth,
        `UC_7.1 cuộn ngang ở ${vp.name}`
      ).toBeLessThanOrEqual(cqScroll.clientWidth);
      if (vp.width === 1920) {
        expect(cqScroll.scrollHeight).toBeLessThanOrEqual(1080);
      }
      if (vp.width === 390 || vp.width === 1920) {
        await page.screenshot({
          path: `../docs/ket-qua/uc7-1_${vp.name}.png`,
          fullPage: false,
        });
      }
    }
  });
});
