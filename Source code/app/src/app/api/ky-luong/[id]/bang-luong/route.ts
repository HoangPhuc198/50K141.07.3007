import { createApiHandler, successResponse, errorResponse } from "@backend/lib/api";
import { layDuLieuChotBangLuong, ChotLuongError } from "@backend/services/chot-luong";

/**
 * GET /api/ky-luong/:id/bang-luong
 * Lấy dữ liệu bảng lương dự kiến/đã chốt cho màn hình Chốt bảng lương (UC_8.6 · U29).
 * Chỉ ChuQuan.
 */
export const GET = createApiHandler(
  async (_req, ctx) => {
    try {
      const data = await layDuLieuChotBangLuong(String(ctx.params.id ?? ""));
      return successResponse(data);
    } catch (err) {
      if (err instanceof ChotLuongError) {
        return errorResponse(err.message, err.code, err.statusCode);
      }
      throw err;
    }
  },
  { requiredRole: "ChuQuan" }
);
