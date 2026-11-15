import { nowVN } from "@backend/lib/time";
import { prisma, withDbRetry } from "@database/client";
import { createApiHandler, successResponse } from "@backend/lib/api";

export const handleGetHealth = createApiHandler(async () => {
  // Chạy SELECT 1 thật trên database thông qua withDbRetry
  const result = await withDbRetry(async (client) => {
    return await client.$queryRawUnsafe<Array<{ result: number }>>("SELECT 1 AS result");
  });

  return successResponse({
    status: "healthy",
    database: "connected",
    check: result?.[0]?.result === 1 ? 1 : 0,
    timestamp: nowVN().toISOString(),
  });
});
