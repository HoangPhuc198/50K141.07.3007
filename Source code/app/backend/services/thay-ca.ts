import type { Prisma, PrismaClient } from "@prisma/client";
import { withDbRetry } from "@database/client";
import { SHORT_TX_OPTIONS, acquireAdvisoryXactLock } from "@backend/lib/db-lock";
import { parseTimeToMinutes } from "@backend/calc/chamcong";
import {
  URGENT_SHIFT_MINUTES,
  addDaysVN,
  formatDateVN,
  formatTimeFromDb,
  nowVN,
} from "@backend/lib/time";
import { THONG_BAO_THONG_TIN_HET_HAN_NGAY } from "@frontend/lib/thong-bao-da-doc";
import type { CreateThayCaInput } from "@backend/validators/thay-ca";
import {
  THAY_CA_CANH_BAO_KHONG_NGUOI_RANH,
  THAY_CA_CANH_BAO_SAT_GIO,
  THAY_CA_DA_CO_NGUOI_NHAN,
  THAY_CA_XAC_NHAN_THANH_CONG,
} from "@frontend/config/thong-bao";
import { chotTangCaHetHan } from "./cham-cong";

type DbClient = PrismaClient | Prisma.TransactionClient;

export class ThayCaServiceError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "ThayCaServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface NguoiDuocMoiItem {
  manv: string;
  hoten: string;
  vitri: string;
  lichRanh: string;
  trangThai: "Chờ phản hồi" | "Đã nhận ca" | "Đã từ chối";
}

export interface ThayCaEntry {
  id: string;
  malich: string;
  maca: string;
  tenCa: string;
  ngayLam: string; // YYYY-MM-DD
  ngayHienThi: string; // DD/MM/YYYY
  thu: string;
  gioBatDau: string;
  gioKetThuc: string;
  manvXinNghi: string;
  tenNhanVienXinNghi: string;
  viTriCanThay: string;
  lyDo: string;
  nguoiDuocMoi: NguoiDuocMoiItem[];
  tuChoiSet: Set<string>;
  trangThai: "Đang mở" | "Đã nhận" | "Đã hủy";
  manvNhanThay: string | null;
  tenNhanVienNhanThay: string | null;
  claimingByManv: string | null;
  khongCoNguoiRanh: boolean;
  taoLuc: Date;
  nhanLuc: Date | null;
}

export interface ThayCaPublicItem {
  id: string;
  malich: string;
  maca: string;
  tenCa: string;
  ngayLam: string;
  ngayHienThi: string;
  thu: string;
  gioBatDau: string;
  gioKetThuc: string;
  manvXinNghi: string;
  tenNhanVienXinNghi: string;
  viTriCanThay: string;
  lyDo: string;
  nguoiDuocMoi: NguoiDuocMoiItem[];
  trangThai: "Đang mở" | "Đã nhận" | "Đã hủy";
  manvNhanThay: string | null;
  tenNhanVienNhanThay: string | null;
  khongCoNguoiRanh: boolean;
  satGio: boolean;
  taoLucIso?: string;
  tuChoiCount?: number;
}

export interface CaTrongNgayThayCaItem {
  malich: string;
  maca: string;
  loaica: string;
  gioBatDau: string;
  gioKetThuc: string;
  khungGio: string;
  nhanOptionLabel: string;
  nhanViensRanh: NguoiDuocMoiItem[];
  daGuiYeuCau: boolean;
  yeuCauHienTai: ThayCaPublicItem | null;
}

export interface CaTrongNgayThayCaResponse {
  ngayStr: string;
  ngayHienThi: string;
  thu: string;
  ngayDai: string;
  danhSachCa: CaTrongNgayThayCaItem[];
}

export interface ThayCaDangMoResponse {
  loiMoi: ThayCaPublicItem[];
  yeuCauCuaToi: ThayCaPublicItem[];
}

export interface CanhBaoThayCaChuQuanItem {
  id: string;
  malich: string;
  tenNhanVienXinNghi: string;
  manvXinNghi: string;
  tenCa: string;
  khungGio: string;
  ngayHienThi: string;
  lyDo: string;
  satGio: boolean;
  khongCoNguoiRanh: boolean;
  noiDungCanhBao: string;
  ngayLam?: string;
  taoLucIso?: string;
}

export interface DaNhanThayCaChuQuanItem {
  id: string;
  tenNhanVienXinNghi: string;
  tenNhanVienNhanThay: string;
  tenCa: string;
  khungGio: string;
  ngayHienThi: string;
  manvNhanThay?: string | null;
  ngayLam?: string;
  taoLucIso?: string;
}

const TEN_THU = [
  "Chủ nhật",
  "Thứ hai",
  "Thứ ba",
  "Thứ tư",
  "Thứ năm",
  "Thứ sáu",
  "Thứ bảy",
] as const;

function getThuFromIso(dateStr: string): string {
  const dateObj = new Date(`${dateStr}T00:00:00Z`);
  return TEN_THU[dateObj.getUTCDay()] || "";
}

function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function formatGioNgan(hhmm: string): string {
  const [h, m] = hhmm.split(":");
  const hNum = parseInt(h || "0", 10);
  if (m === "00") return `${hNum}h`;
  return `${hNum}h${m}`;
}

/**
 * Giữ hàm helper tương thích cho các bộ kiểm thử cũ, nhưng KHÔNG dùng bộ nhớ máy chủ
 * để lưu trạng thái giữa các request (mọi trạng thái lưu bền trong PostgreSQL).
 */
export function getThayCaMap(): Map<string, ThayCaEntry> {
  return new Map<string, ThayCaEntry>();
}

