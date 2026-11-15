import { test, expect } from "@playwright/test";
import { signSession, AUTH_COOKIE_NAME } from "../../backend/lib/auth";
import { prisma } from "../../database/client";
import {
  CHOT_LUONG_CO_PHAN_HOI_NOI_DUNG,
  CHOT_LUONG_CO_PHAN_HOI_TIEU_DE,
  CHOT_LUONG_THANH_CONG,
} from "../../frontend/config/thong-bao";

const VIEWPORTS = [
  { width: 360, height: 800, name: "360px" },
  { width: 390, height: 844, name: "390px" },
  { width: 768, height: 1024, name: "768px" },
  { width: 1280, height: 800, name: "1280px" },
  { width: 1920, height: 1080, name: "1920x1080" },
];

const KY_ID = "KL209711";
const BL_ID = "BL970001";
const CT_ID = "CT970001";
const PH_ID = "PH970001";
const HS_ID = "HS970001";

async function cleanupFixtures() {
  await prisma.phanHoiLuong.deleteMany({ where: { Maphanhoi: PH_ID } });
  await prisma.chiTietBangLuong.deleteMany({ where: { MaCTBL: CT_ID } });
  await prisma.bangLuong.deleteMany({ where: { Mabangluong: BL_ID } });
  await prisma.heSoLuong.deleteMany({ where: { Maheso: HS_ID } });
  await prisma.kyLuong.deleteMany({ where: { Makyluong: KY_ID } });
}

