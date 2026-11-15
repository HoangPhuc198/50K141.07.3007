import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";
import path from "node:path";
import { signSession, AUTH_COOKIE_NAME } from "../../backend/lib/auth";
import {
  BANG_LUONG_CHUA_TONG_HOP,
  CHECK_IN_KHONG_CO_CA,
} from "../../frontend/config/thong-bao";

const APP_DIR = path.resolve(__dirname, "../..");

const SAMPLE_NAMES = [
  "Nguyễn Minh Anh",
  "Trần Thu Hà",
  "Lê Quốc Bảo",
  "Phạm Ngọc Lan",
  "Võ Thanh Tùng",
  "Đặng Bảo Châu",
  "Hoàng Gia Huy",
];

const SAMPLE_NUMBERS_AND_TEXTS = [
  "104,5",
  "2.090.000",
  "20.000",
  "792.000",
  "Lương tháng 10",
  "Lương tháng 11",
  "22/10",
  "29/10",
  "Bảng lương đã sẵn sàng",
  "Lịch làm tuần này đã được cập nhật",
  "Hôm nay · 08:00",
  "Hôm qua · 16:30",
  "Thử việc",
];

test.describe("E2E CSDL clean: Hai màn hình chính không có dữ liệu gõ cứng/mẫu", () => {
  test.describe.configure({ mode: "serial" });

  let chuQuanToken: string;
  let nhanVienToken: string;

  test.beforeAll(async () => {
    process.env.JWT_SECRET =
      "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";

    execSync("node --env-file=.env database/sql/run-sql.mjs clean", {
      cwd: APP_DIR,
      stdio: "inherit",
    });
    execSync("node --env-file=.env database/sql/set-passwords.mjs", {
      cwd: APP_DIR,
      stdio: "inherit",
    });

    chuQuanToken = await signSession({
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Thanh Hà",
    });

    // Kể cả khi cookie chứa thông tin NV mẫu cũ, CSDL clean không có NV nên phải trả rỗng
    nhanVienToken = await signSession({
      userId: "NV000001",
      username: "NV000001",
      role: "NhanVien",
      name: "Nguyễn Minh Anh",
    });
  });

  test.afterAll(async () => {
    execSync("node --env-file=.env database/sql/run-sql.mjs reset", {
      cwd: APP_DIR,
      stdio: "inherit",
    });
    execSync("node --env-file=.env database/sql/set-passwords.mjs", {
      cwd: APP_DIR,
      stdio: "inherit",
    });
  });

  test("1. Màn hình chính Chủ quán (/chu-quan) trên CSDL clean hiện 0 và danh sách trống", async ({
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
    await page.goto("/chu-quan");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("0/3")).toBeVisible();

    const bodyText = await page.locator("body").innerText();

    for (const sampleName of SAMPLE_NAMES) {
      expect(bodyText).not.toContain(sampleName);
    }
    expect(bodyText).not.toMatch(/\bNV\d+\b/i);
    for (const sampleText of SAMPLE_NUMBERS_AND_TEXTS) {
      expect(bodyText).not.toContain(sampleText);
    }
    expect(bodyText).not.toContain("3 yêu cầu");
    expect(bodyText).not.toContain("2 yêu cầu");

    await expect(page.getByText("0 yêu cầu")).toBeVisible();
    await expect(page.getByText("Tất cả · 0")).toBeVisible();
    await expect(page.getByText("Đổi ca · 0")).toBeVisible();
    await expect(page.getByText("Chấm công · 0")).toBeVisible();
    await expect(page.getByText("Lương · 0")).toBeVisible();
    await expect(page.getByLabel("Thông báo")).toContainText("0");

    // Kiểm tra bố cục desktop & mobile không vỡ, không cuộn ngang
    const desktopOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    );
    expect(desktopOverflow).toBe(false);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    );
    expect(mobileOverflow).toBe(false);
  });

  test("2. Màn hình chính Nhân viên (/nhan-vien) trên CSDL clean không có tên người, mã NV, số mẫu", async ({
    page,
    context,
  }) => {
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
    await expect(page.getByText("0đ/giờ")).toBeVisible();

    const bodyText = await page.locator("body").innerText();

    for (const sampleName of [...SAMPLE_NAMES, "Thanh Hà"]) {
      expect(bodyText).not.toContain(sampleName);
    }
    expect(bodyText).not.toMatch(/\bNV\d+\b/i);
    for (const sampleText of SAMPLE_NUMBERS_AND_TEXTS) {
      expect(bodyText).not.toContain(sampleText);
    }

    const headerText = await page.locator("header").innerText();
    expect(headerText).not.toContain("TH");
    expect(headerText).not.toContain("Nhân viên");

    await expect(page.getByText("Không có ca làm", { exact: true })).toBeVisible();
    await expect(page.getByText(CHECK_IN_KHONG_CO_CA)).toBeVisible();
    await expect(page.getByText("0 giờ", { exact: true })).toBeVisible();
    await expect(page.getByText("0 giờ làm")).toBeVisible();
    await expect(page.getByText("0đ/giờ")).toBeVisible();
    await expect(page.getByText(BANG_LUONG_CHUA_TONG_HOP)).toBeVisible();
    await expect(page.getByText("Dự kiến")).toHaveCount(0);
    await expect(page.getByText("–", { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel("Thông báo")).toContainText("0");

    const desktopOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    );
    expect(desktopOverflow).toBe(false);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileOverflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
    );
    expect(mobileOverflow).toBe(false);
  });

  test("3. Toàn bộ màn hình Chủ quán trên CSDL clean không dữ liệu mẫu, không lỗi, không cuộn ngang", async ({
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

    const cqRoutes = [
      "/chu-quan",
      "/chu-quan/nhan-vien",
      "/chu-quan/nhan-vien/them",
      "/chu-quan/nhan-vien/sua",
      "/chu-quan/nhan-vien/xoa",
      "/chu-quan/nhan-vien/xem",
      "/chu-quan/lich-lam",
      "/chu-quan/lich-lam/xep-lich",
      "/chu-quan/lich-lam/xep-ca",
      "/chu-quan/lich-lam/doi-ca",
      "/chu-quan/cham-cong",
      "/chu-quan/cham-cong/bo-sung",
      "/chu-quan/cham-cong/bao-cao",
      "/chu-quan/luong",
      "/chu-quan/luong/muc-luong",
      "/chu-quan/luong/tinh-luong",
      "/chu-quan/luong/chinh-sua",
      "/chu-quan/luong/he-so",
      "/chu-quan/luong/tien-thuong",
      "/chu-quan/luong/chot-luong",
    ];

    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    for (const route of cqRoutes) {
      await page.setViewportSize({ width: 1280, height: 1080 });
      const res = await page.goto(route);
      expect(res?.status(), `${route} status`).toBeLessThan(500);
      await page.waitForLoadState("networkidle");

      const bodyText = await page.locator("body").innerText();
      for (const sampleName of SAMPLE_NAMES) {
        expect(bodyText, `${route} chứa tên mẫu ${sampleName}`).not.toContain(sampleName);
      }
      expect(bodyText, `${route} chứa mã NV mẫu`).not.toMatch(/\bNV\d+\b/i);

      const desktopOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(desktopOverflow, `${route} cuộn ngang desktop`).toBe(false);

      await page.setViewportSize({ width: 390, height: 844 });
      const mobileOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(mobileOverflow, `${route} cuộn ngang mobile`).toBe(false);
    }

    expect(pageErrors).toEqual([]);
  });

  test("4. Toàn bộ màn hình Nhân viên (NV mới trên CSDL clean) không dữ liệu mẫu, không lỗi, không cuộn ngang", async ({
    page,
    context,
    request,
  }) => {
    const createRes = await request.post("http://localhost:3000/api/chu-quan/nhan-vien", {
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
      },
      data: {
        Hoten: "Kiểm Thử Rỗng",
        Sdt: "0998877665",
        Diachi: "Đà Nẵng",
        Truonghoc: null,
        Vitrilamviec: "Phục vụ",
        Hinhthuclam: "Part-time",
        Ngayvaolam: "2026-11-14",
        Kinhnghiem: "Mới",
        Mucluongtheogio: 17000,
      },
    });
    expect(createRes.status()).toBe(201);
    const createdJson = await createRes.json();
    const cleanManv: string = createdJson.data.Manv;

    const cleanNvToken = await signSession({
      userId: cleanManv,
      username: cleanManv,
      role: "NhanVien",
      name: "Kiểm Thử Rỗng",
    });

    await context.addCookies([
      {
        name: AUTH_COOKIE_NAME,
        value: cleanNvToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    const nvRoutes = [
      "/nhan-vien",
      "/nhan-vien/ca-lam",
      "/nhan-vien/ca-lam/lich-ranh",
      "/nhan-vien/ca-lam/doi-ca",
      "/nhan-vien/ca-lam/thay-ca",
      "/nhan-vien/cham-cong",
      "/nhan-vien/cham-cong/check-in",
      "/nhan-vien/cham-cong/check-out",
      "/nhan-vien/cham-cong/bo-sung",
      "/nhan-vien/luong",
      "/nhan-vien/luong/xem",
      "/nhan-vien/luong/phan-hoi",
    ];

    const pageErrors: string[] = [];
    let currentRoute = "";
    page.on("pageerror", (e) => pageErrors.push(`[${currentRoute}] ${e.message}`));

    for (const route of nvRoutes) {
      currentRoute = route;
      await page.setViewportSize({ width: 1280, height: 1080 });
      const res = await page.goto(route);
      expect(res?.status(), `${route} status`).toBeLessThan(500);
      await page.waitForLoadState("networkidle");

      const bodyText = await page.locator("body").innerText();
      for (const sampleName of SAMPLE_NAMES) {
        expect(bodyText, `${route} chứa tên mẫu ${sampleName}`).not.toContain(sampleName);
      }
      if (route === "/nhan-vien") {
        for (const sampleText of SAMPLE_NUMBERS_AND_TEXTS) {
          expect(bodyText, `${route} chứa chuỗi mẫu ${sampleText}`).not.toContain(sampleText);
        }
        await expect(page.getByText(BANG_LUONG_CHUA_TONG_HOP)).toBeVisible();
        await expect(page.getByText("Dự kiến")).toHaveCount(0);
        await expect(page.getByLabel("Thông báo")).toContainText("0");
      }

      const desktopOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(desktopOverflow, `${route} cuộn ngang desktop`).toBe(false);

      await page.setViewportSize({ width: 390, height: 844 });
      const mobileOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(mobileOverflow, `${route} cuộn ngang mobile`).toBe(false);
    }

    expect(pageErrors).toEqual([]);
  });
});
