import { createApiHandler, successResponse } from "@backend/lib/api";
import { layCaCuaToi } from "@backend/services/doi-ca";

export const GET = createApiHandler(
  async (_req, { user }) => {
    const items = await layCaCuaToi(user!.userId);
    return successResponse({ items });
  },
  { requiredRole: "NhanVien" }
);
