import { z } from "zod";

export const LoginSchema = z.object({
  username: z
    .string({ required_error: "Không được để trống" })
    .trim()
    .min(1, "Không được để trống"),
  password: z
    .string({ required_error: "Không được để trống" })
    .min(1, "Không được để trống"),
});

export type LoginInput = z.infer<typeof LoginSchema>;
