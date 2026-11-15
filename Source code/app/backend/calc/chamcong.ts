/**
 * Tính toán chấm công (UC_3.1, UC_3.2).
 * Giờ làm và tiền công là giá trị DẪN XUẤT: tính khi truy vấn, không lưu vào CSDL.
 */

import {
  formatDateVN,
  formatTimeFromDb,
  OVERTIME_MAX_MINUTES,
} from "@backend/lib/time";

const MS_MOT_GIO = 60 * 60 * 1000;

function lamTron2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Giờ làm = giờ ra − giờ vào, đơn vị giờ, làm tròn 2 số lẻ. */
export function tinhGioLam(checkin: Date, checkout: Date): number {
  const diffMs = checkout.getTime() - checkin.getTime();
  if (diffMs <= 0) return 0;
  return lamTron2(diffMs / MS_MOT_GIO);
}

/** Tiền công = giờ làm × mức lương theo giờ × hệ số lương (mặc định 1). */
export function tinhTienCong(
  gioLam: number,
  mucLuongTheoGio: number,
  heSo: number = 1
): number {
  if (gioLam <= 0 || mucLuongTheoGio <= 0) return 0;
  return lamTron2(gioLam * mucLuongTheoGio * heSo);
}

export interface HeSoLuongKhoang {
  Ngaybatdau: Date;
  Ngayketthuc: Date;
  Heso: number | string;
}

function toIsoDateKey(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  // Cột DATE từ Prisma có giờ UTC 00:00:00Z; còn nowVN() có local components theo giờ VN
  if (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  ) {
    return d.toISOString().slice(0, 10);
  }
  return formatDateVN(d);
}

/** Hệ số lương theo ngày (Ngaybatdau ≤ ngày ≤ Ngayketthuc); không có khoảng nào thì = 1. */
export function chonHeSoTheoNgay(
  ngay: Date | string,
  danhSach: HeSoLuongKhoang[]
): number {
  const ngayKey = toIsoDateKey(ngay);
  const khoang = danhSach.find((k) => {
    const startKey = k.Ngaybatdau.toISOString().slice(0, 10);
    const endKey = k.Ngayketthuc.toISOString().slice(0, 10);
    return startKey <= ngayKey && ngayKey <= endKey;
  });
  return khoang ? Number(khoang.Heso) : 1;
}

/** Đổi giá trị TIME (Date hoặc "HH:mm[:ss]") sang tổng số phút tính từ 00:00. */
export function parseTimeToMinutes(timeVal: Date | string): number {
  const str = typeof timeVal === "string" ? timeVal.trim() : formatTimeFromDb(timeVal);
  const parts = str.split(":").map((p) => parseInt(p, 10));
  const hh = parts[0] || 0;
  const mm = parts[1] || 0;
  const ss = parts[2] || 0;
  return hh * 60 + mm + ss / 60;
}

