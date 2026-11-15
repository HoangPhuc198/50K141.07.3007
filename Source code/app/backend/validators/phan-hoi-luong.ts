import { z } from "zod";
import { PHAN_HOI_LUONG_THIEU_NOI_DUNG } from "@frontend/config/thong-bao";

export const createPhanHoiLuongSchema = z.object({
  mabangluong: z
    .string()
    .trim()
    .length(8, "Mã bảng lương phải gồm đúng 8 ký tự")
    .optional(),
  noidung: z
    .string({ required_error: PHAN_HOI_LUONG_THIEU_NOI_DUNG })
    .trim()
    .min(1, PHAN_HOI_LUONG_THIEU_NOI_DUNG)
    .max(500, "Nội dung phản hồi tối đa 500 ký tự"),
});

export type CreatePhanHoiLuongInput = z.infer<typeof createPhanHoiLuongSchema>;
