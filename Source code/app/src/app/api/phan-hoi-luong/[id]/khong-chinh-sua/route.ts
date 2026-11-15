import { createApiHandler, errorResponse, successResponse } from "@backend/lib/api";
import { khongChinhSuaPhanHoi } from "@backend/services/chinh-sua-luong";

/**
 * POST /api/phan-hoi-luong/:id/khong-chinh-sua
 * Đánh dấu phản hồi lương đã xử lý mà không sửa bảng lương (UC_8.3 nhánh thay thế 5a).
 */
export const POST = createApiHandler(
  async (_req, ctx) => {
    const id = String(ctx.params.id ?? "").trim();
    if (!id) {
      return errorResponse("Thiếu mã phản hồi.", "BAD_REQUEST", 400);
    }
    const data = await khongChinhSuaPhanHoi(id);
    return successResponse(data);
  },
  { requiredRole: "ChuQuan" }
);
