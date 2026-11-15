import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt } from "@backend/lib/crypto";
import { nowVN, CHECKIN_EARLY_MINUTES, URGENT_SHIFT_MINUTES } from "@backend/lib/time";
import { PLACEHOLDER } from "@frontend/config/placeholder";
import {
  autoFormatNgayInput,
  buildCalendarCells,
  CALENDAR_WEEKDAYS,
  formatCalendarMonthTitle,
  formatGio24,
  formatNgay,
  formatNgayGio24,
  formatThangNam,
  isValidCalendarDate,
  parseNgayVNToIso,
  parseSoThapPhanDuong,
  parseSoTienNguyenVND,
  toIsoDate,
} from "@frontend/lib/dinh-dang";

describe("backend/lib/time", () => {
  it("hằng số phải đúng với đặc tả", () => {
    expect(CHECKIN_EARLY_MINUTES).toBe(5);
    expect(URGENT_SHIFT_MINUTES).toBe(30);
  });

  it("nowVN trả về đối tượng Date hợp lệ", () => {
    const vnTime = nowVN();
    expect(vnTime).toBeInstanceOf(Date);
    expect(isNaN(vnTime.getTime())).toBe(false);
  });
});

describe("backend/lib/crypto", () => {
  beforeAll(() => {
    if (!process.env.ENCRYPTION_KEY) {
      process.env.ENCRYPTION_KEY = "f3e30a1389c33496f423af12c42ea726264983b3d28cc449204d69f89fcfcb8e";
    }
  });

  it("mã hóa và giải mã chuỗi chuẩn xác với AES-256-GCM", () => {
    const raw = "MatKhauDemo123!";
    const encrypted = encrypt(raw);
    expect(encrypted.split(":").length).toBe(3);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(raw);
  });
});

