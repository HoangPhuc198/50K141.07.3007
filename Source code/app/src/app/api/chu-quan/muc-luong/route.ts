import { createApiHandler, successResponse, errorResponse } from "@backend/lib/api";
import {
  getNhanVienMucLuongList,
  capNhatMucLuong,
  CapNhatMucLuongError,
} from "@backend/services/cap-nhat-muc-luong";
import { capNhatMucLuongBodySchema } from "@backend/validators/muc-luong";

/**
 * GET /api/chu-quan/muc-luong
 * Danh sách nhân viên với mức lương hiện tại (UC 8.1)
 */
export const GET = createApiHandler(
  async () => {
    const data = await getNhanVienMucLuongList();
    return successResponse(data);
  },
  { requiredRole: "ChuQuan" }
);

/**
 * PUT /api/chu-quan/muc-luong
 * Body: { Manv: string, Mucluongtheogio: number }
 * Cập nhật mức lương nhân viên (UC 8.1)
 */
export const PUT = createApiHandler(
  async (_req, ctx) => {
    const body = ctx.body as { Manv?: string; Mucluongtheogio?: number };
    if (!body.Manv || body.Mucluongtheogio === undefined) {
      return errorResponse("Thiếu Manv hoặc Mucluongtheogio", "BAD_REQUEST", 400);
    }
    const mucMoi = Number(body.Mucluongtheogio);
    if (!Number.isInteger(mucMoi) || mucMoi <= 0) {
      return errorResponse("Mức lương không hợp lệ", "LUONG_KHONG_HOP_LE", 400);
    }
    try {
      const result = await capNhatMucLuong(body.Manv, mucMoi);
      return successResponse(result);
    } catch (err) {
      if (err instanceof CapNhatMucLuongError) {
        return errorResponse(err.message, err.code, err.statusCode);
      }
      throw err;
    }
  },
  { requiredRole: "ChuQuan", bodySchema: capNhatMucLuongBodySchema }
);
