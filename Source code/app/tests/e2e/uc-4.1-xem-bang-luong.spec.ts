import { test, expect, type Page } from "@playwright/test";
import { prisma } from "../../database/client";
import { AUTH_COOKIE_NAME, signSession } from "../../backend/lib/auth";

const KY_TEST = "KL209711"; // 11/2097
const BL_NV1 = "BL410001";
const HS_TEST = "HS41E2E1";

async function ganPhien(page: Page, token: string) {
  await page.context().addCookies([
    {
      name: AUTH_COOKIE_NAME,
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function donDepDuLieuTest() {
  await prisma.chiTietBangLuong.deleteMany({ where: { Mabangluong: BL_NV1 } });
  await prisma.bangLuong.deleteMany({ where: { Mabangluong: BL_NV1 } });
  await prisma.heSoLuong.deleteMany({ where: { Maheso: HS_TEST } });
  await prisma.kyLuong.deleteMany({ where: { Makyluong: KY_TEST } });
}

test.describe.serial("UC_4.1 - Xem bảng lương (Nhân viên)", () => {
  let nv1Token: string;
  let nv2Token: string;

  test.beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";
    nv1Token = await signSession({
      userId: "NV000001",
      username: "NV000001",
      role: "NhanVien",
      name: "Nguyễn Minh Anh",
    });
    nv2Token = await signSession({
      userId: "NV000002",
      username: "NV000002",
      role: "NhanVien",
      name: "Trần Văn Bình",
    });
    await donDepDuLieuTest();
  });

  test.afterAll(async () => {
    await donDepDuLieuTest();
  });

  test("1. Điều hướng từ menu /nhan-vien → Kiểm tra bảng lương → Xem bảng lương và trạng thái chưa tổng hợp", async ({
    page,
  }) => {
    await ganPhien(page, nv1Token);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/nhan-vien");

    // Mở nhóm menu Kiểm tra bảng lương và bấm Xem bảng lương
    await page.getByRole("button", { name: /Kiểm tra bảng lương/i }).click();
    await page.getByRole("link", { name: /^Xem bảng lương$/i }).click();
    await page.waitForURL("**/nhan-vien/luong/xem");
    await page.locator('[data-hydrated="true"]').waitFor({ state: "visible" });

    // Khi chưa có dữ liệu bảng lương → hiển thị hình ví nội bộ và thông báo chuẩn
    const img = page.locator('img[src="/figma/vi-bang-luong.svg"]');
    await expect(img).toBeVisible();
    await expect(page.getByTestId("thong-bao-chua-tong-hop")).toHaveText("Bảng lương chưa được tổng hợp");
    await expect(page.locator("main").getByRole("link", { name: "Quay lại" })).toHaveAttribute("href", "/nhan-vien");
    await expect(page.locator("main").getByRole("link", { name: "Phản hồi sai sót lương" })).toHaveCount(0);
  });

  test("2. Trạng thái Dự kiến: khứ hồi 3 thẻ + bảng 6 cột + phân trang 2 trang + nút Phản hồi", async ({
    page,
  }) => {
    await prisma.heSoLuong.create({
      data: {
        Maheso: HS_TEST,
        Ngaybatdau: new Date("2097-11-01"),
        Ngayketthuc: new Date("2097-11-30"),
        Heso: 2,
      },
    });
    await prisma.kyLuong.create({
      data: {
        Makyluong: KY_TEST,
        Thang: 11,
        Nam: 2097,
        Trangthai: "Dự kiến",
      },
    });
    await prisma.bangLuong.create({
      data: {
        Mabangluong: BL_NV1,
        Manv: "NV000001",
        Makyluong: KY_TEST,
        Tienthuong: 50000,
        Lydothuong: "Chuyên cần",
      },
    });
    await prisma.chiTietBangLuong.createMany({
      data: [1, 2, 3, 4, 5, 6, 7, 8].map((d) => ({
        MaCTBL: `CT41000${d}`,
        Mabangluong: BL_NV1,
        Ngaylam: new Date(`2097-11-0${d}`),
        Giolam: d === 1 ? 5.5 : 4,
        Mucluong: 20000,
        Maheso: d === 1 ? HS_TEST : null,
      })),
    });

    await ganPhien(page, nv1Token);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/nhan-vien/luong/xem");
    await page.locator('[data-hydrated="true"]').waitFor({ state: "visible" });

    // Kiểm tra 3 thẻ thống kê khứ hồi (tổng lương = 830.000đ, 33,5 giờ, 50.000đ)
    await expect(page.getByText("Tổng lương dự kiến")).toBeVisible();
    await expect(page.getByText("830.000đ")).toBeVisible();
    await expect(page.getByText("Giờ làm thực tế")).toBeVisible();
    await expect(page.getByText("33,5 giờ")).toBeVisible();
    await expect(page.getByText("Tổng tiền thưởng")).toBeVisible();
    await expect(page.getByText("50.000đ")).toBeVisible();

    // Header bảng và nhãn trạng thái
    await expect(page.getByRole("heading", { name: "Lương tháng 11" })).toBeVisible();
    await expect(page.getByTestId("trang-thai-bang-luong")).toHaveText("Dự kiến");

    // Kiểm tra cột và dòng 1
    await expect(page.getByRole("columnheader", { name: "Ngày" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Giờ thực tế" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Lương/giờ" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Hệ số" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Thưởng" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Thành tiền" })).toBeVisible();

    const bang = page.getByRole("table");
    await expect(bang.getByText("01/11/2097")).toBeVisible();
    await expect(bang.getByText("5,5 giờ")).toBeVisible();
    await expect(bang.getByText("220.000đ")).toBeVisible();

    // Phân trang trang 1 / 2 -> bấm sang trang 2
    await expect(page.getByTestId("phan-trang-nhan")).toHaveText("Trang 1 / 2");
    await page.getByRole("button", { name: "Trang 2", exact: true }).click();
    await expect(page.getByTestId("phan-trang-nhan")).toHaveText("Trang 2 / 2");
    await expect(bang.getByText("07/11/2097")).toBeVisible();
    await expect(bang.getByText("08/11/2097")).toBeVisible();

    // Thanh thao tác dưới có đủ 2 nút Đóng & Phản hồi sai sót lương
    await expect(page.locator("main").getByRole("link", { name: "Đóng" })).toHaveAttribute("href", "/nhan-vien");
    await expect(page.locator("main").getByRole("link", { name: "Phản hồi sai sót lương" })).toHaveAttribute(
      "href",
      "/nhan-vien/luong/phan-hoi"
    );
  });

  test("3. NV B không thấy bảng lương của NV A trên UI", async ({ page }) => {
    await ganPhien(page, nv2Token);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/nhan-vien/luong/xem");
    await page.locator('[data-hydrated="true"]').waitFor({ state: "visible" });

    await expect(page.getByTestId("thong-bao-chua-tong-hop")).toHaveText("Bảng lương chưa được tổng hợp");
    await expect(page.getByText("830.000đ")).toHaveCount(0);
  });

  test("4. Trạng thái Đã chốt: ẩn nút Phản hồi sai sót lương, chỉ giữ nút Đóng", async ({ page }) => {
    await prisma.kyLuong.update({
      where: { Makyluong: KY_TEST },
      data: { Trangthai: "Đã chốt", Ngaychot: new Date("2097-12-01") },
    });

    await ganPhien(page, nv1Token);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/nhan-vien/luong/xem");
    await page.locator('[data-hydrated="true"]').waitFor({ state: "visible" });

    await expect(page.getByTestId("trang-thai-bang-luong")).toHaveText("Đã chốt");
    await expect(page.locator("main").getByRole("link", { name: "Đóng" })).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: "Phản hồi sai sót lương" })).toHaveCount(0);
  });

  test("5. Responsive: không cuộn ngang ở 5 kích thước, bảng thành thẻ trên điện thoại, 1920x1080 không cuộn dọc thừa", async ({
    page,
  }) => {
    await ganPhien(page, nv1Token);

    for (const vp of [
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 },
      { width: 1920, height: 1080 },
    ]) {
      await page.setViewportSize(vp);
      await page.goto("/nhan-vien/luong/xem");
      await page.locator('[data-hydrated="true"]').waitFor({ state: "visible" });
      await expect(page.getByRole("heading", { name: "Lương tháng 11" })).toBeVisible();

      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(hasHorizontalScroll, `Bị cuộn ngang ở ${vp.width}x${vp.height}`).toBe(false);

      if (vp.width < 768) {
        // Bảng chuyển thành thẻ trên điện thoại (<768px): thẻ <table> ẩn, danh sách thẻ hiển thị
        const tableVisible = await page.locator("table").isVisible();
        expect(tableVisible).toBe(false);
      } else {
        const tableVisible = await page.locator("table").isVisible();
        expect(tableVisible).toBe(true);
      }

      if (vp.width === 1920 && vp.height === 1080) {
        const hasMainVerticalScroll = await page.evaluate(() => {
          const main = document.querySelector("main");
          return main ? main.scrollHeight > main.clientHeight : false;
        });
        expect(hasMainVerticalScroll, "Không được có thanh cuộn dọc thừa ở 1920x1080").toBe(false);
      }
    }
  });
});