export async function clearThayCaMapForTest(): Promise<void> {
  await withDbRetry(async (db) => {
    await db.yeuCauBoSungCC.deleteMany({
      where: { Mayeucau: { startsWith: "TC" } },
    });
    await db.donXinDoiCa.deleteMany({
      where: {
        OR: [
          { Madon: { startsWith: "TC" } },
          { Madon: { startsWith: "TD" } },
        ],
      },
    });
  });
}

export async function pruneDeletedShiftsFromThayCaMap(): Promise<void> {
  // Trạng thái lưu bền trong CSDL có khóa ngoại tới LichLam, không cần dọn Map trong bộ nhớ.
}

function parseCodeNumber(code: string | null | undefined, prefix: string): number {
  if (!code) return 0;
  const trimmed = code.trim().toUpperCase();
  if (!trimmed.startsWith(prefix)) return 0;
  const numPart = trimmed.slice(prefix.length);
  if (!/^\d+$/.test(numPart)) return 0;
  const num = parseInt(numPart, 10);
  return Number.isFinite(num) ? num : 0;
}

async function generateNextThayCaId(tx: DbClient): Promise<string> {
  const [donRows, ycRows] = await Promise.all([
    tx.donXinDoiCa.findMany({
      where: { Madon: { startsWith: "TC" } },
      select: { Madon: true },
    }),
    tx.yeuCauBoSungCC.findMany({
      where: { Mayeucau: { startsWith: "TC" } },
      select: { Mayeucau: true },
    }),
  ]);
  let maxNum = 0;
  for (const r of donRows) {
    const n = parseCodeNumber(r.Madon, "TC");
    if (n > maxNum) maxNum = n;
  }
  for (const r of ycRows) {
    const n = parseCodeNumber(r.Mayeucau, "TC");
    if (n > maxNum) maxNum = n;
  }
  return `TC${String(maxNum + 1).padStart(6, "0")}`;
}

async function generateNextTuChoiId(tx: DbClient): Promise<string> {
  const tdRows = await tx.donXinDoiCa.findMany({
    where: { Madon: { startsWith: "TD" } },
    select: { Madon: true },
  });
  let maxNum = 0;
  for (const r of tdRows) {
    const n = parseCodeNumber(r.Madon, "TD");
    if (n > maxNum) maxNum = n;
  }
  return `TD${String(maxNum + 1).padStart(6, "0")}`;
}

/**
 * Đánh dấu các yêu cầu thay ca gấp đã quá giờ kết thúc ca mà chưa ai nhận
 * thành "Đã xử lý" (Manvnhanthay = null -> trạng thái "Đã hủy") để không hiện lại.
 */
async function dongYeuCauThayCaHetHan(db: DbClient, now: Date): Promise<void> {
  const openRows = await db.donXinDoiCa.findMany({
    where: {
      Madon: { startsWith: "TC" },
      Trangthaixuly: "Chưa xử lý",
      Manvnhanthay: null,
    },
    select: {
      Madon: true,
      LichLam: {
        select: {
          Ngaylam: true,
          CaLam: { select: { Gioketthuc: true } },
        },
      },
    },
  });

  const expiredIds: string[] = [];
  for (const r of openRows) {
    if (!r.LichLam?.CaLam) continue;
    const ngayLam = formatDateVN(r.LichLam.Ngaylam);
    const gioKetThuc = formatTimeFromDb(r.LichLam.CaLam.Gioketthuc);
    if (hasShiftEnded(ngayLam, gioKetThuc, now)) {
      expiredIds.push(r.Madon.trim());
    }
  }

  if (expiredIds.length > 0) {
    await db.donXinDoiCa.updateMany({
      where: {
        Madon: { in: expiredIds },
        Trangthaixuly: "Chưa xử lý",
        Manvnhanthay: null,
      },
      data: { Trangthaixuly: "Đã xử lý" },
    });
  }
}

function toTimeDbFromNow(now: Date): Date {
  return new Date(
    Date.UTC(
      1970,
      0,
      1,
      now.getHours(),
      now.getMinutes(),
      now.getSeconds()
    )
  );
}

function hasShiftEnded(ngayLam: string, gioKetThuc: string, now: Date): boolean {
  const todayStr = formatDateVN(now);
  if (ngayLam < todayStr) return true;
  if (ngayLam > todayStr) return false;
  const hienTaiPhut =
    now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  return hienTaiPhut >= parseTimeToMinutes(gioKetThuc);
}

function isSatGio(
  entry: { ngayLam: string; gioBatDau: string; gioKetThuc: string },
  now: Date
): boolean {
  const todayStr = formatDateVN(now);
  if (entry.ngayLam !== todayStr) return false;
  if (hasShiftEnded(entry.ngayLam, entry.gioKetThuc, now)) return false;
  const hienTaiPhut =
    now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const batDauPhut = parseTimeToMinutes(entry.gioBatDau);
  const phutConLai = batDauPhut - hienTaiPhut;
  return phutConLai <= URGENT_SHIFT_MINUTES;
}

function formatTaoLucIso(ngayLam: string, taoLuc: Date, fallbackGio: string): string {
  if (taoLuc && taoLuc.getTime() > 0) {
    return `${ngayLam}T${taoLuc.toISOString().slice(11, 19)}`;
  }
  return `${ngayLam}T${fallbackGio}:00`;
}

