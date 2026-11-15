/**
 * Định dạng hiển thị kiểu Việt Nam (dùng chung, một nơi duy nhất):
 * tiền 18.640.000đ, giờ 1.023,5, ngày 02/11/2026, 24 giờ HH:mm.
 */

const NF_TIEN = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
const NF_GIO = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

export const CALENDAR_WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;

const TEN_THU_VIET = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** 18640000 → "18.640.000" (không kèm đ, dùng trong bảng) */
export function formatSoTien(n: number): string {
  return NF_TIEN.format(n);
}

/** 18640000 → "18.640.000đ" */
export function formatTien(n: number): string {
  return `${NF_TIEN.format(n)}đ`;
}

/** 1023.5 → "1.023,5" */
export function formatGio(n: number): string {
  return NF_GIO.format(n);
}

/** Kiểm tra ngày dương lịch có thật (không cho phép 31/02, 31/04, 29/02 năm không nhuận...) */
export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

/** Chuyển năm/tháng/ngày thành chuỗi ISO "YYYY-MM-DD" */
export function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Tách phần ngày { year, month, day } từ chuỗi ISO ("YYYY-MM-DD" hoặc ISO timestamp)
 * hoặc đối tượng Date (dùng thành phần giờ VN nội bộ, không lệch múi giờ).
 */
export function extractIsoDateParts(
  input: string | Date | null | undefined
): { year: number; month: number; day: number } | null {
  if (!input) return null;
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    return {
      year: input.getFullYear(),
      month: input.getMonth() + 1,
      day: input.getDate(),
    };
  }
  const m = String(input).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (!isValidCalendarDate(year, month, day)) return null;
  return { year, month, day };
}

/** Kiểm tra chuỗi ISO "YYYY-MM-DD" có hợp lệ theo lịch thực tế không */
export function isValidIsoDate(iso: string): boolean {
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  return isValidCalendarDate(
    parseInt(m[1], 10),
    parseInt(m[2], 10),
    parseInt(m[3], 10)
  );
}

/** "2026-11-02" (hoặc ISO timestamp / Date) → "02/11/2026" */
export function formatNgay(input: string | Date | null | undefined): string {
  const parts = extractIsoDateParts(input);
  if (!parts) return "";
  return `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}`;
}

/** "2026-11-02" (hoặc ISO timestamp / Date) → "02/11" */
export function formatNgayThang(input: string | Date | null | undefined): string {
  const parts = extractIsoDateParts(input);
  if (!parts) return "";
  return `${pad2(parts.day)}/${pad2(parts.month)}`;
}

/** Date → "Thứ Hai, 02/11/2026" */
export function formatNgayDaiVN(date: Date): string {
  const thu = TEN_THU_VIET[date.getDay()];
  return `${thu}, ${formatNgay(date)}`;
}

/** Định dạng giờ 24h ("HH:mm") từ ISO string hoặc Date */
export function formatGio24(input: string | Date | null | undefined): string {
  if (!input) return "";
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return "";
    return `${pad2(input.getHours())}:${pad2(input.getMinutes())}`;
  }
  const s = String(input).trim();
  const isoMatch = s.match(/T(\d{2}):(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}:${isoMatch[2]}`;
  const hmMatch = s.match(/^(\d{2}):(\d{2})/);
  if (hmMatch) return `${hmMatch[1]}:${hmMatch[2]}`;
  return "";
}

/** Định dạng ngày giờ 24h ("dd/mm/yyyy HH:mm") */
export function formatNgayGio24(input: string | Date | null | undefined): string {
  const ngay = formatNgay(input);
  const gio = formatGio24(input);
  if (!ngay) return "";
  return gio ? `${ngay} ${gio}` : ngay;
}

/** (11, 2026) → "11/2026" */
export function formatThangNam(thang: number, nam: number): string {
  return `${pad2(thang)}/${nam}`;
}

/** "Tháng 11 2026" cho tiêu đề lịch bật lên */
export function formatCalendarMonthTitle(year: number, month: number): string {
  return `Tháng ${month} ${year}`;
}

/**
 * Chuyển chuỗi "dd/mm/yyyy" (hoặc "d/m/yyyy") sang ISO "yyyy-mm-dd".
 * Trả về null nếu sai định dạng hoặc ngày không có thật (ví dụ "31/02/2026").
 */
export function parseNgayVNToIso(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  if (!isValidCalendarDate(year, month, day)) return null;
  return toIsoDate(year, month, day);
}

/** Tự động chèn dấu "/" khi gõ ngày ("14112026" → "14/11/2026") */
export function autoFormatNgayInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Parse "mm/yyyy" hoặc "yyyy-mm" thành { thang, nam } */
export function parseThangNamInput(raw: string): { thang: number; nam: number } | null {
  const s = raw.trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) {
    const thang = parseInt(m[1], 10);
    const nam = parseInt(m[2], 10);
    if (thang >= 1 && thang <= 12 && nam >= 1900 && nam <= 2100) {
      return { thang, nam };
    }
    return null;
  }
  m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m) {
    const nam = parseInt(m[1], 10);
    const thang = parseInt(m[2], 10);
    if (thang >= 1 && thang <= 12 && nam >= 1900 && nam <= 2100) {
      return { thang, nam };
    }
  }
  return null;
}

/** Tự động chèn dấu "/" khi gõ tháng/năm ("112026" → "11/2026") */
export function autoFormatThangNamInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/** Dựng danh sách ô ngày trong tháng, tuần bắt đầu từ Thứ hai (T2..CN) */
export function buildCalendarCells(year: number, month: number): Array<number | null> {
  const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0=CN..6=T7
  const leadingEmpty = (firstDay + 6) % 7; // Monday-first
  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < leadingEmpty; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  return cells;
}

/**
 * Phân tích chuỗi tiền VND nguyên không âm (chấp nhận "17500" hoặc "17.500" / "1.000.000").
 * Từ chối số thập phân ("17500.5", "100.5"), chữ cái, dấu phẩy, khoảng trắng giữa số hoặc số âm.
 */
export function parseSoTienNguyenVND(raw: string | number): number | null {
  if (typeof raw === "number") {
    return Number.isSafeInteger(raw) && raw >= 0 ? raw : null;
  }
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed);
    return Number.isSafeInteger(n) ? n : null;
  }
  if (/^\d{1,3}(\.\d{3})+$/.test(trimmed)) {
    const n = Number(trimmed.replace(/\./g, ""));
    return Number.isSafeInteger(n) ? n : null;
  }
  return null;
}

/**
 * Phân tích hệ số thập phân không âm (chấp nhận "1", "1.5", "1,5").
 * Từ chối chuỗi lẫn chữ cái ("2abc"), nhiều dấu chấm ("1.2.3") hoặc số âm.
 */
export function parseSoThapPhanDuong(raw: string | number): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw >= 0 ? raw : null;
  }
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
