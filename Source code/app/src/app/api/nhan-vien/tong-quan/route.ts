import { createApiHandler, successResponse } from "@backend/lib/api";
import { getNhanVienTongQuan } from "@backend/services/tong-quan";

export const GET = createApiHandler(
  async (_req, { user }) => {
    // Nhân viên chỉ lấy dữ liệu của chính mình thông qua user từ phiên đăng nhập
    const data = await getNhanVienTongQuan(user!);
    return successResponse(data);
  },
  {
    requiredRole: "NhanVien",
  }
);
