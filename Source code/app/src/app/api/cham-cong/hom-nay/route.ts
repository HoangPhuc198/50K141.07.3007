import { createApiHandler, successResponse, errorResponse } from "@backend/lib/api";
import {
  layCaHomNayCuaNhanVien,
  ChamCongServiceError,
} from "@backend/services/cham-cong";

export const GET = createApiHandler(
  async (_req, ctx) => {
    try {
      const data = await layCaHomNayCuaNhanVien(ctx.user!.userId);
      return successResponse(data);
    } catch (err) {
      if (err instanceof ChamCongServiceError) {
        return errorResponse(err.message, err.code, err.statusCode);
      }
      throw err;
    }
  },
  { requiredRole: "NhanVien" }
);
