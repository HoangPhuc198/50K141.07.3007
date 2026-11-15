import { test, expect } from "@playwright/test";
import { signSession, AUTH_COOKIE_NAME } from "../../backend/lib/auth";
import { prisma } from "../../database/client";

test.describe("UC_6.2: Xếp ca làm (Chủ quán)", () => {
  let chuQuanToken: string;
  const unscheduledDate = "2026-11-15";
  const unscheduledDateVN = "15/11/2026";
  const scheduledDate = "2026-11-09";
  const scheduledDateVN = "09/11/2026";
  let savedAssignments: Array<{ Manv: string; Malich: string }> = [];

  test.beforeAll(async () => {
    process.env.JWT_SECRET = "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";
    chuQuanToken = await signSession({
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Thanh Hà",
    });

    // Lưu lại và xóa phân công ca của ngày 2026-11-15 để làm ngày chưa xếp mẫu
    const lichLams = await prisma.lichLam.findMany({
      where: { Ngaylam: new Date(`${unscheduledDate}T00:00:00Z`) },
      include: { NhanVien_LichLam: true },
    });

    savedAssignments = lichLams.flatMap((l) =>
      l.NhanVien_LichLam.map((nvl) => ({ Manv: nvl.Manv, Malich: nvl.Malich }))
    );

    const malichs = lichLams.map((l) => l.Malich);
    if (malichs.length > 0) {
      await prisma.nhanVien_LichLam.deleteMany({
        where: { Malich: { in: malichs } },
      });
    }
  });

  test.afterAll(async () => {
    // Khôi phục lại dữ liệu ban đầu cho ngày 2026-11-15
    const lichLams = await prisma.lichLam.findMany({
      where: { Ngaylam: new Date(`${unscheduledDate}T00:00:00Z`) },
    });
    const malichs = lichLams.map((l) => l.Malich);
    if (malichs.length > 0) {
      await prisma.nhanVien_LichLam.deleteMany({
        where: { Malich: { in: malichs } },
      });
    }

    if (savedAssignments.length > 0) {
      await prisma.nhanVien_LichLam.createMany({
        data: savedAssignments,
        skipDuplicates: true,
      });
    }
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

  test("1. Ngày chưa xếp ca: hiện đủ ô trống theo Sonvquydinh (Sáng 3, Chiều 2, Tối 2), đếm '0 / N người' và placeholder đúng", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/chu-quan/lich-lam/xep-ca");
    await page.waitForLoadState("networkidle");

    // Chọn ngày chưa xếp: 2026-11-15 (Chủ nhật)
    const selectNgay = page.locator("#select-ngay-xep-ca");
    await expect(selectNgay).toBeVisible();
    await selectNgay.fill(unscheduledDateVN);
    await page.waitForLoadState("networkidle");

    // Kiểm tra Ca sáng: 3 ô, đếm "0 / 3 người"
    const caCards = page.locator(".grid > div");
    await expect(caCards).toHaveCount(3);

    const sangCard = caCards.nth(0);
    await expect(sangCard.locator("h3")).toHaveText("Ca sáng");
    await expect(sangCard.locator("p.text-lg")).toHaveText("0 / 3 người");
    const sangSelects = sangCard.locator("select");
    await expect(sangSelects).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(sangSelects.nth(i)).toHaveValue("");
      // Kiểm tra option mặc định có placeholder đúng
      const firstOpt = sangSelects.nth(i).locator("option").first();
      await expect(firstOpt).toHaveText("Chọn nhân viên cho ca này");
    }

    // Kiểm tra Ca chiều: 2 ô, đếm "0 / 2 người"
    const chieuCard = caCards.nth(1);
    await expect(chieuCard.locator("h3")).toHaveText("Ca chiều");
    await expect(chieuCard.locator("p.text-lg")).toHaveText("0 / 2 người");
    const chieuSelects = chieuCard.locator("select");
    await expect(chieuSelects).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      await expect(chieuSelects.nth(i)).toHaveValue("");
      await expect(chieuSelects.nth(i).locator("option").first()).toHaveText("Chọn nhân viên cho ca này");
    }

    // Kiểm tra Ca tối: 2 ô, đếm "0 / 2 người"
    const toiCard = caCards.nth(2);
    await expect(toiCard.locator("h3")).toHaveText("Ca tối");
    await expect(toiCard.locator("p.text-lg")).toHaveText("0 / 2 người");
    const toiSelects = toiCard.locator("select");
    await expect(toiSelects).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      await expect(toiSelects.nth(i)).toHaveValue("");
      await expect(toiSelects.nth(i).locator("option").first()).toHaveText("Chọn nhân viên cho ca này");
    }
  });

  test("2. Trong mỗi ca: không thể chọn trùng người, danh sách thả xuống loại người đã chọn ở ô khác", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/chu-quan/lich-lam/xep-ca");
    await page.waitForLoadState("networkidle");

    // Chọn ngày chưa xếp: 2026-11-15
    const selectNgay = page.locator("#select-ngay-xep-ca");
    await selectNgay.fill(unscheduledDateVN);
    await page.waitForLoadState("networkidle");

    const caCards = page.locator(".grid > div");
    const sangCard = caCards.nth(0);
    const sangSelects = sangCard.locator("select");

    // Ban đầu ca sáng đếm "0 / 3 người"
    await expect(sangCard.locator("p.text-lg")).toHaveText("0 / 3 người");

    // Chọn nhân viên đầu tiên ở ô 1
    const slot0 = sangSelects.nth(0);
    const slot0Options = await slot0.locator("option").all();
    expect(slot0Options.length).toBeGreaterThan(1);
    const selectedManv = await slot0Options[1].getAttribute("value");
    expect(selectedManv).toBeTruthy();

    await slot0.selectOption(selectedManv!);

    // Kiểm tra đếm đã cập nhật thành "1 / 3 người"
    await expect(sangCard.locator("p.text-lg")).toHaveText("1 / 3 người");

    // Kiểm tra ô 2 và ô 3 không còn chứa nhân viên vừa chọn
    const slot1 = sangSelects.nth(1);
    const slot1OptionValues = await slot1.locator("option").evaluateAll((opts) =>
      opts.map((o) => (o as HTMLOptionElement).value)
    );
    expect(slot1OptionValues).not.toContain(selectedManv);

    const slot2 = sangSelects.nth(2);
    const slot2OptionValues = await slot2.locator("option").evaluateAll((opts) =>
      opts.map((o) => (o as HTMLOptionElement).value)
    );
    expect(slot2OptionValues).not.toContain(selectedManv);
  });

  test("3. Đổi qua lại hai ngày: không lẫn dữ liệu của ngày trước; ngày đã xếp hiện đúng người", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/chu-quan/lich-lam/xep-ca");
    await page.waitForLoadState("networkidle");

    const selectNgay = page.locator("#select-ngay-xep-ca");

    // 1. Ở ngày chưa xếp (2026-11-15): Chọn một nhân viên ở Ca sáng ô 1 nhưng KHÔNG ấn Lưu
    await selectNgay.fill(unscheduledDateVN);
    await page.waitForLoadState("networkidle");

    const caCards = page.locator(".grid > div");
    const sangCard = caCards.nth(0);
    const slot0 = sangCard.locator("select").nth(0);
    const optValues = await slot0.locator("option").evaluateAll((opts) =>
      opts.map((o) => (o as HTMLOptionElement).value).filter((v) => v !== "")
    );
    expect(optValues.length).toBeGreaterThan(0);
    const pickedManv = optValues[0];

    await slot0.selectOption(pickedManv);
    await expect(sangCard.locator("p.text-lg")).toHaveText("1 / 3 người");

    // 2. Chuyển sang ngày đã xếp (2026-11-09): Dữ liệu phải được tải theo ngày đã xếp
    await selectNgay.fill(scheduledDateVN);
    await page.waitForLoadState("networkidle");

    // Ngày 2026-11-09 đã xếp đủ 3 người ở Ca sáng
    await expect(caCards.nth(0).locator("p.text-lg")).toHaveText("3 / 3 người");

    // 3. Chuyển ngược lại ngày chưa xếp (2026-11-15): lựa chọn chưa lưu bị hủy, tải lại đúng ngày mới
    await selectNgay.fill(unscheduledDateVN);
    await page.waitForLoadState("networkidle");

    // Ca sáng quay về trạng thái chưa xếp: "0 / 3 người", tất cả các ô đều trống
    await expect(caCards.nth(0).locator("p.text-lg")).toHaveText("0 / 3 người");
    await expect(caCards.nth(0).locator("select").nth(0)).toHaveValue("");
    await expect(caCards.nth(0).locator("select").nth(1)).toHaveValue("");
    await expect(caCards.nth(0).locator("select").nth(2)).toHaveValue("");
  });

  test("4. Lưu phân công thành công: chuyển ngày rồi quay lại vẫn hiện đúng nhân viên đã xếp và ô thiếu", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/chu-quan/lich-lam/xep-ca");
    await page.waitForLoadState("networkidle");

    const selectNgay = page.locator("#select-ngay-xep-ca");
    await selectNgay.fill(unscheduledDateVN);
    await page.waitForLoadState("networkidle");

    const caCards = page.locator(".grid > div");
    const sangCard = caCards.nth(0);
    const slot0 = sangCard.locator("select").nth(0);

    const availableOpts = await slot0.locator("option").evaluateAll((opts) =>
      opts.map((o) => (o as HTMLOptionElement).value).filter((v) => v !== "")
    );
    expect(availableOpts.length).toBeGreaterThan(0);
    const chosenManv = availableOpts[0];

    // Chọn nhân viên vào ô 1 (thiếu 2 người so với quy định 3)
    await slot0.selectOption(chosenManv);

    // Bấm Lưu
    const btnSave = page.locator("#btn-save");
    await expect(btnSave).toBeEnabled();
    await btnSave.click();

    // Nút chuyển thành "Đã lưu"
    await expect(btnSave).toHaveText("Đã lưu");

    // Chuyển sang ngày khác (2026-11-09)
    await selectNgay.fill(scheduledDateVN);
    await page.waitForLoadState("networkidle");

    // Chuyển lại ngày 2026-11-15
    await selectNgay.fill(unscheduledDateVN);
    await page.waitForLoadState("networkidle");

    // Kiểm tra ô 1 vẫn có chosenManv, ô 2 và ô 3 vẫn hiện ô trống, đếm đúng "1 / 3 người"
    const reloadedSang = page.locator(".grid > div").nth(0);
    await expect(reloadedSang.locator("select").nth(0)).toHaveValue(chosenManv);
    await expect(reloadedSang.locator("select").nth(1)).toHaveValue("");
    await expect(reloadedSang.locator("select").nth(2)).toHaveValue("");
    await expect(reloadedSang.locator("p.text-lg")).toHaveText("1 / 3 người");
  });
});
