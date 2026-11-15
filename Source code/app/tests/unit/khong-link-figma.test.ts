import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const APP_ROOT = path.resolve(__dirname, "../..");
const TARGET_EXTENSIONS = new Set([".ts", ".tsx", ".css", ".json", ".mjs"]);
const IGNORED_DIRS = new Set(["node_modules", ".next"]);

// Ghép chuỗi động để file test này không tự chứa chuỗi cấm
const FIGMA_DOMAIN = "figma" + ".com";
const FORBIDDEN_PATTERNS = [`${FIGMA_DOMAIN}/api`, `${FIGMA_DOMAIN}/design`];

function isIgnoredRelativePath(relPosix: string): boolean {
  // Bỏ tests/visual/_* (file hoặc thư mục bắt đầu bằng _ trong tests/visual/)
  return relPosix === "tests/visual"
    ? false
    : relPosix.startsWith("tests/visual/_");
}

function collectFiles(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    const relPosix = path.relative(APP_ROOT, fullPath).split(path.sep).join("/");

    if (isIgnoredRelativePath(relPosix)) continue;

    if (entry.isDirectory()) {
      collectFiles(fullPath, files);
    } else if (entry.isFile() && TARGET_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("Kiểm tra không còn link tạm Figma trong app/ (khong-link-figma.test.ts)", () => {
  it("không có file .ts/.tsx/.css/.json/.mjs nào chứa link figma api hoặc design", () => {
    const files = collectFiles(APP_ROOT);
    expect(files.length).toBeGreaterThan(0);

    const violations: string[] = [];

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, "utf8");
      const lines = content.split(/\r?\n/);

      lines.forEach((line, idx) => {
        for (const pattern of FORBIDDEN_PATTERNS) {
          if (line.includes(pattern)) {
            const relPosix = path.relative(APP_ROOT, filePath).split(path.sep).join("/");
            violations.push(`${relPosix}:${idx + 1} chứa "${pattern}"`);
          }
        }
      });
    }

    expect(
      violations,
      `Phát hiện link Figma tạm/trực tiếp trong app/:\n${violations.join("\n")}`
    ).toEqual([]);
  });
});