function serializeThayCa(entry: ThayCaEntry, now: Date): ThayCaPublicItem {
  return {
    id: entry.id,
    malich: entry.malich,
    maca: entry.maca,
    tenCa: entry.tenCa,
    ngayLam: entry.ngayLam,
    ngayHienThi: entry.ngayHienThi,
    thu: entry.thu,
    gioBatDau: entry.gioBatDau,
    gioKetThuc: entry.gioKetThuc,
    manvXinNghi: entry.manvXinNghi,
    tenNhanVienXinNghi: entry.tenNhanVienXinNghi,
    viTriCanThay: entry.viTriCanThay,
    lyDo: entry.lyDo,
    nguoiDuocMoi: entry.nguoiDuocMoi.map((n) => ({ ...n })),
    trangThai: entry.trangThai,
    manvNhanThay: entry.manvNhanThay,
    tenNhanVienNhanThay: entry.tenNhanVienNhanThay,
    khongCoNguoiRanh: entry.khongCoNguoiRanh,
    satGio: isSatGio(entry, now),
    taoLucIso: formatTaoLucIso(entry.ngayLam, entry.taoLuc, entry.gioBatDau),
    tuChoiCount: entry.tuChoiSet.size,
  };
}

/**
 * Đọc bền từ CSDL danh sách các yêu cầu thay ca gấp (`DonXinDoiCa` có `Madon` bắt đầu bằng `TC`)
 * cùng lý do (`YeuCauBoSungCC` có `Mayeucau` = `TCxxxxxx`) và danh sách từ chối (`DonXinDoiCa` có `Madon` = `TDxxxxxx`).
 */
async function loadThayCaEntriesFromDb(
  db: DbClient,
  filter: { todayDate?: Date; minDate?: Date; maxDate?: Date; id?: string }
): Promise<ThayCaEntry[]> {
  const dateFilter = filter.todayDate
    ? { LichLam: { Ngaylam: filter.todayDate } }
    : filter.minDate || filter.maxDate
    ? {
        LichLam: {
          Ngaylam: {
            ...(filter.minDate ? { gte: filter.minDate } : {}),
            ...(filter.maxDate ? { lte: filter.maxDate } : {}),
          },
        },
      }
    : {};

  const whereClause: Prisma.DonXinDoiCaWhereInput = filter.id
    ? { Madon: filter.id.trim() }
    : {
        Madon: { startsWith: "TC" },
        ...dateFilter,
      };

  const tcRows = await db.donXinDoiCa.findMany({
    where: whereClause,
    include: {
      NhanVien_DonXinDoiCa_ManvToNhanVien: {
        select: {
          Manv: true,
          Hoten: true,
          Vitrilamviec: true,
          Trangthai: true,
        },
      },
      NhanVien_DonXinDoiCa_ManvnhanthayToNhanVien: {
        select: {
          Manv: true,
          Hoten: true,
          Vitrilamviec: true,
        },
      },
      LichLam: {
        include: {
          CaLam: true,
          NhanVien_LichLam: {
            select: { Manv: true },
          },
        },
      },
    },
    orderBy: { Madon: "asc" },
  });

  const validTcRows = tcRows.filter((r) =>
    r.Madon.trim().toUpperCase().startsWith("TC")
  );
  if (validTcRows.length === 0) return [];

  const tcIds = validTcRows.map((r) => r.Madon.trim());
  const malichIds = Array.from(
    new Set(validTcRows.map((r) => r.Malich.trim()))
  );
  const ngayDates = Array.from(
    new Set(validTcRows.map((r) => r.LichLam.Ngaylam.toISOString()))
  ).map((iso) => new Date(iso));

  const [ycMetaRows, tdDeclineRows, lichRanhRows] = await Promise.all([
    db.yeuCauBoSungCC.findMany({
      where: { Mayeucau: { in: tcIds } },
      select: {
        Mayeucau: true,
        Lydo: true,
        Giovaobosung: true,
        Giorabosung: true,
      },
    }),
    db.donXinDoiCa.findMany({
      where: {
        Madon: { startsWith: "TD" },
        Malich: { in: malichIds },
      },
      select: {
        Madon: true,
        Manv: true,
        Malich: true,
        Manvnhanthay: true,
      },
    }),
    db.lichRanh.findMany({
      where: { Ngayranh: { in: ngayDates } },
      include: {
        NhanVien: {
          select: {
            Manv: true,
            Hoten: true,
            Vitrilamviec: true,
            Trangthai: true,
          },
        },
      },
      orderBy: { Manv: "asc" },
    }),
  ]);

  const metaByTcId = new Map(
    ycMetaRows.map((m) => [m.Mayeucau.trim().toUpperCase(), m])
  );

  const entries: ThayCaEntry[] = [];

  for (const tc of validTcRows) {
    const ll = tc.LichLam;
    const senderNv = tc.NhanVien_DonXinDoiCa_ManvToNhanVien;
    if (!ll || !ll.CaLam || !senderNv) continue;

    const id = tc.Madon.trim();
    const malich = ll.Malich.trim();
    const maca = ll.Maca.trim();
    const tenCa = ll.CaLam.Loaica.trim();
    const ngayLam = formatDateVN(ll.Ngaylam);
    const ngayHienThi = formatDateDisplay(ngayLam);
    const thu = getThuFromIso(ngayLam);
    const gioBatDau = formatTimeFromDb(ll.CaLam.Giobatdau);
    const gioKetThuc = formatTimeFromDb(ll.CaLam.Gioketthuc);
    const manvXinNghi = tc.Manv.trim().toUpperCase();
    const tenNhanVienXinNghi = senderNv.Hoten.trim();
    const viTriCanThay = senderNv.Vitrilamviec.trim();

    const manvNhanThay = tc.Manvnhanthay
      ? tc.Manvnhanthay.trim().toUpperCase()
      : null;
    const tenNhanVienNhanThay = tc.NhanVien_DonXinDoiCa_ManvnhanthayToNhanVien
      ? tc.NhanVien_DonXinDoiCa_ManvnhanthayToNhanVien.Hoten.trim()
      : null;

    const rawTrangThai = tc.Trangthaixuly.trim();
    const trangThai: "Đang mở" | "Đã nhận" | "Đã hủy" =
      rawTrangThai === "Đã xử lý" && manvNhanThay
        ? "Đã nhận"
        : rawTrangThai === "Chưa xử lý"
        ? "Đang mở"
        : "Đã hủy";

    const tuChoiSet = new Set<string>();
    for (const td of tdDeclineRows) {
      if (
        td.Manv.trim().toUpperCase() === manvXinNghi &&
        td.Malich.trim() === malich &&
        td.Manvnhanthay
      ) {
        tuChoiSet.add(td.Manvnhanthay.trim().toUpperCase());
      }
    }

    // Khi ca đã được người nhận thay (manvNhanThay), người nhận đã được thêm vào NhanVien_LichLam;
    // không loại người nhận khỏi danh sách nguoiDuocMoi để hiển thị đúng trạng thái "Đã nhận ca".
    const busySet = new Set(
      ll.NhanVien_LichLam.map((x) => x.Manv.trim().toUpperCase()).filter(
        (m) => m !== manvNhanThay
      )
    );

    const nguoiDuocMoi: NguoiDuocMoiItem[] = [];
    const seenManv = new Set<string>();
    for (const lr of lichRanhRows) {
      if (formatDateVN(lr.Ngayranh) !== ngayLam) continue;
      if (lr.Caranh.trim() !== maca) continue;
      const nv = lr.NhanVien;
      if (!nv || nv.Trangthai === "Đã nghỉ việc") continue;
      if (nv.Vitrilamviec.trim() !== viTriCanThay) continue;
      const eManv = nv.Manv.trim().toUpperCase();
      if (eManv === manvXinNghi || busySet.has(eManv) || seenManv.has(eManv)) {
        continue;
      }
      seenManv.add(eManv);

      let itemTrangThai: "Chờ phản hồi" | "Đã nhận ca" | "Đã từ chối" =
        "Chờ phản hồi";
      if (manvNhanThay && eManv === manvNhanThay) {
        itemTrangThai = "Đã nhận ca";
      } else if (tuChoiSet.has(eManv)) {
        itemTrangThai = "Đã từ chối";
      }

      nguoiDuocMoi.push({
        manv: eManv,
        hoten: nv.Hoten.trim(),
        vitri: nv.Vitrilamviec.trim(),
        lichRanh: `${gioBatDau} – ${gioKetThuc}`,
        trangThai: itemTrangThai,
      });
    }

    nguoiDuocMoi.sort((a, b) => a.hoten.localeCompare(b.hoten, "vi"));

    const meta = metaByTcId.get(id.toUpperCase());
    const lyDo = meta?.Lydo?.trim() || "";
    const taoLuc = meta?.Giorabosung ? new Date(meta.Giorabosung) : new Date(0);
    const nhanLuc =
      trangThai === "Đã nhận" && meta?.Giorabosung
        ? new Date(meta.Giorabosung)
        : null;

    entries.push({
      id,
      malich,
      maca,
      tenCa,
      ngayLam,
      ngayHienThi,
      thu,
      gioBatDau,
      gioKetThuc,
      manvXinNghi,
      tenNhanVienXinNghi,
      viTriCanThay,
      lyDo,
      nguoiDuocMoi,
      tuChoiSet,
      trangThai,
      manvNhanThay,
      tenNhanVienNhanThay,
      claimingByManv: null,
      khongCoNguoiRanh: nguoiDuocMoi.length === 0,
      taoLuc,
      nhanLuc,
    });
  }

  return entries;
}

