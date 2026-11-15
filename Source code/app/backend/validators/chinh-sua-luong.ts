import { z } from "zod";
import {
  CHINH_SUA_LUONG_THAT_BAI,
  CHINH_SUA_LUONG_THIEU_LY_DO,
  CHINH_SUA_LUONG_THUONG_KHONG_HOP_LE,
} from "@frontend/config/thong-bao";
import { isValidIsoDate } from "@frontend/lib/dinh-dang";

export const kyLuongListQuerySchema = z.object({
  makyluong: z.string().trim().optional(),
  thangNam: z.string().trim().optional(),
  trangthai: z.string().trim().optional(),
  trang: z.coerce.number().int().min(1).default(1),
  soDong: z.coerce.number().int().min(1).max(50).default(6),
});

export const chinhSuaBangLuongSchema = z
  .object({
    maphanhoi: z.string().trim().length(8).optional(),
    machamcong: z.string().trim().length(8).nullable().optional(),
    ngaylam: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(isValidIsoDate, "Ngày làm không hợp lệ theo lịch")
      .optional(),
    giovao: z
      .string({ required_error: CHINH_SUA_LUONG_THAT_BAI })
      .trim()
      .min(1, CHINH_SUA_LUONG_THAT_BAI),
    giora: z
      .string({ required_error: CHINH_SUA_LUONG_THAT_BAI })
      .trim()
      .min(1, CHINH_SUA_LUONG_THAT_BAI),
    heso: z.coerce
      .number({ invalid_type_error: CHINH_SUA_LUONG_THAT_BAI })
      .refine((n) => Number.isFinite(n) && n > 0 && n <= 10, {
        message: "Hệ số lương phải lớn hơn 0",
      }),
    tienthuong: z
      .unknown()
      .refine((val) => {
        if (val === undefined || val === null || val === "") return false;
        const num =
          typeof val === "number"
            ? val
            : typeof val === "string" && /^-?\d+$/.test(val.trim())
              ? Number(val.trim())
              : NaN;
        return Number.isInteger(num) && num >= 0 && num <= 100000000;
      }, CHINH_SUA_LUONG_THUONG_KHONG_HOP_LE)
      .transform((val) =>
        typeof val === "number" ? val : Number(String(val).trim())
      ),
    lydochinhsua: z
      .string({ required_error: CHINH_SUA_LUONG_THIEU_LY_DO })
      .trim()
      .min(1, CHINH_SUA_LUONG_THIEU_LY_DO)
      .max(200, "Lý do chỉnh sửa tối đa 200 ký tự"),
    mucluong: z.unknown().optional(),
    mucluongtheogio: z.unknown().optional(),
    Mucluong: z.unknown().optional(),
    Mucluongtheogio: z.unknown().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.mucluong !== undefined ||
      data.mucluongtheogio !== undefined ||
      data.Mucluong !== undefined ||
      data.Mucluongtheogio !== undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Không được chỉnh sửa mức lương theo giờ",
        path: ["mucluong"],
      });
    }
  });

export type ChinhSuaBangLuongInput = z.infer<typeof chinhSuaBangLuongSchema>;
