import { createApiHandler, successResponse } from "@backend/lib/api";
import { getCurrentUserProfile } from "@backend/services/auth";
import { AUTH_COOKIE_NAME, signSession } from "@backend/lib/auth";

export const GET = createApiHandler(
  async (req, { user }) => {
    const profile = await getCurrentUserProfile(user!);
    let token = req.headers.get("x-tab-token")?.trim() || "";
    if (!token) {
      const cookieHeader = req.headers.get("cookie");
      if (cookieHeader) {
        const match = cookieHeader.match(new RegExp(`${AUTH_COOKIE_NAME}=([^;]+)`));
        if (match) token = match[1];
      }
    }
    if (!token) {
      token = await signSession(user!);
    }
    return successResponse({
      user: profile,
      token,
    });
  },
  {
    requireAuth: true,
  }
);
