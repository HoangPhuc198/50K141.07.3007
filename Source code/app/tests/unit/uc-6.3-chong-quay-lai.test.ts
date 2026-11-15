import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const APP_ROOT = path.resolve(__dirname, "../..");
const REPO_ROOT = path.resolve(APP_ROOT, "..");

describe("Chống quay lại UC_6.3 – Bảng 'Lịch [Tên ca] sau khi lưu' theo SPEC (không theo Figma)", () => {
  it("XuLyDoiCaScreen.tsx tuyệt đối không chứa 'Đang làm', remainingWorkers hay dòng giữ chỗ trống", () => {
    const screenPath = path.join(
      APP_ROOT,
      "frontend/screens/chu-quan/lich-lam/XuLyDoiCaScreen.tsx"
    );
    const src = fs.readFileSync(screenPath, "utf8");

    expect(src).not.toContain("Đang làm");
    expect(src).not.toContain("remainingWorkers");
    expect(src).not.toContain("Chưa chọn người thay");
    expect(src).not.toContain("Chờ phân công");

    // Bắt buộc hiển thị ngày làm dd/mm/yyyy ở tiêu đề bảng xem trước và tối đa 1 dòng người thay hợp lệ
    expect(src).toContain("selectedItem.ngayLamHienThi");
    expect(src).toContain('id="preview-row-nguoi-thay"');
    expect(src).toContain('id="preview-body-nguoi-thay"');
    expect(src).toContain("Thay cho {selectedItem.tenNhanVien}");
    expect(src).toContain("candidate.chucvu.trim() !== selectedItem.chucVuNhanVien.trim()");
  });

  it("RULES.md và NGOAI-LE-FIGMA.md ghi nhận ngoại lệ Figma của UC_6.3 (quyết định 15/11/2026)", () => {
    const ngoaiLePath = path.join(REPO_ROOT, "docs/ke-hoach/NGOAI-LE-FIGMA.md");
    const rulesPath = path.join(REPO_ROOT, "RULES.md");

    const ngoaiLe = fs.readFileSync(ngoaiLePath, "utf8");
    const rules = fs.readFileSync(rulesPath, "utf8");

    expect(ngoaiLe).toContain("UC_6.3");
    expect(ngoaiLe).toContain("15/11/2026");
    expect(ngoaiLe).toContain("Đang làm");

    expect(rules).toContain("**UC_6.3:** bảng sau khi lưu theo SPEC, không theo Figma");
    expect(rules).toContain("không có 'Đang làm'");
  });

  it("visual-map.json mask vùng bảng 'Lịch ca sau khi lưu' cho uc-6.3-doi-ca và giữ ngưỡng <= 8%", () => {
    const mapPath = path.join(APP_ROOT, "tests/visual/visual-map.json");
    const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
    const conf = map.screens["uc-6.3-doi-ca"];

    expect(conf).toBeDefined();
    expect(conf.maxDiffPercent).toBeLessThanOrEqual(8);
    const previewMask = (conf.masks || []).find(
      (m: { name: string }) => m.name === "block-preview-lich"
    );
    expect(previewMask).toBeDefined();
    expect(previewMask.width).toBeGreaterThan(400);
    expect(previewMask.height).toBeGreaterThan(100);
  });
});
