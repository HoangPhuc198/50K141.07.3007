// Mã hóa mật khẩu mặc định cho dữ liệu mẫu (mã hóa HAI CHIỀU để chủ quán xem được, theo đặc tả).
// Dùng (trong app/):  node --env-file=.env database/sql/set-passwords.mjs
// Định dạng lưu: base64(iv):base64(authTag):base64(ciphertext), AES-256-GCM, khóa = ENCRYPTION_KEY (64 ký tự hex).
// Code ứng dụng (backend/lib/crypto.ts) PHẢI dùng đúng định dạng này.
import pg from "pg";
import { createCipheriv, randomBytes } from "node:crypto";

const { ENCRYPTION_KEY, DEFAULT_PASSWORD } = process.env;
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url || !ENCRYPTION_KEY || !DEFAULT_PASSWORD) { console.error("Thiếu DATABASE_URL / ENCRYPTION_KEY / DEFAULT_PASSWORD trong .env"); process.exit(1); }
if (!/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY)) { console.error("ENCRYPTION_KEY phải là 64 ký tự hex (32 byte)."); process.exit(1); }
if (decodeURIComponent(new URL(url).username).toLowerCase() === "postgres") { console.error("Không dùng tài khoản postgres."); process.exit(1); }

function encrypt(plain) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", Buffer.from(ENCRYPTION_KEY, "hex"), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(":");
}

const c = new pg.Client({ connectionString: url });
await c.connect();
for (const [table, key] of [["ChuQuan", "Machuquan"], ["NhanVien", "Manv"]]) {
  const rows = (await c.query(`SELECT "${key}" AS k FROM "${table}" WHERE "Matkhau" = 'PENDING'`)).rows;
  for (const r of rows) {
    await c.query(`UPDATE "${table}" SET "Matkhau" = $1 WHERE "${key}" = $2`, [encrypt(DEFAULT_PASSWORD), r.k]);
  }
  console.log(`${table}: đã đặt mật khẩu cho ${rows.length} tài khoản`);
}
await c.end();