/**
 * Lấy danh sách ca làm trong ngày hôm nay của nhân viên (chưa kết thúc)
 * kèm danh sách nhân viên có lịch rảnh phù hợp (chỉ ĐỌC, không ghi CSDL).
 */
export async function layCaTrongNgayChoThayCa(
  manv: string
): Promise<CaTrongNgayThayCaResponse> {
  const cleanManv = manv.trim().toUpperCase();
  const now = nowVN();
  const todayStr = formatDateVN(now);
  const todayDate = new Date(`${todayStr}T00:00:00Z`);
  const thu = getThuFromIso(todayStr);
  const ngayHienThi = formatDateDisplay(todayStr);

  return withDbRetry(async (db) => {
    await dongYeuCauThayCaHetHan(db, now);

    const [senderNv, nvLichLams, allLichRanhToday, todayEntries] =
      await Promise.all([
        db.nhanVien.findUnique({
          where: { Manv: cleanManv },
          select: { Vitrilamviec: true },
        }),
        db.nhanVien_LichLam.findMany({
          where: {
            Manv: cleanManv,
            LichLam: { Ngaylam: todayDate },
          },
          include: {
            LichLam: {
              include: {
                CaLam: true,
                NhanVien_LichLam: {
                  select: { Manv: true },
                },
              },
            },
          },
        }),
        db.lichRanh.findMany({
          where: { Ngayranh: todayDate },
          include: {
            NhanVien: {
              select: {
                Manv: true,
                Hoten: true,
                Vitrilamviec: true,
                Trangthai: true,
              },
            },
          },
          orderBy: { Manv: "asc" },
        }),
        loadThayCaEntriesFromDb(db, { todayDate }),
      ]);

    const targetViTri = senderNv?.Vitrilamviec?.trim() || null;

    const myRequestsByMalich = new Map<string, ThayCaEntry>();
    for (const entry of todayEntries) {
      if (
        entry.ngayLam === todayStr &&
        entry.manvXinNghi === cleanManv &&
        entry.trangThai !== "Đã hủy"
      ) {
        const existing = myRequestsByMalich.get(entry.malich);
        if (!existing || entry.id >= existing.id) {
          myRequestsByMalich.set(entry.malich, entry);
        }
      }
    }

    const danhSachCa: CaTrongNgayThayCaItem[] = [];

    for (const item of nvLichLams) {
      const ll = item.LichLam;
      if (!ll || !ll.CaLam) continue;

      const gioBatDau = formatTimeFromDb(ll.CaLam.Giobatdau);
      const gioKetThuc = formatTimeFromDb(ll.CaLam.Gioketthuc);

      if (hasShiftEnded(todayStr, gioKetThuc, now)) continue;

      const malich = ll.Malich.trim();
      const maca = ll.CaLam.Maca.trim();
      const loaica = ll.CaLam.Loaica.trim();
      const busySet = new Set(
        ll.NhanVien_LichLam.map((x) => x.Manv.trim().toUpperCase())
      );

      const nhanViensRanh: NguoiDuocMoiItem[] = [];
      const seenManv = new Set<string>();
      for (const lr of allLichRanhToday) {
        if (lr.Caranh.trim() !== maca) continue;
        const nv = lr.NhanVien;
        if (!nv || nv.Trangthai === "Đã nghỉ việc") continue;
        if (targetViTri && nv.Vitrilamviec.trim() !== targetViTri) continue;
        const eManv = nv.Manv.trim().toUpperCase();
        if (eManv === cleanManv || busySet.has(eManv) || seenManv.has(eManv)) {
          continue;
        }
        seenManv.add(eManv);
        nhanViensRanh.push({
          manv: eManv,
          hoten: nv.Hoten.trim(),
          vitri: nv.Vitrilamviec.trim(),
          lichRanh: `${gioBatDau} – ${gioKetThuc}`,
          trangThai: "Chờ phản hồi",
        });
      }

      nhanViensRanh.sort((a, b) => a.hoten.localeCompare(b.hoten, "vi"));

      const existingReq = myRequestsByMalich.get(malich) || null;
      const yeuCauHienTai = existingReq
        ? serializeThayCa(existingReq, now)
        : null;

      danhSachCa.push({
        malich,
        maca,
        loaica,
        gioBatDau,
        gioKetThuc,
        khungGio: `${gioBatDau} – ${gioKetThuc}`,
        nhanOptionLabel: `${loaica} ${formatGioNgan(gioBatDau)} - ${formatGioNgan(gioKetThuc)}`,
        nhanViensRanh: yeuCauHienTai ? yeuCauHienTai.nguoiDuocMoi : nhanViensRanh,
        daGuiYeuCau: Boolean(existingReq),
        yeuCauHienTai,
      });
    }

    // Nếu người xin nghỉ đã được thay thế (đã xóa khỏi NhanVien_LichLam khi chưa check-in),
    // vẫn bổ sung ca từ yêu cầu đã nhận trong ngày để hiển thị trạng thái UC_2.3_05 ("Đã có nhân viên đồng ý").
    for (const entry of myRequestsByMalich.values()) {
      if (
        entry.trangThai === "Đã nhận" &&
        !danhSachCa.some((c) => c.malich === entry.malich)
      ) {
        const serialized = serializeThayCa(entry, now);
        danhSachCa.push({
          malich: entry.malich,
          maca: entry.maca,
          loaica: entry.tenCa,
          gioBatDau: entry.gioBatDau,
          gioKetThuc: entry.gioKetThuc,
          khungGio: `${entry.gioBatDau} – ${entry.gioKetThuc}`,
          nhanOptionLabel: `${entry.tenCa} ${formatGioNgan(entry.gioBatDau)} - ${formatGioNgan(entry.gioKetThuc)}`,
          nhanViensRanh: serialized.nguoiDuocMoi,
          daGuiYeuCau: true,
          yeuCauHienTai: serialized,
        });
      }
    }

    danhSachCa.sort((a, b) => a.gioBatDau.localeCompare(b.gioBatDau));

    return {
      ngayStr: todayStr,
      ngayHienThi,
      thu,
      ngayDai: `${thu}, ${ngayHienThi}`,
      danhSachCa,
    };
  });
}

