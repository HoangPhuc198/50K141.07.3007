import { test, expect } from "@playwright/test";
import { signSession, AUTH_COOKIE_NAME } from "../../backend/lib/auth";
import { prisma } from "../../database/client";
import {
  CHINH_SUA_LUONG_CO,
  CHINH_SUA_LUONG_KHONG,
  CHINH_SUA_LUONG_KHONG_DOI,
  CHINH_SUA_LUONG_KHONG_THAY_DOI,
  CHINH_SUA_LUONG_THANH_CONG,
  CHINH_SUA_LUONG_THIEU_LY_DO,
  CHINH_SUA_LUONG_THUONG_KHONG_HOP_LE,
  CHINH_SUA_LUONG_XAC_NHAN_NOI_DUNG,
  CHINH_SUA_LUONG_XAC_NHAN_TIEU_DE,
  PHAN_HOI_LUONG_GUI_THANH_CONG,
  PHAN_HOI_LUONG_HET_HAN,
  PHAN_HOI_LUONG_THIEU_NOI_DUNG,
} from "../../frontend/config/thong-bao";

const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
];

const E2E_KY_DK = "KL209811";
const E2E_KY_CHOT = "KL209812";
const E2E_BL_DK = "BLE2E831";
const E2E_BL_CHOT = "BLE2E832";
const E2E_CT_DK = "CTE2E831";
const E2E_CT_CHOT = "CTE2E832";
const E2E_LICH_DK = "LLE2E831";
const E2E_CC_DK = "CCE2E831";
const E2E_PH_1 = "PHE2E001";
const E2E_PH_2 = "PHE2E002";

async function cleanupE2E() {
  await prisma.phanHoiLuong.deleteMany({
    where: { OR: [{ Mabangluong: { in: [E2E_BL_DK, E2E_BL_CHOT] } }, { Maphanhoi: { in: [E2E_PH_1, E2E_PH_2] } }] },
  });
  await prisma.chiTietBangLuong.deleteMany({
    where: { MaCTBL: { in: [E2E_CT_DK, E2E_CT_CHOT] } },
  });
  await prisma.bangLuong.deleteMany({
    where: { Mabangluong: { in: [E2E_BL_DK, E2E_BL_CHOT] } },
  });
  await prisma.chamCong.deleteMany({ where: { Machamcong: E2E_CC_DK } });
  await prisma.nhanVien_LichLam.deleteMany({ where: { Malich: E2E_LICH_DK } });
  await prisma.lichLam.deleteMany({ where: { Malich: E2E_LICH_DK } });
  await prisma.heSoLuong.deleteMany({
    where: { Ngaybatdau: new Date("2098-11-15"), Ngayketthuc: new Date("2098-11-15") },
  });
  await prisma.kyLuong.deleteMany({ where: { Makyluong: { in: [E2E_KY_DK, E2E_KY_CHOT] } } });
}

