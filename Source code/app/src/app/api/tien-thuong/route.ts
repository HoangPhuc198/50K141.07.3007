import { createApiHandler, successResponse, errorResponse } from "@backend/lib/api";
import {
  getNhanVienTienThuongList,
  saveTienThuong,
  TienThuongError,
} from "@backend/services/tien-thuong";

/**
 * GET /api/tien-thuong
 * Lấy danh sách kỳ lương và danh sách nhân viên để nhập thưởng (UC 8.5)
 * Query: ?makyluong=...
 */
export const GET = createApiHandler(
  async (req) => {
    const url = new URL(req.url);
    const makyluong = url.searchParams.get("makyluong") || undefined;
    const data = await getNhanVienTienThuongList(makyluong);
    return successResponse(data);
  },
  { requiredRole: "ChuQuan" }
);

/**
 * POST /api/tien-thuong
 * Nhập / lưu tiền thưởng cho nhân viên trong kỳ lương (UC 8.5)
 */
export const POST = createApiHandler(
  async (req, ctx) => {
    const body = (ctx.body ?? (await req.json().catch(() => ({})))) as {
      Makyluong?: string;
      Manv?: string;
      Tienthuong?: number | string;
      Lydothuong?: string;
    };

    if (!body || !body.Makyluong || !body.Manv) {
      return errorResponse("Thiếu thông tin kỳ lương hoặc nhân viên", "BAD_REQUEST", 400);
    }

    try {
      const result = await saveTienThuong({
        Makyluong: body.Makyluong,
        Manv: body.Manv,
        Tienthuong: body.Tienthuong ?? 0,
        Lydothuong: body.Lydothuong ?? "",
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

/**
 * PUT /api/tien-thuong
 * Cập nhật tiền thưởng
 */
export const PUT = POST;
