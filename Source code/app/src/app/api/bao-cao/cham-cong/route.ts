import {
  createApiHandler,
  errorResponse,
  successResponse,
} from "@backend/lib/api";
import { baoCaoChamCongQuerySchema } from "@backend/validators/bao-cao-cham-cong";
import { layBaoCaoChamCong } from "@backend/services/bao-cao-cham-cong";

export const GET = createApiHandler(
  async (req) => {
    const url = new URL(req.url);
    const rawParams: Record<string, string | undefined> = {
      ngay: url.searchParams.get("ngay") ?? undefined,
      thang: url.searchParams.get("thang") ?? undefined,
      manv: url.searchParams.get("manv") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    };

    const parsed = baoCaoChamCongQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      return errorResponse(
        parsed.error.issues[0]?.message || "Tham số báo cáo không hợp lệ",
        "VALIDATION_ERROR",
        400
      );
    }

    const data = await layBaoCaoChamCong(parsed.data);
    return successResponse(data);
  },
  { requiredRole: "ChuQuan" }
);
