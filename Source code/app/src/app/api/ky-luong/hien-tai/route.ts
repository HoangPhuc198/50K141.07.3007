import { createApiHandler, successResponse, errorResponse } from "@backend/lib/api";
import { layKyHienTai, TinhLuongError } from "@backend/services/tinh-luong";

/**
 * GET /api/ky-luong/hien-tai
 * Kỳ lương đang xử lý, ngày chi trả dự kiến, trạng thái, cờ kỳ cuối năm (UC_8.2) — chỉ Chủ quán.
 */
export const GET = createApiHandler(
  async () => {
    try {
      return successResponse(await layKyHienTai());
    } catch (err) {
      if (err instanceof TinhLuongError) return errorResponse(err.message, err.code, err.statusCode);
      throw err;
    }
  },
  { requiredRole: "ChuQuan" }
);
