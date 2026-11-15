import { createApiHandler, successResponse, errorResponse } from "@backend/lib/api";
import {
  updateTienThuongByBangLuongId,
  TienThuongError,
} from "@backend/services/tien-thuong";

/**
 * PUT /api/bang-luong/:id/thuong
 * Nhập tiền thưởng theo mã bảng lương (UC 8.5)
 */
export const PUT = createApiHandler(
  async (req, ctx) => {
    const id = ctx.params.id as string;
    const body = (ctx.body ?? (await req.json().catch(() => ({})))) as {
      Tienthuong?: number | string;
      Lydothuong?: string;
    };

    if (!id) {
      return errorResponse("Thiếu mã bảng lương", "BAD_REQUEST", 400);
    }

    try {
      const result = await updateTienThuongByBangLuongId(id, {
        Tienthuong: body?.Tienthuong ?? 0,
        Lydothuong: body?.Lydothuong ?? "",
      });
      return successResponse(result);
    } catch (err) {
      if (err instanceof TienThuongError) {
        return errorResponse(err.message, err.code, err.statusCode);
      }
      throw err;
    }
  },
  { requiredRole: "ChuQuan" }
);
