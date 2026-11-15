import { createApiHandler, successResponse, errorResponse } from "@backend/lib/api";
import { UpdateNhanVienSchema, UpdateNhanVienInput } from "@backend/validators/nhan-vien";
import { getNhanVienDetail, updateNhanVien, deleteNhanVien, NhanVienServiceError } from "@backend/services/nhan-vien";

export const GET = createApiHandler(
  async (_req, ctx) => {
    const id = ctx.params.id as string;
    if (!id) {
      return errorResponse("Thiếu mã nhân viên", "BAD_REQUEST", 400);
    }

    const data = await getNhanVienDetail(id, true);
    if (!data) {
      return errorResponse("Không tìm thấy nhân viên", "NOT_FOUND", 404);
    }

    return successResponse(data);
  },
  {
    requiredRole: "ChuQuan",
  }
);

export const PUT = createApiHandler<unknown, UpdateNhanVienInput>(
  async (_req, ctx) => {
    const id = ctx.params.id as string;
    if (!id) {
      return errorResponse("Thiếu mã nhân viên", "BAD_REQUEST", 400);
    }

    const updated = await updateNhanVien(id, ctx.body);
    return successResponse(updated);
  },
  {
    requiredRole: "ChuQuan",
    bodySchema: UpdateNhanVienSchema,
  }
);

export const DELETE = createApiHandler(
  async (_req, ctx) => {
    const id = ctx.params.id as string;
    if (!id) {
      return errorResponse("Thiếu mã nhân viên", "BAD_REQUEST", 400);
    }

    try {
      const result = await deleteNhanVien(id);
      return successResponse(result);
    } catch (err) {
      if (err instanceof NhanVienServiceError) {
        return errorResponse(err.message, err.code, err.statusCode);
      }
      throw err;
    }
  },
  {
    requiredRole: "ChuQuan",
  }
);
