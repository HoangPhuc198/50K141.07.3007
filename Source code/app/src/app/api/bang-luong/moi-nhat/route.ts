import { z } from "zod";
import { createApiHandler, errorResponse, successResponse } from "@backend/lib/api";
import { layBangLuongMoiNhat } from "@backend/services/xem-bang-luong";

const querySchema = z.object({
  trang: z.coerce.number().int().min(1).default(1),
  soDong: z.coerce.number().int().min(1).max(50).default(6),
});

/**
 * GET /api/bang-luong/moi-nhat?trang=&soDong=
 * Trả bảng lương kỳ gần nhất ("Dự kiến" hoặc "Đã chốt") của chính nhân viên đang đăng nhập (UC_4.1).
 */
export const GET = createApiHandler(
  async (req, ctx) => {
    const url = new URL(req.url);
    if (
      url.searchParams.has("makyluong") ||
      url.searchParams.has("Makyluong") ||
      url.searchParams.has("thang") ||
      url.searchParams.has("nam") ||
      url.searchParams.has("kyLuong") ||
      url.searchParams.has("mabangluong")
    ) {
      return errorResponse(
        "Chỉ được xem bảng lương kỳ gần nhất.",
        "FORBIDDEN_PERIOD",
        400
      );
    }
    const parsed = querySchema.safeParse({
      trang: url.searchParams.get("trang") ?? undefined,
      soDong: url.searchParams.get("soDong") ?? undefined,
    });

    if (!parsed.success) {
      return errorResponse("Tham số phân trang không hợp lệ.", "VALIDATION_ERROR", 400);
    }

    const data = await layBangLuongMoiNhat(ctx.user!.userId, parsed.data.trang, parsed.data.soDong);
    return successResponse(data);
  },
  { requiredRole: "NhanVien" }
);
