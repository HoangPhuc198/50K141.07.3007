import { z } from "zod";
import { THEM_NV_THIEU_TRUONG } from "@frontend/config/thong-bao";
import { isValidIsoDate } from "@frontend/lib/dinh-dang";

export const CreateNhanVienSchema = z.object({
  Hoten: z
    .string({ required_error: THEM_NV_THIEU_TRUONG })
    .trim()
    .min(1, THEM_NV_THIEU_TRUONG),
  Sdt: z
    .string({ required_error: THEM_NV_THIEU_TRUONG })
    .trim()
    .regex(/^0[0-9]{9}$/, "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0"),
  Diachi: z
    .string({ required_error: THEM_NV_THIEU_TRUONG })
    .trim()
    .min(1, THEM_NV_THIEU_TRUONG),
  Truonghoc: z.string().trim().optional().nullable(),
  Vitrilamviec: z.enum(["Phục vụ", "Pha chế"], {
    errorMap: () => ({ message: THEM_NV_THIEU_TRUONG }),
  }),
  Hinhthuclam: z.enum(["Part-time", "Full-time"], {
    errorMap: () => ({ message: THEM_NV_THIEU_TRUONG }),
  }),
  Ngayvaolam: z
    .string({ required_error: THEM_NV_THIEU_TRUONG })
    .min(1, THEM_NV_THIEU_TRUONG)
    .refine((val) => isValidIsoDate(val), "Ngày vào làm không hợp lệ theo lịch"),
  Kinhnghiem: z
    .string({ required_error: THEM_NV_THIEU_TRUONG })
    .trim()
    .min(1, THEM_NV_THIEU_TRUONG),
  Trangthai: z.string().default("Thử việc"),
  Mucluongtheogio: z.unknown().optional(),
});

export type CreateNhanVienInput = z.infer<typeof CreateNhanVienSchema>;

export const UpdateNhanVienSchema = z.object({
  Hoten: z
    .string({ required_error: THEM_NV_THIEU_TRUONG })
    .trim()
    .min(1, THEM_NV_THIEU_TRUONG),
  Sdt: z
    .string({ required_error: THEM_NV_THIEU_TRUONG })
    .trim()
    .regex(/^0[0-9]{9}$/, "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0"),
  Diachi: z
    .string({ required_error: THEM_NV_THIEU_TRUONG })
    .trim()
    .min(1, THEM_NV_THIEU_TRUONG),
  Truonghoc: z.string().trim().optional().nullable(),
  Vitrilamviec: z.enum(["Phục vụ", "Pha chế"], {
    errorMap: () => ({ message: THEM_NV_THIEU_TRUONG }),
  }),
  Hinhthuclam: z.enum(["Part-time", "Full-time"], {
    errorMap: () => ({ message: THEM_NV_THIEU_TRUONG }),
  }),
  Ngayvaolam: z
    .string({ required_error: THEM_NV_THIEU_TRUONG })
    .min(1, THEM_NV_THIEU_TRUONG)
    .refine((val) => isValidIsoDate(val), "Ngày vào làm không hợp lệ theo lịch"),
  Kinhnghiem: z
    .string({ required_error: THEM_NV_THIEU_TRUONG })
    .trim()
    .min(1, THEM_NV_THIEU_TRUONG),
  Trangthai: z.enum(["Thử việc", "Chính thức"], {
    errorMap: () => ({ message: THEM_NV_THIEU_TRUONG }),
  }).optional(),
  Matkhau: z.string().optional(),
});

export type UpdateNhanVienInput = z.infer<typeof UpdateNhanVienSchema>;
