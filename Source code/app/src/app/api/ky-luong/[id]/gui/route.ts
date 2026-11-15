import { createApiHandler, successResponse, errorResponse } from "@backend/lib/api";
import { guiBangLuongDuKien, TinhLuongError } from "@backend/services/tinh-luong";

/**
 * POST /api/ky-luong/:id/gui
 * Lưu bảng lương dự kiến (UC_8.2): tính lại trên máy chủ, một transaction, kỳ → "Dự kiến".
 */
export const POST = createApiHandler(
  async (_req, ctx) => {
    try {
      return successResponse(await guiBangLuongDuKien(String(ctx.params.id ?? "")));
    } catch (err) {
      if (err instanceof TinhLuongError) return errorResponse(err.message, err.code, err.statusCode);
      throw err;
    }
  },
  { requiredRole: "ChuQuan" }
);
