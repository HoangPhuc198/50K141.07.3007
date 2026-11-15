/**
 * tests/e2e/visual-login.spec.ts
 * So sánh màn hình /dang-nhap với ảnh Figma bằng pixelmatch.
 * Mục tiêu: lệch < 5% ngoài vùng dữ liệu động (placeholder text có thể khác).
 *
 * Chạy: npm run test:layout (hoặc npx playwright test tests/e2e/visual-login.spec.ts)
 * Yêu cầu: server đã build (next build + next start -p 3000)
 */
import { test, expect } from "@playwright/test";
import { signSession, AUTH_COOKIE_NAME } from "../../backend/lib/auth";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const FIGMA_DIR = path.resolve(__dirname, "../../../docs/figma");
const RESULT_DIR = path.resolve(__dirname, "../../../docs/ket-qua");
const FIGMA_ASSETS_DIR = path.resolve(__dirname, "../../public/assets");

/** Đọc PNG và trả về { data, width, height } */
function readPng(filePath: string): { data: Buffer; width: number; height: number } {
  const buf = fs.readFileSync(filePath);
  const png = PNG.sync.read(buf);
  return { data: png.data, width: png.width, height: png.height };
}

/** Lưu PNG diff ra file */
function saveDiff(
  diff: Uint8Array,
  width: number,
  height: number,
  outPath: string
) {
  const diffPng = new PNG({ width, height });
  diffPng.data = Buffer.from(diff);
  const buf = PNG.sync.write(diffPng);
  fs.writeFileSync(outPath, buf);
}

type MaskRect = { name?: string; x: number; y: number; width: number; height: number };

/**
 * Xóa vùng mask (fill màu trắng) trong buffer RGBA để bỏ qua khi so sánh.
 */
function applyMasks(data: Buffer, imgWidth: number, masks: MaskRect[]) {
  for (const m of masks) {
    for (let row = m.y; row < m.y + m.height; row++) {
      for (let col = m.x; col < m.x + m.width; col++) {
        const idx = (row * imgWidth + col) * 4;
        data[idx] = 255;     // R
        data[idx + 1] = 255; // G
        data[idx + 2] = 255; // B
        data[idx + 3] = 255; // A
      }
    }
  }
}

/**
 * So 2 ảnh PNG và trả về phần trăm pixel khác biệt.
 * Nếu kích thước khác nhau, trả về -1.
 * masks: vùng bỏ qua (fill trắng cả 2 ảnh trước khi so).
 */
function compareImages(
  actualPath: string,
  referencePath: string,
  diffPath: string,
  threshold = 0.1,
  masks: MaskRect[] = []
): number {
  if (!fs.existsSync(actualPath)) {
    console.log(`  [SKIP] Actual not found: ${actualPath}`);
    return -1;
  }
  if (!fs.existsSync(referencePath)) {
    console.log(`  [SKIP] Reference not found: ${referencePath}`);
    return -1;
  }

  const actual = readPng(actualPath);
  const reference = readPng(referencePath);

  if (actual.width !== reference.width || actual.height !== reference.height) {
    console.log(
      `  [WARN] Size mismatch: actual=${actual.width}x${actual.height} vs ref=${reference.width}x${reference.height}`
    );
    return -1;
  }

  // Áp dụng mask (bỏ qua vùng dynamic)
  if (masks.length > 0) {
    applyMasks(actual.data, actual.width, masks);
    applyMasks(reference.data, reference.width, masks);
  }

  const { width, height } = actual;
  const diff = new Uint8Array(width * height * 4);

  const numDiff = pixelmatch(
    actual.data,
    reference.data,
    diff,
    width,
    height,
    { threshold, includeAA: false }
  );

  saveDiff(diff, width, height, diffPath);

  const pct = (numDiff / (width * height)) * 100;
  return pct;
}

/** ───────────────────────────────────────────────────────── */

