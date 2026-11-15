// Quản lý PostgreSQL CHẠY Ở MÁY, dữ liệu nằm NGAY TRONG thư mục dự án: app/database/data (cổng PG_PORT, mặc định 5433).
// Cần cài sẵn PostgreSQL (để có chương trình initdb, pg_ctl). Đặt PG_BIN trong .env nếu chúng chưa nằm trong PATH,
// ví dụ PG_BIN=C:\Program Files\PostgreSQL\16\bin
// Dùng (trong app/):  node --env-file=.env database/sql/pg-local.mjs <lệnh>
//   init    : tạo thư mục dữ liệu, khởi động, tạo tài khoản ứng dụng + CSDL (chạy một lần)
//   start   : khởi động     stop : dừng     status : xem trạng thái
//   destroy : dừng và XÓA HẲN toàn bộ dữ liệu trong app/database/data (cần thêm --yes)
import { spawnSync } from "node:child_process";
import { existsSync, rmSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import pg from "pg";

const cmd = process.argv[2];
const yes = process.argv.includes("--yes");
const { PG_BIN = "", PG_PORT = "5433", DB_DATA_DIR = "database/data", DATABASE_URL, PG_OWNER_PASSWORD } = process.env;
const data = resolve(DB_DATA_DIR);
const exe = (n) => (PG_BIN ? join(PG_BIN, n) : n);
const LOC = process.platform === "win32" ? "C" : "C.UTF-8"; // locale "C" + mã hóa UTF8: không phụ thuộc hệ điều hành
const OWNER = "thanhha_owner"; // tài khoản quản trị riêng của cụm CSDL local này (KHÔNG phải postgres)

if (!DATABASE_URL) { console.error("Thiếu DATABASE_URL trong .env"); process.exit(1); }
const u = new URL(DATABASE_URL);
const APP_USER = decodeURIComponent(u.username), APP_PASS = decodeURIComponent(u.password), DB = u.pathname.slice(1);
if (APP_USER.toLowerCase() === "postgres" || APP_USER === OWNER) { console.error(`DATABASE_URL phải dùng tài khoản ứng dụng (ví dụ thanhha_app), không dùng ${APP_USER}.`); process.exit(1); }

function run(name, args, opts = {}) {
  const r = spawnSync(exe(name), args, { encoding: "utf8", ...opts });
  if (r.error) { console.error(`Không chạy được ${name}. Đã cài PostgreSQL chưa? Nếu rồi, đặt PG_BIN trong .env.\n${r.error.message}`); process.exit(1); }
  return r;
}
const running = () => run("pg_ctl", ["-D", data, "status"]).status === 0;
function start() {
  if (running()) return console.log("Đã chạy.");
  const r = run("pg_ctl", ["-D", data, "-o", `-p ${PG_PORT} -c listen_addresses=127.0.0.1`, "-l", join(data, "server.log"), "-w", "start"]);
  if (r.status !== 0) { console.error(r.stderr || r.stdout); process.exit(1); }
  console.log(`PostgreSQL đang chạy ở cổng ${PG_PORT}.`);
}
function stop() { if (running()) { run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]); console.log("Đã dừng."); } else console.log("Đang dừng sẵn."); }

if (cmd === "init") {
  if (existsSync(join(data, "PG_VERSION"))) { console.log("Cụm CSDL đã có, chỉ khởi động."); start(); }
  else {
    if (existsSync(data) && readdirSync(data).length) { console.error(`Thư mục ${data} không trống (có thể còn file .mdf/.ldf của SQL Server). Xóa CSDL cũ trong SQL Server bằng DROP DATABASE (xem HUONG-DAN-CHUYEN-POSTGRES.md), hoặc đổi DB_DATA_DIR sang thư mục khác.`); process.exit(1); }
    mkdirSync(data, { recursive: true });
    const pw = join(data, "..", ".owner-pw.tmp");
    const ownerPass = PG_OWNER_PASSWORD || APP_PASS + "_owner";
    writeFileSync(pw, ownerPass);
    const r = run("initdb", ["-D", data, "-U", OWNER, "--pwfile", pw, "--auth=scram-sha-256", "-E", "UTF8", `--locale=${LOC}`]);
    rmSync(pw, { force: true });
    if (r.status !== 0) { console.error(r.stderr || r.stdout); process.exit(1); }
    start();
    const admin = new pg.Client({ host: "127.0.0.1", port: Number(PG_PORT), user: OWNER, password: ownerPass, database: "postgres" });
    await admin.connect();
    const q = (s) => s.replace(/'/g, "''");
    await admin.query(`CREATE ROLE "${APP_USER}" LOGIN PASSWORD '${q(APP_PASS)}'`);
    await admin.query(`CREATE DATABASE "${DB}" OWNER "${APP_USER}" ENCODING 'UTF8' TEMPLATE template0 LC_COLLATE '${LOC}' LC_CTYPE '${LOC}'`).catch(async (e) => {
      console.log(`Không dùng được locale ${LOC}, tạo với cài đặt mặc định: ` + e.message);
      await admin.query(`CREATE DATABASE "${DB}" OWNER "${APP_USER}" ENCODING 'UTF8' TEMPLATE template0`);
    });
    await admin.end();
    console.log(`Đã tạo tài khoản ${APP_USER} và CSDL ${DB} tại ${data}`);
  }
} else if (cmd === "start") start();
else if (cmd === "stop") stop();
else if (cmd === "status") console.log(running() ? `Đang chạy (cổng ${PG_PORT}).` : "Đang dừng.");
else if (cmd === "destroy") {
  if (!yes) { console.error(`Lệnh này XÓA HẲN toàn bộ CSDL trong ${data}. Chạy lại kèm --yes nếu chắc chắn.`); process.exit(1); }
  if (existsSync(join(data, "PG_VERSION"))) stop();
  rmSync(data, { recursive: true, force: true });
  console.log(`Đã xóa ${data}. Chạy "npm run db:init" để tạo lại.`);
} else { console.error("Lệnh: init | start | stop | status | destroy [--yes]"); process.exit(1); }
