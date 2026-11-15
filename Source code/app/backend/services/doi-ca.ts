import { withDbRetry } from "@database/client";
import { SHORT_TX_OPTIONS, acquireAdvisoryXactLock } from "@backend/lib/db-lock";
import { Prisma } from "@prisma/client";
import { CreateDoiCaInput, XuLyDoiCaInput } from "../validators/doi-ca";
import {
  YEU_CAU_DOI_CA_THANH_CONG,
  XU_LY_DOI_CA_THANH_CONG,
} from "@frontend/config/thong-bao";
import {
  formatDateVN,
  formatTimeFromDb,
  nowVN,
} from "@backend/lib/time";

export class DoiCaServiceError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "DoiCaServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const TEN_THU = [
  "Chủ nhật",
  "Thứ hai",
  "Thứ ba",
  "Thứ tư",
  "Thứ năm",
  "Thứ sáu",
  "Thứ bảy",
];

function getThuFromDate(date: Date): string {
  return TEN_THU[date.getUTCDay()] || "";
}

function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function formatDateShort(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

/**
 * Sinh mã DonXinDoiCa tiếp theo dạng DDxxxxxx (ví dụ DD000001) trong transaction.
 */
export async function generateNextMadon(
  tx: Prisma.TransactionClient
): Promise<string> {
  await acquireAdvisoryXactLock(tx, "don_xin_doi_ca:dd_id");

  const records = await tx.donXinDoiCa.findMany({
    where: { Madon: { startsWith: "DD" } },
    select: { Madon: true },
  });

  let maxNum = 0;
  for (const r of records) {
    const trimmed = r.Madon.trim().toUpperCase();
    if (trimmed.startsWith("DD")) {
      const numStr = trimmed.slice(2);
      if (/^\d+$/.test(numStr)) {
        const numPart = parseInt(numStr, 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    }
  }

  const nextNum = maxNum + 1;
  return `DD${String(nextNum).padStart(6, "0")}`;
}

export interface CaCuaToiItem {
  malich: string;
  ngayLam: string; // YYYY-MM-DD
  ngayHienThi: string; // DD/MM/YYYY
  thu: string; // Thứ ba
  maca: string;
  loaica: string; // Sáng / Chiều / Tối
  gioBatDau: string; // 06:00
  gioKetThuc: string; // 11:30
  khungGio: string; // Chiều · 11:30 – 17:00
  viTri: string; // Pha chế / Phục vụ
  daGuiYeuCau: boolean;
}

export interface NguoiThayItem {
  manv: string;
  hoten: string;
  chucvu: string;
  coLichRanh?: boolean;
}

export interface DonDoiCaChuaXuLyItem {
  madon: string;
  trangthaixuly: string;
  manv: string;
  tenNhanVien: string;
  chucVuNhanVien: string;
  malich: string;
  ngayLam: string;
  ngayLamHienThi: string;
  ngayLamNgan: string;
  maca: string;
  tenCa: string;
  khungGio: string;
  manvnhanthay: string | null;
  tenNhanVienThay: string | null;
  chucVuNhanVienThay: string | null;
  nguoiThayHopLe: boolean;
  khongCoNguoiThay: boolean;
  danhSachCaHienTai: { manv: string; hoten: string; chucvu: string }[];
  thoiGian: string;
  lyDo: string;
}

// ============================================================
// UC 2.2: YÊU CẦU ĐỔI CA (Nhân viên)
// ============================================================

/**
 * Lấy danh sách các ca làm đã được xếp cho nhân viên nhưng CHƯA BẮT ĐẦU.
 */
export async function layCaCuaToi(manv: string): Promise<CaCuaToiItem[]> {
  const cleanManv = manv.trim().toUpperCase();

  return await withDbRetry(async (db) => {
    const nv = await db.nhanVien.findUnique({
      where: { Manv: cleanManv },
      select: { Vitrilamviec: true },
    });
    const viTri = nv?.Vitrilamviec?.trim() || "Pha chế";

    const nvLichLams = await db.nhanVien_LichLam.findMany({
      where: { Manv: cleanManv },
      include: {
        LichLam: {
          include: {
            CaLam: true,
          },
        },
      },
    });

    const now = nowVN();
    const todayStr = formatDateVN(now);
    const hienTaiPhut = now.getHours() * 60 + now.getMinutes();

    // Lấy các đơn đổi ca chưa xử lý của nhân viên để đánh dấu
    const pendingRequests = await db.donXinDoiCa.findMany({
      where: {
        Madon: { startsWith: "DD" },
        Manv: cleanManv,
        Trangthaixuly: "Chưa xử lý",
      },
      select: { Malich: true },
    });
    const pendingMalichSet = new Set(pendingRequests.map((r) => r.Malich.trim()));

    const items: CaCuaToiItem[] = [];

    for (const item of nvLichLams) {
      const ll = item.LichLam;
      if (!ll || !ll.CaLam) continue;

      const shiftDateStr = formatDateVN(ll.Ngaylam);
      const gioBatDau = formatTimeFromDb(ll.CaLam.Giobatdau);
      const gioKetThuc = formatTimeFromDb(ll.CaLam.Gioketthuc);

      const [h, m] = gioBatDau.split(":").map(Number);
      const batDauPhut = (h || 0) * 60 + (m || 0);

      // Quy tắc BR01: Chỉ ca chưa bắt đầu
      const isFuture =
        shiftDateStr > todayStr ||
        (shiftDateStr === todayStr && batDauPhut > hienTaiPhut);

      if (!isFuture) continue;

      const dateObj = new Date(shiftDateStr + "T00:00:00Z");
      const thu = getThuFromDate(dateObj);
      const loaica = ll.CaLam.Loaica.trim();

      items.push({
        malich: ll.Malich.trim(),
        ngayLam: shiftDateStr,
        ngayHienThi: formatDateDisplay(shiftDateStr),
        thu,
        maca: ll.CaLam.Maca.trim(),
        loaica,
        gioBatDau,
        gioKetThuc,
        khungGio: `${loaica} · ${gioBatDau} – ${gioKetThuc}`,
        viTri,
        daGuiYeuCau: pendingMalichSet.has(ll.Malich.trim()),
      });
    }

    // Sắp xếp theo ngày làm tăng dần, rồi theo giờ bắt đầu
    items.sort((a, b) => {
      if (a.ngayLam !== b.ngayLam) return a.ngayLam.localeCompare(b.ngayLam);
      return a.gioBatDau.localeCompare(b.gioBatDau);
    });

    return items;
  });
}

export interface LayNguoiThayOptions {
  manvGui?: string;
  madon?: string;
  chiLichRanh?: boolean;
}

/**
 * Lấy danh sách nhân viên có thể làm thay cho một ca làm.
 * Điều kiện:
 * - Không phải chính nhân viên gửi yêu cầu
 * - Đang làm việc (chưa nghỉ việc)
 * - Không có trong danh sách phân công của ca làm đó
 * - Nếu chiLichRanh = true: chỉ lấy nhân viên có LichRanh đúng ngày và ca đó (U20)
 */
export async function layDanhSachNguoiThay(
  manv: string,
  malich?: string,
  options?: LayNguoiThayOptions
): Promise<NguoiThayItem[]> {
  const cleanManv = manv.trim().toUpperCase();

  return await withDbRetry(async (db) => {
    let targetMalich = malich?.trim();
    let senderManv = options?.manvGui?.trim().toUpperCase();
    const chiLichRanh = options?.chiLichRanh ?? false;

    // Nếu truyền madon, tra cứu malich và sender từ DonXinDoiCa (chỉ chấp nhận đơn DD, loại bỏ TC/TD của UC_2.3)
    if (options?.madon) {
      const cleanFilterMadon = options.madon.trim().toUpperCase();
      if (!cleanFilterMadon.startsWith("DD")) {
        return [];
      }
      const don = await db.donXinDoiCa.findUnique({
        where: { Madon: cleanFilterMadon },
        select: { Malich: true, Manv: true },
      });
      if (don) {
        targetMalich = don.Malich.trim();
        senderManv = don.Manv.trim().toUpperCase();
      }
    }

    let busyManvSet = new Set<string>();
    let lichRanhSet = new Set<string>();

    if (targetMalich) {
      const ll = await db.lichLam.findUnique({
        where: { Malich: targetMalich },
        include: {
          NhanVien_LichLam: true,
        },
      });

      if (ll) {
        busyManvSet = new Set(
          ll.NhanVien_LichLam.map((x) => x.Manv.trim().toUpperCase())
        );

        // Tìm nhân viên có lịch rảnh trong ngày và ca này
        const freeEmployees = await db.lichRanh.findMany({
          where: {
            Ngayranh: ll.Ngaylam,
            Caranh: ll.Maca,
          },
          select: { Manv: true },
        });
        lichRanhSet = new Set(
          freeEmployees.map((x) => x.Manv.trim().toUpperCase())
        );
      }
    }

    // Tập loại trừ: người gửi đơn và nhân viên đang gọi (nếu là nhân viên)
    const excludeManvSet = new Set<string>();
    if (cleanManv && cleanManv.startsWith("NV")) {
      excludeManvSet.add(cleanManv);
    }
    if (senderManv) {
      excludeManvSet.add(senderManv);
    }

    // Xác định vị trí làm việc bắt buộc của người xin đổi/người gọi (UC_2.2 / UC_6.3)
    const referenceManv =
      senderManv || (cleanManv && cleanManv.startsWith("NV") ? cleanManv : undefined);
    const refNv = referenceManv
      ? await db.nhanVien.findUnique({
          where: { Manv: referenceManv },
          select: { Vitrilamviec: true },
        })
      : null;
    const targetViTri = refNv?.Vitrilamviec?.trim() || null;

    const employees = await db.nhanVien.findMany({
      where: {
        Manv: { notIn: Array.from(excludeManvSet) },
        Trangthai: { not: "Đã nghỉ việc" },
        ...(targetViTri ? { Vitrilamviec: targetViTri } : {}),
      },
      select: {
        Manv: true,
        Hoten: true,
        Vitrilamviec: true,
      },
      orderBy: { Hoten: "asc" },
    });

    const results: NguoiThayItem[] = [];

    for (const e of employees) {
      const eManv = e.Manv.trim().toUpperCase();
      // Loại người đang làm ca đó
      if (busyManvSet.has(eManv)) continue;
      // Chỉ giữ nhân viên cùng vị trí làm việc
      if (targetViTri && (e.Vitrilamviec?.trim() || "") !== targetViTri) continue;

      const coLichRanh = lichRanhSet.has(eManv);
      // Khi chiLichRanh = true: loại người không có lịch rảnh đúng ngày và ca đó
      if (chiLichRanh && !coLichRanh) continue;

      results.push({
        manv: eManv,
        hoten: e.Hoten.trim(),
        chucvu: e.Vitrilamviec?.trim() || "Pha chế",
        coLichRanh,
      });
    }

    // Ưu tiên người có lịch rảnh lên trước
    results.sort((a, b) => {
      if (a.coLichRanh && !b.coLichRanh) return -1;
      if (!a.coLichRanh && b.coLichRanh) return 1;
      return a.hoten.localeCompare(b.hoten, "vi");
    });

    return results;
  });
}

/**
 * Gửi yêu cầu đổi ca (Nhân viên).
 */
export async function guiYeuCauDoiCa(
  manv: string,
  input: CreateDoiCaInput
): Promise<{ madon: string; message: string }> {
  const cleanManv = manv.trim().toUpperCase();
  const cleanMalich = input.Malich.trim();

  return await withDbRetry(async (db) => {
    return await db.$transaction(async (tx) => {
      // 1. Kiểm tra nhân viên có trong ca làm đó không
      const assigned = await tx.nhanVien_LichLam.findUnique({
        where: {
          Manv_Malich: {
            Manv: cleanManv,
            Malich: cleanMalich,
          },
        },
      });

      if (!assigned) {
        throw new DoiCaServiceError(
          "Ca làm này không thuộc lịch làm của bạn.",
          400,
          "NOT_ASSIGNED"
        );
      }

      // 2. Kiểm tra ca làm chưa diễn ra (BR01)
      const ll = await tx.lichLam.findUnique({
        where: { Malich: cleanMalich },
        include: { CaLam: true },
      });

      if (!ll || !ll.CaLam) {
        throw new DoiCaServiceError("Không tìm thấy thông tin ca làm.", 404, "NOT_FOUND");
      }

      const shiftDateStr = formatDateVN(ll.Ngaylam);
      const gioBatDau = formatTimeFromDb(ll.CaLam.Giobatdau);
      const [h, m] = gioBatDau.split(":").map(Number);
      const batDauPhut = (h || 0) * 60 + (m || 0);

      const now = nowVN();
      const todayStr = formatDateVN(now);
      const hienTaiPhut = now.getHours() * 60 + now.getMinutes();

      const isFuture =
        shiftDateStr > todayStr ||
        (shiftDateStr === todayStr && batDauPhut > hienTaiPhut);

      if (!isFuture) {
        throw new DoiCaServiceError(
          "Nhân viên chỉ đổi được ca khi ca làm chưa diễn ra",
          400,
          "SHIFT_STARTED"
        );
      }

      // 3. Kiểm tra xem ca này đã có đơn chờ xử lý chưa
      const existing = await tx.donXinDoiCa.findFirst({
        where: {
          Madon: { startsWith: "DD" },
          Manv: cleanManv,
          Malich: cleanMalich,
          Trangthaixuly: "Chưa xử lý",
        },
      });

      if (existing) {
        throw new DoiCaServiceError(
          "Ca làm này đang có đơn đổi ca chờ xử lý.",
          400,
          "DUPLICATE_REQUEST"
        );
      }

      // 4. Xử lý người nhận thay (hai lựa chọn loại trừ nhau)
      let manvNhanThay: string | null = null;
      if (!input.khongCoNguoiThay && input.Manvnhanthay) {
        const cleanThay = input.Manvnhanthay.trim().toUpperCase();

        if (cleanThay === cleanManv) {
          throw new DoiCaServiceError(
            "Không thể tự nhận thay ca cho chính mình.",
            400,
            "SELF_REPLACEMENT"
          );
        }

        const [senderNv, targetNv] = await Promise.all([
          tx.nhanVien.findUnique({
            where: { Manv: cleanManv },
            select: { Vitrilamviec: true },
          }),
          tx.nhanVien.findUnique({
            where: { Manv: cleanThay },
          }),
        ]);

        if (!targetNv) {
          throw new DoiCaServiceError(
            "Nhân viên làm thay không tồn tại trên hệ thống.",
            404,
            "EMPLOYEE_NOT_FOUND"
          );
        }

        if (
          senderNv &&
          targetNv.Vitrilamviec.trim() !== senderNv.Vitrilamviec.trim()
        ) {
          throw new DoiCaServiceError(
            "Gửi yêu cầu đổi ca thất bại.",
            400,
            "POSITION_MISMATCH"
          );
        }

        const alreadyInShift = await tx.nhanVien_LichLam.findUnique({
          where: {
            Manv_Malich: {
              Manv: cleanThay,
              Malich: cleanMalich,
            },
          },
        });

        if (alreadyInShift) {
          throw new DoiCaServiceError(
            "Nhân viên này đã có trong lịch làm của ca cần đổi.",
            400,
            "ALREADY_IN_SHIFT"
          );
        }

        manvNhanThay = cleanThay;
      }

      // 5. Sinh mã và ghi vào CSDL
      const madon = await generateNextMadon(tx);

      await tx.donXinDoiCa.create({
        data: {
          Madon: madon,
          Trangthaixuly: "Chưa xử lý",
          Manv: cleanManv,
          Malich: cleanMalich,
          Manvnhanthay: manvNhanThay,
        },
      });

      return {
        madon,
        message: YEU_CAU_DOI_CA_THANH_CONG,
      };
    }, SHORT_TX_OPTIONS);
  });
}

// ============================================================
// UC 6.3: XỬ LÝ ĐỔI CA (Chủ quán)
// ============================================================

/**
 * Lấy danh sách các đơn đổi ca chưa xử lý (Chủ quán).
 */
export async function layDanhSachDonDoiCaChuaXuLy(): Promise<
  DonDoiCaChuaXuLyItem[]
> {
  return await withDbRetry(async (db) => {
    const list = await db.donXinDoiCa.findMany({
      where: {
        Madon: { startsWith: "DD" },
        Trangthaixuly: "Chưa xử lý",
      },
      include: {
        NhanVien_DonXinDoiCa_ManvToNhanVien: true,
        NhanVien_DonXinDoiCa_ManvnhanthayToNhanVien: true,
        LichLam: {
          include: {
            CaLam: true,
            NhanVien_LichLam: {
              include: {
                NhanVien: true,
              },
            },
          },
        },
      },
      orderBy: { Madon: "asc" },
    });

    const items: DonDoiCaChuaXuLyItem[] = [];

    for (const d of list) {
      const ll = d.LichLam;
      const ca = ll?.CaLam;
      const nv = d.NhanVien_DonXinDoiCa_ManvToNhanVien;
      const nvThay = d.NhanVien_DonXinDoiCa_ManvnhanthayToNhanVien;

      const dateStr = ll ? formatDateVN(ll.Ngaylam) : "";
      const gioBatDau = ca ? formatTimeFromDb(ca.Giobatdau) : "";
      const gioKetThuc = ca ? formatTimeFromDb(ca.Gioketthuc) : "";
      const loaica = ca ? ca.Loaica.trim() : "Ca làm";

      const workers = (ll?.NhanVien_LichLam || []).map((w) => ({
        manv: w.Manv.trim(),
        hoten: w.NhanVien?.Hoten?.trim() || w.Manv.trim(),
        chucvu: w.NhanVien?.Vitrilamviec?.trim() || "Phục vụ",
      }));

      const senderManv = d.Manv.trim().toUpperCase();
      const senderViTri = nv?.Vitrilamviec?.trim() || null;
      const reqReplacementManv = d.Manvnhanthay
        ? d.Manvnhanthay.trim().toUpperCase()
        : null;
      const inShiftManvSet = new Set(workers.map((w) => w.manv.toUpperCase()));
      const nguoiThayHopLe = Boolean(
        reqReplacementManv &&
          nv &&
          nvThay &&
          nvThay.Trangthai.trim() !== "Đã nghỉ việc" &&
          reqReplacementManv !== senderManv &&
          senderViTri !== null &&
          nvThay.Vitrilamviec.trim() === senderViTri &&
          !inShiftManvSet.has(reqReplacementManv)
      );

      items.push({
        madon: d.Madon.trim(),
        trangthaixuly: d.Trangthaixuly.trim(),
        manv: d.Manv.trim(),
        tenNhanVien: nv?.Hoten?.trim() || d.Manv.trim(),
        chucVuNhanVien: nv?.Vitrilamviec?.trim() || "Pha chế",
        malich: d.Malich.trim(),
        ngayLam: dateStr,
        ngayLamHienThi: formatDateDisplay(dateStr),
        ngayLamNgan: formatDateShort(dateStr),
        maca: ca?.Maca?.trim() || "",
        tenCa: loaica,
        khungGio: `${gioBatDau} – ${gioKetThuc}`,
        manvnhanthay: d.Manvnhanthay ? d.Manvnhanthay.trim() : null,
        tenNhanVienThay: nvThay?.Hoten?.trim() || null,
        chucVuNhanVienThay: nvThay?.Vitrilamviec?.trim() || null,
        nguoiThayHopLe,
        khongCoNguoiThay: d.Manvnhanthay === null,
        danhSachCaHienTai: workers,
        thoiGian: "Gần đây",
        lyDo: d.Manvnhanthay ? "Đổi ca làm việc" : "Không có người thay thế",
      });
    }

    return items;
  });
}

/**
 * Xử lý đổi ca: cập nhật NhanVien_LichLam và đổi trạng thái DonXinDoiCa trong 1 transaction.
 */
export async function xuLyDoiCa(
  input: XuLyDoiCaInput
): Promise<{ ok: true; message: string }> {
  const cleanMadon = input.Madon.trim();
  const manvThay =
    typeof input.Manvnhanthay === "string"
      ? input.Manvnhanthay.trim().toUpperCase()
      : "";

  if (!manvThay) {
    throw new DoiCaServiceError(
      "Vui lòng chọn người thay ca.",
      400,
      "MISSING_REPLACEMENT"
    );
  }

  return await withDbRetry(async (db) => {
    return await db.$transaction(async (tx) => {
      // 1. Kiểm tra đơn đổi ca
      const don = await tx.donXinDoiCa.findUnique({
        where: { Madon: cleanMadon },
        include: {
          LichLam: true,
        },
      });

      if (!don || !don.Madon.trim().toUpperCase().startsWith("DD")) {
        throw new DoiCaServiceError(
          "Không tìm thấy đơn đổi ca.",
          404,
          "NOT_FOUND"
        );
      }

      if (don.Trangthaixuly !== "Chưa xử lý") {
        throw new DoiCaServiceError(
          "Đơn đổi ca này đã được xử lý trước đó.",
          400,
          "ALREADY_PROCESSED"
        );
      }

      if (manvThay === don.Manv.trim()) {
        throw new DoiCaServiceError(
          "Không thể chọn chính nhân viên xin đổi làm người nhận thay.",
          400,
          "INVALID_REPLACEMENT"
        );
      }

      const [senderNv, targetNv, alreadyInShift] = await Promise.all([
        tx.nhanVien.findUnique({
          where: { Manv: don.Manv.trim() },
          select: { Vitrilamviec: true },
        }),
        tx.nhanVien.findUnique({
          where: { Manv: manvThay },
        }),
        tx.nhanVien_LichLam.findUnique({
          where: {
            Manv_Malich: {
              Manv: manvThay,
              Malich: don.Malich,
            },
          },
        }),
      ]);

      if (!targetNv) {
        throw new DoiCaServiceError(
          "Nhân viên nhận thay không tồn tại trên hệ thống.",
          404,
          "EMPLOYEE_NOT_FOUND"
        );
      }

      if (targetNv.Trangthai.trim() === "Đã nghỉ việc") {
        throw new DoiCaServiceError(
          "Nhân viên nhận thay đã nghỉ việc.",
          400,
          "INACTIVE_EMPLOYEE"
        );
      }

      if (
        senderNv &&
        targetNv.Vitrilamviec.trim() !== senderNv.Vitrilamviec.trim()
      ) {
        throw new DoiCaServiceError(
          "Xử lý đổi ca thất bại.",
          400,
          "POSITION_MISMATCH"
        );
      }

      if (alreadyInShift) {
        throw new DoiCaServiceError(
          "Nhân viên nhận thay đã có trong lịch làm của ca này.",
          400,
          "ALREADY_IN_SHIFT"
        );
      }

      // 2. Xóa nhân viên xin đổi ca và thêm người thay thế vào NhanVien_LichLam
      await tx.nhanVien_LichLam.deleteMany({
        where: {
          Manv: don.Manv,
          Malich: don.Malich,
        },
      });

      await tx.nhanVien_LichLam.create({
        data: {
          Manv: manvThay,
          Malich: don.Malich,
        },
      });

      // 3. Cập nhật trạng thái đơn sang 'Đã xử lý'
      await tx.donXinDoiCa.update({
        where: { Madon: cleanMadon },
        data: {
          Trangthaixuly: "Đã xử lý",
          Manvnhanthay: manvThay,
        },
      });

      return {
        ok: true,
        message: XU_LY_DOI_CA_THANH_CONG,
      };
    }, SHORT_TX_OPTIONS);
  });
}
