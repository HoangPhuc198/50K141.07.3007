import { cookies } from "next/headers";
import { prisma, withDbRetry } from "@database/client";
import { decrypt } from "@backend/lib/crypto";
import {
  signSession,
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_OPTIONS,
  UserPayload,
} from "@backend/lib/auth";

// Quản lý số lần đăng nhập sai theo tài khoản + IP trong bộ nhớ server
interface RateLimitRecord {
  attempts: number;
  lockUntil: number; // timestamp ms
  lastAttempt: number;
}

const loginAttemptsMap = new Map<string, RateLimitRecord>();

const MAX_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 phút

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
}

function getRateLimitKey(username: string, ip: string): string {
  return `${username.trim().toLowerCase()}_${ip}`;
}

export function checkRateLimit(username: string, ip: string): { isLocked: boolean; remainingMinutes: number } {
  const key = getRateLimitKey(username, ip);
  const record = loginAttemptsMap.get(key);
  if (!record) return { isLocked: false, remainingMinutes: 0 };

  const now = Date.now();
  if (record.lockUntil > now) {
    const remainingMinutes = Math.ceil((record.lockUntil - now) / 60000);
    return { isLocked: true, remainingMinutes };
  }

  // Đã hết thời gian khóa hoặc quá 15 phút từ lần thử cuối, reset
  if (now - record.lastAttempt > LOCK_TIME_MS) {
    loginAttemptsMap.delete(key);
    return { isLocked: false, remainingMinutes: 0 };
  }

  return { isLocked: false, remainingMinutes: 0 };
}

export function recordFailedAttempt(username: string, ip: string): { isLocked: boolean; attempts: number } {
  const key = getRateLimitKey(username, ip);
  const now = Date.now();
  const record = loginAttemptsMap.get(key) || { attempts: 0, lockUntil: 0, lastAttempt: now };

  // Nếu lần trước đã quá 15 phút thì tính lại từ đầu
  if (now - record.lastAttempt > LOCK_TIME_MS) {
    record.attempts = 1;
  } else {
    record.attempts += 1;
  }

  record.lastAttempt = now;

  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockUntil = now + LOCK_TIME_MS;
    loginAttemptsMap.set(key, record);
    return { isLocked: true, attempts: record.attempts };
  }

  loginAttemptsMap.set(key, record);
  return { isLocked: false, attempts: record.attempts };
}

export function resetFailedAttempts(username: string, ip: string): void {
  const key = getRateLimitKey(username, ip);
  loginAttemptsMap.delete(key);
}

// Xóa toàn bộ bộ nhớ rate limit (phục vụ testing)
export function clearRateLimitMemory(): void {
  loginAttemptsMap.clear();
}

export interface LoginResult {
  user: UserPayload;
  redirectUrl: string;
  token: string;
}

/**
 * Xử lý đăng nhập tài khoản Chủ quán hoặc Nhân viên
 */
