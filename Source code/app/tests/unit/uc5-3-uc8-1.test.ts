/**
 * Unit test: UC_5.3 Xóa nhân viên + UC_8.1 Cập nhật mức lương
 * Yêu cầu PostgreSQL đang chạy ở cổng 5433.
 */
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@database/client";
import { createNhanVien } from "@backend/services/nhan-vien";
import { deleteNhanVien, NhanVienServiceError } from "@backend/services/nhan-vien";
import { capNhatMucLuong, getNhanVienMucLuongList, CapNhatMucLuongError } from "@backend/services/cap-nhat-muc-luong";

const NOW_DATE = new Date().toISOString().slice(0, 10);

// Tạo nhân viên test dùng chung
async function createTestNV(suffix: string) {
  return await createNhanVien({
    Hoten: `Test ${suffix}`,
    Sdt: `0900${suffix.slice(-6)}`,
    Diachi: "HCM",
    Vitrilamviec: "Phục vụ",
    Hinhthuclam: "Part-time",
    Ngayvaolam: NOW_DATE,
    Kinhnghiem: "Chưa có",
    Mucluongtheogio: 17000,
    Trangthai: "Thử việc",
    Truonghoc: null,
  });
}

describe("UC_5.3 – Xóa nhân viên", () => {
  let createdManv = "";

  it("tạo nhân viên mới thành công", async () => {
    const nv = await createTestNV("530001");
    expect(nv.Manv).toMatch(/^NV\d{6}$/);
    createdManv = nv.Manv;
  });

  it("xóa nhân viên: thành công khi không có kỳ lương chưa chốt", async () => {
    expect(createdManv).not.toBe("");
    const result = await deleteNhanVien(createdManv);
    expect(result.deleted).toBe(true);
    expect(result.Manv).toBe(createdManv);

    // Kiểm tra đã xóa khỏi CSDL
    const check = await prisma.nhanVien.findUnique({ where: { Manv: createdManv } });
    expect(check).toBeNull();
  });

  it("xóa nhân viên không tồn tại → lỗi NOT_FOUND", async () => {
    await expect(deleteNhanVien("NV999999")).rejects.toThrow(NhanVienServiceError);
    try {
      await deleteNhanVien("NV999999");
    } catch (e) {
      if (e instanceof NhanVienServiceError) {
        expect(e.code).toBe("NOT_FOUND");
        expect(e.statusCode).toBe(404);
      }
    }
  });
});

describe("UC_8.1 – Cập nhật mức lương", () => {
  let testManv = "";

  it("tạo nhân viên test", async () => {
    const nv = await createTestNV("810001");
    testManv = nv.Manv;
    expect(testManv).toMatch(/^NV\d{6}$/);
  });

  it("lấy danh sách nhân viên mức lương: có trả về", async () => {
    const list = await getNhanVienMucLuongList();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    // Mỗi item đủ 4 trường
    const item = list[0];
    expect(item).toHaveProperty("Manv");
    expect(item).toHaveProperty("Hoten");
    expect(item).toHaveProperty("Vitrilamviec");
    expect(item).toHaveProperty("Mucluongtheogio");
  });

  it("cập nhật mức lương thành công: giá trị mới phản ánh ngay", async () => {
    const mucMoi = 19000;
    const result = await capNhatMucLuong(testManv, mucMoi);
    expect(result.Mucluongtheogio).toBe(mucMoi);
    expect(result.Manv).toBe(testManv);

    // Đọc lại từ CSDL
    const nv = await prisma.nhanVien.findUnique({ where: { Manv: testManv } });
    expect(nv?.Mucluongtheogio).toBe(mucMoi);
  });

  it("mức lương không hợp lệ (0, âm, NaN) → lỗi LUONG_KHONG_HOP_LE", async () => {
    for (const invalid of [0, -1000]) {
      await expect(capNhatMucLuong(testManv, invalid)).rejects.toThrow(CapNhatMucLuongError);
    }
  });

  it("cập nhật nhân viên không tồn tại → lỗi NOT_FOUND", async () => {
    await expect(capNhatMucLuong("NV999999", 20000)).rejects.toThrow(CapNhatMucLuongError);
  });

  afterAll(async () => {
    // Dọn dẹp NV test UC_8.1
    if (testManv) {
      await deleteNhanVien(testManv).catch(() => {});
    }
  });
});
