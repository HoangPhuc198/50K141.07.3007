import { z } from "zod";
import { formatDateVN, nowVN } from "@backend/lib/time";

const DATE_YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_YYYY_MM = /^(\d{4})-(\d{2})$/;
const MONTH_MM_YYYY = /^(\d{2})\/(\d{4})$/;

function isValidIsoDate(val: string): boolean {
  if (!DATE_YYYY_MM_DD.test(val)) return false;
  const [y, m, d] = val.split("-").map((n) => parseInt(n, 10));
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function parseMonthParam(
  raw: string
): { year: number; month: number; label: string } | null {
  const trimmed = raw.trim();
  const iso = trimmed.match(MONTH_YYYY_MM);
  if (iso) {
    const year = parseInt(iso[1], 10);
    const month = parseInt(iso[2], 10);
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      return {
        year,
        month,
        label: `${String(month).padStart(2, "0")}/${year}`,
      };
    }
    return null;
  }
  const vn = trimmed.match(MONTH_MM_YYYY);
  if (vn) {
    const month = parseInt(vn[1], 10);
    const year = parseInt(vn[2], 10);
    if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
      return {
        year,
        month,
        label: `${String(month).padStart(2, "0")}/${year}`,
      };
    }
    return null;
  }
  return null;
}

export const baoCaoChamCongQuerySchema = z
  .object({
    ngay: z
      .string()
      .trim()
      .optional()
      .refine((v) => v === undefined || v === "" || isValidIsoDate(v), {
        message: "Ngày báo cáo không hợp lệ (YYYY-MM-DD)",
      }),
    thang: z
      .string()
      .trim()
      .optional()
      .refine((v) => v === undefined || v === "" || parseMonthParam(v) !== null, {
        message: "Tháng báo cáo không hợp lệ (YYYY-MM hoặc MM/YYYY)",
      }),
    manv: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.toUpperCase() : undefined)),
    page: z
      .string()
      .optional()
      .transform((v) => {
        const n = v ? parseInt(v, 10) : 1;
        return Number.isFinite(n) && n >= 1 ? n : 1;
      }),
    limit: z
      .string()
      .optional()
      .transform((v) => {
        const n = v ? parseInt(v, 10) : 50;
        return Number.isFinite(n) ? Math.min(100, Math.max(1, n)) : 50;
      }),
  })
  .superRefine((data, ctx) => {
    const hasNgay = Boolean(data.ngay && data.ngay.length > 0);
    const hasThang = Boolean(data.thang && data.thang.length > 0);
    if (hasNgay && hasThang) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Chỉ chọn xem theo ngày hoặc theo tháng, không truyền đồng thời",
      });
    }
  })
  .transform((data) => {
    const hasThang = Boolean(data.thang && data.thang.length > 0);
    if (hasThang) {
      const parsed = parseMonthParam(data.thang!)!;
      return {
        mode: "thang" as const,
        year: parsed.year,
        month: parsed.month,
        thangLabel: parsed.label,
        manv: data.manv,
        page: data.page,
        limit: data.limit,
      };
    }
    const ngay = data.ngay && data.ngay.length > 0 ? data.ngay : formatDateVN(nowVN());
    return {
      mode: "ngay" as const,
      ngay,
      manv: data.manv,
      page: data.page,
      limit: data.limit,
    };
  });

export type BaoCaoChamCongQuery = z.infer<typeof baoCaoChamCongQuerySchema>;
