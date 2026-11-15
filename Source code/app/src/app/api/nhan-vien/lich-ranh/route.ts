import { createApiHandler, successResponse, errorResponse } from "@backend/lib/api";
import { getTuanHienThiLichRanh, nowVN } from "@backend/lib/time";
import { dangKyLichRanhSchema, DangKyLichRanhInput } from "@backend/validators/lich-lam";
import {
  dangKyLichRanh,
  layLichRanhCuaToi,
  getNgayDaKhoaTrongTuan,
  LichLamServiceError,
} from "@backend/services/lich-lam";
import { prisma } from "@database/client";

export const GET = createApiHandler(
  async (req, ctx) => {
    const url = new URL(req.url);
    const tuan = getTuanHienThiLichRanh(nowVN());
    const startDate = url.searchParams.get("startDate") || url.searchParams.get("start") || tuan.startDate;
    const endDate = url.searchParams.get("endDate") || url.searchParams.get("end") || tuan.endDate;

    const manv = ctx.user!.userId;
    const data = await layLichRanhCuaToi(manv, startDate, endDate);
    return successResponse({
      ...data,
      tuan,
    });
  },
  { requiredRole: "NhanVien" }
);

export const POST = createApiHandler<unknown, DangKyLichRanhInput>(
  async (_req, ctx) => {
    const manv = ctx.user!.userId;
    try {
      const result = await dangKyLichRanh(manv, ctx.body);
      return successResponse(result);
    } catch (err) {
      if (err instanceof LichLamServiceError) {
        return errorResponse(err.message, err.code, err.statusCode);
      }
      throw err;
    }
  },
  {
    requiredRole: "NhanVien",
    bodySchema: dangKyLichRanhSchema,
  }
);

export const PUT = POST;

export const DELETE = createApiHandler(
  async (req, ctx) => {
    const manv = ctx.user!.userId;
    const url = new URL(req.url);
    let ngay = url.searchParams.get("ngay") || "";
    if (!ngay) {
      try {
        const body = await req.json();
        ngay = body?.ngay || "";
      } catch {
        // ignore
      }
    }

    const tuan = getTuanHienThiLichRanh(nowVN());
    const start = new Date(tuan.startDate + "T00:00:00Z");
    const end = new Date(tuan.endDate + "T23:59:59Z");
    const ngayDaKhoa = await getNgayDaKhoaTrongTuan(prisma, start, end);

    if (ngay && ngayDaKhoa.includes(ngay)) {
      return errorResponse(
        "Ngày đăng ký đã được chủ quán duyệt lịch làm, không thể xóa lịch rảnh",
        "LOCKED_DATE",
        409
      );
    }
    if (!ngay && ngayDaKhoa.length > 0) {
      return errorResponse(
        "Ngày đăng ký đã được chủ quán duyệt lịch làm, không thể xóa lịch rảnh",
        "LOCKED_DATE",
        409
      );
    }

    if (ngay) {
      await prisma.lichRanh.deleteMany({
        where: {
          Manv: manv,
          Ngayranh: new Date(ngay + "T00:00:00Z"),
        },
      });
    }
    return successResponse({ message: "Đã xóa lịch rảnh" });
  },
  { requiredRole: "NhanVien" }
);
