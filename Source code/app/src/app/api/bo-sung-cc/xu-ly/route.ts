import { createApiHandler, successResponse } from "@backend/lib/api";
import { xuLyBoSungCCSchema } from "@backend/validators/bo-sung-cc";
import {
  layDanhSachYeuCauBoSungChuaXuLy,
  xuLyYeuCauBoSungCC,
} from "@backend/services/bo-sung-cc";

export const GET = createApiHandler(
  async (req) => {
    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") || "1");
    const limit = Number(url.searchParams.get("limit") || "50");
    const data = await layDanhSachYeuCauBoSungChuaXuLy(
      Number.isFinite(page) ? page : 1,
      Number.isFinite(limit) ? limit : 50
    );
    return successResponse(data);
  },
  { requiredRole: "ChuQuan" }
);

export const POST = createApiHandler(
  async (_req, { body }) => {
    const result = await xuLyYeuCauBoSungCC(body);
    return successResponse(result);
  },
  {
    requiredRole: "ChuQuan",
    bodySchema: xuLyBoSungCCSchema,
  }
);
