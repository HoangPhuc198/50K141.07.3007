import { createApiHandler, successResponse, errorResponse } from "@backend/lib/api";
import { chotBangLuong, ChotLuongError } from "@backend/services/chot-luong";

/**
 * POST /api/ky-luong/:id/chot
 * Chốt bảng lương kỳ :id (UC_8.6) — chỉ ChuQuan.
 * Chặn nếu kỳ không ở "Dự kiến" hoặc còn phản hồi chưa xử lý.
 */
export const POST = createApiHandler(
  async (_req, ctx) => {
    try {
      const result = await chotBangLuong(String(ctx.params.id ?? ""));
      return successResponse(result);
    } catch (err) {
      if (err instanceof ChotLuongError) {
        return errorResponse(err.message, err.code, err.statusCode);
      }
      throw err;
    }
  },
  { requiredRole: "ChuQuan" }
);
