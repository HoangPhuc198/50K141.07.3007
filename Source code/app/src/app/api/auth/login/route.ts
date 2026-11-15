import { createApiHandler, successResponse, errorResponse } from "@backend/lib/api";
import { LoginSchema } from "@backend/validators/auth";
import { authenticateUser, getClientIp } from "@backend/services/auth";
import { AUTH_COOKIE_NAME } from "@backend/lib/auth";

export const POST = createApiHandler(
  async (req, { body }) => {
    try {
      const ip = getClientIp(req);
      const result = await authenticateUser(body.username, body.password, ip);
      const res = successResponse(result, 200);

      if (result.token) {
        const isProd = process.env.NODE_ENV === "production";
        res.headers.set(
          "Set-Cookie",
          `${AUTH_COOKIE_NAME}=${result.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${8 * 3600}${isProd ? "; Secure" : ""}`
        );
      }

      return res;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Đăng nhập thất bại.";
      if (message.includes("bị khóa")) {
        return errorResponse(message, "ACCOUNT_LOCKED", 429);
      }
      if (message === "Tên đăng nhập hoặc mật khẩu không đúng") {
        return errorResponse(message, "INVALID_CREDENTIALS", 401);
      }
      return errorResponse(message, "LOGIN_FAILED", 400);
    }
  },
  {
    bodySchema: LoginSchema,
  }
);
