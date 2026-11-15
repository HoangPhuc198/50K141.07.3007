import { z } from "zod";
import { createApiHandler, successResponse, errorResponse } from "@backend/lib/api";
import { chiTietNhanVien, TinhLuongError } from "@backend/services/tinh-luong";

const querySchema = z.object({
  trang: z.coerce.number().int().min(1).default(1),
  soDong: z.coerce.number().int().min(1).max(50).default(6),
});

/**
 * GET /api/ky-luong/:id/nhan-vien/:manv/chi-tiet?trang=&soDong=
 * Chi tiết từng ngày của một nhân viên trong kỳ, phân trang phía máy chủ (UC_8.2) — chỉ Chủ quán.
 */
export const GET = createApiHandler(
  async (req, ctx) => {
    const url = new URL(req.url);
    const q = querySchema.safeParse({
      trang: url.searchParams.get("trang") ?? undefined,
      soDong: url.searchParams.get("soDong") ?? undefined,
    });
    if (!q.success) return errorResponse("Tham số phân trang không hợp lệ.", "VALIDATION_ERROR", 400);
    try {
      const data = await chiTietNhanVien(
        String(ctx.params.id ?? ""),
        String(ctx.params.manv ?? ""),
        q.data.trang,
        q.data.soDong
      );
      return successResponse(data);
    } catch (err) {
      if (err instanceof TinhLuongError) return errorResponse(err.message, err.code, err.statusCode);
      throw err;
    }
  },
  { requiredRole: "ChuQuan" }
);