test.describe("E2E UC_8.6 Chốt bảng lương (U29)", () => {
  test.describe.configure({ mode: "serial" });

  let chuQuanToken = "";
  let nhanVienToken = "";

  test.beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ??
      "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";

    chuQuanToken = await signSession({
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Hoàng Lan",
    });

    nhanVienToken = await signSession({
      userId: "NV000001",
      username: "NV000001",
      role: "NhanVien",
      name: "Nguyễn Minh Anh",
    });

    await cleanupFixtures();

    await prisma.kyLuong.create({
      data: {
        Makyluong: KY_ID,
        Thang: 11,
        Nam: 2097,
        Trangthai: "Dự kiến",
        Ngaychot: null,
      },
    });

    await prisma.heSoLuong.create({
      data: {
        Maheso: HS_ID,
        Ngaybatdau: new Date("2097-11-10T00:00:00.000Z"),
        Ngayketthuc: new Date("2097-11-10T00:00:00.000Z"),
        Heso: 1.5,
      },
    });

    await prisma.bangLuong.create({
      data: {
        Mabangluong: BL_ID,
        Manv: "NV000001",
        Makyluong: KY_ID,
        Tienthuong: 100000,
        Lydothuong: "Chuyên cần",
      },
    });

    await prisma.chiTietBangLuong.create({
      data: {
        MaCTBL: CT_ID,
        Ngaylam: new Date("2097-11-10T00:00:00.000Z"),
        Giolam: 8,
        Mucluong: 25000,
        Mabangluong: BL_ID,
        Maheso: HS_ID,
      },
    });

    await prisma.phanHoiLuong.create({
      data: {
        Maphanhoi: PH_ID,
        Noidung: "Nhờ kiểm tra lại giờ công",
        Ngaygui: new Date("2097-12-01T00:00:00.000Z"),
        Ngayxuly: null,
        Trangthai: "Chưa xử lý",
        Mabangluong: BL_ID,
      },
    });
  });

  test.afterAll(async () => {
    await cleanupFixtures();
  });

  test("Điều hướng từ menu: Quản lý lương -> Chốt bảng lương & active sidebar", async ({
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

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/chu-quan");
    await page.waitForLoadState("networkidle");

    const groupBtn = page.locator('aside nav button:has-text("Quản lý lương")');
    await expect(groupBtn).toBeVisible();
    const linkChot = page.locator(
      'aside nav a[href="/chu-quan/luong/chot-luong"]'
    );
    if (!(await linkChot.isVisible().catch(() => false))) {
      await groupBtn.click();
    }
    await expect(linkChot).toBeVisible();
    await linkChot.click();
    await page.waitForURL("**/chu-quan/luong/chot-luong");
    await expect(linkChot).toHaveClass(/bg-\[#F7F2EB\]/);
  });

  test("Khứ hồi dữ liệu + hộp thoại chặn (_03) + chốt thành công (_02) + NV thấy Đã chốt", async ({
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

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(`/chu-quan/luong/chot-luong?makyluong=${KY_ID}`);
    await page.waitForLoadState("networkidle");

    // 1. Đối chiếu khứ hồi 3 thẻ tổng hợp & 7 cột bảng
    // Tổng lương = 8 * 25.000 * 1.5 + 100.000 = 400.000đ
    await expect(page.locator("#card-tong-luong")).toContainText("Tổng lương đã cập nhật");
    await expect(page.locator("#card-tong-luong")).toContainText("400.000đ");
    await expect(page.locator("#card-tong-luong")).toContainText("Tháng 11/2097 · 1 nhân viên");

    await expect(page.locator("#card-phan-hoi")).toContainText("1 phản hồi");
    await expect(page.locator("#card-trang-thai")).toContainText("Bảng lương dự kiến");

    const row = page.locator("table tbody tr").first();
    await expect(row).toContainText("Nguyễn Minh Anh");
    await expect(row).toContainText("25.000");
    await expect(row).toContainText("1,5");
    await expect(row).toContainText("100.000");
    await expect(row).toContainText("400.000");

    // 2. Bấm Chốt bảng lương khi còn phản hồi chưa xử lý -> mở hộp thoại chặn (UC_8.6_03)
    const btnChot = page.locator("#btn-chot-bang-luong");
    await expect(btnChot).toBeEnabled();
    await btnChot.click();

    const dialog = page.getByTestId("blocking-feedback-dialog");
    await expect(dialog).toBeVisible();
    await expect(page.locator("#blocking-dialog-title")).toHaveText(
      "Có phản hồi chưa xử lý"
    );
    await expect(page.locator("#blocking-chot-dialog-message")).toHaveText(
      "Vui lòng xử lý hết các phản hồi trước khi chốt bảng lương"
    );
    await expect(dialog).toContainText(CHOT_LUONG_CO_PHAN_HOI_TIEU_DE);
    await expect(dialog).toContainText(CHOT_LUONG_CO_PHAN_HOI_NOI_DUNG);
    await expect(page.locator("#btn-xac-nhan-chot-dialog")).toHaveText("Xác nhận");

    // Bấm Xác nhận chỉ đóng hộp thoại, không ghi CSDL
    await page.locator("#btn-xac-nhan-chot-dialog").click();
    await expect(dialog).toBeHidden();

    // Test nút X cũng đóng hộp thoại
    await btnChot.click();
    await expect(dialog).toBeVisible();
    await page.locator("#btn-dong-chot-dialog").click();
    await expect(dialog).toBeHidden();

    const kyStillDraft = await prisma.kyLuong.findUnique({ where: { Makyluong: KY_ID } });
    expect(kyStillDraft?.Trangthai).toBe("Dự kiến");

    // 3. Xử lý xong phản hồi -> tải lại -> chốt trực tiếp (không có popup xác nhận trước khi chốt)
    await prisma.phanHoiLuong.update({
      where: { Maphanhoi: PH_ID },
      data: { Trangthai: "Đã xử lý", Ngayxuly: new Date("2097-12-01T00:00:00.000Z") },
    });

    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("#card-phan-hoi")).toContainText("0 phản hồi");
    await expect(page.locator("#card-phan-hoi")).toContainText("Đủ điều kiện để chốt bảng lương");

    await btnChot.click();

    const banner = page.getByTestId("notification-banner");
    await expect(banner).toBeVisible({ timeout: 10000 });
    await expect(banner).toContainText(CHOT_LUONG_THANH_CONG);
    const textColor = await banner.evaluate((el) => getComputedStyle(el).color);
    expect(textColor).toBe("rgb(88, 117, 84)");

    await expect(page.locator("#card-trang-thai")).toContainText("Bảng lương đã chốt");
    await expect(btnChot).toBeDisabled();

    const kyFinalized = await prisma.kyLuong.findUnique({ where: { Makyluong: KY_ID } });
    expect(kyFinalized?.Trangthai).toBe("Đã chốt");
    expect(kyFinalized?.Ngaychot).not.toBeNull();

    // 4. Nhân viên mở màn xem bảng lương thấy nhãn Đã chốt
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
    await page.goto("/nhan-vien/luong/xem");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("trang-thai-bang-luong")).toHaveText("Đã chốt");
  });

  for (const vp of VIEWPORTS) {
    test(`Responsive ở ${vp.name}: không có thanh cuộn ngang`, async ({
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

      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`/chu-quan/luong/chot-luong?makyluong=${KY_ID}`);
      await page.waitForLoadState("networkidle");

      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(
        hasHorizontalScroll,
        `Màn /chu-quan/luong/chot-luong bị cuộn ngang ở ${vp.name}`
      ).toBe(false);

      if (vp.width === 1920 || vp.width === 390) {
        await page.screenshot({
          path: `../docs/ket-qua/uc-8.6_${vp.name}.png`,
          fullPage: false,
        });
      }
    });
  }
});