/**
 * Tạo yêu cầu thay ca gấp (lưu bền trong PostgreSQL qua DonXinDoiCa + YeuCauBoSungCC với mã TCxxxxxx).
 */
export async function taoYeuCauThayCa(
  manv: string,
  input: CreateThayCaInput
): Promise<{ yeuCau: ThayCaPublicItem }> {
  const cleanManv = manv.trim().toUpperCase();
  const cleanMalich = input.malich.trim();
  const now = nowVN();
  const todayStr = formatDateVN(now);
  const todayDate = new Date(`${todayStr}T00:00:00Z`);

  return withDbRetry(async (db) => {
    return db.$transaction(async (tx) => {
      await acquireAdvisoryXactLock(tx, "don_xin_doi_ca:tc_id");
      await dongYeuCauThayCaHetHan(tx, now);

      const [ll, senderNv] = await Promise.all([
        tx.lichLam.findUnique({
          where: { Malich: cleanMalich },
          include: {
            CaLam: true,
            NhanVien_LichLam: { select: { Manv: true } },
          },
        }),
        tx.nhanVien.findUnique({
          where: { Manv: cleanManv },
          select: { Manv: true, Hoten: true, Vitrilamviec: true, Trangthai: true },
        }),
      ]);

      if (!ll || !ll.CaLam) {
        throw new ThayCaServiceError("Không tìm thấy thông tin ca làm.", 404, "NOT_FOUND");
      }

      if (!senderNv || senderNv.Trangthai === "Đã nghỉ việc") {
        throw new ThayCaServiceError(
          "Không tìm thấy thông tin nhân viên.",
          404,
          "EMPLOYEE_NOT_FOUND"
        );
      }

      const shiftDateStr = formatDateVN(ll.Ngaylam);
      if (shiftDateStr !== todayStr) {
        throw new ThayCaServiceError(
          "Chỉ hỗ trợ báo nghỉ gấp cho ca làm trong ngày hôm nay.",
          400,
          "NOT_TODAY_SHIFT"
        );
      }

      const gioBatDau = formatTimeFromDb(ll.CaLam.Giobatdau);
      const gioKetThuc = formatTimeFromDb(ll.CaLam.Gioketthuc);
      if (hasShiftEnded(shiftDateStr, gioKetThuc, now)) {
        throw new ThayCaServiceError("Ca làm này đã kết thúc.", 400, "SHIFT_ENDED");
      }

      const busySet = new Set(
        ll.NhanVien_LichLam.map((x) => x.Manv.trim().toUpperCase())
      );
      if (!busySet.has(cleanManv)) {
        throw new ThayCaServiceError(
          "Ca làm này không thuộc lịch làm của bạn.",
          400,
          "NOT_ASSIGNED"
        );
      }

      const existingOpen = await tx.donXinDoiCa.findFirst({
        where: {
          Madon: { startsWith: "TC" },
          Manv: cleanManv,
          Malich: cleanMalich,
          Trangthaixuly: "Chưa xử lý",
        },
        select: { Madon: true },
      });

      if (existingOpen) {
        throw new ThayCaServiceError(
          "Ca làm này đang có yêu cầu thay ca chờ phản hồi.",
          400,
          "DUPLICATE_REQUEST"
        );
      }

      // Xóa các bản ghi từ chối cũ (TDxxxxxx) nếu có của cùng người gửi và ca làm này
      await tx.donXinDoiCa.deleteMany({
        where: {
          Madon: { startsWith: "TD" },
          Manv: cleanManv,
          Malich: cleanMalich,
        },
      });

      const id = await generateNextThayCaId(tx);
      const lyDo = input.lyDo?.trim() || "";

      await tx.donXinDoiCa.create({
        data: {
          Madon: id,
          Trangthaixuly: "Chưa xử lý",
          Manv: cleanManv,
          Malich: cleanMalich,
          Manvnhanthay: null,
        },
      });

      await tx.yeuCauBoSungCC.create({
        data: {
          Mayeucau: id,
          Giovaobosung: null,
          Giorabosung: toTimeDbFromNow(now),
          Lydo: lyDo,
          Trangthai: "Đã xử lý",
          Manv: cleanManv,
          Malich: cleanMalich,
        },
      });

      const loaded = await loadThayCaEntriesFromDb(tx, {
        todayDate,
        id,
      });
      const entry = loaded[0];
      if (!entry) {
        throw new ThayCaServiceError(
          "Không thể khởi tạo yêu cầu thay ca.",
          500,
          "INTERNAL_ERROR"
        );
      }

      return {
        yeuCau: serializeThayCa(entry, now),
      };
    }, SHORT_TX_OPTIONS);
  });
}

