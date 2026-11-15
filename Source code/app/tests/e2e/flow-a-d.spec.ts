import { test, expect } from "@playwright/test";
import { signSession, AUTH_COOKIE_NAME } from "../../backend/lib/auth";
import { prisma } from "../../database/client";
import {
  THEM_NV_THANH_CONG,
  YEU_CAU_DOI_CA_THANH_CONG,
  XU_LY_DOI_CA_THANH_CONG,
} from "../../frontend/config/thong-bao";

test.describe("Luồng E2E (a) CQ thêm NV -> xếp ca và (d) NV đổi ca -> CQ duyệt", () => {
  test.describe.configure({ mode: "serial" });

  let chuQuanToken: string;
  let nhanVienToken: string;
  let createdManv = "";
  const testPhone = "0977665544";
  const testName = "Phạm Luồng A";

  let savedSwapMalich = "";
  let savedSwapManvNhanThay = "";
  let createdMadon = "";
  const testFlowDMalich = "LL989601";
  let backupAssignments: Array<{ Manv: string; Malich: string }> = [];
  let targetEmptyDate = "";

  test.beforeAll(async () => {
    process.env.JWT_SECRET =
      "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";

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

    // Dọn nhân viên test nếu còn sót
    await prisma.nhanVien.deleteMany({ where: { Sdt: testPhone } });
  });

  test.afterAll(async () => {
    // Khôi phục ca đã mượn trong luồng (a) nếu có
    if (targetEmptyDate) {
      const lichs = await prisma.lichLam.findMany({
        where: { Ngaylam: new Date(`${targetEmptyDate}T00:00:00.000Z`) },
      });
      const mls = lichs.map((l) => l.Malich);
      if (mls.length > 0) {
        await prisma.nhanVien_LichLam.deleteMany({
          where: { Malich: { in: mls } },
        });
        for (const b of backupAssignments) {
          await prisma.nhanVien_LichLam.create({ data: b }).catch(() => {});
        }
      }
    }

    if (createdManv) {
      await prisma.nhanVien_LichLam.deleteMany({ where: { Manv: createdManv } });
      await prisma.nhanVien.deleteMany({ where: { Manv: createdManv } });
    }

    // Dọn đơn đổi ca tạo trong luồng (d) và ca test riêng
    if (createdMadon) {
      await prisma.donXinDoiCa.deleteMany({ where: { Madon: createdMadon } });
    }
    await prisma.donXinDoiCa.deleteMany({ where: { Malich: testFlowDMalich } });
    await prisma.nhanVien_LichLam.deleteMany({ where: { Malich: testFlowDMalich } });
    await prisma.lichLam.deleteMany({ where: { Malich: testFlowDMalich } });
    if (savedSwapMalich && savedSwapMalich !== testFlowDMalich) {
      if (savedSwapManvNhanThay) {
        await prisma.nhanVien_LichLam.deleteMany({
          where: { Malich: savedSwapMalich, Manv: savedSwapManvNhanThay },
        });
      }
      const hasNv1 = await prisma.nhanVien_LichLam.findFirst({
        where: { Malich: savedSwapMalich, Manv: "NV000001" },
      });
      if (!hasNv1) {
        await prisma.nhanVien_LichLam.create({
          data: { Malich: savedSwapMalich, Manv: "NV000001" },
        });
      }
    }
  });

  test("Luồng (a): CQ thêm nhân viên mới rồi xếp ca làm cho nhân viên đó", async ({
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

    // 1. Mở trang Thêm nhân viên (/chu-quan/nhan-vien/them)
    await page.setViewportSize({ width: 1280, height: 1080 });
    await page.goto("/chu-quan/nhan-vien/them");
    await page.waitForLoadState("networkidle");

    await page.locator("#input-hoten").fill(testName);
    await page.locator("#input-sdt").fill(testPhone);
    await page.locator("#input-diachi").fill("Đà Nẵng");
    await page.locator("#input-kinhnghiem").fill("1 năm phục vụ");
    const selects = page.locator("select");
    await selects.nth(0).selectOption("Phục vụ");
    await selects.nth(1).selectOption("Part-time");

    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(page.getByText(THEM_NV_THANH_CONG)).toBeVisible({ timeout: 10000 });

    const nvRow = await prisma.nhanVien.findFirst({ where: { Sdt: testPhone } });
    expect(nvRow).toBeTruthy();
    createdManv = nvRow!.Manv;

    // 2. Chuyển sang trang Xếp ca làm (/chu-quan/lich-lam/xep-ca)
    await page.goto("/chu-quan/lich-lam/xep-ca");
    await page.waitForLoadState("networkidle");

    // Chọn ngày cuối tuần hiện tại (cộng thêm 6 ngày từ ngày đầu tuần đang hiển thị)
    const daySelect = page.locator("#select-ngay-xep-ca");
    const mondayDisplay = await daySelect.inputValue();
    const [dStr, mStr, yStr] = mondayDisplay.split("/");
    const sundayDt = new Date(Date.UTC(Number(yStr), Number(mStr) - 1, Number(dStr) + 6));
    targetEmptyDate = sundayDt.toISOString().slice(0, 10);
    const targetEmptyDateVN = `${String(sundayDt.getUTCDate()).padStart(2, "0")}/${String(
      sundayDt.getUTCMonth() + 1
    ).padStart(2, "0")}/${sundayDt.getUTCFullYear()}`;
    expect(targetEmptyDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const existingLich = await prisma.lichLam.findMany({
      where: { Ngaylam: new Date(`${targetEmptyDate}T00:00:00.000Z`) },
      include: { NhanVien_LichLam: true },
    });
    backupAssignments = existingLich.flatMap((l) =>
      l.NhanVien_LichLam.map((x) => ({ Manv: x.Manv, Malich: x.Malich }))
    );

    const xepCaLoaded = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/chu-quan/lich-lam/xep-ca?ngay=${targetEmptyDate}`) &&
        res.request().method() === "GET" &&
        res.status() === 200
    );
    await daySelect.fill(targetEmptyDateVN);
    await xepCaLoaded;
    await expect(page.locator("#btn-save")).toBeEnabled();

    // Chọn nhân viên mới tạo vào slot đầu tiên của Ca sáng
    const slotSelect = page.getByLabel("Ca sáng - Nhân viên 1");
    await slotSelect.selectOption(createdManv);
    await expect(slotSelect).toHaveValue(createdManv);
    await page.locator("#btn-save").click();

    await expect(page.locator("#btn-save")).toHaveText("Đã lưu", { timeout: 10000 });

    // Xác minh CSDL đã ghi NhanVien_LichLam cho nhân viên mới
    const assigned = await prisma.nhanVien_LichLam.findFirst({
      where: {
        Manv: createdManv,
        LichLam: { Ngaylam: new Date(`${targetEmptyDate}T00:00:00.000Z`) },
      },
    });
    expect(assigned).toBeTruthy();
  });

  test("Luồng (d): NV gửi đơn đổi ca -> CQ mở xử lý và duyệt đổi ca", async ({
    page,
    context,
  }) => {
    // Chuẩn bị 1 ca tương lai cho NV000001 (Pha chế) sao cho còn đồng nghiệp cùng vị trí NV000002 rảnh để chọn
    await prisma.donXinDoiCa.deleteMany({ where: { Malich: testFlowDMalich } });
    await prisma.nhanVien_LichLam.deleteMany({ where: { Malich: testFlowDMalich } });
    await prisma.lichLam.deleteMany({ where: { Malich: testFlowDMalich } });
    await prisma.lichLam.create({
      data: {
        Malich: testFlowDMalich,
        Ngaylam: new Date("2099-10-19T00:00:00.000Z"),
        Maca: "CA000001",
      },
    });
    await prisma.nhanVien_LichLam.create({
      data: {
        Manv: "NV000001",
        Malich: testFlowDMalich,
      },
    });

    // 1. Nhân viên NV000001 đăng nhập và gửi đơn đổi ca
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

    await page.setViewportSize({ width: 1280, height: 1080 });
    await page.goto("/nhan-vien/ca-lam/doi-ca");
    await page.waitForLoadState("networkidle");

    // Chọn đúng ca tương lai vừa tạo (chưa gửi đơn và có đồng nghiệp Pha chế khả dụng)
    const targetRadio = page
      .locator('[role="radio"]:not([aria-disabled="true"])')
      .filter({ hasText: "19/10/2099" });
    await expect(targetRadio).toHaveCount(1);
    await targetRadio.click();

    // Đợi select người thay tải xong có ít nhất 1 nhân viên cùng vị trí khả dụng
    const selectNguoiThay = page.locator("#select-nguoi-thay");
    await expect(selectNguoiThay).toBeEnabled();
    const firstOpt = selectNguoiThay.locator('option[value]:not([value=""])').first();
    await expect(firstOpt).toBeAttached({ timeout: 10000 });
    const firstOptVal = await firstOpt.getAttribute("value");
    expect(firstOptVal).toBeTruthy();
    await selectNguoiThay.selectOption(firstOptVal!);

    await page.locator("#btn-gui").click();
    await expect(page.locator("#notification-message")).toContainText(
      YEU_CAU_DOI_CA_THANH_CONG,
      { timeout: 10000 }
    );

    const donMoi = await prisma.donXinDoiCa.findFirst({
      where: { Manv: "NV000001", Malich: testFlowDMalich, Trangthaixuly: "Chưa xử lý" },
      orderBy: { Madon: "desc" },
    });
    expect(donMoi).toBeTruthy();
    createdMadon = donMoi!.Madon;
    savedSwapMalich = donMoi!.Malich;

    // 2. Chủ quán đăng nhập và duyệt đơn đổi ca
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

    await page.goto("/chu-quan/lich-lam/doi-ca");
    await page.waitForLoadState("networkidle");

    // Chọn đơn mới tạo ở cột trái (dùng data-testid row-don-<Madon>)
    const donChip = page.getByTestId(`row-don-${createdMadon.trim()}`);
    await donChip.click();

    await expect(page.locator("#select-nguoi-thay-cq")).toHaveValue(firstOptVal!, {
      timeout: 10000,
    });
    await expect(page.locator("#preview-body-nguoi-thay > div")).toHaveCount(1);
    await expect(page.locator("#preview-row-nguoi-thay")).toContainText("Thay cho");
    await expect(page.locator("#block-preview-lich")).not.toContainText("Đang làm");
    await expect(page.locator("#btn-luu")).toBeEnabled({ timeout: 10000 });
    await page.locator("#btn-luu").click();

    await expect(page.locator("#notification-message")).toContainText(
      XU_LY_DOI_CA_THANH_CONG,
      { timeout: 10000 }
    );

    // Kiểm tra CSDL: đơn đã chuyển sang Đã xử lý đúng người nhận thay
    const donAfter = await prisma.donXinDoiCa.findUnique({
      where: { Madon: createdMadon },
    });
    expect(donAfter?.Trangthaixuly.trim()).toBe("Đã xử lý");
    savedSwapManvNhanThay = donAfter?.Manvnhanthay?.trim() || "";
    expect(savedSwapManvNhanThay).toBe(firstOptVal!.trim());
  });
});
