import { createApiHandler, successResponse } from "@backend/lib/api";
import { getThongBaoTheoPhien } from "@backend/services/thong-bao";

export const GET = createApiHandler(
  async (_req, { user }) => {
    const data = await getThongBaoTheoPhien(user!);
    return successResponse(data);
  },
  {
    requireAuth: true,
  }
);
