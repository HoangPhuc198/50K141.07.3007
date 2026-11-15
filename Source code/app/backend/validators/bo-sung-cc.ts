import { z } from "zod";
import { BO_SUNG_CC_THIEU_TRUONG } from "@frontend/config/thong-bao";

const HH_MM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const createBoSungCCSchema = z.object({
  malich: z
    .string({ required_error: BO_SUNG_CC_THIEU_TRUONG })
    .trim()
    .min(1, BO_SUNG_CC_THIEU_TRUONG)
    .length(8, "Mã lịch làm phải gồm đúng 8 ký tự"),
  loaiYeuCau: z.enum(["Quên check-out", "Quên check-in"]).optional(),
  giovaobosung: z
    .string()
    .trim()
    .refine((val) => val === "" || HH_MM_REGEX.test(val), {
      message: "Giờ vào không hợp lệ (HH:mm)",
    })
    .nullable()
    .optional(),
  giorabosung: z
    .string({ required_error: BO_SUNG_CC_THIEU_TRUONG })
    .trim()
    .min(1, BO_SUNG_CC_THIEU_TRUONG)
    .regex(HH_MM_REGEX, "Giờ kết thúc không hợp lệ (HH:mm)"),
  lydo: z
    .string({ required_error: BO_SUNG_CC_THIEU_TRUONG })
    .trim()
    .min(1, BO_SUNG_CC_THIEU_TRUONG)
    .max(200, "Lý do tối đa 200 ký tự"),
});

export type CreateBoSungCCInput = z.infer<typeof createBoSungCCSchema>;

export const xuLyBoSungCCSchema = z.object({
  mayeucau: z
    .string({ required_error: BO_SUNG_CC_THIEU_TRUONG })
    .trim()
    .min(1, BO_SUNG_CC_THIEU_TRUONG)
    .length(8, "Mã yêu cầu phải gồm đúng 8 ký tự"),
  giovaobosung: z
    .string()
    .trim()
    .refine((val) => val === "" || HH_MM_REGEX.test(val), {
      message: "Giờ bắt đầu không hợp lệ (HH:mm)",
    })
    .nullable()
    .optional(),
  giorabosung: z
    .string({ required_error: BO_SUNG_CC_THIEU_TRUONG })
    .trim()
    .min(1, BO_SUNG_CC_THIEU_TRUONG)
    .regex(HH_MM_REGEX, "Giờ kết thúc không hợp lệ (HH:mm)"),
});

export type XuLyBoSungCCInput = z.infer<typeof xuLyBoSungCCSchema>;
