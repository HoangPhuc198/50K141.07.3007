import type { Prisma, PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Giới hạn thời gian chờ và thực thi cho một transaction ngắn, an toàn với
 * kết nối pooled (Neon / PgBouncer transaction mode).
 */
export const SHORT_TX_OPTIONS = {
  maxWait: 5000,
  timeout: 10000,
} as const;

/**
 * Dùng PostgreSQL transaction-scoped advisory lock kèm `SET LOCAL lock_timeout`
 * thay cho `LOCK TABLE ... IN EXCLUSIVE MODE`:
 * - Tự động giải phóng khi COMMIT/ROLLBACK, không rò rỉ trạng thái session qua pooler.
 * - Giới hạn khóa theo `lockKey` thay vì khóa toàn bộ bảng.
 * - Có `lock_timeout` cục bộ để tránh treo vô hạn nếu có tranh chấp.
 */
export async function acquireAdvisoryXactLock(
  tx: DbClient,
  lockKey: string,
  lockTimeoutMs = 3000
): Promise<void> {
  const safeTimeoutMs = Math.max(100, Math.floor(lockTimeoutMs));
  await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '${safeTimeoutMs}ms'`);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
}
