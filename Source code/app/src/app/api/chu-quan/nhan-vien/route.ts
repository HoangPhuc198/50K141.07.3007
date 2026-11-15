import { createApiHandler, successResponse } from "@backend/lib/api";
import { CreateNhanVienSchema } from "@backend/validators/nhan-vien";
import { createNhanVien, getNhanVienList } from "@backend/services/nhan-vien";
import type { ZodType } from "zod";
import type { CreateNhanVienInput } from "@backend/validators/nhan-vien";

export const GET = createApiHandler(
  async (req) => {
    const url = new URL(req.url);
    const search = url.searchParams.get("q") || url.searchParams.get("search") || undefined;
    const page = parseInt(url.searchParams.get("page") || "1", 10) || 1;
    const limit = parseInt(url.searchParams.get("limit") || "50", 10) || 50;

    const data = await getNhanVienList(search, page, limit);
    return successResponse(data);
  },
  {
    requiredRole: "ChuQuan",
  }
);

export const POST = createApiHandler<unknown, CreateNhanVienInput>(
  async (_req, ctx) => {
    const created = await createNhanVien(ctx.body);
    return successResponse(created, 201);
  },
  {
    requiredRole: "ChuQuan",
    bodySchema: CreateNhanVienSchema as unknown as ZodType<CreateNhanVienInput>,
  }
);
