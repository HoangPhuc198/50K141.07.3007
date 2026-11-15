import { createApiHandler, successResponse } from "@backend/lib/api";
import { layDanhSachNguoiThay } from "@backend/services/doi-ca";

export const GET = createApiHandler(
  async (req, { user }) => {
    const url = new URL(req.url);
    const malich = url.searchParams.get("malich") || undefined;
    const isCQ = user?.role === "ChuQuan";
    const madon = isCQ ? url.searchParams.get("madon") || undefined : undefined;
    const manvGui = isCQ ? url.searchParams.get("manvGui") || undefined : undefined;
    const chiLichRanhParam = url.searchParams.get("chiLichRanh");
    const chiLichRanh =
      chiLichRanhParam !== null
        ? chiLichRanhParam === "true" || chiLichRanhParam === "1"
        : isCQ;

    const items = await layDanhSachNguoiThay(user!.userId, malich, {
      madon,
      manvGui,
      chiLichRanh,
    });
    return successResponse({ items });
  },
  { requireAuth: true }
);
