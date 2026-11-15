import { createApiHandler, successResponse, errorResponse } from "@backend/lib/api";
import { xemTruocTinhLuong, TinhLuongError } from "@backend/services/tinh-luong";

/**
 * POST /api/ky-luong/:id/tinh
 * XEM TRƯỚC tiền lương cả kỳ (UC_8.2) — chỉ Chủ quán, KHÔNG ghi CSDL.
 */
export const POST = createApiHandler(
  async (_req, ctx) => {
    try {
      return successResponse(await xemTruocTinhLuong(String(ctx.params.id ?? "")));
    } catch (err) {
      if (err instanceof TinhLuongError) return errorResponse(err.message, err.code, err.statusCode);
      throw err;
    }
  },
  { requiredRole: "ChuQuan" }
);
