import { test, expect } from "@playwright/test";
import { signSession, AUTH_COOKIE_NAME } from "../../../backend/lib/auth";
import { prisma } from "../../../database/client";
import { encrypt } from "../../../backend/lib/crypto";

test.describe("BƯỚC 2 - Ưu tiên 4: E2E luồng chính UC_1.1 (Đăng xuất), UC_5.3 (Xóa nhân viên), UC_8.1 (Cập nhật mức lương)", () => {
  let chuQuanToken = "";
  let nhanVienToken = "";
  let defaultPassword = "";

  test.beforeAll(async () => {
    try {
      process.loadEnvFile();
    } catch {
      // ignore
    }
    defaultPassword = process.env.DEFAULT_PASSWORD ?? "";

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

  test.afterAll(async () => {
    await prisma.nhanVien.deleteMany({
      where: { Manv: { in: ["NV009953"] } },
    });
    await prisma.nhanVien.updateMany({
      where: { Manv: "NV000003" },
      data: { Mucluongtheogio: 19000 },
    });
  });

  // =========================================================================
  // UC_1.1: ĐĂNG XUẤT
  // =========================================================================
  test("TC_1.1_01 & TC_1.1_02: Bấm biểu tượng đăng xuất về màn hình đăng nhập; bấm Quay lại hoặc gõ URL nội bộ đều bị chuyển về /dang-nhap, cookie phiên bị xóa", async ({
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

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/nhan-vien");
    await page.waitForLoadState("networkidle");

    // TC_1.1_01: Bấm biểu tượng đăng xuất ở thanh trên
    const logoutBtn = page.locator("#header-logout-btn");
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    await page.waitForURL("**/dang-nhap**", { timeout: 10000 });
    expect(page.url()).toContain("/dang-nhap");

    // TC_1.1_02: Kiểm tra cookie phiên đã bị xóa
    const cookiesAfter = await context.cookies();
    const sessionCookie = cookiesAfter.find((c) => c.name === AUTH_COOKIE_NAME && c.value !== "");
    expect(sessionCookie).toBeUndefined();

    // Bấm nút Quay lại hoặc gõ lại địa chỉ trang trong hệ thống -> bị chuyển về /dang-nhap
    await page.goto("/nhan-vien/ca-lam/lich-ranh");
    await page.waitForURL("**/dang-nhap**", { timeout: 10000 });
    expect(page.url()).toContain("/dang-nhap");
  });

  // =========================================================================
  // UC_5.3: XÓA THÔNG TIN NHÂN VIÊN (E2E LUỒNG CHÍNH)
  // =========================================================================
  test("TC_5.3_04, TC_5.3_01, TC_5.3_02: Chọn NV -> Bấm Xóa thông tin -> Hộp xác nhận bấm Hủy không xóa; bấm Xác nhận hiện 'Xóa thông tin nhân viên thành công', NV biến mất và không đăng nhập lại được", async ({
    page,
    context,
  }) => {
    // Tạo nhân viên tạm NV009953 không thuộc kỳ lương chưa chốt
    await prisma.nhanVien.deleteMany({ where: { Manv: "NV009953" } });
    await prisma.nhanVien.create({
      data: {
        Manv: "NV009953",
        Tendangnhap: "NV009953",
        Matkhau: encrypt(defaultPassword || "123456"),
        Hoten: "Trần Thị Kiểm Thử Xóa",
        Sdt: "0905995353",
        Diachi: "Đà Nẵng",
        Truonghoc: "ĐH Kinh Tế",
        Vitrilamviec: "Phục vụ",
        Hinhthuclam: "Part-time",
        Ngayvaolam: new Date("2026-11-01T00:00:00.000Z"),
        Kinhnghiem: "1 năm",
        Trangthai: "Chính thức",
        Mucluongtheogio: 17000,
      },
    });

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

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/chu-quan/nhan-vien/xoa");
    await page.waitForLoadState("networkidle");

    // Tìm NV009953
    const searchInput = page.locator("#search-xoa-nv");
    await searchInput.fill("NV009953");
    await page.waitForTimeout(400);

    const row = page.locator("tr", { hasText: "NV009953" }).first();
    await expect(row).toBeVisible();
    await row.click();

    // Bấm Xóa thông tin -> mở hộp thoại xác nhận
    const deleteBtn = page.locator("button:has-text('Xóa thông tin')");
    await deleteBtn.click();

    const dialog = page.locator("#dialog-xoa-nhan-vien");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Xác nhận xóa thông tin nhân viên này?");

    // TC_5.3_04: Bấm Hủy ở hộp thoại xác nhận -> Không xóa, NV vẫn còn trong danh sách
    await dialog.locator("button:has-text('Hủy')").click();
    await expect(dialog).toBeHidden();
    await expect(row).toBeVisible();

    // TC_5.3_01: Bấm Xóa thông tin -> Bấm Xác nhận -> Hiện 'Xóa thông tin nhân viên thành công', NV biến mất
    await deleteBtn.click();
    await expect(dialog).toBeVisible();
    await dialog.locator("button:has-text('Xác nhận')").click();

    await expect(page.locator("[data-testid='notification-banner']")).toContainText(
      "Xóa thông tin nhân viên thành công",
    );
    await expect(page.locator("tr", { hasText: "NV009953" })).toHaveCount(0);

    // TC_5.3_02: Đăng nhập bằng tài khoản NV vừa bị xóa -> Không đăng nhập được
    await context.clearCookies();
    await page.goto("/dang-nhap");
    await page.locator("#username-input").fill("NV009953");
    await page.locator("#password-input").fill(defaultPassword || "123456");
    await page.locator("#login-button").click();
    await expect(page.locator("#login-error-message")).toContainText(
      "Tên đăng nhập hoặc mật khẩu không đúng",
    );
  });

  // =========================================================================
  // UC_8.1: CẬP NHẬT MỨC LƯƠNG (E2E LUỒNG CHÍNH & NGOẠI LỆ)
  // =========================================================================
  test("TC_8.1_05, TC_8.1_02, TC_8.1_01: Để trống báo 'Vui lòng nhập mức lương'; hộp xác nhận chọn Không không lưu; chọn Có hiện 'Cập nhật mức lương thành công' và cập nhật danh sách", async ({
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

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/chu-quan/luong/muc-luong");
    await page.waitForLoadState("networkidle");

    // Chọn NV000003 (Lê Quốc Bảo)
    const rowNv3 = page.locator("tr", { hasText: "Lê Quốc Bảo" }).first();
    await expect(rowNv3).toBeVisible();
    await rowNv3.click();

    // TC_8.1_05: Để trống mức lương rồi bấm Lưu -> Hiện 'Vui lòng nhập mức lương'
    const luuBtn = page.locator("button:has-text('Lưu')");
    await luuBtn.click();
    await expect(page.locator("text=Vui lòng nhập mức lương")).toBeVisible();

    // Nhập 0 và abc -> Hiện 'Mức lương không hợp lệ'
    const salaryInput = page.locator("input[inputmode='numeric']");
    for (const bad of ["0", "-5000", "abc"]) {
      await salaryInput.fill(bad);
      await luuBtn.click();
      await expect(page.locator("text=Mức lương không hợp lệ")).toBeVisible();
    }

    // TC_8.1_02: Nhập mức lương hợp lệ 21000 -> bấm Lưu -> Hộp xác nhận chọn Không -> Không lưu
    await salaryInput.fill("21000");
    await luuBtn.click();
    await expect(page.locator("text=Xác nhận cập nhật mức lương")).toBeVisible();
    await page.locator("button:has-text('Không')").click();
    await expect(page.locator("text=Xác nhận cập nhật mức lương")).toBeHidden();

    // TC_8.1_01: Bấm Lưu -> Hộp xác nhận chọn Có -> Hiện 'Cập nhật mức lương thành công'
    await luuBtn.click();
    await expect(page.locator("text=Xác nhận cập nhật mức lương")).toBeVisible();
    await page.locator("button:has-text('Có')").click();

    await expect(page.locator("[data-testid='notification-banner']")).toContainText(
      "Cập nhật mức lương thành công",
    );
    await expect(page.locator("tr", { hasText: "Lê Quốc Bảo" }).first()).toContainText("21.000");

    // Khôi phục mức lương NV000003 về 19000
    await prisma.nhanVien.update({
      where: { Manv: "NV000003" },
      data: { Mucluongtheogio: 19000 },
    });
  });

  test("TC_8.1_04 (ma trận nhập số): Kiểm tra 9 giá trị mức lương trên UI production", async ({
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

    const beforeNv3 = await prisma.nhanVien.findUnique({ where: { Manv: "NV000003" } });
    const origLuong = beforeNv3?.Mucluongtheogio ?? 19000;

    try {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/chu-quan/luong/muc-luong");
      await page.waitForLoadState("networkidle");

      const salaryInput = page.locator("input[inputmode='numeric']");
      const luuBtn = page.locator("button:has-text('Lưu')");

      await page.locator("tr", { hasText: "Lê Quốc Bảo" }).first().click();

      for (const bad of ["17500.5", "17,5", "1.5", "abc", "0", "-5"]) {
        await salaryInput.fill(bad);
        await luuBtn.click();
        await expect(page.locator("text=Mức lương không hợp lệ")).toBeVisible();
        await expect(page.locator("text=Xác nhận cập nhật mức lương")).toBeHidden();
      }

      for (const [raw, expectedInt] of [
        ["17500", 17500],
        ["17.500", 17500],
        ["1.000.000", 1000000],
      ] as const) {
        await page.locator("tr", { hasText: "Lê Quốc Bảo" }).first().click();
        await salaryInput.fill(raw);
        await luuBtn.click();
        await expect(page.locator("text=Xác nhận cập nhật mức lương")).toBeVisible();
        await page.locator("button:has-text('Có')").click();
        await expect(page.locator("[data-testid='notification-banner']")).toContainText(
          "Cập nhật mức lương thành công",
        );
        const nvNow = await prisma.nhanVien.findUnique({ where: { Manv: "NV000003" } });
        expect(nvNow?.Mucluongtheogio).toBe(expectedInt);
      }
    } finally {
      await prisma.nhanVien.update({
        where: { Manv: "NV000003" },
        data: { Mucluongtheogio: origLuong },
      });
    }
  });

  test("BUG-06 (TC_8.1_03 & UC_5.3): Bấm Hủy ở Cập nhật mức lương và Xóa nhân viên -> không lưu và quay về /chu-quan", async ({
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

    const beforeNv3 = await prisma.nhanVien.findUnique({ where: { Manv: "NV000003" } });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/chu-quan/luong/muc-luong");
    await page.waitForLoadState("networkidle");
    await page.locator("tr", { hasText: "Lê Quốc Bảo" }).first().click();
    await page.locator("input[inputmode='numeric']").fill("25000");
    await page.locator("button:has-text('Hủy')").last().click();
    await page.waitForURL("**/chu-quan", { timeout: 10000 });
    expect(new URL(page.url()).pathname).toBe("/chu-quan");

    const afterNv3 = await prisma.nhanVien.findUnique({ where: { Manv: "NV000003" } });
    expect(afterNv3?.Mucluongtheogio).toBe(beforeNv3?.Mucluongtheogio);

    await page.goto("/chu-quan/nhan-vien/xoa");
    await page.waitForLoadState("networkidle");
    await page.locator("button:has-text('Hủy')").last().click();
    await page.waitForURL("**/chu-quan", { timeout: 10000 });
    expect(new URL(page.url()).pathname).toBe("/chu-quan");
  });
});
