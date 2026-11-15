import { createApiHandler, errorResponse, successResponse } from "@backend/lib/api";
import { chinhSuaBangLuong } from "@backend/services/chinh-sua-luong";

/**
 * PUT /api/bang-luong/:id
 * Chủ quán chỉnh sửa giờ vào/ra, hệ số, tiền thưởng (không sửa mức lương giờ) (UC_8.3).
 */
export const PUT = createApiHandler(
  async (req, ctx) => {
    const id = String(ctx.params.id ?? "").trim();
    if (!id) {
      return errorResponse("Thiếu mã bảng lương.", "BAD_REQUEST", 400);
    }
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return errorResponse("Dữ liệu gửi lên không đúng định dạng JSON.", "INVALID_JSON", 400);
    }
    const data = await chinhSuaBangLuong(id, rawBody);
    return successResponse(data);
  },
  { requiredRole: "ChuQuan" }
);
