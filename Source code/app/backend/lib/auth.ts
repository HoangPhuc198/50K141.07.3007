import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const AUTH_COOKIE_NAME = "thanhha_token";

export interface UserPayload {
  userId: string; // Machuquan (CQ...) hoặc Manv (NV...)
  username: string; // Tendangnhap
  role: "ChuQuan" | "NhanVien";
  name: string; // Họ tên đầy đủ
}

export const AUTH_COOKIE_OPTIONS = {
  name: AUTH_COOKIE_NAME,
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 8 * 60 * 60, // 8 giờ tính theo giây
  path: "/",
};

export class AuthError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET chưa được cấu hình trong .env");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Tạo token JWT cho phiên đăng nhập (thời hạn 8 giờ)
 */
export async function signSession(payload: UserPayload): Promise<string> {
  const key = getJwtSecretKey();
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(key);
}

/**
 * Xác thực token JWT
 */
export async function verifySession(token: string): Promise<UserPayload | null> {
  try {
    const key = getJwtSecretKey();
    const { payload } = await jwtVerify(token, key);
    return payload as unknown as UserPayload;
  } catch {
    return null;
  }
}

/**
 * Lấy thông tin user hiện tại từ cookie httpOnly
 */
export async function getCurrentUser(): Promise<UserPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySession(token);
  } catch {
    return null;
  }
}

/**
 * Lấy phiên đăng nhập hiện tại
 */
export async function getSession(): Promise<UserPayload | null> {
  return getCurrentUser();
}

/**
 * Kiểm tra vai trò của phiên đăng nhập.
 * Chưa đăng nhập ném AuthError 401, sai vai trò ném AuthError 403.
 */
export async function requireRole(
  allowedRoles: "ChuQuan" | "NhanVien" | ("ChuQuan" | "NhanVien")[]
): Promise<UserPayload> {
  const user = await getSession();
  if (!user) {
    throw new AuthError("Chưa đăng nhập hoặc phiên làm việc đã hết hạn.", 401, "UNAUTHORIZED");
  }

  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!roles.includes(user.role)) {
    throw new AuthError("Bạn không có quyền thực hiện thao tác này.", 403, "FORBIDDEN");
  }

  return user;
}
