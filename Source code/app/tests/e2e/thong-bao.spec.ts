import { test, expect } from "@playwright/test";
import { signSession, AUTH_COOKIE_NAME } from "../../backend/lib/auth";
import { getTuanLamViec, nowVN } from "../../backend/lib/time";
import { prisma } from "../../database/client";
import {
  DANG_NHAP_TRONG,
  DANG_NHAP_SAI,
  THEM_NV_THANH_CONG,
  THEM_NV_THIEU_TRUONG,
  THEM_NV_TRUNG_SDT,
  THEM_NV_TRANG_THAI_MAC_DINH,
  SUA_NV_THANH_CONG,
  SUA_NV_THIEU_TRUONG,
  SUA_NV_TRUNG_SDT,
  DANG_KY_LICH_RANH_THANH_CONG,
  DANG_KY_LICH_RANH_CHUA_CHON,
  XEP_LICH_LAM_THANH_CONG,
} from "../../frontend/config/thong-bao";

const RED_COLOR = "rgb(192, 57, 43)"; // #C0392B
const GREEN_COLOR = "rgb(88, 117, 84)"; // #587554

test.describe("E2E: Kiểm tra thông báo chuẩn & màu chữ tính toán (08-THONG-BAO.md)", () => {
  let chuQuanToken: string;
  let nhanVienToken: string;
  const testPhone = "0944556677";
  let createdManv = "";

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

    await prisma.nhanVien.deleteMany({
      where: { Sdt: testPhone },
    });
  });

  test.afterAll(async () => {
    if (createdManv) {
      await prisma.nhanVien.deleteMany({ where: { Manv: createdManv } });
    }
    await prisma.nhanVien.deleteMany({ where: { Sdt: testPhone } });
  });

  test("1. Đăng nhập: để trống và sai tài khoản hiện đúng chữ và màu đỏ rgb(192, 57, 43)", async ({ page }) => {
    await page.goto("/dang-nhap");
    await page.waitForLoadState("networkidle");

    // Click Đăng nhập khi để trống
    await page.locator("#login-button").click();

    // Thông báo trống ô tên đăng nhập
    const userErr = page.locator("#empty-username-error");
    await expect(userErr).toBeVisible();
    await expect(userErr).toHaveText(DANG_NHAP_TRONG);
    const userErrColor = await userErr.evaluate((el) => window.getComputedStyle(el).color);
    expect(userErrColor).toBe(RED_COLOR);

    // Thông báo trống ô mật khẩu
    const passErr = page.locator("#empty-password-error");
    await expect(passErr).toBeVisible();
    await expect(passErr).toHaveText(DANG_NHAP_TRONG);
    const passErrColor = await passErr.evaluate((el) => window.getComputedStyle(el).color);
    expect(passErrColor).toBe(RED_COLOR);

    // Nhập sai tài khoản/mật khẩu
    await page.locator("#username-input").fill("sai_tai_khoan");
    await page.locator("#password-input").fill("sai_mat_khau");
    await page.locator("#login-button").click();

    // Thông báo lỗi chung
    const genErr = page.locator("#login-error-message");
    await expect(genErr).toBeVisible();
    await expect(genErr).toHaveText(DANG_NHAP_SAI);
    const genErrColor = await genErr.evaluate((el) => window.getComputedStyle(el).color);
    expect(genErrColor).toBe(RED_COLOR);
  });

  test("2. UC 5.1 Thêm nhân viên: thiếu trường, trùng SĐT, thành công, trạng thái mặc định", async ({ page, context }) => {
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

    await page.goto("/chu-quan/nhan-vien/them");
    await page.waitForLoadState("networkidle");

    // Kiểm tra "Trạng thái mặc định" chỉ ghi "Thử việc"
    const trangThaiInput = page.locator("input[value='Thử việc']");
    await expect(trangThaiInput).toBeVisible();
    await expect(trangThaiInput).toHaveValue(THEM_NV_TRANG_THAI_MAC_DINH);

    // Click Lưu khi chưa nhập gì -> Lỗi thiếu trường
    await page.locator("button:has-text('Lưu')").click();
    const bannerThieu = page.locator("[data-testid='notification-banner']");
    await expect(bannerThieu).toBeVisible();
    await expect(bannerThieu).toHaveText(THEM_NV_THIEU_TRUONG);
    const bannerThieuColor = await bannerThieu.evaluate((el) => window.getComputedStyle(el).color);
    expect(bannerThieuColor).toBe(RED_COLOR);

    // Điền trùng số điện thoại đã có (NV000001: 0905000001)
    await page.locator("#input-hoten").fill("Nguyễn Test Trùng");
    await page.locator("#input-diachi").fill("Hải Châu, Đà Nẵng");
    await page.locator("select").nth(0).selectOption("Phục vụ");
    await page.locator("#input-sdt").fill("0905000001");
    await page.locator("select").nth(1).selectOption("Part-time");
    await page.locator("#input-kinhnghiem").fill("1 năm kinh nghiệm");

    await page.locator("button:has-text('Lưu')").click();
    const bannerTrung = page.locator("[data-testid='notification-banner']");
    await expect(bannerTrung).toBeVisible();
    await expect(bannerTrung).toHaveText(THEM_NV_TRUNG_SDT);
    const bannerTrungColor = await bannerTrung.evaluate((el) => window.getComputedStyle(el).color);
    expect(bannerTrungColor).toBe(RED_COLOR);

    // Đổi số điện thoại thành hợp lệ và lưu thành công
    await page.locator("#input-sdt").fill(testPhone);
    await page.locator("button:has-text('Lưu')").click();

    const bannerThanhCong = page.locator("[data-testid='notification-banner']");
    await expect(bannerThanhCong).toBeVisible();
    await expect(bannerThanhCong).toHaveText(THEM_NV_THANH_CONG);

    // Lưu mã để dọn dẹp
    const created = await prisma.nhanVien.findFirst({ where: { Sdt: testPhone } });
    if (created) createdManv = created.Manv;
  });

  test("3. UC 5.2 Sửa nhân viên: thiếu trường, trùng SĐT, thành công", async ({ page, context }) => {
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

    await page.goto("/chu-quan/nhan-vien/sua");
    await page.waitForLoadState("networkidle");

    // Chọn nhân viên đầu tiên trong danh sách (NV000001)
    const firstRow = page.locator("table tbody tr").first();
    await firstRow.click();
    await page.waitForTimeout(500);

    const hoTenInput = page.locator("label:has-text('Họ và tên') ~ input, label:has-text('Họ và tên') + input").first();
    const sdtInput = page.locator("label:has-text('Số điện thoại') ~ input, label:has-text('Số điện thoại') + input").first();

    const originalName = await hoTenInput.inputValue();
    const originalPhone = await sdtInput.inputValue();

    // Xóa họ tên (trường bắt buộc) rồi bấm Lưu
    await hoTenInput.fill("");
    await page.locator("button:has-text('Lưu')").click();

    // Banner lỗi thiếu trường
    const bannerThieu = page.locator("[data-testid='notification-banner']");
    await expect(bannerThieu).toBeVisible();
    await expect(bannerThieu).toHaveText(SUA_NV_THIEU_TRUONG);
    const bannerThieuColor = await bannerThieu.evaluate((el) => window.getComputedStyle(el).color);
    expect(bannerThieuColor).toBe(RED_COLOR);

    // Điền lại họ tên và thử nhập SĐT trùng của nhân viên khác (NV000002: 0905000002)
    await hoTenInput.fill(originalName || "Nguyễn Minh Anh");
    await sdtInput.fill("0905000002");
    await page.locator("button:has-text('Lưu')").click();

    // Banner lỗi trùng SĐT
    const bannerTrung = page.locator("[data-testid='notification-banner']");
    await expect(bannerTrung).toBeVisible();
    await expect(bannerTrung).toHaveText(SUA_NV_TRUNG_SDT);
    const bannerTrungColor = await bannerTrung.evaluate((el) => window.getComputedStyle(el).color);
    expect(bannerTrungColor).toBe(RED_COLOR);

    // Trả lại SĐT ban đầu và lưu thành công
    await sdtInput.fill(originalPhone || "0905000001");
    await page.locator("button:has-text('Lưu')").click();

    const bannerThanhCong = page.locator("[data-testid='notification-banner']");
    await expect(bannerThanhCong).toBeVisible();
    await expect(bannerThanhCong).toHaveText(SUA_NV_THANH_CONG);
  });

  test("4. UC 2.1 Đăng ký lịch rảnh: không chọn hiện lỗi đỏ, chọn ca gửi thành công hiện xanh", async ({ page, context }) => {
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

    await page.goto("/nhan-vien/ca-lam/lich-ranh");
    await page.waitForLoadState("networkidle");

    // Bỏ chọn tất cả các checkbox (bấm cả label/khối ô lưới)
    const cellLabels = page.locator("table tbody label");
    const cellInputs = page.locator("table tbody input[type='checkbox']");
    const count = await cellInputs.count();
    expect(count).toBe(21);
    for (let i = 0; i < count; i++) {
      if (await cellInputs.nth(i).isChecked()) {
        await cellLabels.nth(i).click();
      }
    }

    // Nhấn Gửi khi chưa chọn ca nào -> Thông báo lỗi đỏ
    await page.locator("#btn-submit").click();
    const bannerLoi = page.locator("[data-testid='notification-banner']");
    await expect(bannerLoi).toBeVisible();
    await expect(bannerLoi).toHaveText(DANG_KY_LICH_RANH_CHUA_CHON);
    const colorLoi = await bannerLoi.evaluate((el) => window.getComputedStyle(el).color);
    expect(colorLoi).toBe(RED_COLOR);

    // Bấm vào vùng khoảng trống góc ô (NGOÀI ô tick nhỏ) -> đổi đúng 1 lần thành checked
    const firstLabelBox = await cellLabels.first().boundingBox();
    expect(firstLabelBox).not.toBeNull();
    await page.mouse.click(firstLabelBox!.x + 8, firstLabelBox!.y + 8);
    await expect(cellInputs.first()).toBeChecked();
    // Bấm lại lần nữa vào góc đối diện -> bỏ chọn đúng 1 lần
    await page.mouse.click(firstLabelBox!.x + firstLabelBox!.width - 8, firstLabelBox!.y + firstLabelBox!.height - 8);
    await expect(cellInputs.first()).not.toBeChecked();
    // Chọn lại để gửi thành công
    await cellLabels.first().click();
    await expect(cellInputs.first()).toBeChecked();

    // Nhấn Gửi -> Thành công
    await page.locator("#btn-submit").click();
    const bannerSuccess = page.locator("[data-testid='notification-banner']");
    await expect(bannerSuccess).toBeVisible();
    await expect(bannerSuccess).toHaveText(DANG_KY_LICH_RANH_THANH_CONG);
    const colorSuccess = await bannerSuccess.evaluate((el) => window.getComputedStyle(el).color);
    expect(colorSuccess).toBe(GREEN_COLOR);
  });

  test("5. UC 6.1 Xếp lịch làm: chip ngày hành vi radio (chỉ chọn 1), giữ state từng ngày khi chuyển chip, bàn phím mũi tên/Enter/Space", async ({ page, context }) => {
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

    await page.goto("/chu-quan/lich-lam/xep-lich");
    await page.waitForLoadState("networkidle");

    const radioGroup = page.locator("[role='radiogroup'][aria-label='Chọn ngày trong tuần']");
    await expect(radioGroup).toBeVisible();
    const dayChips = radioGroup.locator("button[role='radio']");
    await expect(dayChips).toHaveCount(7);

    // Ban đầu có ĐÚNG 1 chip được chọn (hôm nay theo giờ VN nếu trong tuần, ngược lại chip đầu tiên)
    const checkedChips = radioGroup.locator("button[role='radio'][aria-checked='true']");
    await expect(checkedChips).toHaveCount(1);

    // Kiểm tra vùng bấm tối thiểu >= 44px
    const firstBox = await dayChips.first().boundingBox();
    expect(firstBox).not.toBeNull();
    expect(firstBox!.height).toBeGreaterThanOrEqual(44);

    const tuan = getTuanLamViec(nowVN());
    const day0Short = tuan.days[0].shortDate;
    const day3Short = tuan.days[3].shortDate;

    // Bấm ngày đầu tuần (chip 0) -> chỉ chip 0 được chọn & tô xanh đậm
    await dayChips.nth(0).click();
    await expect(dayChips.nth(0)).toHaveAttribute("aria-checked", "true");
    await expect(dayChips.nth(0)).toHaveCSS("background-color", "rgb(51, 78, 172)");
    await expect(checkedChips).toHaveCount(1);
    await expect(page.locator("h3")).toContainText(day0Short);

    // Đọc trạng thái ban đầu của nhân viên thứ 2 (NV000002) ở chip 0 rồi toggle
    const nvCheckboxes = page.locator("label").filter({ has: page.locator("input[type='checkbox']") });
    const targetNvDay0 = nvCheckboxes.nth(1);
    const wasCheckedDay0 = await targetNvDay0.locator("input").isChecked();
    await targetNvDay0.click();
    const expectedAfterToggleDay0 = !wasCheckedDay0;
    await expect(targetNvDay0.locator("input")).toBeChecked({ checked: expectedAfterToggleDay0 });

    // Bấm ngày thứ tư trong tuần (chip 3) -> chỉ còn chip 3 được chọn, chip 0 tự bỏ chọn
    await dayChips.nth(3).click();
    await expect(dayChips.nth(3)).toHaveAttribute("aria-checked", "true");
    await expect(dayChips.nth(3)).toHaveCSS("background-color", "rgb(51, 78, 172)");
    await expect(dayChips.nth(0)).toHaveAttribute("aria-checked", "false");
    await expect(dayChips.nth(0)).not.toHaveCSS("background-color", "rgb(51, 78, 172)");
    await expect(checkedChips).toHaveCount(1);
    await expect(page.locator("h3")).toContainText(day3Short);

    // Bấm lại chip 3 -> vẫn giữ nguyên đang chọn (không bỏ chọn)
    await dayChips.nth(3).click();
    await expect(dayChips.nth(3)).toHaveAttribute("aria-checked", "true");
    await expect(checkedChips).toHaveCount(1);

    // Đảm bảo nhân viên ở chip 3 được tick để khi lưu có cả 2 ngày
    const targetNvDay3 = nvCheckboxes.nth(2);
    if (!(await targetNvDay3.locator("input").isChecked())) {
      await targetNvDay3.click();
    }
    await expect(targetNvDay3.locator("input")).toBeChecked();

    // Bàn phím: ArrowLeft từ chip 3 -> chuyển về chip 2, rồi ArrowRight quay lại chip 3
    await dayChips.nth(3).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(dayChips.nth(2)).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("ArrowRight");
    await expect(dayChips.nth(3)).toHaveAttribute("aria-checked", "true");

    // Quay lại chip 0 -> dữ liệu đã đổi ở chip 0 vẫn còn nguyên trong state
    await dayChips.nth(0).click();
    await expect(page.locator("h3")).toContainText(day0Short);
    await expect(targetNvDay0.locator("input")).toBeChecked({ checked: expectedAfterToggleDay0 });

    // Nếu trước đó bỏ tick khiến chip 0 chưa tick NV nào thì tick lại để đảm bảo đủ >= 2 ngày
    if (!expectedAfterToggleDay0) {
      await targetNvDay0.click();
    }

    // Lưu -> gửi đủ cả 2 ngày đã chọn nhân viên (chip 0 và chip 3) và hiện thông báo xanh
    const [saveReq] = await Promise.all([
      page.waitForRequest((req) => req.url().includes("/api/chu-quan/lich-lam") && req.method() === "POST"),
      page.locator("#btn-save").click(),
    ]);
    const sentBody = saveReq.postDataJSON();
    expect(sentBody.cacNgay.length).toBeGreaterThanOrEqual(2);

    const bannerSuccess = page.locator("[data-testid='notification-banner']");
    await expect(bannerSuccess).toBeVisible();
    await expect(bannerSuccess).toHaveText(XEP_LICH_LAM_THANH_CONG);
    const colorSuccess = await bannerSuccess.evaluate((el) => window.getComputedStyle(el).color);
    expect(colorSuccess).toBe(GREEN_COLOR);
  });

  test("6. UC 6.2 Xếp ca làm: đúng 3 ca với 3/2/2 dropdown slot theo Figma", async ({ page, context }) => {
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

    await page.goto("/chu-quan/lich-lam/xep-ca");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("#select-ngay-xep-ca")).toBeVisible();
    await expect(page.locator("select[aria-label^='Ca sáng']")).toHaveCount(3);
    await expect(page.locator("select[aria-label^='Ca chiều']")).toHaveCount(2);
    await expect(page.locator("select[aria-label^='Ca tối']")).toHaveCount(2);
  });

  test("7. Responsive UC 2.1, 6.1, 6.2 (360..1920px): không cuộn ngang, mobile UC 2.1 đổi sang thẻ", async ({ page, context }) => {
    const viewports = [
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 },
      { width: 1920, height: 1080 },
    ];

    // Kiểm tra UC 2.1 (Nhân viên)
    await context.clearCookies();
    await context.addCookies([
      { name: AUTH_COOKIE_NAME, value: nhanVienToken, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    ]);
    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.goto("/nhan-vien/ca-lam/lich-ranh");
      await page.waitForLoadState("networkidle");
      const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(hasHScroll, `UC 2.1 cuộn ngang ở ${vp.width}px`).toBe(false);
      if (vp.width < 768) {
        await expect(page.locator("table")).toBeHidden();
        const mobileCardBox = await page.locator("label").filter({ has: page.locator("input[type='checkbox']") }).first().boundingBox();
        if (mobileCardBox) {
          expect(mobileCardBox.height).toBeGreaterThanOrEqual(44);
        }
      } else {
        await expect(page.locator("table")).toBeVisible();
      }
    }

    // Kiểm tra UC 6.1 & 6.2 (Chủ quán)
    await context.clearCookies();
    await context.addCookies([
      { name: AUTH_COOKIE_NAME, value: chuQuanToken, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    ]);
    for (const pathUrl of ["/chu-quan/lich-lam/xep-lich", "/chu-quan/lich-lam/xep-ca"]) {
      for (const vp of viewports) {
        await page.setViewportSize(vp);
        await page.goto(pathUrl);
        await page.waitForLoadState("networkidle");
        const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        expect(hasHScroll, `${pathUrl} cuộn ngang ở ${vp.width}px`).toBe(false);
        if (pathUrl === "/chu-quan/lich-lam/xep-lich" && vp.width === 390) {
          const dayCardBox = await page.locator("[role='radiogroup'] button[role='radio']").first().boundingBox();
          expect(dayCardBox).not.toBeNull();
          expect(dayCardBox!.height).toBeGreaterThanOrEqual(44);
        }
      }
    }
  });
});
