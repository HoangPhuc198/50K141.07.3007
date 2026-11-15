import { withDbRetry } from "@database/client";
import { nowVN } from "@backend/lib/time";
import { tongHopKy, type BangLuongTinhDto } from "@backend/services/tinh-luong";
import {
  CHOT_LUONG_CO_PHAN_HOI_NOI_DUNG,
  CHOT_LUONG_CO_PHAN_HOI_TIEU_DE,
  CHOT_LUONG_THANH_CONG,
} from "@frontend/config/thong-bao";

const MA_KY_LUONG = /^KL\d{6}$/;

export class ChotLuongError extends Error {
  statusCode: number;
  code: string;
  title?: string;

  constructor(
    message: string,
    statusCode = 400,
    code = "CHOT_LUONG_LOI",
    title?: string
  ) {
    super(message);
    this.name = "ChotLuongError";
    this.statusCode = statusCode;
    this.code = code;
    this.title = title;
  }
}

export type ChotBangLuongDto = {
  kyLuong: {
    Makyluong: string;
    Thang: number;
    Nam: number;
    Trangthai: string;
    Ngaychot: string | null;
  };
  tongLuong: number;
  soNhanVien: number;
  soPhanHoiChuaXuLy: number;
  danhSach: BangLuongTinhDto[];
};

export type ChotBangLuongKetQuaDto = ChotBangLuongDto & {
  message: string;
};

function chuanHoaMaKyLuong(makyluong: string): string {
  const ma = makyluong.trim().toUpperCase();
  if (!MA_KY_LUONG.test(ma)) {
    throw new ChotLuongError("Mã kỳ lương không hợp lệ", 400, "BAD_REQUEST");
  }
  return ma;
}

/**
 * GET /api/ky-luong/:id/bang-luong (UC_8.6 · U29)
 * Trả dữ liệu bảng lương dự kiến/đã chốt của kỳ + số phản hồi chưa xử lý.
 */
export async function layDuLieuChotBangLuong(
  makyluong: string
): Promise<ChotBangLuongDto> {
  const ma = chuanHoaMaKyLuong(makyluong);

  const { ky, soPhanHoiChuaXuLy } = await withDbRetry(async (db) => {
    const kyRow = await db.kyLuong.findUnique({ where: { Makyluong: ma } });
    if (!kyRow) {
      throw new ChotLuongError("Không tìm thấy kỳ lương", 404, "KY_LUONG_NOT_FOUND");
    }

    const pendingCount = await db.phanHoiLuong.count({
      where: {
        Trangthai: "Chưa xử lý",
        BangLuong: { Makyluong: ma },
      },
    });

    return { ky: kyRow, soPhanHoiChuaXuLy: pendingCount };
  });

  let tongLuong = 0;
  let danhSach: BangLuongTinhDto[] = [];

  if (ky.Trangthai !== "Chưa tính") {
    const tongHop = await tongHopKy(ma);
    tongLuong = tongHop.Tongluong;
    danhSach = tongHop.BangLuong;
  }

  return {
    kyLuong: {
      Makyluong: ky.Makyluong.trim(),
      Thang: ky.Thang,
      Nam: ky.Nam,
      Trangthai: ky.Trangthai,
      Ngaychot: ky.Ngaychot ? ky.Ngaychot.toISOString().slice(0, 10) : null,
    },
    tongLuong,
    soNhanVien: danhSach.length,
    soPhanHoiChuaXuLy,
    danhSach,
  };
}

/**
 * POST /api/ky-luong/:id/chot (UC_8.6)
 * Tính lại điều kiện phía máy chủ trong 1 transaction:
 * - Kỳ phải ở trạng thái "Dự kiến"
 * - Không còn PhanHoiLuong ở trạng thái "Chưa xử lý"
 * - Cập nhật KyLuong.Trangthai = "Đã chốt", Ngaychot = nowVN()
 */
export async function chotBangLuong(
  makyluong: string
): Promise<ChotBangLuongKetQuaDto> {
  const ma = chuanHoaMaKyLuong(makyluong);

  await withDbRetry(async (db) => {
    await db.$transaction(async (tx) => {
      const ky = await tx.kyLuong.findUnique({ where: { Makyluong: ma } });
      if (!ky) {
        throw new ChotLuongError("Không tìm thấy kỳ lương", 404, "KY_LUONG_NOT_FOUND");
      }

      if (ky.Trangthai === "Đã chốt") {
        throw new ChotLuongError(
          "Kỳ lương đã chốt, không thể chỉnh sửa",
          400,
          "KY_LUONG_DA_CHOT"
        );
      }

      if (ky.Trangthai !== "Dự kiến") {
        throw new ChotLuongError(
          "Kỳ lương chưa ở trạng thái dự kiến",
          400,
          "CHUA_DU_KIEN"
        );
      }

      const soPhanHoiChuaXuLy = await tx.phanHoiLuong.count({
        where: {
          Trangthai: "Chưa xử lý",
          BangLuong: { Makyluong: ma },
        },
      });

      if (soPhanHoiChuaXuLy > 0) {
        throw new ChotLuongError(
          CHOT_LUONG_CO_PHAN_HOI_NOI_DUNG,
          400,
          "CO_PHAN_HOI_CHUA_XU_LY",
          CHOT_LUONG_CO_PHAN_HOI_TIEU_DE
        );
      }

      const vn = nowVN();
      const ngayChotDate = new Date(
        Date.UTC(vn.getFullYear(), vn.getMonth(), vn.getDate())
      );

      const updated = await tx.kyLuong.updateMany({
        where: { Makyluong: ma, Trangthai: "Dự kiến" },
        data: {
          Trangthai: "Đã chốt",
          Ngaychot: ngayChotDate,
        },
      });

      if (updated.count !== 1) {
        throw new ChotLuongError(
          "Kỳ lương đã chốt, không thể chỉnh sửa",
          400,
          "KY_LUONG_DA_CHOT"
        );
      }
    });
  });

  const duLieuMoi = await layDuLieuChotBangLuong(ma);
  return {
    ...duLieuMoi,
    message: CHOT_LUONG_THANH_CONG,
  };
}
