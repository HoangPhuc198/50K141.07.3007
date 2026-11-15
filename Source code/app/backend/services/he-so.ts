import { prisma, withDbRetry } from "@database/client";
import { nowVN, formatDateVN } from "@backend/lib/time";
import { isValidIsoDate, parseSoThapPhanDuong } from "@frontend/lib/dinh-dang";
import { Prisma } from "@prisma/client";

export type HeSoItemDto = {
  Maheso: string;
  Ngaybatdau: string; // YYYY-MM-DD
  Ngayketthuc: string; // YYYY-MM-DD
  NgaybatdauDisplay: string; // DD/MM/YYYY
  NgayketthucDisplay: string; // DD/MM/YYYY
  Heso: number;
};

export class HeSoError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "HeSoError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Chuyển đổi định dạng ngày YYYY-MM-DD hoặc DD/MM/YYYY thành YYYY-MM-DD
 */
function normalizeDateStr(dateStr: string): string {
  if (!dateStr || typeof dateStr !== "string") return "";
  const trimmed = dateStr.trim();
  let candidate = "";
  // Nếu là DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, "0");
    const m = dmyMatch[2].padStart(2, "0");
    const y = dmyMatch[3];
    candidate = `${y}-${m}-${d}`;
  } else {
    // Nếu là YYYY-MM-DD
    const ymdMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymdMatch) {
      const y = ymdMatch[1];
      const m = ymdMatch[2].padStart(2, "0");
      const d = ymdMatch[3].padStart(2, "0");
      candidate = `${y}-${m}-${d}`;
    }
  }
  return candidate && isValidIsoDate(candidate) ? candidate : "";
}

/**
 * Định dạng YYYY-MM-DD thành DD/MM/YYYY
 */
