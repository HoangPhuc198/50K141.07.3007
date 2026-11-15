import { createApiHandler, successResponse } from "@backend/lib/api";
import { logoutUser } from "@backend/services/auth";
import { AUTH_COOKIE_NAME } from "@backend/lib/auth";

export const POST = createApiHandler(
  async () => {
    await logoutUser();
    const res = successResponse({ message: "Đăng xuất thành công" });
    // Thiết lập xóa cookie trực tiếp trên response
    res.headers.set(
      "Set-Cookie",
      `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
    );
    return res;
  },
  {
    requireAuth: true,
  }
);
