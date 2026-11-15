import { prisma, withDbRetry } from "@database/client";
import { encrypt } from "../lib/crypto";
import { mucLuongKhoiDiemTheoViTri } from "../calc/luong";
import { toNhanVienDto, toNhanVienListDto, NhanVienDto } from "../mappers/nhan-vien";
import { CreateNhanVienInput, UpdateNhanVienInput } from "../validators/nhan-vien";
import { isValidIsoDate } from "@frontend/lib/dinh-dang";
import { Prisma } from "@prisma/client";

export class NhanVienServiceError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "NhanVienServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Sinh mã nhân viên tiếp theo dạng CHAR(8): NVxxxxxx (ví dụ NV000008).
 * Chạy bên trong transaction để tránh trùng lặp.
 */
export async function generateNextManv(tx: Prisma.TransactionClient): Promise<string> {
  // Khóa bảng trong transaction để đảm bảo sinh mã tuần tự tuyệt đối, không trùng lặp
  await tx.$executeRawUnsafe('LOCK TABLE "NhanVien" IN EXCLUSIVE MODE');

  const records = await tx.nhanVien.findMany({
    select: { Manv: true },
  });

  let maxNum = 0;
  for (const r of records) {
    const trimmed = r.Manv.trim();
    if (trimmed.startsWith("NV")) {
      const numPart = parseInt(trimmed.slice(2), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `NV${String(nextNum).padStart(6, "0")}`;
}

/**
 * UC 5.1: Thêm thông tin nhân viên
 */
export async function createNhanVien(input: CreateNhanVienInput) {
  return await withDbRetry(async (db) => {
    // 1. Kiểm tra trùng số điện thoại
    const existingPhone = await db.nhanVien.findFirst({
      where: { Sdt: input.Sdt },
    });
    if (existingPhone) {
      throw new NhanVienServiceError("Số điện thoại này đã tồn tại trên hệ thống", 400, "PHONE_DUPLICATE");
    }

    // 2. Máy chủ tự tính mức lương khởi điểm từ Vitrilamviec, bỏ qua mọi giá trị client gửi lên
    const mucluong = mucLuongKhoiDiemTheoViTri(input.Vitrilamviec);

    // 3. Mật khẩu mặc định mã hóa AES-256-GCM
    const defaultPass = process.env.DEFAULT_PASSWORD || "123456";
    const encryptedPass = encrypt(defaultPass);

    // 4. Ngày vào làm
    if (!isValidIsoDate(input.Ngayvaolam)) {
      throw new NhanVienServiceError("Ngày vào làm không hợp lệ", 400, "INVALID_DATE");
    }
    const ngayVaoLamDate = new Date(input.Ngayvaolam);

    // 5. Transaction: sinh mã tự động & lưu vào CSDL
    return await db.$transaction(async (tx) => {
      const manv = await generateNextManv(tx);

      const created = await tx.nhanVien.create({
        data: {
          Manv: manv,
          Tendangnhap: manv,
          Matkhau: encryptedPass,
          Hoten: input.Hoten,
          Sdt: input.Sdt,
          Diachi: input.Diachi,
          Truonghoc: input.Truonghoc || null,
          Vitrilamviec: input.Vitrilamviec,
          Hinhthuclam: input.Hinhthuclam,
          Ngayvaolam: ngayVaoLamDate,
          Kinhnghiem: input.Kinhnghiem,
          Trangthai: input.Trangthai || "Thử việc",
          Mucluongtheogio: mucluong,
        },
      });

      return toNhanVienDto(created, { isChuQuan: true, skipTrangThaiDerived: true });
    });
  });
}

/**
 * UC 5.4: Lấy danh sách nhân viên + tìm kiếm theo tên hoặc mã (đầy đủ hoặc một phần)
 */
export async function getNhanVienList(search?: string, page = 1, limit = 50) {
  return await withDbRetry(async (db) => {
    const trimmedSearch = search?.trim();

    let whereClause: Prisma.NhanVienWhereInput = {};
    if (trimmedSearch) {
      const orConditions: Prisma.NhanVienWhereInput[] = [
        { Hoten: { contains: trimmedSearch, mode: "insensitive" } },
        { Manv: { contains: trimmedSearch.toUpperCase(), mode: "insensitive" } },
        { Sdt: { contains: trimmedSearch } },
      ];

      // Hỗ trợ tìm kiếm theo mã rút gọn hoặc một phần (vd: NV008, 008, 8 -> NV000008)
      const nvMatch = trimmedSearch.toUpperCase().match(/^NV0*(\d+)$/);
      if (nvMatch) {
        const padded = `NV${nvMatch[1].padStart(6, "0")}`;
        orConditions.push({ Manv: padded });
      }

      whereClause = {
        OR: orConditions,
      };
    }

    const [total, list] = await Promise.all([
      db.nhanVien.count({ where: whereClause }),
      db.nhanVien.findMany({
        where: whereClause,
        orderBy: { Manv: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const items = toNhanVienListDto(list, { isChuQuan: true });

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      items,
    };
  });
}

/**
 * UC 5.4 / UC 5.2: Lấy chi tiết nhân viên theo Manv
 */
export async function getNhanVienDetail(manv: string, isCQ = true) {
  return await withDbRetry(async (db) => {
    const normalizedManv = manv.trim().toUpperCase();
    const nv = await db.nhanVien.findUnique({
      where: { Manv: normalizedManv },
    });

    if (!nv) return null;

    return toNhanVienDto(nv, { isChuQuan: isCQ });
  });
}

/**
 * UC 5.2: Sửa thông tin nhân viên
 */
export async function updateNhanVien(manv: string, input: UpdateNhanVienInput) {
  return await withDbRetry(async (db) => {
    const normalizedManv = manv.trim().toUpperCase();

    // 1. Kiểm tra tồn tại
    const existing = await db.nhanVien.findUnique({
      where: { Manv: normalizedManv },
    });
    if (!existing) {
      throw new NhanVienServiceError("Không tìm thấy nhân viên", 404, "NOT_FOUND");
    }

    // 2. Kiểm tra trùng SĐT với nhân viên khác
    const duplicatePhone = await db.nhanVien.findFirst({
      where: {
        Sdt: input.Sdt,
        NOT: { Manv: normalizedManv },
      },
    });
    if (duplicatePhone) {
      throw new NhanVienServiceError("Số điện thoại này đã tồn tại trên hệ thống", 400, "PHONE_DUPLICATE");
    }

    // 3. Chuẩn bị dữ liệu cập nhật (KHÔNG sửa mức lương Mucluongtheogio)
    if (!isValidIsoDate(input.Ngayvaolam)) {
      throw new NhanVienServiceError("Ngày vào làm không hợp lệ", 400, "INVALID_DATE");
    }
    const updateData: Prisma.NhanVienUpdateInput = {
      Hoten: input.Hoten,
      Sdt: input.Sdt,
      Diachi: input.Diachi,
      Truonghoc: input.Truonghoc || null,
      Vitrilamviec: input.Vitrilamviec,
      Hinhthuclam: input.Hinhthuclam,
      Ngayvaolam: new Date(input.Ngayvaolam),
      Kinhnghiem: input.Kinhnghiem,
    };

    if (input.Trangthai) {
      updateData.Trangthai = input.Trangthai;
    }

    if (input.Matkhau && input.Matkhau.trim().length > 0) {
      updateData.Matkhau = encrypt(input.Matkhau.trim());
    }

    const updated = await db.nhanVien.update({
      where: { Manv: normalizedManv },
      data: updateData,
    });

    return toNhanVienDto(updated, { isChuQuan: true });
  });
}

/**
 * UC 5.3: Xóa nhân viên
 * - Chặn nếu còn kỳ lương chưa chốt (BangLuong liên kết với KyLuong chưa đóng)
 * - Xóa dữ liệu liên quan trong 1 transaction
 * - Đơn đổi ca của người khác mà Manvnhanthay = manv bị xóa → đặt NULL (không xóa đơn)
 */
export async function deleteNhanVien(manv: string) {
  return await withDbRetry(async (db) => {
    const normalizedManv = manv.trim().toUpperCase();

    // 1. Kiểm tra tồn tại
    const existing = await db.nhanVien.findUnique({
      where: { Manv: normalizedManv },
      include: {
        BangLuong: {
          include: { KyLuong: true },
        },
      },
    });
    if (!existing) {
      throw new NhanVienServiceError("Không tìm thấy nhân viên", 404, "NOT_FOUND");
    }

    // 2. Chặn nếu còn kỳ lương chưa chốt
    const hasOpenKy = existing.BangLuong.some(
      (bl) => bl.KyLuong && bl.KyLuong.Trangthai !== "Đã chốt"
    );
    if (hasOpenKy) {
      throw new NhanVienServiceError(
        "Không thể xóa vì còn kỳ lương chưa chốt",
        400,
        "KY_LUONG_CHUA_CHOT"
      );
    }

    // 3. Xóa trong 1 transaction
    await db.$transaction(async (tx) => {
      // 3a. Xóa bản ghi từ chối thay ca gấp (TDxxxxxx) mà nhân viên này từng từ chối,
      // và đặt NULL Manvnhanthay cho các đơn đổi ca/thay ca mà nhân viên này nhận thay.
      await tx.donXinDoiCa.deleteMany({
        where: {
          Madon: { startsWith: "TD" },
          Manvnhanthay: normalizedManv,
        },
      });
      await tx.donXinDoiCa.updateMany({
        where: { Manvnhanthay: normalizedManv },
        data: { Manvnhanthay: null },
      });

      // 3b. Xóa dữ liệu liên quan theo thứ tự (FK constraints)
      await tx.yeuCauBoSungCC.deleteMany({ where: { Manv: normalizedManv } });
      await tx.chamCong.deleteMany({ where: { Manv: normalizedManv } });
      await tx.donXinDoiCa.deleteMany({ where: { Manv: normalizedManv } });
      await tx.lichRanh.deleteMany({ where: { Manv: normalizedManv } });
      await tx.nhanVien_LichLam.deleteMany({ where: { Manv: normalizedManv } });

      // 3c. Xóa BangLuong và ChiTietBangLuong + PhanHoiLuong của NV
      const bangs = await tx.bangLuong.findMany({
        where: { Manv: normalizedManv },
        select: { Mabangluong: true },
      });
      const bangIds = bangs.map((b) => b.Mabangluong);
      if (bangIds.length > 0) {
        await tx.phanHoiLuong.deleteMany({ where: { Mabangluong: { in: bangIds } } });
        await tx.chiTietBangLuong.deleteMany({ where: { Mabangluong: { in: bangIds } } });
        await tx.bangLuong.deleteMany({ where: { Manv: normalizedManv } });
      }

      // 3d. Xóa nhân viên
      await tx.nhanVien.delete({ where: { Manv: normalizedManv } });
    });

    return { deleted: true, Manv: normalizedManv };
  });
}
