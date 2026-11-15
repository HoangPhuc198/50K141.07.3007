import { createApiHandler, errorResponse, successResponse } from "@backend/lib/api";
import { kyLuongListQuerySchema } from "@backend/validators/chinh-sua-luong";
import { layDanhSachKyLuong } from "@backend/services/chinh-sua-luong";

/**
 * GET /api/ky-luong
 * Lấy danh sách kỳ lương có lọc & phân trang cho Chủ quán (UC_8.3).
 */
export const GET = createApiHandler(
  async (req) => {
    const url = new URL(req.url);
    const parsed = kyLuongListQuerySchema.safeParse({
      makyluong: url.searchParams.get("makyluong") ?? undefined,
      thangNam: url.searchParams.get("thangNam") ?? undefined,
      trangthai: url.searchParams.get("trangthai") ?? undefined,
      trang: url.searchParams.get("trang") ?? undefined,
      soDong: url.searchParams.get("soDong") ?? undefined,
    });
    if (!parsed.success) {
      return errorResponse("Tham số lọc kỳ lương không hợp lệ.", "VALIDATION_ERROR", 400);
    }

    const data = await layDanhSachKyLuong(parsed.data);
    return successResponse(data);
  },
  { requiredRole: "ChuQuan" }
);
