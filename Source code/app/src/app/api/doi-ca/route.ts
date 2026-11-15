import { createApiHandler, errorResponse, successResponse } from "@backend/lib/api";
import { createDoiCaSchema, xuLyDoiCaSchema } from "@backend/validators/doi-ca";
import {
  guiYeuCauDoiCa,
  layCaCuaToi,
  layDanhSachNguoiThay,
  layDanhSachDonDoiCaChuaXuLy,
  xuLyDoiCa,
} from "@backend/services/doi-ca";

export const GET = createApiHandler<any>(
  async (req, { user }) => {
    if (!user) {
      return errorResponse("Chưa đăng nhập hoặc phiên làm việc đã hết hạn.", "UNAUTHORIZED", 401);
    }

    const url = new URL(req.url);
    const type = url.searchParams.get("type");
    const malich = url.searchParams.get("malich") || undefined;

    if (user.role === "ChuQuan") {
      // Chủ quán: lấy danh sách đơn đổi ca chưa xử lý hoặc người thay
      if (type === "nguoi-thay") {
        const madon = url.searchParams.get("madon") || undefined;
        const manvGui = url.searchParams.get("manvGui") || undefined;
        const chiLichRanhParam = url.searchParams.get("chiLichRanh");
        const chiLichRanh =
          chiLichRanhParam !== null
            ? chiLichRanhParam === "true" || chiLichRanhParam === "1"
            : true;
        const items = await layDanhSachNguoiThay(user.userId, malich, {
          madon,
          manvGui,
          chiLichRanh,
        });
        return successResponse({ items });
      }
      const items = await layDanhSachDonDoiCaChuaXuLy();
      return successResponse({ items });
    }

    if (user.role === "NhanVien") {
      // Nhân viên: lấy ca của tôi hoặc lấy người thay được
      if (type === "nguoi-thay" || malich) {
        const chiLichRanhParam = url.searchParams.get("chiLichRanh");
        const chiLichRanh =
          chiLichRanhParam !== null
            ? chiLichRanhParam === "true" || chiLichRanhParam === "1"
            : false;
        const items = await layDanhSachNguoiThay(user.userId, malich, {
          chiLichRanh,
        });
        return successResponse({ items });
      }
      const items = await layCaCuaToi(user.userId);
      return successResponse({ items });
    }

    return errorResponse("Vai trò không hợp lệ.", "FORBIDDEN", 403);
  },
  { requireAuth: true }
);

export const POST = createApiHandler(
  async (_req, { user, body }) => {
    const result = await guiYeuCauDoiCa(user!.userId, body);
    return successResponse(result, 201);
  },
  {
    requiredRole: "NhanVien",
    bodySchema: createDoiCaSchema,
  }
);

export const PUT = createApiHandler(
  async (_req, { body }) => {
    const result = await xuLyDoiCa(body);
    return successResponse(result);
  },
  {
    requiredRole: "ChuQuan",
    bodySchema: xuLyDoiCaSchema,
  }
);
