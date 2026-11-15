/**
 * Module xử lý thời gian theo chuẩn múi giờ Việt Nam (Asia/Ho_Chi_Minh - GMT+7).
 * CẤM dùng `new Date()` trực tiếp trong logic nghiệp vụ.
 */

export const CHECKIN_EARLY_MINUTES = 5;
export const CHECKOUT_GRACE_MINUTES = 60;
export const OVERTIME_MAX_MINUTES = 210; // 3.5 giờ (ca sáng 11:30 -> 15:00)
export const URGENT_SHIFT_MINUTES = 30;
export const TIMEZONE_VN = "Asia/Ho_Chi_Minh";

/**
 * Hằng số dùng chung cho UC_2.1 (Đăng ký lịch rảnh):
 * Từ Thứ bảy lúc 18:00:00 (giờ Việt Nam) đến hết Chủ nhật, tuần hiển thị tự chuyển sang tuần sau.
 */
export const LICH_RANH_CHUYEN_TUAN = {
  dayOfWeek: 6, // Thứ bảy (0 = CN, 1 = T2, ..., 6 = T7)
  hour: 18,
  minute: 0,
  second: 0,
} as const;

/**
 * Trả về đối tượng Date đại diện cho thời điểm hiện tại theo giờ Việt Nam (GMT+7).
 * Chỉ khi chạy test (`NODE_ENV=test` và có biến `VISUAL_NOW` ở server) mới trả về mốc cố định để ổn định test visual.
 */
export function nowVN(): Date {
  if (typeof window === "undefined") {
    const env = process.env;
    const nodeEnvKey = ["NODE", "ENV"].join("_");
    const visualKey = ["VISUAL", "NOW"].join("_");
    const nodeEnv = Reflect.get(env, nodeEnvKey);
    const visualNow = Reflect.get(env, visualKey);
    if (nodeEnv === "test" && typeof visualNow === "string" && visualNow.trim().length > 0) {
      const m = visualNow
        .trim()
        .match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
      if (m) {
        return new Date(
          Number(m[1]),
          Number(m[2]) - 1,
          Number(m[3]),
          Number(m[4] ?? "0"),
          Number(m[5] ?? "0"),
          Number(m[6] ?? "0"),
        );
      }
    }
  }
  const now = new Date();
  const vnString = now.toLocaleString("en-US", { timeZone: TIMEZONE_VN });
  return new Date(vnString);
}

/**
 * Đổi một mốc giờ VN (từ nowVN()) thành Date để ghi vào cột TIMESTAMP: cột lưu GIỜ VIỆT NAM,
 * nên các thành phần UTC của Date trả về chính là giờ-phút VN (không lưu UTC thật).
 */
export function toDbDateTimeVN(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      date.getMilliseconds()
    )
  );
}

/**
 * Format ngày thành dạng YYYY-MM-DD theo giờ VN
 */
export function formatDateVN(date: Date = nowVN()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format giờ thành dạng HH:mm:ss theo giờ VN
 */
export function formatTimeVN(date: Date = nowVN()): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Lấy chênh lệch thời gian giữa hai mốc tính theo phút
 */
export function diffInMinutes(target: Date, base: Date = nowVN()): number {
  return Math.round((target.getTime() - base.getTime()) / (1000 * 60));
}

/**
 * Format giá trị TIME từ CSDL (được Prisma trả về dưới dạng Date epoch UTC: 1970-01-01THH:mm:ssZ) thành HH:mm.
 */
export function formatTimeFromDb(timeVal: unknown): string {
  if (!timeVal) return "";
  if (timeVal instanceof Date) {
    try {
      return timeVal.toISOString().slice(11, 16);
    } catch {
      return String(timeVal).slice(0, 5);
    }
  }
  const str = String(timeVal).trim();
  const match = str.match(/(\d{2}:\d{2})/);
  if (match) return match[1];
  return str.slice(0, 5);
}

export interface TuanNgayItem {
  label: string;       // "Thứ hai" .. "Chủ nhật"
  shortDate: string;   // "09/11"
  fullDisplay: string; // "09/11/2026"
  fullDate: string;    // "2026-11-09"
}

export interface TuanLamViec {
  startDate: string;   // "2026-11-09"
  endDate: string;     // "2026-11-15"
  titleRange: string;  // "09–15/11/2026" hoặc "30/11–06/12/2026"
  days: TuanNgayItem[];
}

const TEN_THU_TRONG_TUAN = [
  "Thứ hai",
  "Thứ ba",
  "Thứ tư",
  "Thứ năm",
  "Thứ sáu",
  "Thứ bảy",
  "Chủ nhật",
] as const;

function buildTuanLamViecFromMonday(monday: Date): TuanLamViec {
  const days: TuanNgayItem[] = TEN_THU_TRONG_TUAN.map((label, idx) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return {
      label,
      shortDate: `${dd}/${mm}`,
      fullDisplay: `${dd}/${mm}/${yyyy}`,
      fullDate: formatDateVN(d),
    };
  });

  const first = days[0];
  const last = days[6];
  const firstMonth = first.shortDate.slice(3);
  const lastMonth = last.shortDate.slice(3);
  const firstYear = first.fullDisplay.slice(6);
  const lastYear = last.fullDisplay.slice(6);

  let titleRange: string;
  if (firstYear !== lastYear) {
    titleRange = `${first.fullDisplay}–${last.fullDisplay}`;
  } else if (firstMonth !== lastMonth) {
    titleRange = `${first.shortDate}–${last.fullDisplay}`;
  } else {
    titleRange = `${first.shortDate.slice(0, 2)}–${last.fullDisplay}`;
  }

  return {
    startDate: first.fullDate,
    endDate: last.fullDate,
    titleRange,
    days,
  };
}

