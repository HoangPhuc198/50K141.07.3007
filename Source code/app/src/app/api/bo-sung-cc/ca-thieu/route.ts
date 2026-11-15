import { createApiHandler, successResponse } from "@backend/lib/api";
import { layCaThieuChamCong } from "@backend/services/bo-sung-cc";

export const GET = createApiHandler(
  async (_req, { user }) => {
    const items = await layCaThieuChamCong(user!.userId);
    return successResponse({ items });
  },
  { requiredRole: "NhanVien" }
);
