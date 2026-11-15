import { test, expect } from "@playwright/test";
import { signSession, AUTH_COOKIE_NAME } from "../../backend/lib/auth";
import { prisma } from "../../database/client";

test.describe("UC_6.3 - Tự điền Người thay ca, bảng xem trước 1 dòng và chống lệch vị trí", () => {
  const malichTest = "LL989771";
  const donHopLeId = "DD989701";
  const donKhongNguoiId = "DD989702";
  const donDaVaoCaId = "DD989703";
  const donLechViTriId = "DD989704";
  const nvPhuPhaCheId = "NV989701";
  const lichRanhTestId1 = "LR989701";
  const lichRanhTestId2 = "LR989702";
  const targetDate = new Date("2099-10-18T00:00:00.000Z");

  let chuQuanToken = "";
  let nv1Name = "";
  let nv2Name = "";
  const nvPhuName = "Đỗ Pha Chế Test";

  test.beforeAll(async () => {
    process.env.JWT_SECRET =
      "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";

    chuQuanToken = await signSession({
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Thanh Hà",
    });

    const [nv1, nv2] = await Promise.all([
      prisma.nhanVien.findUnique({ where: { Manv: "NV000001" } }),
      prisma.nhanVien.findUnique({ where: { Manv: "NV000002" } }),
    ]);
    nv1Name = nv1?.Hoten?.trim() || "NV000001";
    nv2Name = nv2?.Hoten?.trim() || "NV000002";

    await prisma.donXinDoiCa.deleteMany({
      where: {
        Madon: {
          in: [donHopLeId, donKhongNguoiId, donDaVaoCaId, donLechViTriId],
        },
      },
    });
    await prisma.nhanVien_LichLam.deleteMany({ where: { Malich: malichTest } });
    await prisma.lichLam.deleteMany({ where: { Malich: malichTest } });
    await prisma.lichRanh.deleteMany({
      where: { Malichranh: { in: [lichRanhTestId1, lichRanhTestId2] } },
    });
    await prisma.nhanVien.deleteMany({ where: { Manv: nvPhuPhaCheId } });

    // Tạo thêm 1 nhân viên Pha chế để test chuyển đổi dropdown giữa 2 người hợp lệ
    await prisma.nhanVien.create({
      data: {
        Manv: nvPhuPhaCheId,
        Tendangnhap: nvPhuPhaCheId,
        Matkhau: "test-hash",
        Hoten: nvPhuName,
        Sdt: "0999897001",
        Diachi: "Đà Nẵng",
        Truonghoc: null,
        Vitrilamviec: "Pha chế",
        Hinhthuclam: "Part-time",
        Ngayvaolam: new Date("2025-01-01T00:00:00.000Z"),
        Kinhnghiem: "1 năm",
        Trangthai: "Chính thức",
        Mucluongtheogio: 20000,
      },
    });

    await prisma.lichLam.create({
      data: {
        Malich: malichTest,
        Ngaylam: targetDate,
        Maca: "CA000001",
      },
    });

    await prisma.nhanVien_LichLam.createMany({
      data: [
        { Manv: "NV000001", Malich: malichTest },
        { Manv: "NV000003", Malich: malichTest },
      ],
    });

    // NV000002 và NV989701 (đều Pha chế) có lịch rảnh vào ca test
    await prisma.lichRanh.createMany({
      data: [
        {
          Malichranh: lichRanhTestId1,
          Manv: "NV000002",
          Ngayranh: targetDate,
          Caranh: "CA000001",
        },
        {
          Malichranh: lichRanhTestId2,
          Manv: nvPhuPhaCheId,
          Ngayranh: targetDate,
          Caranh: "CA000001",
        },
      ],
    });

    await prisma.donXinDoiCa.createMany({
      data: [
        {
          Madon: donHopLeId,
          Trangthaixuly: "Chưa xử lý",
          Manv: "NV000001",
          Malich: malichTest,
          Manvnhanthay: "NV000002", // Hợp lệ, cùng Pha chế, chưa có trong ca
        },
        {
          Madon: donKhongNguoiId,
          Trangthaixuly: "Chưa xử lý",
          Manv: "NV000001",
          Malich: malichTest,
          Manvnhanthay: null, // Không có người thay thế
        },
        {
          Madon: donDaVaoCaId,
          Trangthaixuly: "Chưa xử lý",
          Manv: "NV000004", // Phục vụ
          Malich: malichTest,
          Manvnhanthay: "NV000003", // Phục vụ nhưng đã có trong ca LL989771
        },
        {
          Madon: donLechViTriId,
          Trangthaixuly: "Chưa xử lý",
          Manv: "NV000001", // Pha chế
          Malich: malichTest,
          Manvnhanthay: "NV000004", // Lệch vị trí (Phục vụ) lưu sẵn trong DB
        },
      ],
    });
  });

  test.afterAll(async () => {
    await prisma.donXinDoiCa.deleteMany({
      where: {
        Madon: {
          in: [donHopLeId, donKhongNguoiId, donDaVaoCaId, donLechViTriId],
        },
      },
    });
    await prisma.nhanVien_LichLam.deleteMany({ where: { Malich: malichTest } });
    await prisma.lichLam.deleteMany({ where: { Malich: malichTest } });
    await prisma.lichRanh.deleteMany({
      where: { Malichranh: { in: [lichRanhTestId1, lichRanhTestId2] } },
    });
    await prisma.nhanVien.deleteMany({ where: { Manv: nvPhuPhaCheId } });
  });

  test("Đủ 4 trường hợp preview & khóa nút Lưu; mọi đơn mẫu cùng vị trí và tuyệt đối không có 'Đang làm'", async ({
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

    await page.setViewportSize({ width: 1280, height: 1080 });
    await page.goto("/chu-quan/lich-lam/doi-ca");
    await page.waitForLoadState("networkidle");

    const selectEl = page.locator("#select-nguoi-thay-cq");
    const btnLuu = page.locator("#btn-luu");
    const previewRow = page.locator("#preview-row-nguoi-thay");
    const previewBody = page.locator("#preview-body-nguoi-thay");
    const previewTitle = page.locator("#title-preview-ca");

    // 0. Kiểm tra toàn bộ đơn mẫu (DD00*) đều mở được và không bao giờ hiện người khác vị trí / "Đang làm"
    const sampleRows = page.locator('[data-testid^="row-don-DD00"]');
    const sampleCount = await sampleRows.count();
    expect(sampleCount).toBeGreaterThanOrEqual(2);

    const sampleDonsInDb = await prisma.donXinDoiCa.findMany({
      where: { Madon: { startsWith: "DD00" }, Trangthaixuly: "Chưa xử lý" },
      include: { NhanVien_DonXinDoiCa_ManvToNhanVien: true },
    });
    const senderPosMap = new Map(
      sampleDonsInDb.map((d) => [
        d.Madon.trim(),
        d.NhanVien_DonXinDoiCa_ManvToNhanVien.Vitrilamviec.trim(),
      ])
    );

    for (let i = 0; i < sampleCount; i++) {
      const row = sampleRows.nth(i);
      const testId = await row.getAttribute("data-testid");
      const madon = (testId || "").replace("row-don-", "").trim();
      await row.click();
      await expect(page.locator("#block-preview-lich")).not.toContainText("Đang làm");
      const selectedVal = await selectEl.inputValue();
      if (selectedVal) {
        await expect(previewBody.locator("> div")).toHaveCount(1);
        await expect(previewRow).toContainText(senderPosMap.get(madon)!);
      } else {
        await expect(previewRow).toHaveCount(0);
        await expect(btnLuu).toBeDisabled();
      }
    }

    // 1. Có người thay hợp lệ tự điền sẵn -> đúng 1 dòng 'Thay cho ...', không có 'Đang làm'
    await page.getByTestId(`row-don-${donHopLeId}`).click();
    await expect(selectEl).toHaveValue("NV000002");
    await expect(btnLuu).toBeEnabled();
    await expect(previewTitle).toContainText("18/10/2099");
    await expect(previewRow).toBeVisible();
    await expect(previewBody.locator("> div")).toHaveCount(1);
    await expect(previewRow).toContainText(nv2Name);
    await expect(previewRow).toContainText("Pha chế");
    await expect(previewRow).toContainText(`Thay cho ${nv1Name}`);
    await expect(page.locator("body")).not.toContainText("Đang làm");

    // 4. Đổi dropdown sang nhân viên Pha chế hợp lệ khác -> bảng xem trước cập nhật ngay đúng 1 dòng mới
    await selectEl.selectOption(nvPhuPhaCheId);
    await expect(previewBody.locator("> div")).toHaveCount(1);
    await expect(previewRow).toContainText(nvPhuName);
    await expect(previewRow).not.toContainText(nv2Name);
    await expect(previewRow).toContainText(`Thay cho ${nv1Name}`);

    // 2. Đơn "Không có người thay thế" -> '-- Chọn người thay --', nút Lưu khóa, bảng xem trước TRỐNG
    await page.getByTestId(`row-don-${donKhongNguoiId}`).click();
    await expect(selectEl).toHaveValue("");
    await expect(selectEl.locator('option[value=""]')).toHaveText("-- Chọn người thay --");
    await expect(btnLuu).toBeDisabled();
    await expect(previewRow).toHaveCount(0);
    await expect(previewBody).toBeEmpty();

    // Chọn một nhân viên hợp lệ từ dropdown -> nút Lưu mở khóa và xem trước cập nhật đúng 1 dòng
    await selectEl.selectOption("NV000002");
    await expect(btnLuu).toBeEnabled();
    await expect(previewBody.locator("> div")).toHaveCount(1);
    await expect(previewRow).toContainText(nv2Name);

    // 3a. Đơn có người cũ đã bị xếp vào chính ca đó -> KHÔNG tự điền, bảng TRỐNG, khóa Lưu
    await page.getByTestId(`row-don-${donDaVaoCaId}`).click();
    await expect(selectEl).toHaveValue("");
    await expect(btnLuu).toBeDisabled();
    await expect(previewRow).toHaveCount(0);
    await expect(previewBody).toBeEmpty();

    // 3b. Đơn trong DB lưu người khác vị trí -> KHÔNG tự điền, KHÔNG vẽ trong bảng xem trước, khóa Lưu
    await page.getByTestId(`row-don-${donLechViTriId}`).click();
    await expect(selectEl).toHaveValue("");
    await expect(btnLuu).toBeDisabled();
    await expect(previewRow).toHaveCount(0);
    await expect(previewBody).toBeEmpty();
    await expect(page.locator("#block-preview-lich")).not.toContainText("Phạm Ngọc Lan");
  });
});
