import { createApiHandler, successResponse } from "@backend/lib/api";
import { chapNhanThayCa } from "@backend/services/thay-ca";

export const POST = createApiHandler(
  async (_req, { user, params }) => {
    const id = String(params.id || "");
    const result = await chapNhanThayCa(id, user!.userId);
    return successResponse(result);
  },
  {
    requiredRole: "NhanVien",
  }
);
