import { createApiHandler, successResponse } from "@backend/lib/api";
import { getChuQuanTongQuan } from "@backend/services/tong-quan";

export const GET = createApiHandler(
  async () => {
    const data = await getChuQuanTongQuan();
    return successResponse(data);
  },
  {
    requiredRole: "ChuQuan",
  }
);
