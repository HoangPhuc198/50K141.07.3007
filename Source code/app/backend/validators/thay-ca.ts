import { z } from "zod";

export const createThayCaSchema = z.object({
  malich: z.string().trim().min(1, "Vui lòng chọn ca làm cần nghỉ gấp."),
  lyDo: z
    .string()
    .trim()
    .max(200, "Lý do xin nghỉ tối đa 200 ký tự.")
    .optional()
    .default(""),
});

export type CreateThayCaInput = z.infer<typeof createThayCaSchema>;
