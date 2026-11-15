import { createApiHandler, successResponse, errorResponse } from "@backend/lib/api";
import { getHeSoList, saveHeSo, deleteHeSo, HeSoError } from "@backend/services/he-so";

/**
 * GET /api/he-so
 * Danh sách khoảng áp dụng hệ số lương (UC 8.4)
 */
export const GET = createApiHandler(
  async () => {
    const list = await getHeSoList();
    return successResponse(list);
  },
  { requiredRole: "ChuQuan" }
);

/**
 * POST /api/he-so
 * Thêm hoặc cập nhật khoảng áp dụng hệ số lương (UC 8.4)
 */
export const POST = createApiHandler(
  async (req, ctx) => {
    const body = (ctx.body ?? (await req.json().catch(() => ({})))) as {
      Maheso?: string;
      Ngaybatdau?: string;
      Ngayketthuc?: string;
      Heso?: number | string;
    };

    if (!body || !body.Ngaybatdau || !body.Ngayketthuc || body.Heso === undefined) {
      return errorResponse("Vui lòng nhập đầy đủ thông tin", "BAD_REQUEST", 400);
    }

    try {
      const saved = await saveHeSo({
        Maheso: body.Maheso,
        Ngaybatdau: body.Ngaybatdau,
        Ngayketthuc: body.Ngayketthuc,
        Heso: body.Heso,
      });
      return successResponse(saved);
    } catch (err) {
      if (err instanceof HeSoError) {
        return errorResponse(err.message, err.code, err.statusCode);
      }
      throw err;
    }
  },
  { requiredRole: "ChuQuan" }
);

/**
 * DELETE /api/he-so
 * Xóa khoảng áp dụng hệ số lương (UC 8.4)
 * Hỗ trợ nhận id qua query (?id=...) hoặc body ({ Maheso: ... })
 */
export const DELETE = createApiHandler(
  async (req, ctx) => {
    const url = new URL(req.url);
    const queryId = url.searchParams.get("id");
    const body = (ctx.body ?? (await req.json().catch(() => ({})))) as { Maheso?: string; id?: string };
    const maheso = queryId || body?.Maheso || body?.id;

    if (!maheso) {
      return errorResponse("Thiếu mã hệ số cần xóa", "BAD_REQUEST", 400);
    }

    try {
      await deleteHeSo(maheso);
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