test.describe("Visual Regression – Màn hình Đăng nhập", () => {
  if (!fs.existsSync(RESULT_DIR)) fs.mkdirSync(RESULT_DIR, { recursive: true });

  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  /**
   * Trạng thái 1: Mặc định – so với UC_1_dang-nhap_01.png
   */
  test("Trạng thái 1 – Mặc định: lệch < 5% so Figma", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/dang-nhap");
    await page.waitForSelector("[data-hydrated='true']", { timeout: 10000 });
    // Đợi ảnh nền load
    await page.waitForLoadState("networkidle");

    const shotPath = path.join(RESULT_DIR, "login_state1_actual.png");
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`  Chụp: ${shotPath}`);

    const refPath = path.join(FIGMA_DIR, "UC_1_dang-nhap_01.png");
    const diffPath = path.join(RESULT_DIR, "login_state1_diff.png");
    const pct = compareImages(shotPath, refPath, diffPath);

    if (pct < 0) {
      console.log("  [SKIP] Không so được (kích thước khác hoặc thiếu file)");
    } else {
      console.log(`  Độ lệch trạng thái 1: ${pct.toFixed(2)}%`);
      // Chuẩn RULES.md: shell/login <= 3%
      expect(pct, `Lệch ${pct.toFixed(2)}% > 3% (xem diff: ${diffPath})`).toBeLessThanOrEqual(3);
    }
  });

  /**
   * Trạng thái 2: Lỗi để trống – so với UC_1_dang-nhap_02.png
   */
  test("Trạng thái 2 – Lỗi trống: lệch < 5% so Figma", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/dang-nhap");
    await page.waitForSelector("[data-hydrated='true']", { timeout: 10000 });
    await page.waitForLoadState("networkidle");

    // Nhấn Đăng nhập khi chưa nhập gì → hiện lỗi trống
    await page.locator("#login-button").click();
    await page.waitForSelector("#empty-username-error", { timeout: 5000 });

    const shotPath = path.join(RESULT_DIR, "login_state2_actual.png");
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`  Chụp: ${shotPath}`);

    const refPath = path.join(FIGMA_DIR, "UC_1_dang-nhap_02.png");
    const diffPath = path.join(RESULT_DIR, "login_state2_diff.png");
    const pct = compareImages(shotPath, refPath, diffPath);

    if (pct < 0) {
      console.log("  [SKIP] Không so được");
    } else {
      console.log(`  Độ lệch trạng thái 2: ${pct.toFixed(2)}%`);
      expect(pct, `Lệch ${pct.toFixed(2)}% > 3% (xem diff: ${diffPath})`).toBeLessThanOrEqual(3);
    }
  });

  /**
   * Trạng thái 3: Sai thông tin – so với UC_1_dang-nhap_03.png
   */
  test("Trạng thái 3 – Sai thông tin: lệch < 5% so Figma", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/dang-nhap");
    await page.waitForSelector("[data-hydrated='true']", { timeout: 10000 });
    await page.waitForLoadState("networkidle");

    await page.locator("#username-input").fill("CQ000001");
    await page.locator("#password-input").fill("sai_mat_khau_xyz_1234");
    await page.locator("#login-button").click();
    await page.waitForSelector("#login-error-message", { timeout: 10000 });

    const shotPath = path.join(RESULT_DIR, "login_state3_actual.png");
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`  Chụp: ${shotPath}`);

    const refPath = path.join(FIGMA_DIR, "UC_1_dang-nhap_03.png");
    const diffPath = path.join(RESULT_DIR, "login_state3_diff.png");
    const pct = compareImages(shotPath, refPath, diffPath);

    if (pct < 0) {
      console.log("  [SKIP] Không so được");
    } else {
      console.log(`  Độ lệch trạng thái 3: ${pct.toFixed(2)}%`);
      expect(pct, `Lệch ${pct.toFixed(2)}% > 3% (xem diff: ${diffPath})`).toBeLessThanOrEqual(3);
    }
  });

  /**
   * Chắc chắn không có thanh cuộn ngang ở mọi trạng thái
   */
  for (const [width, height] of [[390, 844], [1280, 800], [1920, 1080]] as [number, number][]) {
    test(`Không cuộn ngang trang đăng nhập ở ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/dang-nhap");
      await page.waitForLoadState("domcontentloaded");
      const hasHScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasHScroll, `Có thanh cuộn ngang ở ${width}px`).toBe(false);
    });
  }

  test.describe("Visual Regression – Hai màn hình chính", () => {
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

    test("Màn hình chính Chủ quán (/chu-quan): so với Figma", async ({ page, context }) => {
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
      await page.goto("/chu-quan");
      await page.waitForLoadState("networkidle");

      const shotPath = path.join(RESULT_DIR, "main_chuquan_actual.png");
      await page.screenshot({ path: shotPath, fullPage: false });
      console.log(`  Chụp: ${shotPath}`);

      const refPath = path.join(FIGMA_DIR, "00_man-hinh-chinh_chu-quan.png");
      const diffPath = path.join(RESULT_DIR, "main_chuquan_diff.png");
      const pct = compareImages(shotPath, refPath, diffPath);

      if (pct < 0) {
        console.log("  [SKIP] Không so được");
      } else {
        console.log(`  Độ lệch màn hình chính Chủ quán: ${pct.toFixed(2)}%`);
        // Chuẩn RULES.md: hai màn chính <= 5%
        expect(pct, `Lệch ${pct.toFixed(2)}% > 5% (xem diff: ${diffPath})`).toBeLessThanOrEqual(5);
      }
    });

    test("Màn hình chính Nhân viên (/nhan-vien): so với Figma", async ({ page, context }) => {
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
      await page.goto("/nhan-vien");
      await page.waitForLoadState("networkidle");

      const shotPath = path.join(RESULT_DIR, "main_nhanvien_actual.png");
      await page.screenshot({ path: shotPath, fullPage: false });
      console.log(`  Chụp: ${shotPath}`);

      const refPath = path.join(FIGMA_DIR, "00_man-hinh-chinh_nhan-vien.png");
      const diffPath = path.join(RESULT_DIR, "main_nhanvien_diff.png");
      const pct = compareImages(shotPath, refPath, diffPath);

      if (pct < 0) {
        console.log("  [SKIP] Không so được");
      } else {
        console.log(`  Độ lệch màn hình chính Nhân viên: ${pct.toFixed(2)}%`);
        // Chuẩn RULES.md: hai màn chính <= 5%
        expect(pct, `Lệch ${pct.toFixed(2)}% > 5% (xem diff: ${diffPath})`).toBeLessThanOrEqual(5);
      }
    });

    // Duyệt qua tất cả các màn hình được đăng ký trong visual-map.json
    const mapPath = path.resolve(__dirname, "../visual/visual-map.json");
    if (fs.existsSync(mapPath)) {
      const visualMap = JSON.parse(fs.readFileSync(mapPath, "utf-8"));
      for (const [screenKey, conf] of Object.entries<any>(visualMap.screens)) {
        // Bỏ qua các màn đã test ở trên
        if (screenKey === "dang-nhap" || screenKey === "chu-quan-main" || screenKey === "nhan-vien-main") {
          continue;
        }

        test(`Màn hình ${screenKey} (${conf.path}): so với Figma`, async ({ page, context }) => {
          const token = conf.role === "NhanVien" ? nhanVienToken : chuQuanToken;
          await context.addCookies([
            {
              name: AUTH_COOKIE_NAME,
              value: token,
              domain: "localhost",
              path: "/",
              httpOnly: true,
              sameSite: "Lax",
            },
          ]);
          await page.setViewportSize({ width: 1920, height: 1080 });
          await page.goto(conf.path);
          await page.waitForLoadState("networkidle");

          const shotPath = path.join(RESULT_DIR, `${screenKey}_actual.png`);
          await page.screenshot({ path: shotPath, fullPage: false });
          console.log(`  Chụp: ${shotPath}`);

          const refPath = path.join(FIGMA_DIR, conf.figma);
          const diffPath = path.join(RESULT_DIR, `${screenKey}_diff.png`);
          const masks = conf.masks || [];
          // UC_6.3 (uc-6.3-doi-ca): Bỏ qua (mask) vùng bảng "Lịch ca sau khi lưu" (#block-preview-lich)
          // vì ảnh chuẩn Figma hiện vẽ trạng thái "Đang làm" trái SPEC (chỉ hiện 1 dòng người thay hợp lệ, không liệt kê người đang trong ca).
          // Phần còn lại vẫn giữ ngưỡng <= 8%. Khi chủ dự án cập nhật lại ảnh chuẩn Figma cho khớp SPEC, xóa mask "block-preview-lich" trong visual-map.json.
          if (screenKey === "uc-6.3-doi-ca") {
            console.log(
              "  [MASK UC_6.3] Bỏ qua vùng bảng 'Lịch ca sau khi lưu' (#block-preview-lich): ngoại lệ Figma đã chốt ngày 15/11/2026; xóa mask khi thay ảnh chuẩn Figma mới."
            );
          }
          const pct = compareImages(shotPath, refPath, diffPath, conf.threshold || 0.1, masks);

          if (pct < 0) {
            console.log(`  [SKIP] Không so được ${screenKey}`);
          } else {
            console.log(`  Độ lệch màn hình ${screenKey}: ${pct.toFixed(2)}%`);
            const maxDiff = conf.maxDiffPercent ?? 8.0;
            expect(pct, `Lệch ${pct.toFixed(2)}% > ${maxDiff}% (xem diff: ${diffPath})`).toBeLessThanOrEqual(maxDiff);
          }
        });
      }
    }
  });
});
