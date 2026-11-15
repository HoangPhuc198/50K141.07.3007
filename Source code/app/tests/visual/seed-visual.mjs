/**
 * Seed CSDL cho chạy test:visual ổn định theo mốc VISUAL_NOW (2026-11-06).
 * CHỈ dùng khi chạy test visual, tuyệt đối không dùng cho production.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, "../..");
const SCHEMA_PATH = path.join(APP_DIR, "database/sql/schema.sql");
const SEED_PATH = path.join(APP_DIR, "database/sql/seed.sql");

const VISUAL_DATE = "2026-11-06";
const VISUAL_MONTH_START = "2026-11-01";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Thiếu DATABASE_URL");
  }

  const schemaSql = fs.readFileSync(SCHEMA_PATH, "utf-8");
  let seedSql = fs.readFileSync(SEED_PATH, "utf-8");

  // Thay ngày động now() AT TIME ZONE 'Asia/Ho_Chi_Minh' bằng ngày cố định của ảnh Figma mẫu
  seedSql = seedSql
    .replaceAll("(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date", `DATE '${VISUAL_DATE}'`)
    .replaceAll(
      "date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date",
      `DATE '${VISUAL_MONTH_START}'`
    );

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(schemaSql);
    await client.query(seedSql);

    // Đảm bảo ngày 2026-11-06 Ca sáng (CA000001) luôn có NV000001 để màn Check-in khớp trạng thái mở
    const lichSang = await client.query(
      `SELECT "Malich" FROM "LichLam" WHERE "Ngaylam" = $1::date AND "Maca" = 'CA000001' LIMIT 1`,
      [VISUAL_DATE]
    );
    if (lichSang.rows[0]) {
      const malich = lichSang.rows[0].Malich;
      const existing = await client.query(
        `SELECT "Manv" FROM "NhanVien_LichLam" WHERE "Malich" = $1 ORDER BY "Manv"`,
        [malich]
      );
      const hasNv1 = existing.rows.some((r) => r.Manv.trim() === "NV000001");
      if (!hasNv1) {
        if (existing.rows.length >= 3) {
          await client.query(
            `DELETE FROM "NhanVien_LichLam" WHERE "Malich" = $1 AND "Manv" = $2`,
            [malich, existing.rows[existing.rows.length - 1].Manv]
          );
        }
        await client.query(
          `INSERT INTO "NhanVien_LichLam" ("Manv", "Malich") VALUES ('NV000001', $1) ON CONFLICT DO NOTHING`,
          [malich]
        );
      }
    }
  } finally {
    await client.end();
  }

  execSync("node --env-file=.env database/sql/set-passwords.mjs", {
    cwd: APP_DIR,
    stdio: "inherit",
  });
  console.log(`Đã seed dữ liệu visual cố định cho ngày ${VISUAL_DATE}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