function getThayCaWindowDatesVN(now: Date): {
  todayStr: string;
  todayDate: Date;
  minInfoStr: string;
  minInfoDate: Date;
} {
  const todayStr = formatDateVN(now);
  const todayDate = new Date(`${todayStr}T00:00:00Z`);
  const minInfoStr = formatDateVN(
    addDaysVN(now, -(THONG_BAO_THONG_TIN_HET_HAN_NGAY + 1))
  );
  const minInfoDate = new Date(`${minInfoStr}T00:00:00Z`);
  return { todayStr, todayDate, minInfoStr, minInfoDate };
}

/**
 * Lấy danh sách yêu cầu thay ca đang mở cho nhân viên (polling 5–10 giây):
 * - loiMoi: chỉ các yêu cầu hợp lệ trong ngày với NV đang đăng nhập (có trong danh sách rảnh, cùng vị trí, chưa từ chối, không phải người gửi, ca chưa kết thúc)
 * - yeuCauCuaToi: các yêu cầu đang mở trong ngày + các yêu cầu đã được nhận thay trong cửa sổ thông báo thông tin
 */
export async function layYeuCauThayCaDangMo(
  manv: string
): Promise<ThayCaDangMoResponse> {
  const cleanManv = manv.trim().toUpperCase();
  const now = nowVN();
  const { todayStr, todayDate, minInfoStr, minInfoDate } =
    getThayCaWindowDatesVN(now);

  return withDbRetry(async (db) => {
    await chotTangCaHetHan({ db, manv: cleanManv, now });
    await dongYeuCauThayCaHetHan(db, now);
    const entries = await loadThayCaEntriesFromDb(db, {
      minDate: minInfoDate,
      maxDate: todayDate,
    });

    const loiMoi: ThayCaPublicItem[] = [];
    const yeuCauCuaToi: ThayCaPublicItem[] = [];

    for (const entry of entries) {
      if (entry.ngayLam > todayStr || entry.ngayLam < minInfoStr) continue;

      if (entry.manvXinNghi === cleanManv) {
        if (
          entry.trangThai === "Đã nhận" ||
          (entry.ngayLam === todayStr &&
            entry.trangThai === "Đang mở" &&
            !hasShiftEnded(entry.ngayLam, entry.gioKetThuc, now))
        ) {
          yeuCauCuaToi.push(serializeThayCa(entry, now));
        }
        continue;
      }

      if (
        entry.ngayLam === todayStr &&
        entry.trangThai === "Đang mở" &&
        !hasShiftEnded(entry.ngayLam, entry.gioKetThuc, now) &&
        !entry.tuChoiSet.has(cleanManv) &&
        entry.nguoiDuocMoi.some((n) => n.manv === cleanManv)
      ) {
        loiMoi.push(serializeThayCa(entry, now));
      }
    }

    loiMoi.sort((a, b) => a.gioBatDau.localeCompare(b.gioBatDau));
    yeuCauCuaToi.sort((a, b) => b.id.localeCompare(a.id));

    return { loiMoi, yeuCauCuaToi };
  });
}

