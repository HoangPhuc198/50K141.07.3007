import { z } from "zod";

export const capNhatMucLuongBodySchema = z
  .object({
    Manv: z.string().optional(),
    Mucluongtheogio: z.unknown().optional(),
  })
  .passthrough();
