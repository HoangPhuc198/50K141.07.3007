import { createApiHandler, successResponse } from "@backend/lib/api";
import { layYeuCauThayCaDangMo } from "@backend/services/thay-ca";

export const GET = createApiHandler(
  async (_req, { user }) => {
    const result = await layYeuCauThayCaDangMo(user!.userId);
    return successResponse(result);
  },
  {
    requiredRole: "NhanVien",
  }
);