/**
 * Nhân viên bấm "Chấp nhận" thay ca:
 * - Khóa nguyên tử mức bảng trong transaction PostgreSQL để khi hai người bấm cùng lúc (kể cả trên nhiều instance serverless) chỉ MỘT người thắng.
 * - Thêm trực tiếp người thắng vào NhanVien_LichLam trong 1 transaction DB (không cần CQ duyệt).
 * - Người sau nhận lỗi 409 với thông báo chuẩn "Đã có người nhận thay ca".
 */
export async function chapNhanThayCa(
  id: string,
  manv: string
): Promise<{ message: string; yeuCau: ThayCaPublicItem }> {
  const cleanId = id.trim();
  const cleanManv = manv.trim().toUpperCase();
  const now = nowVN();
  let shiftEndedDetected = false;

  try {
    return await withDbRetry(async (db) => {
      return db.$transaction(async (tx) => {
        await acquireAdvisoryXactLock(tx, `thay_ca:${cleanId.toUpperCase()}`);

        const entries = await loadThayCaEntriesFromDb(tx, { id: cleanId });
        const entry = entries[0];

        if (!entry) {
          throw new ThayCaServiceError(
            "Không tìm thấy yêu cầu thay ca.",
            404,
            "NOT_FOUND"
          );
        }

        if (entry.manvXinNghi === cleanManv) {
          throw new ThayCaServiceError(
            "Không thể tự nhận thay ca cho chính mình.",
            400,
            "SELF_REPLACEMENT"
          );
        }

        if (!entry.nguoiDuocMoi.some((n) => n.manv === cleanManv)) {
          throw new ThayCaServiceError(
            "Bạn không thuộc danh sách nhân viên có lịch rảnh cho ca này.",
            403,
            "FORBIDDEN"
          );
        }

        if (entry.trangThai === "Đã nhận" || entry.manvNhanThay !== null) {
          throw new ThayCaServiceError(
            THAY_CA_DA_CO_NGUOI_NHAN,
            409,
            "ALREADY_CLAIMED"
          );
        }

        if (hasShiftEnded(entry.ngayLam, entry.gioKetThuc, now)) {
          shiftEndedDetected = true;
          throw new ThayCaServiceError(
            "Ca làm này đã kết thúc.",
            400,
            "SHIFT_ENDED"
          );
        }

        if (entry.trangThai !== "Đang mở") {
          throw new ThayCaServiceError(
            "Yêu cầu thay ca này đã đóng.",
            400,
            "CLOSED_REQUEST"
          );
        }

      const nv = await tx.nhanVien.findUnique({
        where: { Manv: cleanManv },
        select: { Manv: true, Hoten: true, Vitrilamviec: true, Trangthai: true },
      });

      if (!nv || nv.Trangthai === "Đã nghỉ việc") {
        throw new ThayCaServiceError(
          "Không tìm thấy nhân viên.",
          404,
          "EMPLOYEE_NOT_FOUND"
        );
      }

      if (nv.Vitrilamviec.trim() !== entry.viTriCanThay.trim()) {
        throw new ThayCaServiceError(
          "Bạn không thuộc danh sách nhân viên có lịch rảnh cho ca này.",
          400,
          "POSITION_MISMATCH"
        );
      }

      // Cập nhật trạng thái yêu cầu thay ca gấp thành Đã xử lý + gán người nhận thay (có điều kiện nguyên tử)
      const claimed = await tx.donXinDoiCa.updateMany({
        where: {
          Madon: cleanId,
          Trangthaixuly: "Chưa xử lý",
          Manvnhanthay: null,
        },
        data: {
          Trangthaixuly: "Đã xử lý",
          Manvnhanthay: cleanManv,
        },
      });
      if (claimed.count === 0) {
        throw new ThayCaServiceError(
          THAY_CA_DA_CO_NGUOI_NHAN,
          409,
          "ALREADY_CLAIMED"
        );
      }

      await tx.yeuCauBoSungCC.updateMany({
        where: { Mayeucau: cleanId },
        data: {
          Giorabosung: toTimeDbFromNow(now),
        },
      });

      const existed = await tx.nhanVien_LichLam.findUnique({
        where: {
          Manv_Malich: {
            Manv: cleanManv,
            Malich: entry.malich,
          },
        },
      });

      if (!existed) {
        await tx.nhanVien_LichLam.create({
          data: {
            Manv: cleanManv,
            Malich: entry.malich,
          },
        });
      }

      // Nếu người xin nghỉ chưa chấm công ở ca này thì xóa khỏi NhanVien_LichLam
      // để tránh báo sai quên check-in (nếu đã check-in rồi vì về sớm thì giữ lại cho check-out)
      const senderChamCong = await tx.chamCong.findUnique({
        where: {
          Manv_Malich: {
            Manv: entry.manvXinNghi,
            Malich: entry.malich,
          },
        },
        select: { Machamcong: true },
      });

      if (!senderChamCong) {
        await tx.nhanVien_LichLam.deleteMany({
          where: {
            Manv: entry.manvXinNghi,
            Malich: entry.malich,
          },
        });
      }

      const updatedEntries = await loadThayCaEntriesFromDb(tx, { id: cleanId });
      const updatedEntry = updatedEntries[0] || {
        ...entry,
        trangThai: "Đã nhận" as const,
        manvNhanThay: cleanManv,
        tenNhanVienNhanThay: nv.Hoten.trim(),
        nguoiDuocMoi: entry.nguoiDuocMoi.map((n) =>
          n.manv === cleanManv ? { ...n, trangThai: "Đã nhận ca" as const } : n
        ),
      };

        return {
          message: THAY_CA_XAC_NHAN_THANH_CONG,
          yeuCau: serializeThayCa(updatedEntry, now),
        };
      }, SHORT_TX_OPTIONS);
    });
  } catch (error) {
    if (shiftEndedDetected) {
      await withDbRetry((db) => dongYeuCauThayCaHetHan(db, now)).catch(
        () => undefined
      );
    }
    throw error;
  }
}