/**
 * Tính tuần làm việc (Thứ hai – Chủ nhật) theo giờ Việt Nam.
 * Khi kết thúc ngày Thứ 7 (tức bắt đầu sang Chủ nhật: getDay() === 0),
 * tự động chuyển sang tuần tiếp theo (Thứ hai ngày hôm sau .. Chủ nhật kế tiếp).
 */
export function getTuanLamViec(baseDate: Date = nowVN()): TuanLamViec {
  const dayOfWeek = baseDate.getDay(); // 0 = CN, 1 = T2, ..., 6 = T7
  const offsetToMonday = dayOfWeek === 0 ? 1 : 1 - dayOfWeek;

  const monday = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate() + offsetToMonday
  );

  return buildTuanLamViecFromMonday(monday);
}

/**
 * Tính tuần hiển thị cho UC_2.1 (Đăng ký lịch rảnh) theo giờ Việt Nam (`nowVN()`):
 * - Từ 00:00:00 Thứ hai đến trước 18:00:00 Thứ bảy: tuần đang chạy.
 * - Từ 18:00:00 Thứ bảy đến 23:59:59 Chủ nhật: tuần sau (Thứ hai – Chủ nhật kế tiếp).
 */
export function getTuanHienThiLichRanh(baseDate: Date = nowVN()): TuanLamViec {
  const dayOfWeek = baseDate.getDay(); // 0 = CN, 1 = T2, ..., 6 = T7
  const switchSeconds =
    LICH_RANH_CHUYEN_TUAN.hour * 3600 +
    LICH_RANH_CHUYEN_TUAN.minute * 60 +
    LICH_RANH_CHUYEN_TUAN.second;
  const currentSeconds =
    baseDate.getHours() * 3600 +
    baseDate.getMinutes() * 60 +
    baseDate.getSeconds();

  const isAfterSwitchover =
    dayOfWeek === 0 ||
    (dayOfWeek === LICH_RANH_CHUYEN_TUAN.dayOfWeek && currentSeconds >= switchSeconds);

  let offsetToMonday: number;
  if (dayOfWeek === 0) {
    offsetToMonday = 1;
  } else if (isAfterSwitchover) {
    offsetToMonday = 1 - dayOfWeek + 7;
  } else {
    offsetToMonday = 1 - dayOfWeek;
  }

  const monday = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate() + offsetToMonday
  );

  return buildTuanLamViecFromMonday(monday);
}

/**
 * Tạo Date từ ngày ("YYYY-MM-DD") và giờ ("HH:mm" hoặc "HH:mm:ss") để đồng bộ đồng hồ với server.
 */
export function parseDateTimeVN(ngayYmd: string, gioHms: string): Date | null {
  const dm = ngayYmd.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = gioHms.trim().match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!dm || !tm) return null;
  return new Date(
    Number(dm[1]),
    Number(dm[2]) - 1,
    Number(dm[3]),
    Number(tm[1]),
    Number(tm[2]),
    Number(tm[3] ?? "0"),
  );
}

/**
 * Dịch chuyển Date thêm một khoảng mili-giây.
 */
export function addMillisecondsVN(base: Date, offsetMs: number): Date {
  return new Date(base.getTime() + offsetMs);
}

/**
 * Dịch chuyển Date theo lịch Việt Nam thêm `days` ngày (có thể âm).
 */
export function addDaysVN(base: Date, days: number): Date {
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate() + days,
    base.getHours(),
    base.getMinutes(),
    base.getSeconds(),
    base.getMilliseconds()
  );
}

