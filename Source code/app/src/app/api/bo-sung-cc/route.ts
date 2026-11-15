import { createApiHandler, successResponse } from "@backend/lib/api";
import { createBoSungCCSchema } from "@backend/validators/bo-sung-cc";
import { guiYeuCauBoSungCC } from "@backend/services/bo-sung-cc";

export const POST = createApiHandler(
  async (_req, { user, body }) => {
    const result = await guiYeuCauBoSungCC(user!.userId, body);
    return successResponse(result, 201);
  },
  {
    requiredRole: "NhanVien",
    bodySchema: createBoSungCCSchema,
  }
);
