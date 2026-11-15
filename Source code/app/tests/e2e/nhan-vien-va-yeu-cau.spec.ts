import { test, expect } from "@playwright/test";
import { signSession, AUTH_COOKIE_NAME } from "../../backend/lib/auth";
import { prisma } from "../../database/client";

test.describe("E2E: Khứ hồi giao diện UC 5.1 -> 5.4 -> 5.2 và đếm yêu cầu màn hình chính", () => {
  let chuQuanToken: string;
  const testPhone = "0934567890";
  let createdManv = "";

  test.beforeAll(async () => {
    process.env.JWT_SECRET = "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";
    chuQuanToken = await signSession({
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Thanh Hà",
    });

    // Xóa số điện thoại nếu còn từ lần trước
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

  test("1. Tạo nhân viên 5.1 -> Mở Xem 5.4 kiểm tra đủ trường -> Mở Sửa 5.2 kiểm tra giá trị đúng từng ô", async ({
    page,
    context,
  }) => {
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

    // BƯỚC 1: Vào trang UC 5.1 Thêm nhân viên
    await page.goto("/chu-quan/nhan-vien/them");
    await page.waitForLoadState("networkidle");

    // Kiểm tra tự hiển thị mức lương theo vị trí (chỉ 1 lựa chọn tương ứng, chọn sẵn; chưa chọn vị trí -> ô trống)
    const vitriSelect = page.locator("#select-vitri");
    const mucluongSelect = page.locator("#select-mucluong");
    const mucluongOptions = mucluongSelect.locator("option");

    await expect(mucluongSelect).toHaveValue("");
    await expect(mucluongOptions).toHaveCount(1);
    await expect(mucluongOptions.first()).toHaveText("");

    await vitriSelect.selectOption("Phục vụ");
    await expect(mucluongSelect).toHaveValue("17000");
    await expect(mucluongOptions).toHaveCount(1);
    await expect(mucluongOptions.first()).toHaveText("17000");

    await vitriSelect.selectOption("Pha chế");
    await expect(mucluongSelect).toHaveValue("20000");
    await expect(mucluongOptions).toHaveCount(1);
    await expect(mucluongOptions.first()).toHaveText("20000");

    await vitriSelect.selectOption("");
    await expect(mucluongSelect).toHaveValue("");
    await expect(mucluongOptions).toHaveCount(1);
    await expect(mucluongOptions.first()).toHaveText("");

    // Điền đủ các trường khác, bỏ trống Vị trí rồi bấm Lưu -> chỉ tô đỏ ô Vị trí (#C0392B)
    await page.locator("#input-hoten").fill("Lê Văn E2E");
    await page.locator("#input-diachi").fill("99 Núi Thành, TP Đà Nẵng");
    await page.locator("#input-sdt").fill(testPhone);
    await page.locator("#input-truonghoc").fill("Đại học Sư Phạm Kỹ Thuật");
    await page.locator("#select-hinhthuc").selectOption("Full-time");
    await page.locator("#input-kinhnghiem").fill("Có 2 năm kinh nghiệm");

    await page.locator("button:has-text('Lưu')").click();
    await expect(page.locator("[data-testid='notification-banner']")).toHaveText("Vui lòng nhập đầy đủ thông tin");
    const vitriBorder = await vitriSelect.evaluate((el) => window.getComputedStyle(el).borderColor);
    const mucluongBorder = await mucluongSelect.evaluate((el) => window.getComputedStyle(el).borderColor);
    expect(vitriBorder).toBe("rgb(192, 57, 43)");
    expect(mucluongBorder).not.toBe("rgb(192, 57, 43)");

    // Chọn Vị trí Pha chế -> mức lương tự hiện 20000 rồi bấm Lưu
    await vitriSelect.selectOption("Pha chế"); // Vị trí
    await expect(mucluongSelect).toHaveValue("20000");
    await expect(mucluongOptions).toHaveCount(1);

    // Nhấn Lưu
    await page.locator("button:has-text('Lưu')").click();

    // Chờ banner thành công
    await expect(page.locator("text=Thêm thông tin nhân viên thành công")).toBeVisible({ timeout: 5000 });

    // Tìm Manv vừa tạo từ CSDL
    const dbNv = await prisma.nhanVien.findFirst({
      where: { Sdt: testPhone },
    });
    expect(dbNv).toBeDefined();
    createdManv = dbNv!.Manv;
    expect(createdManv).toMatch(/^NV\d{6}$/);

    // BƯỚC 2: Mở UC 5.4 Xem thông tin nhân viên
    await page.goto("/chu-quan/nhan-vien/xem");
    await page.waitForLoadState("networkidle");

    // Tìm kiếm nhân viên vừa tạo
    const searchInput = page.locator("#search-xem-nv");
    await searchInput.fill("Lê Văn E2E");
    await page.waitForTimeout(500); // Debounce search

    // Click vào dòng nhân viên trong bảng
    const row = page.locator("tr", { hasText: "Lê Văn E2E" });
    await expect(row).toBeVisible();
    // Kiểm tra Mã hiển thị đầy đủ trong bảng danh sách
    await expect(row.locator("td").first()).toHaveText(createdManv);
    await row.click();

    // Chờ tải chi tiết
    await expect(page.locator("h2", { hasText: "Lê Văn E2E" })).toBeVisible();

    // Kiểm tra TIÊU ĐỀ: Chỉ có tên (đậm), mã trong chip nhỏ có viền, KHÔNG có dấu "·"
    const titleArea = page.locator("h2", { hasText: "Lê Văn E2E" }).locator("..");
    await expect(titleArea).not.toContainText("·");
    await expect(titleArea.locator("span", { hasText: createdManv })).toBeVisible();

    // Kiểm tra từng trường hiển thị ở Màn Xem
    const getFieldValue = async (label: string) => {
      const container = page.locator("div", { has: page.locator("label", { hasText: label }) }).last();
      return await container.locator("input").inputValue();
    };

    expect(await getFieldValue("Họ và tên")).toBe("Lê Văn E2E");
    expect(await getFieldValue("Số điện thoại")).toBe(testPhone); // KHÔNG được rỗng
    expect(await getFieldValue("Địa chỉ")).toBe("99 Núi Thành, TP Đà Nẵng");
    expect(await getFieldValue("Trường học")).toBe("Đại học Sư Phạm Kỹ Thuật");
    expect(await getFieldValue("Vị trí")).toBe("Pha chế"); // KHÔNG được rỗng
    expect(await getFieldValue("Hình thức làm việc")).toBe("Full-time"); // KHÔNG được rỗng
    expect(await getFieldValue("Kinh nghiệm")).toBe("Có 2 năm kinh nghiệm");
    expect(await getFieldValue("Trạng thái")).toBe("Thử việc");
    expect(await getFieldValue("Tên đăng nhập")).toBe(createdManv);

    // BƯỚC 3: Mở UC 5.2 Sửa thông tin nhân viên
    await page.goto("/chu-quan/nhan-vien/sua");
    await page.waitForLoadState("networkidle");

    // Tìm kiếm ở panel trái
    const searchSua = page.locator("#search-sua-nv");
    await searchSua.fill(createdManv);
    await page.waitForTimeout(500);

    // Click vào nhân viên
    const rowSua = page.locator("tr", { hasText: "Lê Văn E2E" });
    await expect(rowSua).toBeVisible();
    await expect(rowSua.locator("td").first()).toHaveText(createdManv);
    await rowSua.click();

    // Chờ form sửa hiện
    await expect(page.locator("h2", { hasText: "Lê Văn E2E" })).toBeVisible();

    // Kiểm tra TIÊU ĐỀ: Chỉ có tên (đậm), mã trong chip nhỏ có viền, KHÔNG có dấu "·"
    const titleAreaSua = page.locator("h2", { hasText: "Lê Văn E2E" }).locator("..");
    await expect(titleAreaSua).not.toContainText("·");
    await expect(titleAreaSua.locator("span", { hasText: createdManv })).toBeVisible();

    // Kiểm tra giá trị từng ô form
    const getInputValue = async (label: string) => {
      const container = page.locator("div", { has: page.locator("label", { hasText: label }) }).last();
      return await container.locator("input").inputValue();
    };
    const getSelectValue = async (label: string) => {
      const container = page.locator("div", { has: page.locator("label", { hasText: label }) }).last();
      return await container.locator("select").inputValue();
    };

    expect(await getInputValue("Họ và tên")).toBe("Lê Văn E2E");
    expect(await getInputValue("Số điện thoại")).toBe(testPhone); // KHÔNG được rỗng
    expect(await getInputValue("Địa chỉ")).toBe("99 Núi Thành, TP Đà Nẵng");
    expect(await getInputValue("Trường học")).toBe("Đại học Sư Phạm Kỹ Thuật");
    expect(await getSelectValue("Vị trí")).toBe("Pha chế"); // ĐÚNG giá trị, KHÔNG tự hiện "Phục vụ"
    expect(await getSelectValue("Hình thức làm việc")).toBe("Full-time"); // ĐÚNG giá trị, KHÔNG tự hiện "Part-time"
    expect(await getInputValue("Kinh nghiệm")).toBe("Có 2 năm kinh nghiệm");
    expect(await getSelectValue("Trạng thái")).toBe("Thử việc");
  });

  test("2. Kiểm tra đếm yêu cầu trên Màn hình chính Chủ quán (/chu-quan)", async ({ page, context }) => {
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

    // CSDL mẫu có: 2 đơn đổi ca (DD000001, DD000002), 1 bổ sung chấm công, 0 phản hồi lương -> Tổng = 3
    // 1. Thẻ thống kê thứ 3:
    const cardYeuCau = page
      .locator("div", { has: page.locator("span", { hasText: "Yêu cầu cần xử lý" }) })
      .filter({ has: page.locator(".text-3xl") })
      .last();
    await expect(cardYeuCau.locator(".text-3xl")).toHaveText("3");

    // 2. Tiêu đề khối Yêu cầu cần xử lý:
    await expect(page.locator("text=3 yêu cầu")).toBeVisible();

    // 3. Các nhãn lọc:
    await expect(page.locator("button:has-text('Tất cả · 3')")).toBeVisible();
    await expect(page.locator("button:has-text('Đổi ca · 2')")).toBeVisible();
    await expect(page.locator("button:has-text('Chấm công · 1')")).toBeVisible();
    await expect(page.locator("button:has-text('Lương · 0')")).toBeVisible(); // Lương là 0 vì chưa có phản hồi lương
  });
});
