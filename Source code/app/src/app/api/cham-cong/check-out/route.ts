import { createApiHandler, successResponse, errorResponse } from "@backend/lib/api";
import { checkOutSchema, CheckOutInput } from "@backend/validators/cham-cong";
import {
  thucHienCheckOut,
  ChamCongServiceError,
} from "@backend/services/cham-cong";

export const POST = createApiHandler<unknown, CheckOutInput>(
  async (_req, ctx) => {
    try {
      const result = await thucHienCheckOut(
        ctx.user!.userId,
        ctx.body?.tangCa ?? false,
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
    bodySchema: checkOutSchema,
  }
);
