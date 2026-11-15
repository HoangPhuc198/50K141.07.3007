import { NextResponse } from "next/server";
import { ZodError, ZodSchema } from "zod";
import { getCurrentUser, UserPayload, AuthError, AUTH_COOKIE_NAME, verifySession } from "./auth";

export interface ApiResponseSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiResponseError {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiResponseSuccess<T> | ApiResponseError;

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json<ApiResponseSuccess<T>>({ ok: true, data }, { status });
}

export function errorResponse(message: string, code = "BAD_REQUEST", status = 400) {
  return NextResponse.json<ApiResponseError>(
    {
      ok: false,
      error: { code, message },
    },
    { status }
  );
}

export interface RouteContext<TBody = unknown> {
  user: UserPayload | null;
  body: TBody;
  params: Record<string, string | string[]>;
}

export interface RouteOptions<TBody> {
  requireAuth?: boolean;
  requiredRole?: "ChuQuan" | "NhanVien";
  bodySchema?: ZodSchema<TBody>;
}

/**
 * Wrapper cho Next.js App Router API Route.
 * Tự động kiểm tra authentication, authorization, parse Zod schema và bắt lỗi.
 */
export function createApiHandler<TResponse = unknown, TBody = unknown>(
  handler: (req: Request, ctx: RouteContext<TBody>) => Promise<NextResponse<ApiResponse<TResponse>>>,
  options: RouteOptions<TBody> = {}
) {
  return async (
    req: Request,
    context: { params: Promise<Record<string, string | string[]>> }
  ) => {
    try {
      let user: UserPayload | null = null;

      if (options.requireAuth || options.requiredRole) {
        let token = req.headers.get("x-tab-token")?.trim() || "";
        if (!token) {
          const cookieHeader = req.headers.get("cookie");
          if (cookieHeader) {
            const match = cookieHeader.match(new RegExp(`${AUTH_COOKIE_NAME}=([^;]+)`));
            if (match) token = match[1];
          }
        }

        if (token) {
          user = await verifySession(token);
        } else {
          user = await getCurrentUser();
        }

        if (!user) {
          return errorResponse("Chưa đăng nhập hoặc phiên làm việc đã hết hạn.", "UNAUTHORIZED", 401);
        }

        if (options.requiredRole && user.role !== options.requiredRole) {
          return errorResponse("Bạn không có quyền thực hiện thao tác này.", "FORBIDDEN", 403);
        }
      }

      let parsedBody: TBody = undefined as unknown as TBody;
      if (options.bodySchema && ["POST", "PUT", "PATCH"].includes(req.method)) {
        try {
          const rawBody = await req.json();
          parsedBody = options.bodySchema.parse(rawBody);
        } catch (err: unknown) {
          if (err instanceof ZodError) {
            const firstMsg = err.errors[0]?.message || "Dữ liệu không hợp lệ.";
            return errorResponse(firstMsg, "VALIDATION_ERROR", 400);
          }
          return errorResponse("Dữ liệu gửi lên không đúng định dạng JSON.", "INVALID_JSON", 400);
        }
      }

      let resolvedParams: Record<string, string | string[]> = {};
      if (context && context.params) {
        resolvedParams = (await context.params) || {};
      }

      return await handler(req, {
        user,
        body: parsedBody,
        params: resolvedParams,
      });
    } catch (err: unknown) {
      if (err instanceof AuthError) {
        return errorResponse(err.message, err.code, err.statusCode);
      }
      if (err && typeof err === "object" && "statusCode" in err && "code" in err) {
        const customErr = err as { message: string; code: string; statusCode: number };
        return errorResponse(customErr.message, customErr.code, customErr.statusCode);
      }
      console.error("API Route Error:", err);
      const message = err instanceof Error ? err.message : "Đã xảy ra lỗi máy chủ nội bộ.";
      return errorResponse(message, "INTERNAL_SERVER_ERROR", 500);
    }
  };
}