export async function authenticateUser(
  username: string,
  passwordPlain: string,
  clientIp: string
): Promise<LoginResult> {
  const u = username.trim();

  // 1. Kiểm tra khóa tạm thời
  const rateLimit = checkRateLimit(u, clientIp);
  if (rateLimit.isLocked) {
    throw new Error(
      `Tài khoản tạm thời bị khóa do nhập sai quá 5 lần. Vui lòng thử lại sau ${rateLimit.remainingMinutes} phút.`
    );
  }

  let matchedUser: {
    userId: string;
    username: string;
    role: "ChuQuan" | "NhanVien";
    name: string;
    encryptedPassword: string;
  } | null = null;

  try {
    // 2. Tìm ở ChuQuan trước (theo Tendangnhap hoặc Machuquan, không phân biệt hoa/thường)
    const chuQuan = await withDbRetry(async (db) => {
      return db.chuQuan.findFirst({
        where: {
          OR: [
            { Tendangnhap: { equals: u, mode: "insensitive" } },
            { Machuquan: { equals: u, mode: "insensitive" } },
          ],
        },
      });
    });

    if (chuQuan) {
      matchedUser = {
        userId: chuQuan.Machuquan.trim(),
        username: chuQuan.Tendangnhap.trim(),
        role: "ChuQuan",
        name: "Thanh Hà", // Figma thể hiện: "Thanh Hà / Chủ quán"
        encryptedPassword: chuQuan.Matkhau,
      };
    } else {
      // 3. Nếu không có ở ChuQuan, tìm ở NhanVien (chuẩn hóa IN HOA trước khi tra)
      const uUpper = u.toUpperCase();
      const nhanVien = await withDbRetry(async (db) => {
        return db.nhanVien.findFirst({
          where: {
            OR: [{ Tendangnhap: uUpper }, { Manv: uUpper }],
          },
        });
      });

      if (nhanVien) {
        matchedUser = {
          userId: nhanVien.Manv.trim(),
          username: nhanVien.Tendangnhap.trim(),
          role: "NhanVien",
          name: nhanVien.Hoten.trim(),
          encryptedPassword: nhanVien.Matkhau,
        };
      }
    }
  } catch (dbErr: unknown) {
    console.error("Lỗi truy vấn CSDL khi đăng nhập:", dbErr);
    // Nếu lỗi CSDL (ví dụ DB chưa kết nối), ném lại để handler xử lý
    throw dbErr;
  }

  // 4. Nếu không tìm thấy người dùng
  if (!matchedUser) {
    recordFailedAttempt(u, clientIp);
    // Thông báo đúng chữ trong SRS và Figma, không lộ tài khoản có tồn tại
    throw new Error("Tên đăng nhập hoặc mật khẩu không đúng");
  }

  // 5. Giải mã và so khớp mật khẩu
  let passwordMatches = false;
  try {
    const decrypted = decrypt(matchedUser.encryptedPassword);
    passwordMatches = decrypted === passwordPlain;
  } catch (decryptErr) {
    console.error("Lỗi giải mã mật khẩu:", decryptErr);
    passwordMatches = false;
  }

  if (!passwordMatches) {
    const attempt = recordFailedAttempt(u, clientIp);
    if (attempt.isLocked) {
      throw new Error(
        "Tài khoản tạm thời bị khóa do nhập sai quá 5 lần. Vui lòng thử lại sau 15 phút."
      );
    }
    throw new Error("Tên đăng nhập hoặc mật khẩu không đúng");
  }

  // 6. Đăng nhập thành công -> Reset rate limit
  resetFailedAttempts(u, clientIp);

  const payload: UserPayload = {
    userId: matchedUser.userId,
    username: matchedUser.username,
    role: matchedUser.role,
    name: matchedUser.name,
  };

  // 7. Tạo JWT 8 giờ và lưu vào Cookie httpOnly
  const token = await signSession(payload);
  try {
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);
  } catch {
    // Nếu chạy ngoài request scope (như unit test), cookieStore không sẵn sàng
  }

  return {
    user: payload,
    redirectUrl: payload.role === "ChuQuan" ? "/chu-quan" : "/nhan-vien",
    token,
  };
}

/**
 * Đăng xuất: xóa cookie phiên làm việc
 */
export async function logoutUser(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(AUTH_COOKIE_NAME);
  } catch {
    // Nếu chạy ngoài request scope (như trong unit test), bỏ qua
  }
}

export interface CurrentUserProfile {
  userId: string;
  username: string;
  role: UserPayload["role"];
  name: string;
  position: string;
}

/**
 * Lấy thông tin hồ sơ hiện tại của tài khoản đang đăng nhập từ CSDL.
 */
export async function getCurrentUserProfile(
  current: UserPayload
): Promise<CurrentUserProfile> {
  let userId = "";
  let username = "";
  let name = "";
  let position = "";

  if (current.role === "ChuQuan") {
    try {
      const cq = await withDbRetry((db) =>
        db.chuQuan.findUnique({
          where: { Machuquan: current.userId.trim().toUpperCase() },
          select: { Machuquan: true, Tendangnhap: true },
        })
      );
      if (cq) {
        userId = cq.Machuquan.trim();
        username = cq.Tendangnhap.trim();
        name = current.name?.trim() ?? "";
        position = "Chủ quán";
      }
    } catch {
      // bỏ qua nếu truy vấn lỗi
    }
  } else if (current.role === "NhanVien") {
    try {
      const nv = await withDbRetry((db) =>
        db.nhanVien.findUnique({
          where: { Manv: current.userId.trim().toUpperCase() },
          select: { Manv: true, Tendangnhap: true, Hoten: true, Vitrilamviec: true },
        })
      );
      if (nv) {
        userId = nv.Manv.trim();
        username = nv.Tendangnhap.trim();
        name = nv.Hoten.trim();
        position = nv.Vitrilamviec.trim();
      }
    } catch {
      // bỏ qua nếu truy vấn lỗi
    }
  }

  return {
    userId,
    username,
    role: current.role,
    name,
    position,
  };
}
