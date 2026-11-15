import { createApiHandler, successResponse, errorResponse } from "@backend/lib/api";
import { deleteHeSo, HeSoError } from "@backend/services/he-so";

/**
 * DELETE /api/he-so/:id
 * Xóa khoảng áp dụng hệ số lương theo mã (UC 8.4)
 */
export const DELETE = createApiHandler(
  async (_req, ctx) => {
    const id = ctx.params.id as string;
    if (!id) {
      return errorResponse("Thiếu mã hệ số cần xóa", "BAD_REQUEST", 400);
    }

    try {
      await deleteHeSo(id);
      return successResponse({ message: "Đã xóa khoảng áp dụng" });
    } catch (err) {
      if (err instanceof HeSoError) {
        return errorResponse(err.message, err.code, err.statusCode);
      }
      throw err;
    }
  },
  { requiredRole: "ChuQuan" }
);