/**
 * Nhân viên bấm "Không chấp nhận": ghi bền vào CSDL (bản ghi TDxxxxxx trong DonXinDoiCa)
 * để ẩn lời mời với riêng nhân viên này trên mọi instance/mọi lần chuyển trang, vẫn mở cho người rảnh khác.
 */
export async function tuChoiThayCa(
  id: string,
  manv: string
): Promise<{ ok: true }> {
  const cleanId = id.trim();
  const cleanManv = manv.trim().toUpperCase();

  return withDbRetry(async (db) => {
    return db.$transaction(async (tx) => {
      await acquireAdvisoryXactLock(tx, "don_xin_doi_ca:td_id");

      const entries = await loadThayCaEntriesFromDb(tx, { id: cleanId });
      const entry = entries[0];

      if (!entry) {
        throw new ThayCaServiceError(
          "Không tìm thấy yêu cầu thay ca.",
          404,
          "NOT_FOUND"
        );
      }

      if (!entry.nguoiDuocMoi.some((n) => n.manv === cleanManv)) {
        throw new ThayCaServiceError(
          "Bạn không thuộc danh sách nhân viên có lịch rảnh cho ca này.",
          403,
          "FORBIDDEN"
        );
      }

      const existingDecline = await tx.donXinDoiCa.findFirst({
        where: {
          Madon: { startsWith: "TD" },
          Manv: entry.manvXinNghi,
          Malich: entry.malich,
          Manvnhanthay: cleanManv,
        },
        select: { Madon: true },
      });

      if (!existingDecline) {
        const tdId = await generateNextTuChoiId(tx);
        await tx.donXinDoiCa.create({
          data: {
            Madon: tdId,
            Trangthaixuly: "Đã xử lý",
            Manv: entry.manvXinNghi,
            Malich: entry.malich,
            Manvnhanthay: cleanManv,
          },
        });
      }

      return { ok: true as const };
    }, SHORT_TX_OPTIONS);
  });
}

/**
 * Tổng hợp cảnh báo thay ca gấp & thông báo đã nhận ca cho Chủ quán (đọc bền từ CSDL).
 */
export async function layCanhBaoThayCaChoChuQuan(): Promise<{
  canhBaoList: CanhBaoThayCaChuQuanItem[];
  daNhanList: DaNhanThayCaChuQuanItem[];
}> {
  const now = nowVN();
  const { todayStr, todayDate, minInfoStr, minInfoDate } =
    getThayCaWindowDatesVN(now);

  const entries = await withDbRetry(async (db) => {
    await chotTangCaHetHan({ db, now });
    await dongYeuCauThayCaHetHan(db, now);
    return loadThayCaEntriesFromDb(db, {
      minDate: minInfoDate,
      maxDate: todayDate,
    });
  });

  const canhBaoList: CanhBaoThayCaChuQuanItem[] = [];
  const daNhanList: DaNhanThayCaChuQuanItem[] = [];

  for (const entry of entries) {
    if (entry.ngayLam > todayStr || entry.ngayLam < minInfoStr) continue;

    if (entry.trangThai === "Đã nhận" && entry.tenNhanVienNhanThay) {
      daNhanList.push({
        id: entry.id,
        tenNhanVienXinNghi: entry.tenNhanVienXinNghi,
        tenNhanVienNhanThay: entry.tenNhanVienNhanThay,
        tenCa: entry.tenCa,
        khungGio: `${entry.gioBatDau} – ${entry.gioKetThuc}`,
        ngayHienThi: entry.ngayHienThi,
        manvNhanThay: entry.manvNhanThay,
        ngayLam: entry.ngayLam,
        taoLucIso: formatTaoLucIso(entry.ngayLam, entry.taoLuc, entry.gioBatDau),
      });
      continue;
    }

    if (entry.ngayLam !== todayStr) continue;
    if (entry.trangThai !== "Đang mở") continue;
    if (hasShiftEnded(entry.ngayLam, entry.gioKetThuc, now)) continue;

    const satGio = isSatGio(entry, now);
    if (entry.khongCoNguoiRanh || satGio) {
      canhBaoList.push({
        id: entry.id,
        malich: entry.malich,
        tenNhanVienXinNghi: entry.tenNhanVienXinNghi,
        manvXinNghi: entry.manvXinNghi,
        tenCa: entry.tenCa,
        khungGio: `${entry.gioBatDau} – ${entry.gioKetThuc}`,
        ngayHienThi: entry.ngayHienThi,
        lyDo: entry.lyDo,
        satGio,
        khongCoNguoiRanh: entry.khongCoNguoiRanh,
        noiDungCanhBao: entry.khongCoNguoiRanh
          ? THAY_CA_CANH_BAO_KHONG_NGUOI_RANH
          : THAY_CA_CANH_BAO_SAT_GIO,
        ngayLam: entry.ngayLam,
        taoLucIso: formatTaoLucIso(entry.ngayLam, entry.taoLuc, entry.gioBatDau),
      });
    }
  }

  return { canhBaoList, daNhanList };
}
