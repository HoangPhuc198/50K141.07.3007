import { createApiHandler, successResponse, errorResponse } from "@backend/lib/api";
import { checkInSchema, CheckInInput } from "@backend/validators/cham-cong";
import {
  thucHienCheckIn,
  ChamCongServiceError,
} from "@backend/services/cham-cong";

export const POST = createApiHandler<unknown, CheckInInput>(
  async (_req, ctx) => {
    try {
      const result = await thucHienCheckIn(
        ctx.user!.userId,
        ctx.body?.malich
      );
      return successResponse(result);
    } catch (err) {
      if (err instanceof ChamCongServiceError) {
        return errorResponse(err.message, err.code, err.statusCode);
      }
      throw err;
    }
  },
  {
    requiredRole: "NhanVien",
    bodySchema: checkInSchema,
  }
);
