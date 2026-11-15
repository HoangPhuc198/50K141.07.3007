import { z } from "zod";

export const checkInSchema = z.object({
  malich: z
    .string()
    .trim()
    .length(8, "Mã lịch làm phải gồm đúng 8 ký tự")
    .optional(),
});

export type CheckInInput = z.infer<typeof checkInSchema>;

export const checkOutSchema = z.object({
  tangCa: z.boolean().optional(),
  malich: z
    .string()
    .trim()
    .length(8, "Mã lịch làm phải gồm đúng 8 ký tự")
    .optional(),
});

export type CheckOutInput = z.infer<typeof checkOutSchema>;