/** Trừ `phut` phút khỏi chuỗi "HH:mm" (trả về "HH:mm"). */
export function truPhutHHmm(hhmm: string, phut: number): string {
  const total = Math.max(0, Math.floor(parseTimeToMinutes(hhmm)) - phut);
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export type TrangThaiCheckIn =
  | "chua-den-gio" // trước (giờ bắt đầu − CHECKIN_EARLY_MINUTES)
  | "co-the-check-in" // từ (giờ bắt đầu − CHECKIN_EARLY_MINUTES) đến trước giờ kết thúc ca
  | "da-check-in" // đã có Thoigiancheckin (mỗi ca một lần, BR03)
  | "quen-check-in"; // đã hết ca mà chưa check-in

/**
 * Quy tắc check-in (UC_3.1 BR02, BR03).
 * - Sớm tối đa `somPhut` phút trước giờ bắt đầu ca (CHECKIN_EARLY_MINUTES).
 * - Hết giờ kết thúc ca mà chưa check-in → quên check-in.
 */
export function xetTrangThaiCheckIn(args: {
  batDauPhut: number;
  ketThucPhut: number;
  hienTaiPhut: number;
  daCheckIn: boolean;
  somPhut: number;
}): TrangThaiCheckIn {
  if (args.daCheckIn) return "da-check-in";
  if (args.hienTaiPhut < args.batDauPhut - args.somPhut) return "chua-den-gio";
  if (args.hienTaiPhut < args.ketThucPhut) return "co-the-check-in";
  return "quen-check-in";
}

/** Tạo Date dạng giờ-VN-trong-UTC (đồng bộ với `toDbDateTimeVN`) từ `YYYY-MM-DD` và `HH:mm`. */
export function buildDbDateTimeVN(ngayStr: string, hhmm: string): Date {
  const [y, m, d] = ngayStr.split("-").map((n) => parseInt(n, 10));
  const [hh, mm] = hhmm.split(":").map((n) => parseInt(n, 10));
  return new Date(Date.UTC(y, m - 1, d, hh || 0, mm || 0, 0, 0));
}

/**
 * Mốc hết giờ tăng ca (UC_3.2 BR03 & quy tắc đã chốt):
 * - Ca Sáng: tự check-out lúc 15:00 cùng ngày.
 * - Các ca khác (Chiều/Tối): giờ kết thúc ca + maxPhut (mặc định 210 phút = 3.5 giờ).
 */
export function tinhMocKetThucTangCa(
  ngayLamStr: string,
  gioKetThucHHmm: string,
  loaica: string,
  maxPhut: number = OVERTIME_MAX_MINUTES
): { mocDb: Date; gioHienThi: string } {
  if (loaica.trim().toLowerCase().includes("sáng")) {
    return {
      mocDb: buildDbDateTimeVN(ngayLamStr, "15:00"),
      gioHienThi: "15:00",
    };
  }
  const ketThucDb = buildDbDateTimeVN(ngayLamStr, gioKetThucHHmm);
  const mocDb = new Date(ketThucDb.getTime() + maxPhut * 60_000);
  return {
    mocDb,
    gioHienThi: mocDb.toISOString().slice(11, 16),
  };
}

export type TrangThaiCheckOut =
  | "chua-check-in"
  | "dang-lam-viec"
  | "dang-tang-ca"
  | "quen-check-out"
  | "da-check-out";

/**
 * Quy tắc check-out (UC_3.2):
 * - Nếu chưa check-in -> "chua-check-in"
 * - Nếu đã check-out -> "da-check-out"
 * - Nếu đang tăng ca -> "dang-tang-ca" (khi hienTaiDb >= mocTangCaDb thì tự check-out)
 * - Nếu chưa tăng ca và quá giờ kết thúc ca > gracePhut (60 phút) -> "quen-check-out"
 */
export function xetTrangThaiCheckOut(args: {
  daCheckIn: boolean;
  daCheckOut: boolean;
  dangTangCa: boolean;
  hienTaiMs: number;
  ketThucCaMs: number;
  mocTangCaMs: number;
  gracePhut: number;
}): TrangThaiCheckOut {
  if (!args.daCheckIn) return "chua-check-in";
  if (args.daCheckOut) return "da-check-out";
  if (args.dangTangCa) {
    return args.hienTaiMs >= args.mocTangCaMs ? "da-check-out" : "dang-tang-ca";
  }
  if (args.hienTaiMs > args.ketThucCaMs + args.gracePhut * 60_000) {
    return "quen-check-out";
  }
  return "dang-lam-viec";
}

export type LoaiQuenChamCong = "Quên check-in" | "Quên check-out";

/**
 * Phân loại "quên chấm công" cho một ca của nhân viên khi đọc (không job):
 * - Chỉ xét ca đã kết thúc: ngayLam < todayStr hoặc (ngayLam === todayStr && hienTaiPhut >= ketThucPhut).
 * - Thiếu check-in -> "Quên check-in"; đủ check-in nhưng thiếu check-out -> "Quên check-out".
 */
export function phanLoaiQuenChamCong(args: {
  ngayLam: string;
  gioKetThuc: string;
  todayStr: string;
  hienTaiPhut: number;
  daCheckIn: boolean;
  daCheckOut: boolean;
}): LoaiQuenChamCong | null {
  const daKetThuc =
    args.ngayLam < args.todayStr ||
    (args.ngayLam === args.todayStr &&
      args.hienTaiPhut >= parseTimeToMinutes(args.gioKetThuc));

  if (!daKetThuc) return null;
  if (!args.daCheckIn) return "Quên check-in";
  if (!args.daCheckOut) return "Quên check-out";
  return null;
}
