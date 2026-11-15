import { createApiHandler, successResponse, errorResponse } from "@backend/lib/api";
import { tongHopKy, TinhLuongError } from "@backend/services/tinh-luong";

/**
 * GET /api/ky-luong/:id/tong-hop
 * Dữ liệu từng nhân viên của kỳ (UC_8.2) — chỉ Chủ quán.
 */
export const GET = createApiHandler(
  async (_req, ctx) => {
    try {
      return successResponse(await tongHopKy(String(ctx.params.id ?? "")));
    } catch (err) {
      if (err instanceof TinhLuongError) return errorResponse(err.message, err.code, err.statusCode);
      throw err;
    }
  },
  { requiredRole: "ChuQuan" }
);
