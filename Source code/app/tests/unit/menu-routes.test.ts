import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { chuQuanMenu, nhanVienMenu, getAllMenuRoutes } from "../../frontend/config/menu";

const APP_DIR = path.resolve(__dirname, "../../src/app");

describe("Kiểm tra Đồng bộ Điều hướng & Menu (menu-routes.test.ts)", () => {
  const allRoutes = getAllMenuRoutes();

  it("mọi route trong menu.ts đều có trang thật (page.tsx) trong src/app", () => {
    for (const item of allRoutes) {
      // Ví dụ: href="/chu-quan/nhan-vien/them" -> "src/app/chu-quan/nhan-vien/them/page.tsx"
      const relativePath = item.href.replace(/^\//, "");
      const expectedPage = path.join(APP_DIR, relativePath, "page.tsx");
      const exists = fs.existsSync(expectedPage);
      expect(exists, `Thiếu file page.tsx cho route ${item.href} tại ${expectedPage}`).toBe(true);
    }
  });

  it("mọi nhóm cha trong menu có mục con đều có trang điều hướng mặc định vào mục con đầu tiên", () => {
    const parentGroups = [...chuQuanMenu, ...nhanVienMenu].filter((g) => g.items && g.items.length > 0);

    for (const group of parentGroups) {
      // Đường dẫn nhóm cha lấy từ prefix của mục con đầu tiên (ví dụ: "/chu-quan/nhan-vien")
      const firstChildHref = group.items![0].href;
      const parentRoute = firstChildHref.substring(0, firstChildHref.lastIndexOf("/"));
      const relativePath = parentRoute.replace(/^\//, "");
      const expectedPage = path.join(APP_DIR, relativePath, "page.tsx");

      expect(fs.existsSync(expectedPage), `Thiếu page.tsx cho nhóm cha ${parentRoute}`).toBe(true);

      const content = fs.readFileSync(expectedPage, "utf8");
      expect(content, `Trang nhóm cha ${parentRoute} phải có lệnh redirect`).toContain("redirect");
    }
  });

  it("không có trang UC nào trong src/app nằm ngoài menu.ts (chống trang mồ côi / UC đứng riêng)", () => {
    // Thu thập tất cả file page.tsx trong src/app/chu-quan và src/app/nhan-vien
    const discoveredRoutes: string[] = [];

    function scanDir(dir: string, baseRoute: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          scanDir(path.join(dir, entry.name), `${baseRoute}/${entry.name}`);
        } else if (entry.isFile() && entry.name === "page.tsx") {
          discoveredRoutes.push(baseRoute);
        }
      }
    }

    if (fs.existsSync(path.join(APP_DIR, "chu-quan"))) {
      scanDir(path.join(APP_DIR, "chu-quan"), "/chu-quan");
    }
    if (fs.existsSync(path.join(APP_DIR, "nhan-vien"))) {
      scanDir(path.join(APP_DIR, "nhan-vien"), "/nhan-vien");
    }

    const menuHrefs = new Set(allRoutes.map((r) => r.href));
    // Thêm các trang nhóm cha hợp lệ
    const parentGroups = [...chuQuanMenu, ...nhanVienMenu].filter((g) => g.items && g.items.length > 0);
    for (const group of parentGroups) {
      const firstChildHref = group.items![0].href;
      const parentRoute = firstChildHref.substring(0, firstChildHref.lastIndexOf("/"));
      menuHrefs.add(parentRoute);
    }

    for (const route of discoveredRoutes) {
      expect(menuHrefs.has(route), `Phát hiện trang UC hoặc route mồ côi ngoài menu.ts: ${route}`).toBe(true);
    }
  });
});