test.describe("E2E UC_4.2 & UC_8.3 - Phản hồi & Chỉnh sửa bảng lương", () => {
  test.describe.configure({ mode: "serial" });

  let nvToken: string;
  let cqToken: string;

  test.beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";
    nvToken = await signSession({
      userId: "NV000001",
      username: "NV000001",
      role: "NhanVien",
      name: "Nguyễn Minh Anh",
    });
    cqToken = await signSession({
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Hoàng Lan",
    });

    await cleanupE2E();
    await prisma.kyLuong.create({
      data: { Makyluong: E2E_KY_DK, Thang: 11, Nam: 2098, Trangthai: "Dự kiến" },
    });
    await prisma.lichLam.create({
      data: { Malich: E2E_LICH_DK, Ngaylam: new Date("2098-11-15"), Maca: "CA000001" },
    });
    await prisma.nhanVien_LichLam.create({
      data: { Manv: "NV000001", Malich: E2E_LICH_DK },
    });
    await prisma.chamCong.create({
      data: {
        Machamcong: E2E_CC_DK,
        Manv: "NV000001",
        Malich: E2E_LICH_DK,
        Thoigiancheckin: new Date("2098-11-15T06:00:00.000Z"),
        Thoigiancheckout: new Date("2098-11-15T10:00:00.000Z"),
      },
    });
    await prisma.bangLuong.create({
      data: { Mabangluong: E2E_BL_DK, Manv: "NV000001", Makyluong: E2E_KY_DK, Tienthuong: 0, Lydothuong: null },
    });
    await prisma.chiTietBangLuong.create({
      data: { MaCTBL: E2E_CT_DK, Mabangluong: E2E_BL_DK, Ngaylam: new Date("2098-11-15"), Giolam: 4, Mucluong: 25000 },
    });
  });

  test.afterAll(async () => {
    await cleanupE2E();
  });

  test("UC_4.2 (NV): điều hướng từ menu, trống nội dung (#C0392B), gửi thành công, responsive 5 màn hình", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      {
        name: AUTH_COOKIE_NAME,
        value: nvToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/nhan-vien");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Kiểm tra bảng lương" }).click();
    await page.getByRole("link", { name: "Phản hồi sai sót lương" }).click();
    await page.waitForURL("**/nhan-vien/luong/phan-hoi");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Nội dung phản hồi")).toBeVisible();
    await expect(page.getByText("Thông tin kỳ lương")).toBeVisible();
    await expect(page.getByText("Tháng 11/2098").first()).toBeVisible();

    // Trống nội dung -> banner lỗi màu đỏ #C0392B
    await page.getByRole("button", { name: /^Gửi$/ }).click();
    const errBanner = page.getByTestId("notification-banner");
    await expect(errBanner).toHaveText(PHAN_HOI_LUONG_THIEU_NOI_DUNG);
    const errColor = await errBanner.evaluate((el) => getComputedStyle(el).color);
    expect(errColor).toBe("rgb(192, 57, 43)");

    // Gửi thành công
    await page.locator("#phan-hoi-noi-dung").fill("Thiếu 1,5 giờ ca sáng 15/11");
    await page.getByRole("button", { name: /^Gửi$/ }).click();
    const okBanner = page.getByTestId("notification-banner");
    await expect(okBanner).toHaveText(PHAN_HOI_LUONG_GUI_THANH_CONG);
    const okColor = await okBanner.evaluate((el) => getComputedStyle(el).color);
    expect(okColor).toBe("rgb(88, 117, 84)");

    // Kiểm tra không tràn ngang ở 5 kích thước
    for (const vp of VIEWPORTS) {
      await page.setViewportSize(vp);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(overflow, `Tràn ngang ở ${vp.width}px`).toBe(false);
    }
  });

  test("UC_4.2 (NV): kỳ Đã chốt hiển thị Đã hết thời gian phản hồi (#C0392B) và khóa nút Gửi", async ({
    page,
    context,
  }) => {
    await prisma.kyLuong.create({
      data: {
        Makyluong: E2E_KY_CHOT,
        Thang: 12,
        Nam: 2098,
        Trangthai: "Đã chốt",
        Ngaychot: new Date("2099-01-02"),
      },
    });
    await prisma.bangLuong.create({
      data: { Mabangluong: E2E_BL_CHOT, Manv: "NV000001", Makyluong: E2E_KY_CHOT, Tienthuong: 0, Lydothuong: null },
    });
    await prisma.chiTietBangLuong.create({
      data: { MaCTBL: E2E_CT_CHOT, Mabangluong: E2E_BL_CHOT, Ngaylam: new Date("2098-12-10"), Giolam: 8, Mucluong: 25000 },
    });

    await context.addCookies([
      {
        name: AUTH_COOKIE_NAME,
        value: nvToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/nhan-vien/luong/phan-hoi");
    await page.waitForLoadState("networkidle");

    const banner = page.getByTestId("notification-banner");
    await expect(banner).toHaveText(PHAN_HOI_LUONG_HET_HAN);
    const color = await banner.evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe("rgb(192, 57, 43)");
    await expect(page.getByRole("button", { name: /^Gửi$/ })).toBeDisabled();
  });

  test("UC_8.3 (CQ): điều hướng, lọc kỳ lương, kỳ Đã chốt chỉ xem, xác nhận popup, lưu chỉnh sửa & không chỉnh sửa", async ({
    page,
    context,
  }) => {
    // Tạo 2 phản hồi ở kỳ Dự kiến E2E_KY_DK (xóa phản hồi tạm từ test 4.2 nếu có để dữ liệu rõ ràng)
    await prisma.phanHoiLuong.deleteMany({ where: { Mabangluong: E2E_BL_DK } });
    await prisma.phanHoiLuong.createMany({
      data: [
        {
          Maphanhoi: E2E_PH_1,
          Noidung: "Thiếu 1,5 giờ ca sáng 15/11",
          Ngaygui: new Date("2098-11-30"),
          Ngayxuly: null,
          Trangthai: "Chưa xử lý",
          Mabangluong: E2E_BL_DK,
        },
        {
          Maphanhoi: E2E_PH_2,
          Noidung: "Kiểm tra lại công ngày 15/11",
          Ngaygui: new Date("2098-11-30"),
          Ngayxuly: null,
          Trangthai: "Chưa xử lý",
          Mabangluong: E2E_BL_DK,
        },
      ],
    });

    await context.addCookies([
      {
        name: AUTH_COOKIE_NAME,
        value: cqToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/chu-quan");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Quản lý lương" }).click();
    await page.getByRole("link", { name: "Chỉnh sửa sai sót bảng lương" }).click();
    await page.waitForURL("**/chu-quan/luong/chinh-sua");
    await page.waitForLoadState("networkidle");

    // Màn 1: lọc kỳ Đã chốt E2E_KY_CHOT -> vào Xem -> kiểm tra chỉ xem
    await page.locator("#filter-ky-luong").selectOption(E2E_KY_CHOT);
    await page.getByRole("button", { name: "Tìm kiếm" }).click();
    await expect(page.getByRole("table").getByText("Tháng 12/2098")).toBeVisible();
    await page.getByRole("button", { name: "Xem" }).first().click();
    await expect(page.getByText("Đã chốt · Chỉ xem")).toBeVisible();
    await expect(page.getByRole("button", { name: "Lưu" })).toBeDisabled();

    // Quay lại danh sách
    await page.getByRole("button", { name: "Hủy" }).click();

    // Lọc kỳ Dự kiến E2E_KY_DK -> Xem
    await page.locator("#filter-ky-luong").selectOption(E2E_KY_DK);
    await page.getByRole("button", { name: "Tìm kiếm" }).click();
    await expect(page.getByRole("table").getByText("Tháng 11/2098")).toBeVisible();
    await page.getByRole("button", { name: "Xem" }).first().click();

    await expect(page.getByTestId(`feedback-pair-${E2E_PH_1}`)).toBeVisible();

    // Lỗi 1: Chưa thay đổi gì -> Bạn chưa thay đổi thông tin nào
    await page.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByTestId("notification-banner")).toHaveText(CHINH_SUA_LUONG_KHONG_THAY_DOI);

    // Lỗi 2: Sửa giờ ra nhưng trống lý do -> Vui lòng nhập lý do chỉnh sửa
    await page.locator(`#giora-${E2E_PH_1}`).fill("15/11/2098 · 11:30");
    await page.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByTestId("notification-banner")).toHaveText(CHINH_SUA_LUONG_THIEU_LY_DO);

    // Lỗi 3: Thưởng âm -> Số tiền thưởng không hợp lệ
    await page.locator(`#thuong-${E2E_PH_1}`).fill("-5000");
    await page.locator(`#lydo-${E2E_PH_1}`).fill("Cập nhật ca sáng 15/11");
    await page.getByRole("button", { name: "Lưu" }).click();
    await expect(page.getByTestId("notification-banner")).toHaveText(CHINH_SUA_LUONG_THUONG_KHONG_HOP_LE);

    // Nhập hợp lệ -> Lưu -> Mở popup xác nhận -> Hủy "Không" -> Xác nhận "Có"
    await page.locator(`#thuong-${E2E_PH_1}`).fill("50000");
    await page.locator(`#heso-${E2E_PH_1}`).fill("1.5");
    await page.getByRole("button", { name: "Lưu" }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(CHINH_SUA_LUONG_XAC_NHAN_TIEU_DE)).toBeVisible();
    await expect(page.getByText(CHINH_SUA_LUONG_XAC_NHAN_NOI_DUNG)).toBeVisible();

    await page.getByRole("button", { name: CHINH_SUA_LUONG_KHONG, exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    await page.getByRole("button", { name: "Lưu" }).click();
    await page.getByRole("button", { name: CHINH_SUA_LUONG_CO, exact: true }).click();

    await expect(page.getByTestId("notification-banner")).toHaveText(CHINH_SUA_LUONG_THANH_CONG);
    await expect(
      page.getByTestId(`feedback-pair-${E2E_PH_1}`).getByText("Đã chỉnh sửa")
    ).toBeVisible();

    // Không chỉnh sửa cho thẻ thứ 2
    await page
      .getByTestId(`feedback-pair-${E2E_PH_2}`)
      .getByRole("button", { name: "Không chỉnh sửa" })
      .click();
    await expect(page.getByTestId("notification-banner")).toHaveText(CHINH_SUA_LUONG_KHONG_DOI);

    // Kiểm tra không tràn ngang ở 5 kích thước
    for (const vp of VIEWPORTS) {
      await page.setViewportSize(vp);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(overflow, `Tràn ngang chi tiết ở ${vp.width}px`).toBe(false);
    }
  });
});
