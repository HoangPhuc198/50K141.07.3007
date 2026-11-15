import { describe, it, expect, afterAll } from "vitest";
import { handleGetHealth } from "@backend/services/health";
import { prisma } from "@database/client";

describe("GET /api/health", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("trả về ok và kết nối thành công tới CSDL thật", async () => {
    const req = new Request("http://localhost:3000/api/health", { method: "GET" });
    const response = await handleGetHealth(req, { params: Promise.resolve({}) });

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe("healthy");
    expect(body.data.database).toBe("connected");
    expect(body.data.check).toBe(1);
  });
});
