// Chạy schema.sql (+ seed) trên PostgreSQL. Dùng (trong thư mục app/):
//   node --env-file=.env database/sql/run-sql.mjs [schema|seed|reset|clean]
//   schema : chỉ dựng 14 bảng        seed : chỉ nạp dữ liệu mẫu
//   reset  : schema + seed (mặc định, để test local)
//   clean  : schema + seed-sach.sql (chỉ chủ quán + 3 ca, dùng cho bản deploy thật)
// Kết nối bằng DIRECT_URL (nếu có) hoặc DATABASE_URL. CSDL phải tồn tại sẵn
// (local: npm run db:init tạo; deploy: nhà cung cấp tạo sẵn).
import pg from "pg";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const mode = process.argv[2] ?? "reset";
const dir = dirname(fileURLToPath(import.meta.url));
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) { console.error("Thiếu DATABASE_URL trong .env"); process.exit(1); }
if (!["schema", "seed", "reset", "clean"].includes(mode)) { console.error("Chế độ phải là: schema | seed | reset | clean"); process.exit(1); }
const user = decodeURIComponent(new URL(url).username).toLowerCase();
if (user === "postgres") { console.error("Không dùng tài khoản postgres. Dùng tài khoản riêng của ứng dụng (xem README mục CSDL)."); process.exit(1); }

async function connect(tries = 8) {
  for (let i = 1; i <= tries; i++) {
    const c = new pg.Client({ connectionString: url });
    try { await c.connect(); return c; }
    catch (e) {
      console.log(`Chưa kết nối được (${i}/${tries}): ${e.message}`);
      await new Promise((r) => setTimeout(r, 4000)); // CSDL miễn phí có thể đang "đánh thức"
    }
  }
  throw new Error("Không kết nối được PostgreSQL");
}

async function runFile(c, file) {
  const text = readFileSync(join(dir, file), "utf8");
  try { await c.query(text); } // cả file là một giao dịch (BEGIN...COMMIT) nên lỗi sẽ hoàn tác hết
  catch (e) {
    try { await c.query("ROLLBACK"); } catch {}
    console.error(`LỖI ở ${file}: ${e.message}${e.position ? ` (vị trí ký tự ${e.position})` : ""}`); process.exit(1);
  }
  console.log(`OK ${file}`);
}

const c = await connect();
if (mode === "schema" || mode === "reset" || mode === "clean") await runFile(c, "schema.sql");
if (mode === "seed" || mode === "reset") await runFile(c, "seed.sql");
if (mode === "clean") await runFile(c, "seed-sach.sql");
await c.end();
console.log("Hoàn tất.");
