import { createApiHandler, successResponse } from "@backend/lib/api";
import { createThayCaSchema } from "@backend/validators/thay-ca";
import { taoYeuCauThayCa } from "@backend/services/thay-ca";

export const POST = createApiHandler(
  async (_req, { user, body }) => {
    const result = await taoYeuCauThayCa(user!.userId, {
      malich: body.malich,
      lyDo: body.lyDo ?? "",
    });
    return successResponse(result, 201);
  },
  {
    requiredRole: "NhanVien",
    bodySchema: createThayCaSchema,
  }
);
