import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../../database/client";
import { layDanhSachDonDoiCaChuaXuLy } from "../../backend/services/doi-ca";

const APP_ROOT = path.resolve(__dirname, "../..");
const SEED_SQL_PATH = path.join(APP_ROOT, "database/sql/seed.sql");

describe("Kiểm tra dữ liệu mẫu đổi ca (UC_6.3 - không lệch vị trí sau db:reset)", () => {
  it("seed.sql: định nghĩa DonXinDoiCa mẫu bắt buộc cùng Vitrilamviec, chưa vào ca và có đơn Manvnhanthay NULL", () => {
    const sql = fs.readFileSync(SEED_SQL_PATH, "utf8");

    expect(sql).toContain("'DD000001'");
    expect(sql).toContain("'DD000002'");
    expect(sql).toMatch(/n\."Vitrilamviec"\s*=\s*sender\."Vitrilamviec"/);
    expect(sql).toMatch(/NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+"NhanVien_LichLam"/i);
    expect(sql).toMatch(/SELECT\s+'DD000002'[\s\S]*?NULL/i);
  });

  it("DB hiện tại (sau db:reset): mọi đơn đổi ca mẫu DD00* cùng Vitrilamviec, hợp lệ và có ít nhất 1 đơn không có người thay", async () => {
    const sampleDons = await prisma.donXinDoiCa.findMany({
      where: { Madon: { startsWith: "DD00" } },
      include: {
        NhanVien_DonXinDoiCa_ManvToNhanVien: true,
        NhanVien_DonXinDoiCa_ManvnhanthayToNhanVien: true,
      },
      orderBy: { Madon: "asc" },
    });

    expect(sampleDons.length).toBeGreaterThanOrEqual(2);

    let pendingNullCount = 0;
    for (const don of sampleDons) {
      const sender = don.NhanVien_DonXinDoiCa_ManvToNhanVien;
      const receiver = don.NhanVien_DonXinDoiCa_ManvnhanthayToNhanVien;

      if (!don.Manvnhanthay) {
        if (don.Trangthaixuly.trim() === "Chưa xử lý") pendingNullCount++;
        continue;
      }

      expect(receiver, `${don.Madon}: không tìm thấy người thay`).not.toBeNull();
      expect(receiver!.Trangthai.trim(), `${don.Madon}: người thay đã nghỉ`).not.toBe("Đã nghỉ");
      expect(don.Manvnhanthay.trim(), `${don.Madon}: trùng người gửi`).not.toBe(don.Manv.trim());
      expect(
        receiver!.Vitrilamviec.trim(),
        `${don.Madon}: lệch vị trí (${sender.Vitrilamviec} vs ${receiver!.Vitrilamviec})`
      ).toBe(sender.Vitrilamviec.trim());

      const inShift = await prisma.nhanVien_LichLam.findUnique({
        where: {
          Manv_Malich: {
            Manv: don.Manvnhanthay.trim(),
            Malich: don.Malich.trim(),
          },
        },
      });
      expect(inShift, `${don.Madon}: người thay đã có trong ca ${don.Malich}`).toBeNull();
    }

    expect(pendingNullCount).toBeGreaterThanOrEqual(1);

    // Kiểm tra qua service thực tế của UC_6.3
    const pendingItems = await layDanhSachDonDoiCaChuaXuLy();
    const sampleItems = pendingItems.filter((item) => item.madon.startsWith("DD00"));
    expect(sampleItems.length).toBeGreaterThanOrEqual(2);

    for (const item of sampleItems) {
      if (item.manvnhanthay) {
        expect(item.nguoiThayHopLe, `${item.madon}: nguoiThayHopLe phải là true`).toBe(true);
        expect(item.chucVuNhanVienThay).toBe(item.chucVuNhanVien);
      } else {
        expect(item.nguoiThayHopLe).toBe(false);
      }
    }
  });
});
