import { createApiHandler, successResponse } from "@backend/lib/api";
import { layCaTrongNgayChoThayCa } from "@backend/services/thay-ca";

export const GET = createApiHandler(
  async (_req, { user }) => {
    const result = await layCaTrongNgayChoThayCa(user!.userId);
    return successResponse(result);
  },
  {
    requiredRole: "NhanVien",
  }
);
