import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

function isTransientConnectionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  if ("code" in err) {
    const code = (err as { code: unknown }).code;
    if (typeof code === "string" && ["P1001", "P1002", "P1017"].includes(code)) {
      return true;
    }
  }
  if ("message" in err) {
    const msg = String((err as { message: unknown }).message);
    if (msg.includes("ECONNREFUSED") || msg.includes("ETIMEDOUT") || msg.includes("Can't reach database server")) {
      return true;
    }
  }
  return false;
}

/**
 * Thực thi một thao tác database với cơ chế thử lại khi gặp lỗi kết nối tạm thời
 * (CSDL vừa thức dậy: mã Prisma P1001, P1002, P1017, tối đa ~10 giây tổng).
 * Tuyệt đối không thử lại lỗi dữ liệu / ràng buộc.
 */
export async function withDbRetry<T>(
  operation: (client: PrismaClient) => Promise<T>,
  delaysMs = [1500, 2500, 4000]
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation(prisma);
    } catch (err: unknown) {
      if (!isTransientConnectionError(err) || attempt >= delaysMs.length) {
        throw err;
      }
      const delay = delaysMs[attempt];
      attempt++;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export default prisma;