function formatDisplayDate(ymd: string): string {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Sinh mã HeSoLuong dạng HSxxxxxx trong transaction
 */
export async function generateMaHeSo(tx: Prisma.TransactionClient): Promise<string> {
  const all = await tx.heSoLuong.findMany({
    select: { Maheso: true },
  });
  let maxNum = 0;
  for (const item of all) {
    const match = item.Maheso.trim().match(/^HS(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `HS${String(maxNum + 1).padStart(6, "0")}`;
}

/**
 * UC 8.4: Lấy danh sách khoảng áp dụng hệ số lương
 */
export async function getHeSoList(): Promise<HeSoItemDto[]> {
  return await withDbRetry(async (db) => {
    const list = await db.heSoLuong.findMany({
      orderBy: { Ngaybatdau: "asc" },
    });
    return list.map((item) => {
      const startYmd = item.Ngaybatdau.toISOString().slice(0, 10);
      const endYmd = item.Ngayketthuc.toISOString().slice(0, 10);
      return {
        Maheso: item.Maheso.trim(),
        Ngaybatdau: startYmd,
        Ngayketthuc: endYmd,
        NgaybatdauDisplay: formatDisplayDate(startYmd),
        NgayketthucDisplay: formatDisplayDate(endYmd),
        Heso: Number(item.Heso),
      };
    });
  });
}

/**
 * UC 8.4: Thêm hoặc cập nhật khoảng áp dụng hệ số lương
 * - Hệ số ≥ 1 ("Hệ số lỗi, vui lòng nhập lại")
 * - kết thúc ≥ bắt đầu ("Thời gian áp dụng không hợp lệ")
 * - ngày bắt đầu sau hôm nay ("Thời gian áp dụng không hợp lệ")
 * - "Đã lưu thành công"
 */
async function assertHeSoKhongThuocKyDaChot(
  tx: Prisma.TransactionClient,
  ranges: Array<{ start: Date; end: Date }>,
  maHeSo?: string
): Promise<void> {
  if (maHeSo) {
    const linked = await tx.chiTietBangLuong.findFirst({
      where: {
        Maheso: maHeSo,
        BangLuong: { KyLuong: { Trangthai: "Đã chốt" } },
      },
      select: { Mabangluong: true },
    });
    if (linked) {
      throw new HeSoError(
        "Kỳ lương đã chốt, không thể chỉnh sửa",
        400,
        "KY_LUONG_DA_CHOT"
      );
    }
  }

  const kyDaChots = await tx.kyLuong.findMany({
    where: { Trangthai: "Đã chốt" },
    select: { Thang: true, Nam: true },
  });
  for (const ky of kyDaChots) {
    const dauKy = new Date(Date.UTC(ky.Nam, ky.Thang - 1, 1));
    const cuoiKy = new Date(Date.UTC(ky.Nam, ky.Thang, 0));
    if (ranges.some((r) => r.start <= cuoiKy && r.end >= dauKy)) {
      throw new HeSoError(
        "Kỳ lương đã chốt, không thể chỉnh sửa",
        400,
        "KY_LUONG_DA_CHOT"
      );
    }
  }
}

export async function saveHeSo(data: {
  Maheso?: string;
  Ngaybatdau: string;
  Ngayketthuc: string;
  Heso: number | string;
}): Promise<HeSoItemDto> {
  const heSoNum = parseSoThapPhanDuong(data.Heso);
  if (heSoNum === null || heSoNum < 1) {
    throw new HeSoError("Hệ số lỗi, vui lòng nhập lại", 400, "HE_SO_LOI");
  }

  const startYmd = normalizeDateStr(data.Ngaybatdau);
  const endYmd = normalizeDateStr(data.Ngayketthuc);

  if (!startYmd || !endYmd) {
    throw new HeSoError("Thời gian áp dụng không hợp lệ", 400, "THOI_GIAN_KHONG_HOP_LE");
  }

  if (endYmd < startYmd) {
    throw new HeSoError("Thời gian áp dụng không hợp lệ", 400, "THOI_GIAN_KHONG_HOP_LE");
  }

  // Ngày bắt đầu phải sau ngày hiện tại (BR04: ngày bắt đầu sau hôm nay)
  const todayStr = formatDateVN(nowVN());
  if (startYmd <= todayStr) {
    throw new HeSoError("Thời gian áp dụng không hợp lệ", 400, "THOI_GIAN_KHONG_HOP_LE");
  }

  const startDate = new Date(`${startYmd}T00:00:00.000Z`);
  const endDate = new Date(`${endYmd}T00:00:00.000Z`);

  return await withDbRetry(async (db) => {
    return await db.$transaction(async (tx) => {
      let maHeSo = data.Maheso?.trim();

      if (maHeSo) {
        const existing = await tx.heSoLuong.findUnique({
          where: { Maheso: maHeSo },
        });
        if (!existing) {
          throw new HeSoError("Không tìm thấy khoảng áp dụng", 404, "NOT_FOUND");
        }

        await assertHeSoKhongThuocKyDaChot(
          tx,
          [
            { start: existing.Ngaybatdau, end: existing.Ngayketthuc },
            { start: startDate, end: endDate },
          ],
          maHeSo
        );

        const updated = await tx.heSoLuong.update({
          where: { Maheso: maHeSo },
          data: {
            Ngaybatdau: startDate,
            Ngayketthuc: endDate,
            Heso: new Prisma.Decimal(heSoNum),
          },
        });

        const s = updated.Ngaybatdau.toISOString().slice(0, 10);
        const e = updated.Ngayketthuc.toISOString().slice(0, 10);
        return {
          Maheso: updated.Maheso.trim(),
          Ngaybatdau: s,
          Ngayketthuc: e,
          NgaybatdauDisplay: formatDisplayDate(s),
          NgayketthucDisplay: formatDisplayDate(e),
          Heso: Number(updated.Heso),
        };
      } else {
        await assertHeSoKhongThuocKyDaChot(tx, [{ start: startDate, end: endDate }]);
        maHeSo = await generateMaHeSo(tx);
        const created = await tx.heSoLuong.create({
          data: {
            Maheso: maHeSo,
            Ngaybatdau: startDate,
            Ngayketthuc: endDate,
            Heso: new Prisma.Decimal(heSoNum),
          },
        });

        const s = created.Ngaybatdau.toISOString().slice(0, 10);
        const e = created.Ngayketthuc.toISOString().slice(0, 10);
        return {
          Maheso: created.Maheso.trim(),
          Ngaybatdau: s,
          Ngayketthuc: e,
          NgaybatdauDisplay: formatDisplayDate(s),
          NgayketthucDisplay: formatDisplayDate(e),
          Heso: Number(created.Heso),
        };
      }
    });
  });
}

/**
 * UC 8.4: Xóa khoảng áp dụng hệ số lương
 * - Khi xóa khoảng thời gian áp dụng khỏi danh sách, các ngày được áp dụng hệ số trở về 1 (BR05)
 * - Thông báo: "Đã xóa khoảng áp dụng"
 */
export async function deleteHeSo(maheso: string): Promise<void> {
  const normalizedMa = maheso?.trim();
  if (!normalizedMa) {
    throw new HeSoError("Thiếu mã hệ số", 400, "BAD_REQUEST");
  }

  await withDbRetry(async (db) => {
    await db.$transaction(async (tx) => {
      const existing = await tx.heSoLuong.findUnique({
        where: { Maheso: normalizedMa },
      });
      if (!existing) {
        throw new HeSoError("Không tìm thấy khoảng áp dụng", 404, "NOT_FOUND");
      }

      await assertHeSoKhongThuocKyDaChot(
        tx,
        [{ start: existing.Ngaybatdau, end: existing.Ngayketthuc }],
        normalizedMa
      );

      // BR05: Các ngày thuộc khoảng áp dụng trở về hệ số 1 (set Maheso = null trong ChiTietBangLuong)
      await tx.chiTietBangLuong.updateMany({
        where: { Maheso: normalizedMa },
        data: { Maheso: null },
      });

      await tx.heSoLuong.delete({
        where: { Maheso: normalizedMa },
      });
    });
  });
}
