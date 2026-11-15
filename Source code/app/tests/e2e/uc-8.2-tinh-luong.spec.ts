import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { signSession, AUTH_COOKIE_NAME } from "../../backend/lib/auth";
import { prisma } from "../../database/client";
import {
  GUI_BANG_LUONG_CO,
  GUI_BANG_LUONG_KHONG,
  GUI_BANG_LUONG_NOI_DUNG,
  GUI_BANG_LUONG_THANH_CONG,
  GUI_BANG_LUONG_TIEU_DE,
  TINH_LUONG_THANH_CONG,
  TINH_LUONG_THAT_BAI,
} from "../../frontend/config/thong-bao";

const VIEWPORTS = [
  { width: 360, height: 800, name: "360px" },
  { width: 390, height: 844, name: "390px" },
  { width: 768, height: 1024, name: "768px" },
  { width: 1280, height: 800, name: "1280px" },
  { width: 1920, height: 1080, name: "1920x1080" },
];

test.describe("E2E UC_8.2 Tính lương (U24, U25)", () => {
  let chuQuanToken: string;
  let pendingKyRestore: {
    makyluong: string;
    trangThaiCu: string;
    ngayChotCu: Date | null;
    maBlTruoc: Set<string>;
  } | null = null;

  test.beforeAll(async () => {
    process.env.JWT_SECRET =
      "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";
    chuQuanToken = await signSession({
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Hoàng Lan",
    });
  });

  async function restorePendingKyLuong() {
    if (!pendingKyRestore) return;
    const { makyluong, trangThaiCu, ngayChotCu, maBlTruoc } = pendingKyRestore;
    await prisma.chiTietBangLuong.deleteMany({
      where: { BangLuong: { Makyluong: makyluong } },
    });
    await prisma.bangLuong.deleteMany({
      where: { Makyluong: makyluong, Mabangluong: { notIn: [...maBlTruoc] } },
    });
    await prisma.kyLuong.updateMany({
      where: { Makyluong: makyluong },
      data: { Trangthai: trangThaiCu, Ngaychot: ngayChotCu },
    });
    pendingKyRestore = null;
  }

  test.afterAll(async () => {
    await restorePendingKyLuong();
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

  test("Điều hướng từ menu: Quản lý lương -> Tính lương & kiểm tra trạng thái 1-4 trên dữ liệu thật", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/chu-quan");
    await page.waitForLoadState("networkidle");

    const groupBtn = page.locator('aside nav button:has-text("Quản lý lương")');
    await expect(groupBtn).toBeVisible();
    const linkTinhLuong = page.locator(
      'aside nav a[href="/chu-quan/luong/tinh-luong"]'
    );
    if (!(await linkTinhLuong.isVisible().catch(() => false))) {
      await groupBtn.click();
    }
    await expect(linkTinhLuong).toBeVisible();
    await linkTinhLuong.click();
    await page.waitForURL("**/chu-quan/luong/tinh-luong");

    // Mục đang đứng sáng lên trong AppShell
    await expect(linkTinhLuong).toHaveClass(/bg-\[#F7F2EB\]/);
    await expect(page.locator("#title-tinh-luong")).toHaveText("Dữ liệu kì lương");

    // Trạng thái 1: 2 thẻ kỳ lương + ngày chi trả (lấy từ CSDL, không gõ cứng)
    const kyDb = await prisma.kyLuong.findFirstOrThrow({
      where: { Trangthai: { not: "Đã chốt" } },
      orderBy: [{ Nam: "asc" }, { Thang: "asc" }],
    });
    const makyluong = kyDb.Makyluong.trim();
    const trangThaiCu = kyDb.Trangthai;
    const ngayChotCu = kyDb.Ngaychot;
    const blTruoc = await prisma.bangLuong.findMany({
      where: { Makyluong: makyluong },
    });
    pendingKyRestore = {
      makyluong,
      trangThaiCu,
      ngayChotCu,
      maBlTruoc: new Set(blTruoc.map((b) => b.Mabangluong)),
    };

    try {
      await expect(page.locator("#card-ky-luong")).toContainText(`Tháng ${kyDb.Thang}`);
      await expect(page.locator("#card-ngay-chi-tra")).toBeVisible();
      await expect(page.locator("#panel-chi-tiet-luong")).toContainText(
        "Chọn 1 nhân viên để xem chi tiết"
      );

      // Bấm một dòng nhân viên (bấm vào tên, ngoài ô tick) -> đổi bảng chi tiết bên phải
      const rows = page.locator('#card-tinh-luong table tbody tr[role="radio"]');
      const soDong = await rows.count();
      expect(soDong).toBeGreaterThan(1);

      const firstValue = await rows.nth(0).getAttribute("data-value");
      await rows.nth(0).click();
      await expect(rows.nth(0)).toHaveAttribute("aria-checked", "true");
      await expect(page.locator("#chi-tiet-ten-ma")).toContainText(firstValue!);

      const secondValue = await rows.nth(1).getAttribute("data-value");
      await rows.nth(1).click();
      await expect(rows.nth(1)).toHaveAttribute("aria-checked", "true");
      await expect(rows.nth(0)).toHaveAttribute("aria-checked", "false");
      await expect(page.locator("#chi-tiet-ten-ma")).toContainText(secondValue!);

      // Trạng thái 3: bấm "Tính lương" -> xem trước (KHÔNG ghi CSDL)
      await page.locator("#btn-tinh-luong").click();
      const banner = page.locator('[data-testid="notification-banner"]');
      await expect(banner).toBeVisible();
      await expect(banner).toContainText(TINH_LUONG_THANH_CONG);
      // Kiểm tra màu nền & chữ thông báo thành công
      const colors = await banner.evaluate((el) => {
        const s = getComputedStyle(el);
        return { bg: s.backgroundColor, color: s.color };
      });
      expect(colors.bg).toBe("rgb(237, 243, 235)"); // #EDF3EB
      expect(colors.color).toBe("rgb(88, 117, 84)"); // #587554

      await expect(page.locator("#title-tinh-luong")).toHaveText(
        "Kết quả tính lương · Chưa chốt"
      );
      await expect(page.locator("#card-tong-luong")).toContainText("đ");
      await expect(page.locator("#card-tong-gio")).toContainText("giờ");
      await expect(page.locator("#chi-tiet-hien-thi")).toContainText("Hiển thị");

      // CSDL vẫn chưa đổi sau bước xem trước
      const kySauTinh = await prisma.kyLuong.findUniqueOrThrow({
        where: { Makyluong: makyluong },
      });
      expect(kySauTinh.Trangthai).toBe("Chưa tính");
      expect(
        await prisma.chiTietBangLuong.count({
          where: { BangLuong: { Makyluong: makyluong } },
        })
      ).toBe(0);

      // Trạng thái 4: bấm "Gửi bảng lương dự kiến" -> mở dialog
      await page.locator("#btn-gui-bang-luong").click();
      const dialog = page.locator("#dialog-xac-nhan-gui");
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText(GUI_BANG_LUONG_TIEU_DE);
      await expect(dialog).toContainText(GUI_BANG_LUONG_NOI_DUNG);

      // Bấm "Không" -> đóng dialog, không gửi
      await dialog.getByRole("button", { name: GUI_BANG_LUONG_KHONG }).click();
      await expect(dialog).toBeHidden();
      expect(
        (await prisma.kyLuong.findUniqueOrThrow({ where: { Makyluong: makyluong } }))
          .Trangthai
      ).toBe("Chưa tính");

      // Mở lại rồi bấm nút đóng (X) -> cũng không gửi
      await page.locator("#btn-gui-bang-luong").click();
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Đóng" }).click();
      await expect(dialog).toBeHidden();

      // Mở lại rồi bấm "Có" -> lưu "Dự kiến", bảng chi tiết trống với dấu "–", nút gửi bị disabled
      await page.locator("#btn-gui-bang-luong").click();
      await dialog.getByRole("button", { name: GUI_BANG_LUONG_CO }).click();
      await expect(dialog).toBeHidden();

      await expect(banner).toContainText(GUI_BANG_LUONG_THANH_CONG);
      await expect(page.locator("#btn-gui-bang-luong")).toBeDisabled();
      await expect(page.locator("#panel-chi-tiet-luong")).toContainText("–");
      expect(
        (await prisma.kyLuong.findUniqueOrThrow({ where: { Makyluong: makyluong } }))
          .Trangthai
      ).toBe("Dự kiến");
    } finally {
      // Khôi phục DB về đúng trạng thái trước khi test
      await restorePendingKyLuong();
    }
  });

  test("Trạng thái 2 (kỳ cuối năm tháng 12) có cột Lương tháng 13 & phân trang chi tiết", async ({
    page,
  }) => {
    await page.route("**/api/ky-luong/hien-tai", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            Makyluong: "KL202612",
            Thang: 12,
            Nam: 2026,
            Trangthai: "Chưa tính",
            Ngaychitra: "2027-01-02",
            Kycuoinam: true,
          },
        }),
      });
    });

    await page.route("**/api/ky-luong/KL202612/tong-hop", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            Makyluong: "KL202612",
            Thang: 12,
            Nam: 2026,
            Trangthai: "Chưa tính",
            Ngaychitra: "2027-01-02",
            Kycuoinam: true,
            Tongluong: 4600000,
            Tonggio: 214.5,
            Thongbao: "",
            BangLuong: [
              {
                Mabangluong: null,
                Manv: "NV000001",
                Hoten: "Nguyễn Minh Anh",
                Songay: 19,
                Tonggiolam: 104.5,
                Mucluong: 20000,
                Heso: 1,
                Tienthuong: 0,
                Lydothuong: null,
                Tongluong: 2090000,
                Luongthang13: 2420000,
              },
            ],
          },
        }),
      });
    });

    await page.route(
      "**/api/ky-luong/KL202612/nhan-vien/NV000001/chi-tiet*",
      async (route) => {
        const url = new URL(route.request().url());
        const trang = Number(url.searchParams.get("trang") || "1");
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            data: {
              Manv: "NV000001",
              Hoten: "Nguyễn Minh Anh",
              Tonggio: 104.5,
              Tongluong: 2090000,
              Ngaychitra: "2027-01-02",
              Tongsodong: 8,
              Trang: trang,
              Sodong: 6,
              Dong: Array.from({ length: trang === 1 ? 6 : 2 }, (_, idx) => ({
                Ngaylam: `2026-12-${String((trang - 1) * 6 + idx + 1).padStart(2, "0")}`,
                Ca: "Sáng",
                Vao: "06:00",
                Ra: "11:30",
                Giolam: 5.5,
                Mucluong: 20000,
                Maheso: null,
                Heso: 1,
                Thuong: 0,
                Thanhtien: 110000,
              })),
            },
          }),
        });
      }
    );

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/chu-quan/luong/tinh-luong");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("#card-ky-luong")).toContainText("Tháng 12");
    await expect(page.locator("#card-ngay-chi-tra")).toContainText("02/01/2027");
    await expect(
      page.locator('#card-tinh-luong [role="radiogroup"] thead')
    ).toContainText("Lương tháng 13");
    await expect(
      page.locator('#card-tinh-luong [role="radiogroup"] tbody')
    ).toContainText("2.420.000");

    // Bấm dòng -> phân trang chi tiết trang 1 -> trang 2
    await page.locator('#card-tinh-luong tbody tr[role="radio"]').first().click();
    await expect(page.locator("#chi-tiet-hien-thi")).toHaveText(
      "Hiển thị 6/8 ngày"
    );
    await page.getByRole("button", { name: "Trang 2" }).click();
    await expect(page.locator("#chi-tiet-hien-thi")).toHaveText(
      "Hiển thị 2/8 ngày"
    );
  });

  test("Lỗi tính lương hiện thông báo đỏ #C0392B nguyên văn", async ({
    page,
  }) => {
    await page.route("**/api/ky-luong/*/tinh", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: { code: "TINH_LUONG_THAT_BAI", message: TINH_LUONG_THAT_BAI },
        }),
      });
    });

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/chu-quan/luong/tinh-luong");
    await page.waitForLoadState("networkidle");

    await page.locator("#btn-tinh-luong").click();
    const banner = page.locator('[data-testid="notification-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(TINH_LUONG_THAT_BAI);
    const color = await banner.evaluate(
      (el) => getComputedStyle(el).color
    );
    expect(color).toBe("rgb(192, 57, 43)"); // #C0392B
  });

  for (const vp of VIEWPORTS) {
    test(`Layout ở ${vp.name} không cuộn ngang; 1920x1080 không cuộn dọc thừa`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/chu-quan/luong/tinh-luong");
      await page.waitForLoadState("networkidle");

      const hasHScroll = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
      );
      expect(hasHScroll, `Cuộn ngang ở ${vp.name}`).toBe(false);

      if (vp.width === 1920 || vp.width === 390) {
        const outDir = path.resolve(__dirname, "../../../docs/ket-qua");
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
        await page.screenshot({
          path: path.join(outDir, `uc-8.2-tinh-luong_${vp.name}.png`),
          fullPage: false,
        });
      }

      if (vp.width === 1920) {
        const hasVScroll = await page.evaluate(() => {
          const main = document.querySelector("main");
          return main ? main.scrollHeight > main.clientHeight : false;
        });
        expect(hasVScroll, "Không được có cuộn dọc trang ở 1920x1080").toBe(
          false
        );
      }
    });
  }

  test("Visual: so sánh 4 trạng thái với Figma UC_8.2_tinh-luong_01..04.png", async ({
    page,
  }) => {
    const figmaDir = path.resolve(__dirname, "../../../docs/figma");
    const outDir = path.resolve(__dirname, "../../../docs/ket-qua");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const compare = (actualPath: string, refName: string, diffName: string) => {
      const a = PNG.sync.read(fs.readFileSync(actualPath));
      const r = PNG.sync.read(fs.readFileSync(path.join(figmaDir, refName)));
      expect(a.width).toBe(r.width);
      expect(a.height).toBe(r.height);
      // Mask sidebar (x=0..336) như visual-map.json
      for (let y = 0; y < a.height; y++) {
        for (let x = 0; x < 336; x++) {
          const idx = (y * a.width + x) * 4;
          a.data[idx] = a.data[idx + 1] = a.data[idx + 2] = a.data[idx + 3] = 255;
          r.data[idx] = r.data[idx + 1] = r.data[idx + 2] = r.data[idx + 3] = 255;
        }
      }
      const diff = new Uint8Array(a.width * a.height * 4);
      const num = pixelmatch(a.data, r.data, diff, a.width, a.height, {
        threshold: 0.1,
        includeAA: false,
      });
      const diffPng = new PNG({ width: a.width, height: a.height });
      diffPng.data = Buffer.from(diff);
      fs.writeFileSync(path.join(outDir, diffName), PNG.sync.write(diffPng));
      return (num / (a.width * a.height)) * 100;
    };

    const nv7 = [
      { Manv: "NV000001", Hoten: "Nguyễn Minh Anh", Songay: 19, Tonggiolam: 104.5, Mucluong: 20000, Heso: 1, Tienthuong: 0, Lydothuong: null, Tongluong: 2090000, Luongthang13: 2420000 },
      { Manv: "NV000002", Hoten: "Trần Quốc Bảo", Songay: 20, Tonggiolam: 110, Mucluong: 17000, Heso: 1, Tienthuong: 0, Lydothuong: null, Tongluong: 1870000, Luongthang13: 1950000 },
      { Manv: "NV000003", Hoten: "Phạm Thu Hà", Songay: 20, Tonggiolam: 110, Mucluong: 17000, Heso: 1, Tienthuong: 0, Lydothuong: null, Tongluong: 1870000, Luongthang13: 2190000 },
      { Manv: "NV000004", Hoten: "Lê Gia Hân", Songay: 20, Tonggiolam: 100, Mucluong: 17000, Heso: 1, Tienthuong: 0, Lydothuong: null, Tongluong: 1700000, Luongthang13: 2240000 },
      { Manv: "NV000005", Hoten: "Trần Đức Huy", Songay: 20, Tonggiolam: 110, Mucluong: 20000, Heso: 1, Tienthuong: 0, Lydothuong: null, Tongluong: 2200000, Luongthang13: 1980000 },
      { Manv: "NV000006", Hoten: "Ngô Ngọc Linh", Songay: 20, Tonggiolam: 100, Mucluong: 20000, Heso: 1, Tienthuong: 0, Lydothuong: null, Tongluong: 2000000, Luongthang13: 2330000 },
      { Manv: "NV000007", Hoten: "Lê Tuấn Kiệt", Songay: 20, Tonggiolam: 100, Mucluong: 17000, Heso: 1, Tienthuong: 0, Lydothuong: null, Tongluong: 1700000, Luongthang13: 1930000 },
    ];

    let kyMode: "t10" | "t12" = "t10";
    await page.route("**/api/ky-luong/hien-tai", async (route) => {
      const data =
        kyMode === "t10"
          ? { Makyluong: "KL202610", Thang: 10, Nam: 2026, Trangthai: "Chưa tính", Ngaychitra: "2026-11-02", Kycuoinam: false }
          : { Makyluong: "KL202612", Thang: 12, Nam: 2026, Trangthai: "Chưa tính", Ngaychitra: "2026-01-02", Kycuoinam: true };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data }) });
    });
    await page.route("**/api/ky-luong/*/tong-hop", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            Makyluong: kyMode === "t10" ? "KL202610" : "KL202612",
            Thang: kyMode === "t10" ? 10 : 12,
            Nam: 2026,
            Trangthai: "Chưa tính",
            Ngaychitra: kyMode === "t10" ? "2026-11-02" : "2026-01-02",
            Kycuoinam: kyMode === "t12",
            Tongluong: 18640000,
            Tonggio: 1023.5,
            Thongbao: "",
            BangLuong: nv7,
          },
        }),
      });
    });
    await page.route("**/api/ky-luong/*/tinh", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            Makyluong: "KL202610",
            Thang: 10,
            Nam: 2026,
            Trangthai: "Chưa tính",
            Ngaychitra: "2026-11-02",
            Kycuoinam: false,
            Tongluong: 18640000,
            Tonggio: 1023.5,
            Thongbao: TINH_LUONG_THANH_CONG,
            BangLuong: nv7,
          },
        }),
      });
    });
    await page.route("**/api/ky-luong/*/nhan-vien/NV000001/chi-tiet*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            Manv: "NV000001",
            Hoten: "Nguyễn Minh Anh",
            Tonggio: 104.5,
            Tongluong: 2090000,
            Ngaychitra: "2026-11-02",
            Tongsodong: 19,
            Trang: 1,
            Sodong: 6,
            Dong: ["01", "02", "04", "06", "08", "09"].map((d) => ({
              Ngaylam: `2026-10-${d}`,
              Ca: "Sáng",
              Vao: "06:00",
              Ra: "11:30",
              Giolam: 5.5,
              Mucluong: 20000,
              Maheso: null,
              Heso: 1,
              Thuong: 0,
              Thanhtien: 110000,
            })),
          },
        }),
      });
    });

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/chu-quan/luong/tinh-luong");
    await page.waitForLoadState("networkidle");

    const p1 = path.join(outDir, "uc-8.2-state1_actual.png");
    await page.screenshot({ path: p1 });
    const pct1 = compare(p1, "UC_8.2_tinh-luong_01.png", "uc-8.2-state1_diff.png");

    await page.locator("#btn-tinh-luong").click();
    await expect(page.locator("#chi-tiet-hien-thi")).toBeVisible();
    const p2 = path.join(outDir, "uc-8.2-state2_actual.png");
    await page.screenshot({ path: p2 });
    const pct2 = compare(p2, "UC_8.2_tinh-luong_02.png", "uc-8.2-state2_diff.png");

    await page.locator("#btn-gui-bang-luong").click();
    await expect(page.locator("#dialog-xac-nhan-gui")).toBeVisible();
    const p3 = path.join(outDir, "uc-8.2-state3_actual.png");
    await page.screenshot({ path: p3 });
    const pct3 = compare(p3, "UC_8.2_tinh-luong_03.png", "uc-8.2-state3_diff.png");

    kyMode = "t12";
    await page.goto("/chu-quan/luong/tinh-luong");
    await page.waitForLoadState("networkidle");
    const p4 = path.join(outDir, "uc-8.2-state4_actual.png");
    await page.screenshot({ path: p4 });
    const pct4 = compare(p4, "UC_8.2_tinh-luong_04.png", "uc-8.2-state4_diff.png");

    console.log(
      `VISUAL_PCT: 01=${pct1.toFixed(2)}% 02=${pct2.toFixed(2)}% 03=${pct3.toFixed(2)}% 04=${pct4.toFixed(2)}%`
    );
    expect(pct1).toBeLessThan(8);
    expect(pct2).toBeLessThan(8);
    expect(pct3).toBeLessThan(8);
    expect(pct4).toBeLessThan(8);
  });

  test("Chưa có kỳ mở -> tự động tạo kỳ lương tháng hiện tại, bấm Tính lương & làm mờ nút gửi khi mở hộp thoại", async ({
    page,
  }) => {
    const vnNow = new Date(Date.now() + 7 * 3600_000);
    const thangNow = vnNow.getUTCMonth() + 1;
    const namNow = vnNow.getUTCFullYear();
    const maHienTai = `KL${namNow}${String(thangNow).padStart(2, "0")}`;

    const kyTruoc = await prisma.kyLuong.findUnique({ where: { Makyluong: maHienTai } });
    const blTruoc = kyTruoc
      ? await prisma.bangLuong.findMany({
          where: { Makyluong: maHienTai },
          include: { ChiTietBangLuong: true, PhanHoiLuong: true },
        })
      : [];

    try {
      // Nếu kỳ tháng hiện tại đang mở và chưa có ràng buộc phát sinh (hoặc xóa tạm), kiểm tra tự động tạo lại
      if (blTruoc.length === 0 && kyTruoc) {
        await prisma.kyLuong.delete({ where: { Makyluong: maHienTai } });
      }

      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto("/chu-quan/luong/tinh-luong");

      await expect(page.locator("#card-ky-luong")).toContainText(`Tháng ${thangNow}`);
      const kySauTao = await prisma.kyLuong.findUnique({ where: { Makyluong: maHienTai } });
      expect(kySauTao).not.toBeNull();
      expect(kySauTao?.Trangthai).toBe("Chưa tính");

      const btnTinh = page.locator("#btn-tinh-luong");
      await expect(btnTinh).toBeVisible();
      await expect(btnTinh).toBeEnabled();
      await btnTinh.click();

      await expect(page.getByText(TINH_LUONG_THANH_CONG)).toBeVisible();
      const btnGui = page.locator("#btn-gui-bang-luong");
      await expect(btnGui).toBeVisible();
      await expect(btnGui).toBeEnabled();

      // Mở hộp thoại xác nhận -> nút Gửi bảng lương dự kiến bị làm mờ/vô hiệu hóa giống Figma 3
      await btnGui.click();
      await expect(page.getByRole("heading", { name: GUI_BANG_LUONG_TIEU_DE })).toBeVisible();
      await expect(btnGui).toBeDisabled();
      await page.getByRole("button", { name: GUI_BANG_LUONG_KHONG, exact: true }).click();
      await expect(btnGui).toBeEnabled();
    } finally {
      if (blTruoc.length === 0) {
        await prisma.chiTietBangLuong.deleteMany({ where: { BangLuong: { Makyluong: maHienTai } } });
        await prisma.bangLuong.deleteMany({ where: { Makyluong: maHienTai } });
        if (kyTruoc) {
          await prisma.kyLuong.upsert({
            where: { Makyluong: maHienTai },
            update: { Trangthai: kyTruoc.Trangthai, Ngaychot: kyTruoc.Ngaychot },
            create: {
              Makyluong: maHienTai,
              Thang: kyTruoc.Thang,
              Nam: kyTruoc.Nam,
              Trangthai: kyTruoc.Trangthai,
              Ngaychot: kyTruoc.Ngaychot,
            },
          });
        } else {
          await prisma.kyLuong.deleteMany({ where: { Makyluong: maHienTai } });
        }
      }
    }
  });

  test("Chưa có chấm công hoàn thành -> vẫn bấm được Tính lương và báo lỗi đỏ 'Tính lương thất bại'", async ({
    page,
  }) => {
    await page.route("**/api/ky-luong/hien-tai", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            Makyluong: "KL202611",
            Thang: 11,
            Nam: 2026,
            Trangthai: "Chưa tính",
            Ngaychitra: "2026-12-02",
            Kycuoinam: false,
          },
        }),
      });
    });
    await page.route("**/api/ky-luong/KL202611/tong-hop", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            Makyluong: "KL202611",
            Thang: 11,
            Nam: 2026,
            Trangthai: "Chưa tính",
            Ngaychitra: "2026-12-02",
            Kycuoinam: false,
            Tongluongky: 0,
            Tonggiothucte: 0,
            BangLuong: [],
            Thongbao: "",
          },
        }),
      });
    });
    await page.route("**/api/ky-luong/KL202611/tinh", async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: { code: "KHONG_CO_CHAM_CONG", message: TINH_LUONG_THAT_BAI },
        }),
      });
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/chu-quan/luong/tinh-luong");
    const btnTinh = page.locator("#btn-tinh-luong");
    await expect(btnTinh).toBeVisible();
    await expect(btnTinh).toBeEnabled();
    await btnTinh.click();

    const banner = page.locator('[data-testid="notification-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(TINH_LUONG_THAT_BAI);
  });
});
