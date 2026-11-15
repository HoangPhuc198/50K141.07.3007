import { createApiHandler, successResponse } from "@backend/lib/api";
import { createPhanHoiLuongSchema } from "@backend/validators/phan-hoi-luong";
import {
  guiPhanHoiLuong,
  layThongTinPhanHoiLuong,
} from "@backend/services/phan-hoi-luong";

/**
 * GET /api/phan-hoi-luong
 * Lấy bảng lương kỳ gần nhất của chính nhân viên để hiển thị màn U13 (UC_4.2).
 */
export const GET = createApiHandler(
  async (_req, ctx) => {
    const data = await layThongTinPhanHoiLuong(ctx.user!.userId);
    return successResponse(data);
  },
  { requiredRole: "NhanVien" }
);

/**
 * POST /api/phan-hoi-luong
 * Nhân viên gửi phản hồi sai sót bảng lương (UC_4.2).
 */
export const POST = createApiHandler(
  async (_req, ctx) => {
    const data = await guiPhanHoiLuong(ctx.user!.userId, ctx.body);
    return successResponse(data, 201);
  },
  { requiredRole: "NhanVien", bodySchema: createPhanHoiLuongSchema }
);
