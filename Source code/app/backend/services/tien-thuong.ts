import { prisma, withDbRetry } from "@database/client";
import { parseSoTienNguyenVND } from "@frontend/lib/dinh-dang";
import { TIEN_THUONG_THANH_CONG } from "@frontend/config/thong-bao";
import { Prisma } from "@prisma/client";
import { ensureKyLuongHienTai } from "@backend/services/tinh-luong";

export type KyLuongOptionDto = {
  Makyluong: string;
  Thang: number;
  Nam: number;
  Trangthai: string;
  Label: string; // e.g. "Tháng 10/2026 · Dự kiến"
};

export type NhanVienTienThuongDto = {
  Manv: string;
  Hoten: string;
  Vitrilamviec: string;
  Tienthuong: number;
  Lydothuong: string | null;
  Mabangluong: string | null;
};

export type TienThuongPageDataDto = {
  kyLuongHienTai: KyLuongOptionDto | null;
  danhSachKyLuong: KyLuongOptionDto[];
  danhSachNhanVien: NhanVienTienThuongDto[];
};

export class TienThuongError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "TienThuongError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Sinh mã BangLuong dạng BLxxxxxx trong transaction
 */
export async function generateMaBangLuong(tx: Prisma.TransactionClient): Promise<string> {
  const all = await tx.bangLuong.findMany({
    select: { Mabangluong: true },
  });
  let maxNum = 0;
  for (const item of all) {
    const match = item.Mabangluong.trim().match(/^BL(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `BL${String(maxNum + 1).padStart(6, "0")}`;
}

/**
 * Lấy danh sách kỳ lương
 */
export async function getDanhSachKyLuong(): Promise<KyLuongOptionDto[]> {
  return await withDbRetry(async (db) => {
    await ensureKyLuongHienTai(db);
    const list = await db.kyLuong.findMany({
      orderBy: [{ Nam: "desc" }, { Thang: "desc" }],
    });
    return list.map((k) => ({
      Makyluong: k.Makyluong.trim(),
      Thang: k.Thang,
      Nam: k.Nam,
      Trangthai: k.Trangthai,
      Label: `Tháng ${k.Thang}/${k.Nam} · ${k.Trangthai}`,
    }));
  });
}

/**
 * UC 8.5: Lấy danh sách nhân viên và tiền thưởng của kỳ lương
 */
export async function getNhanVienTienThuongList(
  makyluong?: string
): Promise<TienThuongPageDataDto> {
  return await withDbRetry(async (db) => {
    await ensureKyLuongHienTai(db);
    const kyLuongs = await db.kyLuong.findMany({
      orderBy: [{ Nam: "desc" }, { Thang: "desc" }],
    });

    const options: KyLuongOptionDto[] = kyLuongs.map((k) => ({
      Makyluong: k.Makyluong.trim(),
      Thang: k.Thang,
      Nam: k.Nam,
      Trangthai: k.Trangthai,
      Label: `Tháng ${k.Thang}/${k.Nam} · ${k.Trangthai}`,
    }));

    if (kyLuongs.length === 0) {
      return {
        kyLuongHienTai: null,
        danhSachKyLuong: [],
        danhSachNhanVien: [],
      };
    }

    // Nếu không truyền makyluong, ưu tiên kỳ lương chưa chốt gần nhất, hoặc kỳ đầu tiên
    let selectedKy = kyLuongs.find((k) => k.Makyluong.trim() === makyluong?.trim());
    if (!selectedKy) {
      selectedKy = kyLuongs.find((k) => k.Trangthai !== "Đã chốt") || kyLuongs[0];
    }

    const selectedMakyluong = selectedKy.Makyluong.trim();

    // Lấy tất cả nhân viên chưa nghỉ việc
    const nhanViens = await db.nhanVien.findMany({
      where: {
        Trangthai: { not: "Đã nghỉ việc" },
      },
      orderBy: { Manv: "asc" },
      select: {
        Manv: true,
        Hoten: true,
        Vitrilamviec: true,
      },
    });

    // Lấy BangLuong của kỳ đã chọn
    const bangLuongs = await db.bangLuong.findMany({
      where: { Makyluong: selectedMakyluong },
    });

    const bangLuongMap = new Map<string, { Mabangluong: string; Tienthuong: number; Lydothuong: string | null }>();
    for (const bl of bangLuongs) {
      bangLuongMap.set(bl.Manv.trim(), {
        Mabangluong: bl.Mabangluong.trim(),
        Tienthuong: bl.Tienthuong,
        Lydothuong: bl.Lydothuong,
      });
    }

    const danhSachNhanVien: NhanVienTienThuongDto[] = nhanViens.map((nv) => {
      const manv = nv.Manv.trim();
      const bl = bangLuongMap.get(manv);
      return {
        Manv: manv,
        Hoten: nv.Hoten,
        Vitrilamviec: nv.Vitrilamviec,
        Tienthuong: bl ? bl.Tienthuong : 0,
        Lydothuong: bl?.Lydothuong ?? null,
        Mabangluong: bl?.Mabangluong ?? null,
      };
    });

    return {
      kyLuongHienTai: {
        Makyluong: selectedKy.Makyluong.trim(),
        Thang: selectedKy.Thang,
        Nam: selectedKy.Nam,
        Trangthai: selectedKy.Trangthai,
        Label: `Tháng ${selectedKy.Thang}/${selectedKy.Nam} · ${selectedKy.Trangthai}`,
      },
      danhSachKyLuong: options,
      danhSachNhanVien,
    };
  });
}

/**
 * UC 8.5: Lưu tiền thưởng cho nhân viên trong kỳ lương
 * - Thưởng: số nguyên ≥ 0 (nếu sai -> "Số tiền không hợp lệ")
 * - Lý do: bắt buộc (nếu trống -> "Lý do thưởng không được để trống")
 * - Chỉ khi kỳ CHƯA chốt (nếu đã chốt -> từ chối)
 * - Lưu BangLuong (nếu chưa có thì tạo mới nhất quán với P11A)
 * - Thông báo: "Lưu tiền thưởng thành công" (TIEN_THUONG_THANH_CONG, theo Figma UC_8.5_04 & SRS d.2290)
 */
export async function saveTienThuong(data: {
  Makyluong: string;
  Manv: string;
  Tienthuong: number | string;
  Lydothuong: string;
}): Promise<{
  Mabangluong: string;
  Manv: string;
  Makyluong: string;
  Tienthuong: number;
  Lydothuong: string;
  message: string;
}> {
  const makyluong = data.Makyluong?.trim();
  const manv = data.Manv?.trim().toUpperCase();

  if (!makyluong || !manv) {
    throw new TienThuongError("Thiếu mã kỳ lương hoặc mã nhân viên", 400, "BAD_REQUEST");
  }

  // 1. Kiểm tra tiền thưởng: phải là số nguyên ≥ 0
  const tienthuong = parseSoTienNguyenVND(data.Tienthuong);
  if (tienthuong === null || tienthuong < 0) {
    throw new TienThuongError("Số tiền không hợp lệ", 400, "SO_TIEN_KHONG_HOP_LE");
  }

  // 2. Kiểm tra lý do thưởng: bắt buộc không được để trống
  const lydo = data.Lydothuong?.trim();
  if (!lydo) {
    throw new TienThuongError("Lý do thưởng không được để trống", 400, "LY_DO_TRONG");
  }

  return await withDbRetry(async (db) => {
    return await db.$transaction(async (tx) => {
      // 3. Kiểm tra kỳ lương
      const ky = await tx.kyLuong.findUnique({
        where: { Makyluong: makyluong },
      });
      if (!ky) {
        throw new TienThuongError("Không tìm thấy kỳ lương", 404, "NOT_FOUND");
      }

      // 4. Chỉ thiết lập hoặc sửa được khi kỳ lương CHƯA chốt (BR03)
      if (ky.Trangthai === "Đã chốt") {
        throw new TienThuongError("Kỳ lương đã chốt, không thể chỉnh sửa", 400, "KY_LUONG_DA_CHOT");
      }

      // 5. Kiểm tra nhân viên
      const nv = await tx.nhanVien.findUnique({
        where: { Manv: manv },
      });
      if (!nv) {
        throw new TienThuongError("Không tìm thấy nhân viên", 404, "NOT_FOUND");
      }

      // 6. Tìm hoặc tạo mới BangLuong (nhất quán với P11A)
      const existing = await tx.bangLuong.findUnique({
        where: {
          Manv_Makyluong: {
            Manv: manv,
            Makyluong: makyluong,
          },
        },
      });

      let mabangluong: string;
      if (existing) {
        mabangluong = existing.Mabangluong.trim();
        await tx.bangLuong.update({
          where: { Mabangluong: existing.Mabangluong },
          data: {
            Tienthuong: tienthuong,
            Lydothuong: lydo,
          },
        });
      } else {
        mabangluong = await generateMaBangLuong(tx);
        await tx.bangLuong.create({
          data: {
            Mabangluong: mabangluong,
            Manv: manv,
            Makyluong: makyluong,
            Tienthuong: tienthuong,
            Lydothuong: lydo,
          },
        });
      }

      return {
        Mabangluong: mabangluong,
        Manv: manv,
        Makyluong: makyluong,
        Tienthuong: tienthuong,
        Lydothuong: lydo,
        message: TIEN_THUONG_THANH_CONG,
      };
    });
  });
}

/**
 * Cập nhật tiền thưởng theo mã bảng lương (tương thích endpoint /api/bang-luong/:id/thuong)
 */
export async function updateTienThuongByBangLuongId(
  mabangluong: string,
  data: { Tienthuong: number | string; Lydothuong: string }
) {
  const normalizedMa = mabangluong?.trim();
  if (!normalizedMa) {
    throw new TienThuongError("Thiếu mã bảng lương", 400, "BAD_REQUEST");
  }

  const tienthuong = parseSoTienNguyenVND(data.Tienthuong);
  if (tienthuong === null || tienthuong < 0) {
    throw new TienThuongError("Số tiền không hợp lệ", 400, "SO_TIEN_KHONG_HOP_LE");
  }

  const lydo = data.Lydothuong?.trim();
  if (!lydo) {
    throw new TienThuongError("Lý do thưởng không được để trống", 400, "LY_DO_TRONG");
  }

  return await withDbRetry(async (db) => {
    return await db.$transaction(async (tx) => {
      const existing = await tx.bangLuong.findUnique({
        where: { Mabangluong: normalizedMa },
        include: { KyLuong: true },
      });
      if (!existing) {
        throw new TienThuongError("Không tìm thấy bảng lương", 404, "NOT_FOUND");
      }

      if (existing.KyLuong.Trangthai === "Đã chốt") {
        throw new TienThuongError("Kỳ lương đã chốt, không thể chỉnh sửa", 400, "KY_LUONG_DA_CHOT");
      }

      const updated = await tx.bangLuong.update({
        where: { Mabangluong: normalizedMa },
        data: {
          Tienthuong: tienthuong,
          Lydothuong: lydo,
        },
      });

      return {
        Mabangluong: updated.Mabangluong.trim(),
        Manv: updated.Manv.trim(),
        Makyluong: updated.Makyluong.trim(),
        Tienthuong: updated.Tienthuong,
        Lydothuong: updated.Lydothuong,
        message: TIEN_THUONG_THANH_CONG,
      };
    });
  });
}