describe("frontend/lib/dinh-dang (VIỆC 1: dd/mm/yyyy, 24h, lịch tiếng Việt)", () => {
  it("tự chèn dấu / khi gõ 14112026 thành 14/11/2026", () => {
    expect(autoFormatNgayInput("14")).toBe("14");
    expect(autoFormatNgayInput("141")).toBe("14/1");
    expect(autoFormatNgayInput("1411")).toBe("14/11");
    expect(autoFormatNgayInput("14112026")).toBe("14/11/2026");
  });

  it("từ chối ngày không có thật (31/02, 31/04, 29/02 năm không nhuận)", () => {
    expect(isValidCalendarDate(2026, 2, 31)).toBe(false);
    expect(isValidCalendarDate(2026, 4, 31)).toBe(false);
    expect(isValidCalendarDate(2025, 2, 29)).toBe(false);
    expect(isValidCalendarDate(2024, 2, 29)).toBe(true);

    expect(parseNgayVNToIso("31/02/2026")).toBeNull();
    expect(parseNgayVNToIso("31/04/2026")).toBeNull();
    expect(parseNgayVNToIso("29/02/2025")).toBeNull();
    expect(parseNgayVNToIso("29/02/2024")).toBe("2024-02-29");
  });

  it("đổi qua lại dd/mm/yyyy ↔ yyyy-mm-dd không lệch múi giờ ở ngày 1 và ngày cuối tháng", () => {
    const cases: Array<[string, string]> = [
      ["2026-01-01", "01/01/2026"],
      ["2026-01-31", "31/01/2026"],
      ["2026-02-28", "28/02/2026"],
      ["2024-02-29", "29/02/2024"],
      ["2026-03-01", "01/03/2026"],
      ["2026-11-30", "30/11/2026"],
      ["2026-12-31", "31/12/2026"],
      ["2026-11-01T00:00:00.000Z", "01/11/2026"],
    ];
    for (const [iso, vn] of cases) {
      expect(formatNgay(iso)).toBe(vn);
      const parsed = parseNgayVNToIso(vn);
      expect(parsed).toBe(iso.slice(0, 10));
    }
    expect(toIsoDate(2026, 11, 1)).toBe("2026-11-01");
  });

  it("lịch bật lên hiển thị tiêu đề 'Tháng 11 2026' và tuần bắt đầu từ Thứ hai (T2..CN)", () => {
    expect(CALENDAR_WEEKDAYS).toEqual(["T2", "T3", "T4", "T5", "T6", "T7", "CN"]);
    expect(formatCalendarMonthTitle(2026, 11)).toBe("Tháng 11 2026");
    // Ngày 01/11/2026 là Chủ nhật → 6 ô trống đầu tuần (T2..T7), ngày 1 ở cột CN (index 6)
    const cells = buildCalendarCells(2026, 11);
    expect(cells.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(cells[6]).toBe(1);
    expect(cells[cells.length - 1]).toBe(30);
  });

  it("định dạng giờ 24h và tháng/năm chuẩn Việt Nam", () => {
    expect(formatGio24("2026-11-14T16:30:00.000Z")).toBe("16:30");
    expect(formatNgayGio24("2026-11-14T08:05:00.000Z")).toBe("14/11/2026 08:05");
    expect(formatThangNam(11, 2026)).toBe("11/2026");
  });
});

describe("frontend/screens (chống quay lại placeholder hướng dẫn & không chứa giá trị mẫu)", () => {
  const FORBIDDEN_SAMPLE_PATTERNS = [
    /\d/,
    /nguyễn văn/i,
    /minh anh/i,
    /ngũ hành sơn/i,
    /đại học kinh tế/i,
    /dd\/mm/i,
    /hh:mm/i,
    /•/,
  ];

  function collectTsxFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...collectTsxFiles(full));
      else if (entry.name.endsWith(".tsx")) out.push(full);
    }
    return out;
  }

  function extractInputTextareaTags(source: string): string[] {
    const tags: string[] = [];
    const startRegex = /<(?:input|textarea)\b/g;
    let match: RegExpExecArray | null;
    while ((match = startRegex.exec(source)) !== null) {
      let i = match.index + match[0].length;
      let braceDepth = 0;
      let quote: string | null = null;
      while (i < source.length) {
        const ch = source[i];
        if (quote) {
          if (ch === "\\" && i + 1 < source.length) {
            i += 2;
            continue;
          }
          if (ch === quote) quote = null;
          i += 1;
          continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") {
          quote = ch;
        } else if (ch === "{") {
          braceDepth += 1;
        } else if (ch === "}") {
          braceDepth = Math.max(0, braceDepth - 1);
        } else if (ch === ">" && braceDepth === 0) {
          tags.push(source.slice(match.index, i + 1));
          break;
        }
        i += 1;
      }
    }
    return tags;
  }

  it("bảng PLACEHOLDER dùng chung chỉ chứa chữ hướng dẫn 'Nhập ...' / 'Chọn ...', không có số hay tên mẫu", () => {
    const entries = Object.entries(PLACEHOLDER);
    expect(entries.length).toBeGreaterThan(15);
    const violations: string[] = [];
    for (const [key, value] of entries) {
      if (!value.startsWith("Nhập ") && !value.startsWith("Chọn ")) {
        violations.push(`${key}: "${value}" không bắt đầu bằng "Nhập " hoặc "Chọn "`);
      }
      for (const pattern of FORBIDDEN_SAMPLE_PATTERNS) {
        if (pattern.test(value)) {
          violations.push(`${key}: "${value}" khớp mẫu cấm ${pattern}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("quét toàn bộ màn hình & DatePicker/MonthPicker: mọi ô nhập văn bản đều có placeholder 'Nhập ...' / 'Chọn ...'", () => {
    const appRoot = path.resolve(__dirname, "../..");
    const datePickerFile = path.join(appRoot, "frontend/components/ui/DatePicker.tsx");
    const monthPickerFile = path.join(appRoot, "frontend/components/ui/MonthPicker.tsx");
    expect(fs.readFileSync(datePickerFile, "utf8")).toContain("placeholder = PLACEHOLDER.chonNgay");
    expect(fs.readFileSync(monthPickerFile, "utf8")).toContain("placeholder = PLACEHOLDER.chonThang");

    const files = [
      ...collectTsxFiles(path.join(appRoot, "frontend/screens")),
      datePickerFile,
      monthPickerFile,
    ];
    expect(files.length).toBeGreaterThan(20);

    const violations: string[] = [];
    for (const file of files) {
      const rel = path.relative(appRoot, file);
      const content = fs.readFileSync(file, "utf8");
      for (const tag of extractInputTextareaTags(content)) {
        if (/\btype\s*=\s*["'](?:checkbox|radio|hidden)["']/.test(tag)) continue;
        if (/\breadOnly\b/.test(tag)) continue;

        const attrMatch = tag.match(/\bplaceholder\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/);
        if (!attrMatch) {
          violations.push(`${rel}: thiếu placeholder trên ${tag.slice(0, 80)}`);
          continue;
        }

        if (
          (file === datePickerFile || file === monthPickerFile) &&
          attrMatch[3]?.trim() === "placeholder"
        ) {
          continue;
        }

        let resolved = (attrMatch[1] ?? attrMatch[2] ?? "").trim();
        if (attrMatch[3] !== undefined) {
          const expr = attrMatch[3].trim();
          const keyMatch = expr.match(/^PLACEHOLDER\.([A-Za-z0-9_]+)$/);
          if (!keyMatch || !(keyMatch[1] in PLACEHOLDER)) {
            violations.push(`${rel}: placeholder biểu thức không hợp lệ {${expr}}`);
            continue;
          }
          resolved = PLACEHOLDER[keyMatch[1] as keyof typeof PLACEHOLDER];
        }

        if (!resolved.startsWith("Nhập ") && !resolved.startsWith("Chọn ")) {
          violations.push(`${rel}: placeholder="${resolved}" phải bắt đầu bằng "Nhập " hoặc "Chọn "`);
        }
        for (const pattern of FORBIDDEN_SAMPLE_PATTERNS) {
          if (pattern.test(resolved)) {
            violations.push(`${rel}: placeholder="${resolved}" chứa dữ liệu mẫu (${pattern})`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("BUG-01: parseSoTienNguyenVND từ chối số thập phân ('17500.5', '100.5'), chữ cái, số âm và chỉ nhận nguyên VND", () => {
    expect(parseSoTienNguyenVND("17500")).toBe(17500);
    expect(parseSoTienNguyenVND("17.500")).toBe(17500);
    expect(parseSoTienNguyenVND("1.000.000")).toBe(1000000);
    expect(parseSoTienNguyenVND("0")).toBe(0);
    expect(parseSoTienNguyenVND("17500.5")).toBeNull();
    expect(parseSoTienNguyenVND("100.5")).toBeNull();
    expect(parseSoTienNguyenVND("17 500")).toBeNull();
    expect(parseSoTienNguyenVND("-5000")).toBeNull();
    expect(parseSoTienNguyenVND("abc")).toBeNull();

    expect(parseSoThapPhanDuong("2")).toBe(2);
    expect(parseSoThapPhanDuong("1,5")).toBe(1.5);
    expect(parseSoThapPhanDuong("2abc")).toBeNull();
    expect(parseSoThapPhanDuong("-1")).toBeNull();
  });
});
