import { createApiHandler, successResponse, errorResponse } from "@backend/lib/api";
import { getTuanLamViec } from "@backend/lib/time";
import { xepCaLamSchema, XepCaLamInput } from "@backend/validators/lich-lam";
import {
  layDuLieuXepCa,
  luuXepCa,
  LichLamServiceError,
} from "@backend/services/lich-lam";

export const GET = createApiHandler(
  async (req) => {
    const url = new URL(req.url);
    const defaultWeek = getTuanLamViec();
    const ngay = url.searchParams.get("ngay") || defaultWeek.startDate;

    const data = await layDuLieuXepCa(ngay);
    return successResponse(data);
  },
  { requiredRole: "ChuQuan" }
);

export const POST = createApiHandler<unknown, XepCaLamInput>(
  async (_req, ctx) => {
    try {
      const result = await luuXepCa(ctx.body);
      return successResponse(result);
    } catch (err) {
      if (err instanceof LichLamServiceError) {
        return errorResponse(err.message, err.code, err.statusCode);
      }
      throw err;
    }
  },
  {
    requiredRole: "ChuQuan",
    bodySchema: xepCaLamSchema,
  }
);

export const PUT = POST;
