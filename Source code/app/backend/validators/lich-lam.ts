import { z } from "zod";
import { DANG_KY_LICH_RANH_CHUA_CHON } from "@frontend/config/thong-bao";
import { isValidIsoDate } from "@frontend/lib/dinh-dang";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const validDateMsg = "Ngày không hợp lệ theo lịch";

/**
 * UC 2.1: Đăng ký lịch rảnh
 */
export const dangKyLichRanhSchema = z.object({
  startDate: z
    .string()
    .regex(dateRegex, "Ngày bắt đầu không đúng định dạng YYYY-MM-DD")
    .refine(isValidIsoDate, validDateMsg),
  endDate: z
    .string()
    .regex(dateRegex, "Ngày kết thúc không đúng định dạng YYYY-MM-DD")
    .refine(isValidIsoDate, validDateMsg),
  danhSach: z.array(
    z.object({
      ngay: z
        .string()
        .regex(dateRegex, "Ngày rảnh không đúng định dạng YYYY-MM-DD")
        .refine(isValidIsoDate, validDateMsg),
      maCa: z.string().length(8, "Mã ca phải đúng 8 ký tự"),
    })
  ).min(1, DANG_KY_LICH_RANH_CHUA_CHON),
});

export type DangKyLichRanhInput = z.infer<typeof dangKyLichRanhSchema>;

/**
 * UC 6.1: Xếp lịch làm
 */
export const xepLichLamSchema = z.object({
  cacNgay: z
    .array(
      z
        .string()
        .regex(dateRegex, "Ngày không đúng định dạng YYYY-MM-DD")
        .refine(isValidIsoDate, validDateMsg)
    )
    .min(1, "Vui lòng chọn ít nhất một ngày"),
  nhanVienTheoNgay: z.record(z.string(), z.array(z.string())).optional(),
});

export type XepLichLamInput = z.infer<typeof xepLichLamSchema>;

/**
 * UC 6.2: Xếp ca làm
 */
export const xepCaLamSchema = z.object({
  ngay: z
    .string()
    .regex(dateRegex, "Ngày không đúng định dạng YYYY-MM-DD")
    .refine(isValidIsoDate, validDateMsg),
  phanCong: z.array(
    z.object({
      maCa: z.string().length(8, "Mã ca phải đúng 8 ký tự"),
      nhanVienIds: z.array(z.string().length(8, "Mã nhân viên phải đúng 8 ký tự")),
    })
  ),
});

export type XepCaLamInput = z.infer<typeof xepCaLamSchema>;
