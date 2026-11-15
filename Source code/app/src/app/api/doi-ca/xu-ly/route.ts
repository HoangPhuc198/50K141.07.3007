import { createApiHandler, successResponse } from "@backend/lib/api";
import { xuLyDoiCaSchema } from "@backend/validators/doi-ca";
import {
  layDanhSachDonDoiCaChuaXuLy,
  xuLyDoiCa,
} from "@backend/services/doi-ca";

export const GET = createApiHandler(
  async () => {
    const items = await layDanhSachDonDoiCaChuaXuLy();
    return successResponse({ items });
  },
  { requiredRole: "ChuQuan" }
);

export const POST = createApiHandler(
  async (_req, { body }) => {
    const result = await xuLyDoiCa(body);
    return successResponse(result);
  },
  {
    requiredRole: "ChuQuan",
    bodySchema: xuLyDoiCaSchema,
  }
);
