import { createApiHandler, successResponse, errorResponse } from "@backend/lib/api";
import { getTuanLamViec } from "@backend/lib/time";
import { xepLichLamSchema, XepLichLamInput } from "@backend/validators/lich-lam";
import {
  layDuLieuXepLich,
  luuXepLich,
  LichLamServiceError,
} from "@backend/services/lich-lam";

export const GET = createApiHandler(
  async (req) => {
    const url = new URL(req.url);
    const defaultWeek = getTuanLamViec();
    const startDate = url.searchParams.get("startDate") || url.searchParams.get("start") || defaultWeek.startDate;
    const endDate = url.searchParams.get("endDate") || url.searchParams.get("end") || defaultWeek.endDate;

    const data = await layDuLieuXepLich(startDate, endDate);
    return successResponse(data);
  },
  { requiredRole: "ChuQuan" }
);

export const POST = createApiHandler<unknown, XepLichLamInput>(
  async (_req, ctx) => {
    try {
      const result = await luuXepLich(ctx.body);
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
    bodySchema: xepLichLamSchema,
  }
);
