import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const AUTH_COOKIE_NAME = "thanhha_token";

interface UserPayload {
  userId: string;
  username: string;
  role: "ChuQuan" | "NhanVien";
  name: string;
}

async function verifyToken(token: string): Promise<UserPayload | null> {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key);
    return payload as unknown as UserPayload;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Bỏ qua static files, api routes, next internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;

  // Xử lý trang gốc "/"
  if (pathname === "/") {
    if (user) {
      const target = user.role === "ChuQuan" ? "/chu-quan" : "/nhan-vien";
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.redirect(new URL("/dang-nhap", request.url));
  }

  // Xử lý trang "/dang-nhap"
  if (pathname === "/dang-nhap") {
    if (user) {
      const target = user.role === "ChuQuan" ? "/chu-quan" : "/nhan-vien";
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.next();
  }

  // Bảo vệ route Chủ quán "/chu-quan/**"
  if (pathname.startsWith("/chu-quan")) {
    if (!user) {
      const loginUrl = new URL("/dang-nhap", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (user.role !== "ChuQuan") {
      return NextResponse.redirect(new URL("/nhan-vien", request.url));
    }
    return NextResponse.next();
  }

  // Bảo vệ route Nhân viên "/nhan-vien/**"
  if (pathname.startsWith("/nhan-vien")) {
    if (!user) {
      const loginUrl = new URL("/dang-nhap", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (user.role !== "NhanVien") {
      return NextResponse.redirect(new URL("/chu-quan", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dang-nhap",
    "/chu-quan/:path*",
    "/nhan-vien/:path*",
  ],
};
