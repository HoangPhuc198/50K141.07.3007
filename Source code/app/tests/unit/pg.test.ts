/**
 * pg.test.ts – Kiểm tra tích hợp PostgreSQL (B.9)
 *
 * (a) Ghi ChamCong với nowVN() rồi đọc lại đúng giá trị
 * (b) Đăng nhập chủ quán với "ChuQuan" (hoa đầu) và "chuquan" đều thành công
 * (c) Ràng buộc CHECK của CSDL từ chối Sdt sai định dạng
 *
 * Yêu cầu: PostgreSQL đang chạy trên cổng 5433 với seed đã load.
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { prisma } from "@database/client";
import { nowVN } from "@backend/lib/time";
import { encrypt } from "@backend/lib/crypto";
import { authenticateUser, clearRateLimitMemory } from "@backend/services/auth";

// ─── (a) Ghi/đọc ChamCong với nowVN() ────────────────────────────────────────

describe("(a) ChamCong: ghi nowVN() rồi đọc lại đúng giá trị", () => {
  // Dùng Manv và Malich có sẵn trong seed
  const TEST_MANV = "NV000001";
  const TEST_MALICH = "LL000022"; // lịch hiện có, NV000001 đã có trong NhanVien_LichLam
  // Mã ChamCong tạm – phải unique, chưa tồn tại
  const TEST_MACHAMCONG = "CCTEST01";

  afterAll(async () => {
    // Dọn dẹp bản ghi test
    await prisma.chamCong.deleteMany({ where: { Machamcong: TEST_MACHAMCONG } });
    await prisma.$disconnect();
  });

  it("checkin timestamp lưu và đọc lại khớp trong vòng 2 giây", async () => {
    const before = nowVN();

    // Xóa nếu còn từ lần chạy trước
    await prisma.chamCong.deleteMany({ where: { Machamcong: TEST_MACHAMCONG } });

    await prisma.chamCong.create({
      data: {
        Machamcong: TEST_MACHAMCONG,
        Manv: TEST_MANV,
        Malich: TEST_MALICH,
        Thoigiancheckin: before,
      },
    });

    const record = await prisma.chamCong.findUnique({
      where: { Machamcong: TEST_MACHAMCONG },
    });

    expect(record).not.toBeNull();
    expect(record!.Thoigiancheckin).not.toBeNull();

    const diff = Math.abs(
      record!.Thoigiancheckin!.getTime() - before.getTime()
    );
    // Cho phép sai lệch tối đa 2000ms (làm tròn timestamp DB)
    expect(diff).toBeLessThanOrEqual(2000);
  });
});

// ─── (b) Đăng nhập chủ quán không phân biệt hoa/thường ───────────────────────

describe("(b) Đăng nhập Chủ quán: không phân biệt hoa/thường tên đăng nhập", () => {
  const defaultPassword = "123456";
  let encryptedPassword = "";

  beforeAll(() => {
    process.env.ENCRYPTION_KEY =
      process.env.ENCRYPTION_KEY ||
      "f3e30a1389c33496f423af12c42ea726264983b3d28cc449204d69f89fcfcb8e";
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ||
      "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";
    encryptedPassword = encrypt(defaultPassword);
  });

  beforeEach(() => {
    clearRateLimitMemory();
    vi.restoreAllMocks();
  });

  it("đăng nhập với 'ChuQuan' (chữ hoa đầu) thành công", async () => {
    vi.spyOn(prisma.chuQuan, "findFirst").mockResolvedValue({
      Machuquan: "CQ000001",
      Tendangnhap: "chuquan",
      Matkhau: encryptedPassword,
    } as any);

    const result = await authenticateUser("ChuQuan", defaultPassword, "127.0.0.1");
    expect(result.user.role).toBe("ChuQuan");
    expect(result.redirectUrl).toBe("/chu-quan");
  });

  it("đăng nhập với 'chuquan' (chữ thường) thành công", async () => {
    vi.spyOn(prisma.chuQuan, "findFirst").mockResolvedValue({
      Machuquan: "CQ000001",
      Tendangnhap: "chuquan",
      Matkhau: encryptedPassword,
    } as any);

    const result = await authenticateUser("chuquan", defaultPassword, "127.0.0.1");
    expect(result.user.role).toBe("ChuQuan");
    expect(result.redirectUrl).toBe("/chu-quan");
  });

  it("đăng nhập với 'CHUQUAN' (toàn chữ hoa) thành công", async () => {
    vi.spyOn(prisma.chuQuan, "findFirst").mockResolvedValue({
      Machuquan: "CQ000001",
      Tendangnhap: "chuquan",
      Matkhau: encryptedPassword,
    } as any);

    const result = await authenticateUser("CHUQUAN", defaultPassword, "127.0.0.1");
    expect(result.user.role).toBe("ChuQuan");
    expect(result.redirectUrl).toBe("/chu-quan");
  });
});

// ─── (c) CHECK constraint từ chối Sdt sai định dạng ─────────────────────────

describe("(c) CHECK constraint: Sdt sai định dạng bị từ chối", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("chèn NhanVien với Sdt không bắt đầu bằng 0 phải ném lỗi DB", async () => {
    // Sdt='1234567890' vi phạm CHECK CK_NhanVien_Sdt (phải bắt đầu bằng 0)
    await expect(
      prisma.$executeRaw`
        INSERT INTO "NhanVien"
          ("Manv","Tendangnhap","Matkhau","Hoten","Sdt","Diachi","Vitrilamviec","Hinhthuclam","Ngayvaolam","Kinhnghiem","Mucluongtheogio")
        VALUES
          ('NVTEST99','NVTEST99','xxx','Test NV','1234567890','HCM','Phục vụ','Part-time','2024-01-01','Chưa có',20000)
      `
    ).rejects.toThrow();
  });

  it("chèn NhanVien với Sdt đúng định dạng (bắt đầu 0, 10 chữ số) thành công rồi xóa", async () => {
    // Xóa nếu còn từ lần trước
    await prisma.nhanVien.deleteMany({ where: { Manv: "NVTEST98" } });

    await expect(
      prisma.$executeRaw`
        INSERT INTO "NhanVien"
          ("Manv","Tendangnhap","Matkhau","Hoten","Sdt","Diachi","Vitrilamviec","Hinhthuclam","Ngayvaolam","Kinhnghiem","Mucluongtheogio")
        VALUES
          ('NVTEST98','NVTEST98','xxx','Test NV OK','0912345678','HCM','Phục vụ','Part-time','2024-01-01','Chưa có',20000)
      `
    ).resolves.toBeDefined();

    // Dọn dẹp
    await prisma.nhanVien.deleteMany({ where: { Manv: "NVTEST98" } });
  });
});
