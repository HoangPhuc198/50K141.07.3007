import { withDbRetry } from "@database/client";
import { Prisma } from "@prisma/client";
import type { KyLuong, PrismaClient } from "@prisma/client";
import { formatDateVN, nowVN } from "@backend/lib/time";
import { tinhGioLam } from "@backend/calc/chamcong";
import { chotTangCaHetHan } from "./cham-cong";
import {
  chonHeSoTheoNgayKey,
  laKyCuoiNam,
  ngayChiTra,
  tinhTongGioLam,
} from "@backend/calc/luong";
import {
  mapBangLuongTinh,
  type BangLuongTinhDto,
  type ChiTietNgayDto,
  type NgayLamRaw,
  type NhanVienLuongRaw,
} from "@backend/mappers/bang-luong";
import {
  GUI_BANG_LUONG_THANH_CONG,
  TINH_LUONG_THANH_CONG,
  TINH_LUONG_THAT_BAI,
} from "@frontend/config/thong-bao";

export type { BangLuongTinhDto, ChiTietNgayDto };

/** Lỗi nghiệp vụ UC_8.2; message luôn là chữ trong 08-THONG-BAO.md. */
export class TinhLuongError extends Error {
  statusCode: number;
  code: string;
  constructor(statusCode = 500, code = "TINH_LUONG_THAT_BAI") {
    super(TINH_LUONG_THAT_BAI);
    this.name = "TinhLuongError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export type KyLuongHienTaiDto = {
  Makyluong: string;
  Thang: number;
  Nam: number;
  Trangthai: string;
  Ngaychitra: string;
  Kycuoinam: boolean;
};

export type KetQuaKyDto = KyLuongHienTaiDto & {
  Tongluong: number;
  Tonggio: number;
  Thongbao: string;
  BangLuong: BangLuongTinhDto[];
};

export type ChiTietNhanVienDto = {
  Manv: string;
  Hoten: string;
  Tonggio: number;
  Tongluong: number;
  Ngaychitra: string;
  Tongsodong: number;
  Trang: number;
  Sodong: number;
  Dong: ChiTietNgayDto[];
};

const MA_KY_LUONG = /^KL\d{6}$/;
const MA_NV = /^NV\d{6}$/;

function lamTron2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function gioPhut(d: Date): string {
  return d.toISOString().slice(11, 16);
}

function soTiepTheo(maLonNhat: string | undefined, tienTo: string): number {
  if (!maLonNhat) return 0;
  const so = parseInt(maLonNhat.trim().slice(tienTo.length), 10);
  return Number.isNaN(so) ? 0 : so;
}

function mapKy(ky: KyLuong): KyLuongHienTaiDto {
  return {
    Makyluong: ky.Makyluong.trim(),
    Thang: ky.Thang,
    Nam: ky.Nam,
    Trangthai: ky.Trangthai,
    Ngaychitra: ngayChiTra(ky.Thang, ky.Nam),
    Kycuoinam: laKyCuoiNam(ky.Thang),
  };
}

type Db = Prisma.TransactionClient;

type KyData = { ky: KyLuong; nhanVien: NhanVienLuongRaw[] };

async function layKy(db: Db, makyluong: string): Promise<KyLuong> {
  if (!MA_KY_LUONG.test(makyluong)) throw new TinhLuongError(400, "BAD_REQUEST");
  const ky = await db.kyLuong.findUnique({ where: { Makyluong: makyluong } });
  if (!ky) throw new TinhLuongError(404, "KY_LUONG_NOT_FOUND");
  return ky;
}

/**
 * Tổng hợp dữ liệu lương của kỳ (chỉ ĐỌC).
 * - Kỳ "Chưa tính": giờ/ngày từ chấm công, mức lương hiện tại, hệ số theo ngày.
 * - Kỳ đã lưu: giờ/mức lương/hệ số đọc từ ChiTietBangLuong (mức lương đã chụp).
 * Ca, giờ vào, giờ ra luôn lấy từ chấm công.
 */
async function taiDuLieuKy(db: Db, ky: KyLuong): Promise<KyData> {
  await chotTangCaHetHan({ db });
  const daLuu = ky.Trangthai !== "Chưa tính";
  const cuoiNam = laKyCuoiNam(ky.Thang);
  const dauKy = new Date(Date.UTC(ky.Nam, ky.Thang - 1, 1));
  const cuoiKy = new Date(Date.UTC(ky.Nam, ky.Thang, 0));
  // Kỳ cuối năm cần giờ cả năm để tính lương tháng 13 → lấy cả năm một lần
  const tu = cuoiNam ? new Date(Date.UTC(ky.Nam, 0, 1)) : dauKy;
  const ngayDauKy = dateKey(dauKy);

  const [chamCongs, bangLuongs, heSos] = await Promise.all([
    db.chamCong.findMany({
      where: {
        Thoigiancheckin: { not: null },
        Thoigiancheckout: { not: null },
        LichLam: { Ngaylam: { gte: tu, lte: cuoiKy } },
      },
      select: {
        Manv: true,
        Thoigiancheckin: true,
        Thoigiancheckout: true,
        LichLam: { select: { Ngaylam: true, CaLam: { select: { Loaica: true } } } },
      },
    }),
    db.bangLuong.findMany({
      where: { Makyluong: ky.Makyluong },
      include: { ChiTietBangLuong: true },
    }),
    db.heSoLuong.findMany({
      where: { Ngaybatdau: { lte: cuoiKy }, Ngayketthuc: { gte: dauKy } },
      select: { Maheso: true, Ngaybatdau: true, Ngayketthuc: true, Heso: true },
    }),
  ]);

  type NgayCc = { gio: number; ca: string[]; vao: string; ra: string };
  const ccTheoNv = new Map<string, Map<string, NgayCc>>();
  const gioCaNam = new Map<string, number>();
  for (const cc of chamCongs) {
    const manv = cc.Manv.trim();
    const vao = cc.Thoigiancheckin as Date;
    const ra = cc.Thoigiancheckout as Date;
    const gio = tinhGioLam(vao, ra);
    if (gio <= 0) continue;
    gioCaNam.set(manv, (gioCaNam.get(manv) ?? 0) + gio);
    const ngay = dateKey(cc.LichLam.Ngaylam);
    if (ngay < ngayDauKy) continue;
    const theoNgay = ccTheoNv.get(manv) ?? new Map<string, NgayCc>();
    const cur = theoNgay.get(ngay);
    const ca = cc.LichLam.CaLam.Loaica;
    if (!cur) {
      theoNgay.set(ngay, { gio, ca: [ca], vao: gioPhut(vao), ra: gioPhut(ra) });
    } else {
      cur.gio += gio;
      if (!cur.ca.includes(ca)) cur.ca.push(ca);
      if (gioPhut(vao) < cur.vao) cur.vao = gioPhut(vao);
      if (gioPhut(ra) > cur.ra) cur.ra = gioPhut(ra);
    }
    ccTheoNv.set(manv, theoNgay);
  }

  const heSoList = heSos.map((h) => ({ ...h, Maheso: h.Maheso.trim(), Heso: Number(h.Heso) }));
  const blTheoNv = new Map(bangLuongs.map((b) => [b.Manv.trim(), b]));

  const dsManv = daLuu
    ? bangLuongs.filter((b) => b.ChiTietBangLuong.length > 0).map((b) => b.Manv.trim())
    : [...ccTheoNv.keys()];
  const nhanViens = await db.nhanVien.findMany({
    where: { Manv: { in: dsManv } },
    select: { Manv: true, Hoten: true, Mucluongtheogio: true },
  });
  const nvMap = new Map(nhanViens.map((n) => [n.Manv.trim(), n]));

  // Hệ số của ngày đã lưu có thể nằm ngoài khoảng tải ở trên (đã bị sửa/xóa sau): tra riêng
  const maHesoLuu = daLuu
    ? [
        ...new Set(
          bangLuongs.flatMap((b) => b.ChiTietBangLuong.map((c) => c.Maheso?.trim()).filter(Boolean))
        ),
      ]
    : [];
  const hesoLuu = new Map<string, number>();
  if (maHesoLuu.length > 0) {
    const rows = await db.heSoLuong.findMany({
      where: { Maheso: { in: maHesoLuu as string[] } },
      select: { Maheso: true, Heso: true },
    });
    for (const r of rows) hesoLuu.set(r.Maheso.trim(), Number(r.Heso));
  }

  const nhanVien: NhanVienLuongRaw[] = [];
  for (const manv of [...dsManv].sort()) {
    const nv = nvMap.get(manv);
    if (!nv) throw new TinhLuongError(500);
    const bl = blTheoNv.get(manv);
    const ccNgay = ccTheoNv.get(manv) ?? new Map<string, NgayCc>();
    const ngay: NgayLamRaw[] = [];
    if (daLuu) {
      const luu = [...(bl?.ChiTietBangLuong ?? [])].sort((a, b) =>
        dateKey(a.Ngaylam).localeCompare(dateKey(b.Ngaylam))
      );
      for (const c of luu) {
        const k = dateKey(c.Ngaylam);
        const cc = ccNgay.get(k);
        const maheso = c.Maheso?.trim() ?? null;
        ngay.push({
          Ngaylam: k,
          Giolam: Number(c.Giolam),
          Mucluong: c.Mucluong,
          Maheso: maheso,
          Heso: maheso ? (hesoLuu.get(maheso) ?? 1) : 1,
          Ca: cc ? cc.ca.join(", ") : "",
          Vao: cc?.vao ?? null,
          Ra: cc?.ra ?? null,
        });
      }
    } else {
      for (const [k, cc] of [...ccNgay].sort(([a], [b]) => a.localeCompare(b))) {
        const heSo = chonHeSoTheoNgayKey(k, heSoList);
        ngay.push({
          Ngaylam: k,
          Giolam: lamTron2(cc.gio),
          Mucluong: nv.Mucluongtheogio, // chụp mức lương tại lúc tính
          Maheso: heSo?.Maheso ?? null,
          Heso: heSo ? Number(heSo.Heso) : 1,
          Ca: cc.ca.join(", "),
          Vao: cc.vao,
          Ra: cc.ra,
        });
      }
    }
    nhanVien.push({
      Manv: manv,
      Hoten: nv.Hoten,
      Mucluong: ngay[0]?.Mucluong ?? nv.Mucluongtheogio,
      Mabangluong: bl?.Mabangluong.trim() ?? null,
      Tienthuong: bl?.Tienthuong ?? 0,
      Lydothuong: bl?.Lydothuong ?? null,
      GioCaNam: gioCaNam.get(manv) ?? 0,
      MucluongHienTai: nv.Mucluongtheogio,
      Ngay: ngay,
    });
  }
  return { ky, nhanVien };
}

function dungKetQua(data: KyData, thongbao: string, kemChiTiet: boolean): KetQuaKyDto {
  const cuoiNam = laKyCuoiNam(data.ky.Thang);
  const bangLuong = data.nhanVien.map((nv) => {
    const dto = mapBangLuongTinh(nv, cuoiNam);
    if (!kemChiTiet) delete dto.ChiTiet;
    return dto;
  });
  return {
    ...mapKy(data.ky),
    Tongluong: lamTron2(bangLuong.reduce((s, b) => s + b.Tongluong, 0)),
    Tonggio: tinhTongGioLam(data.nhanVien.map((n) => ({ Giolam: tinhTongGioLam(n.Ngay) }))),
    Thongbao: thongbao,
    BangLuong: bangLuong,
  };
}

async function boc<T>(thucHien: (db: PrismaClient) => Promise<T>): Promise<T> {
  try {
    return await withDbRetry((db) => thucHien(db));
  } catch (err) {
    if (err instanceof TinhLuongError) throw err;
    console.error("UC_8.2 lỗi:", err);
    throw new TinhLuongError(500);
  }
}

/**
 * Đảm bảo luôn có kỳ lương mở để tính lương / nhập tiền thưởng khi CSDL trống hoặc các kỳ cũ đã chốt hết:
 * - Nếu đã có kỳ chưa "Đã chốt" -> trả về kỳ chưa chốt cũ nhất.
 * - Nếu chưa có kỳ chưa chốt nào: ưu tiên tháng/năm cũ nhất có chấm công đã hoàn thành (từ 2020 đến tháng hiện tại VN)
 *   nhưng chưa có bản ghi KyLuong; nếu không có thì tạo kỳ cho tháng/năm hiện tại VN (nếu chưa tồn tại).
 */
export async function ensureKyLuongHienTai(db: Db): Promise<KyLuong | null> {
  const kyChuaChot = await db.kyLuong.findFirst({
    where: { Trangthai: { not: "Đã chốt" } },
    orderBy: [{ Nam: "asc" }, { Thang: "asc" }],
  });
  if (kyChuaChot) return kyChuaChot;

  const [namNowStr, thangNowStr] = formatDateVN(nowVN()).split("-");
  const namNow = Number(namNowStr);
  const thangNow = Number(thangNowStr);
  const namNext = thangNow === 12 ? namNow + 1 : namNow;
  const thangNext = thangNow === 12 ? 1 : thangNow + 1;
  const nextMonthStart = new Date(`${namNext}-${String(thangNext).padStart(2, "0")}-01T00:00:00Z`);

  const existingKys = await db.kyLuong.findMany({
    select: { Thang: true, Nam: true },
  });
  const existingKeys = new Set(existingKys.map((k) => `${k.Nam}-${k.Thang}`));

  const completedAttendances = await db.chamCong.findMany({
    where: {
      Thoigiancheckin: { not: null },
      Thoigiancheckout: { not: null },
      LichLam: {
        Ngaylam: {
          gte: new Date("2020-01-01T00:00:00Z"),
          lt: nextMonthStart,
        },
      },
    },
    select: {
      LichLam: {
        select: { Ngaylam: true },
      },
    },
  });

  let target: { nam: number; thang: number } | null = null;
  for (const row of completedAttendances) {
    const ngayKey = dateKey(row.LichLam.Ngaylam);
    const [namCcStr, thangCcStr] = ngayKey.split("-");
    const namCc = Number(namCcStr);
    const thangCc = Number(thangCcStr);
    if (!Number.isFinite(namCc) || !Number.isFinite(thangCc)) continue;
    if (existingKeys.has(`${namCc}-${thangCc}`)) continue;
    if (!target || namCc < target.nam || (namCc === target.nam && thangCc < target.thang)) {
      target = { nam: namCc, thang: thangCc };
    }
  }

  if (!target && !existingKeys.has(`${namNow}-${thangNow}`)) {
    target = { nam: namNow, thang: thangNow };
  }

  if (!target) return null;

  const makyluong = `KL${target.nam}${String(target.thang).padStart(2, "0")}`;
  try {
    return await db.kyLuong.create({
      data: {
        Makyluong: makyluong,
        Thang: target.thang,
        Nam: target.nam,
        Trangthai: "Chưa tính",
        Ngaychot: null,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return await db.kyLuong.findFirst({
        where: {
          OR: [{ Makyluong: makyluong }, { Thang: target.thang, Nam: target.nam }],
        },
      });
    }
    throw err;
  }
}

/** GET /api/ky-luong/hien-tai: kỳ chưa "Đã chốt" cũ nhất (tự tạo kỳ mới nếu cần); nếu tháng hiện tại đã chốt thì trả về kỳ mới nhất. */
export async function layKyHienTai(): Promise<KyLuongHienTaiDto | null> {
  return boc(async (db) => {
    const ky =
      (await ensureKyLuongHienTai(db)) ??
      (await db.kyLuong.findFirst({ orderBy: [{ Nam: "desc" }, { Thang: "desc" }] }));
    return ky ? mapKy(ky) : null;
  });
}

/** GET /api/ky-luong/:id/tong-hop (không kèm chi tiết từng ngày). */
export async function tongHopKy(makyluong: string): Promise<KetQuaKyDto> {
  return boc(async (db) => {
    const ky = await layKy(db, makyluong);
    return dungKetQua(await taiDuLieuKy(db, ky), "", false);
  });
}

/** GET /api/ky-luong/:id/nhan-vien/:manv/chi-tiet?trang=&soDong= */
export async function chiTietNhanVien(
  makyluong: string,
  manv: string,
  trang: number,
  soDong: number
): Promise<ChiTietNhanVienDto> {
  const ma = manv.trim().toUpperCase();
  if (!MA_NV.test(ma)) throw new TinhLuongError(400, "BAD_REQUEST");
  return boc(async (db) => {
    const ky = await layKy(db, makyluong);
    const data = await taiDuLieuKy(db, ky);
    const nv = data.nhanVien.find((n) => n.Manv === ma);
    if (!nv) throw new TinhLuongError(404, "NHAN_VIEN_NOT_FOUND");
    const dto = mapBangLuongTinh(nv, false);
    const tatCa = dto.ChiTiet ?? [];
    return {
      Manv: dto.Manv,
      Hoten: dto.Hoten,
      Tonggio: dto.Tonggiolam,
      Tongluong: dto.Tongluong,
      Ngaychitra: ngayChiTra(ky.Thang, ky.Nam),
      Tongsodong: tatCa.length,
      Trang: trang,
      Sodong: soDong,
      Dong: tatCa.slice((trang - 1) * soDong, trang * soDong),
    };
  });
}

/**
 * POST /api/ky-luong/:id/tinh — XEM TRƯỚC: chỉ tính, KHÔNG ghi CSDL, không đổi trạng thái kỳ.
 */
export async function xemTruocTinhLuong(makyluong: string): Promise<KetQuaKyDto> {
  return boc(async (db) => {
    const ky = await layKy(db, makyluong);
    if (ky.Trangthai !== "Chưa tính") throw new TinhLuongError(409, "KY_LUONG_DA_TINH");
    const data = await taiDuLieuKy(db, ky);
    if (data.nhanVien.length === 0) throw new TinhLuongError(422, "KHONG_CO_CHAM_CONG");
    return dungKetQua(data, TINH_LUONG_THANH_CONG, true);
  });
}

/**
 * POST /api/ky-luong/:id/gui — tính lại trên máy chủ, MỘT transaction:
 * tạo BangLuong + ChiTietBangLuong (chụp Mucluong), kỳ → "Dự kiến". Lỗi → rollback.
 */
export async function guiBangLuongDuKien(makyluong: string): Promise<KetQuaKyDto> {
  if (!MA_KY_LUONG.test(makyluong)) throw new TinhLuongError(400, "BAD_REQUEST");
  return boc((db) =>
    db.$transaction(
      async (tx) => {
        const ky = await layKy(tx, makyluong);
        if (ky.Trangthai !== "Chưa tính") throw new TinhLuongError(409, "KY_LUONG_DA_TINH");
        const data = await taiDuLieuKy(tx, ky);
        if (data.nhanVien.length === 0) throw new TinhLuongError(422, "KHONG_CO_CHAM_CONG");

        const [blMax, ctMax] = await Promise.all([
          tx.bangLuong.findFirst({
            where: { Mabangluong: { startsWith: "BL" } },
            orderBy: { Mabangluong: "desc" },
            select: { Mabangluong: true },
          }),
          tx.chiTietBangLuong.findFirst({
            where: { MaCTBL: { startsWith: "CT" } },
            orderBy: { MaCTBL: "desc" },
            select: { MaCTBL: true },
          }),
        ]);
        let soBl = soTiepTheo(blMax?.Mabangluong, "BL");
        let soCt = soTiepTheo(ctMax?.MaCTBL, "CT");

        const blMoi: Prisma.BangLuongCreateManyInput[] = [];
        const ctMoi: Prisma.ChiTietBangLuongCreateManyInput[] = [];
        for (const nv of data.nhanVien) {
          if (!nv.Mabangluong) {
            soBl += 1;
            nv.Mabangluong = `BL${String(soBl).padStart(6, "0")}`;
            blMoi.push({ Mabangluong: nv.Mabangluong, Manv: nv.Manv, Makyluong: makyluong });
          }
          for (const n of nv.Ngay) {
            soCt += 1;
            ctMoi.push({
              MaCTBL: `CT${String(soCt).padStart(6, "0")}`,
              Ngaylam: new Date(`${n.Ngaylam}T00:00:00.000Z`),
              Giolam: n.Giolam,
              Mucluong: n.Mucluong,
              Mabangluong: nv.Mabangluong,
              Maheso: n.Maheso,
            });
          }
        }

        if (blMoi.length > 0) await tx.bangLuong.createMany({ data: blMoi });
        await tx.chiTietBangLuong.createMany({ data: ctMoi });
        // updateMany + điều kiện trạng thái: hai lần gửi đồng thời thì chỉ một lần thắng
        const doi = await tx.kyLuong.updateMany({
          where: { Makyluong: makyluong, Trangthai: "Chưa tính" },
          data: { Trangthai: "Dự kiến", Ngaychot: null },
        });
        if (doi.count !== 1) throw new TinhLuongError(409, "KY_LUONG_DA_TINH");

        return dungKetQua(
          { ky: { ...ky, Trangthai: "Dự kiến" }, nhanVien: data.nhanVien },
          GUI_BANG_LUONG_THANH_CONG,
          true
        );
      },
      { timeout: 30000, maxWait: 10000 }
    )
  );
}
