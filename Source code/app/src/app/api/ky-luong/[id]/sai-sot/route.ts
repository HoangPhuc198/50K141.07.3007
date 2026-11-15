import { createApiHandler, errorResponse, successResponse } from "@backend/lib/api";
import { layChiTietSaiSotKy } from "@backend/services/chinh-sua-luong";

/**
 * GET /api/ky-luong/:id/sai-sot
 * Lấy danh sách yêu cầu phản hồi sai sót và chi tiết bảng lương của kỳ :id (UC_8.3).
 */
export const GET = createApiHandler(
  async (_req, ctx) => {
    const id = String(ctx.params.id ?? "").trim();
    if (!id) {
      return errorResponse("Thiếu mã kỳ lương.", "BAD_REQUEST", 400);
    }
    const data = await layChiTietSaiSotKy(id);
    return successResponse(data);
  },
  { requiredRole: "ChuQuan" }
);
