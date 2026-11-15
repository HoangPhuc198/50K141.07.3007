import { withDbRetry } from "@database/client";
import {
  formatDateVN,
  formatTimeFromDb,
  nowVN,
} from "@backend/lib/time";
import {
  LoaiQuenChamCong,
  phanLoaiQuenChamCong,
  tinhGioLam,
} from "@backend/calc/chamcong";
import { BaoCaoChamCongQuery } from "@backend/validators/bao-cao-cham-cong";
import { BAO_CAO_CHAM_CONG_TRONG } from "@frontend/config/thong-bao";
import { chotTangCaHetHan } from "./cham-cong";

export interface BaoCaoNgayItem {
  machamcong: string;
  manv: string;
  hoten: string;
  maca: string;
  caLam: string;
  gioVao: string | null;
  gioRa: string | null;
  tongGio: number;
}

export interface BaoCaoThangChiTietItem {
  machamcong: string;
  malich: string;
  ngayLam: string; // YYYY-MM-DD
  ngayHienThi: string; // DD/MM/YYYY
  caLam: string; // Ca sáng / Ca chiều / Ca tối
  gioVao: string | null;
  gioRa: string | null;
  tongGio: number;
}

export interface BaoCaoThangNhanVienItem {
  manv: string;
  hoten: string;
  tongCa: number;
  tongGio: number;
  chiTiet: BaoCaoThangChiTietItem[];
}

export type BaoCaoChamCongResponse =
  | {
      mode: "ngay";
      ngay: string;
      ngayHienThi: string;
      items: BaoCaoNgayItem[];
      total: number;
      page: number;
      limit: number;
      message?: string;
    }
  | {
      mode: "thang";
      thang: string; // MM/YYYY
      items: BaoCaoThangNhanVienItem[];
      total: number;
      page: number;
      limit: number;
      message?: string;
    };

export interface QuenChamCongItem {
  manv: string;
  hoten: string;
  malich: string;
  ngayLam: string; // YYYY-MM-DD
  ngayHienThi: string; // DD/MM/YYYY
  maca: string;
  loaica: string;
  caLam: string;
  gioBatDau: string;
  gioKetThuc: string;
  loaiQuen: LoaiQuenChamCong;
  thieuCheckIn: boolean;
  thieuCheckOut: boolean;
}

function lamTron2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function formatDDMMYYYY(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-");
  return `${d}/${m}/${y}`;
}

function extractHHmm(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(11, 16);
}

/**
 * UC_7.2: Tổng hợp báo cáo chấm công theo ngày hoặc theo tháng.
 */
export async function layBaoCaoChamCong(
  query: BaoCaoChamCongQuery
): Promise<BaoCaoChamCongResponse> {
  return withDbRetry(async (db) => {
    await chotTangCaHetHan({ db });
    if (query.mode === "ngay") {
      const targetDate = new Date(`${query.ngay}T00:00:00Z`);
      const skip = (query.page - 1) * query.limit;

      const whereClause = {
        LichLam: { Ngaylam: targetDate },
        ...(query.manv ? { Manv: query.manv } : {}),
      };

      const [total, rows] = await Promise.all([
        db.chamCong.count({ where: whereClause }),
        db.chamCong.findMany({
          where: whereClause,
          select: {
            Machamcong: true,
            Manv: true,
            Thoigiancheckin: true,
            Thoigiancheckout: true,
            NhanVien: { select: { Manv: true, Hoten: true } },
            LichLam: {
              select: {
                Ngaylam: true,
                CaLam: {
                  select: { Maca: true, Loaica: true, Giobatdau: true },
                },
              },
            },
          },
          orderBy: [
            { LichLam: { CaLam: { Giobatdau: "asc" } } },
            { NhanVien: { Hoten: "asc" } },
          ],
          skip,
          take: query.limit,
        }),
      ]);

      const items: BaoCaoNgayItem[] = rows.map((r) => {
        const gioLam =
          r.Thoigiancheckin && r.Thoigiancheckout
            ? tinhGioLam(r.Thoigiancheckin, r.Thoigiancheckout)
            : 0;
        return {
          machamcong: r.Machamcong.trim(),
          manv: r.Manv.trim(),
          hoten: r.NhanVien.Hoten.trim(),
          maca: r.LichLam.CaLam.Maca.trim(),
          caLam: r.LichLam.CaLam.Loaica.trim(),
          gioVao: extractHHmm(r.Thoigiancheckin),
          gioRa: extractHHmm(r.Thoigiancheckout),
          tongGio: gioLam,
        };
      });

      return {
        mode: "ngay",
        ngay: query.ngay,
        ngayHienThi: formatDDMMYYYY(query.ngay),
        items,
        total,
        page: query.page,
        limit: query.limit,
        ...(total === 0 ? { message: BAO_CAO_CHAM_CONG_TRONG } : {}),
      };
    }

    // Mode "thang"
    const startDate = new Date(Date.UTC(query.year, query.month - 1, 1));
    const endDate = new Date(Date.UTC(query.year, query.month, 0));

    const rows = await db.chamCong.findMany({
      where: {
        LichLam: {
          Ngaylam: {
            gte: startDate,
            lte: endDate,
          },
        },
        ...(query.manv ? { Manv: query.manv } : {}),
      },
      select: {
        Machamcong: true,
        Manv: true,
        Malich: true,
        Thoigiancheckin: true,
        Thoigiancheckout: true,
        NhanVien: { select: { Manv: true, Hoten: true } },
        LichLam: {
          select: {
            Ngaylam: true,
            CaLam: {
              select: { Maca: true, Loaica: true, Giobatdau: true },
            },
          },
        },
      },
      orderBy: [
        { LichLam: { Ngaylam: "asc" } },
        { LichLam: { CaLam: { Giobatdau: "asc" } } },
        { NhanVien: { Hoten: "asc" } },
      ],
    });

    const grouped = new Map<string, BaoCaoThangNhanVienItem>();

    for (const r of rows) {
      const manv = r.Manv.trim();
      const ngayStr = r.LichLam.Ngaylam.toISOString().slice(0, 10);
      const gioLam =
        r.Thoigiancheckin && r.Thoigiancheckout
          ? tinhGioLam(r.Thoigiancheckin, r.Thoigiancheckout)
          : 0;

      let entry = grouped.get(manv);
      if (!entry) {
        entry = {
          manv,
          hoten: r.NhanVien.Hoten.trim(),
          tongCa: 0,
          tongGio: 0,
          chiTiet: [],
        };
        grouped.set(manv, entry);
      }

      entry.tongCa += 1;
      entry.tongGio = lamTron2(entry.tongGio + gioLam);
      entry.chiTiet.push({
        machamcong: r.Machamcong.trim(),
        malich: r.Malich.trim(),
        ngayLam: ngayStr,
        ngayHienThi: formatDDMMYYYY(ngayStr),
        caLam: `Ca ${r.LichLam.CaLam.Loaica.trim().toLowerCase()}`,
        gioVao: extractHHmm(r.Thoigiancheckin),
        gioRa: extractHHmm(r.Thoigiancheckout),
        tongGio: gioLam,
      });
    }

    const allItems = Array.from(grouped.values()).sort((a, b) =>
      a.manv.localeCompare(b.manv)
    );
    const total = allItems.length;
    const skip = (query.page - 1) * query.limit;
    const items = allItems.slice(skip, skip + query.limit);

    return {
      mode: "thang",
      thang: query.thangLabel,
      items,
      total,
      page: query.page,
      limit: query.limit,
      ...(total === 0 ? { message: BAO_CAO_CHAM_CONG_TRONG } : {}),
    };
  });
}

/**
 * Hàm "quên chấm công": tính khi đọc (không job) các ca đã kết thúc
 * mà nhân viên được phân công (kể cả nhận thay ca đã xử lý) bị thiếu check-in hoặc check-out.
 * Dùng cho chuông Chủ quán (P13B).
 */
export async function layDanhSachQuenChamCong(options?: {
  now?: Date;
  tuNgay?: string;
  denNgay?: string;
  manv?: string;
}): Promise<QuenChamCongItem[]> {
  const now = options?.now ?? nowVN();
  const todayStr = formatDateVN(now);
  const hienTaiPhut =
    now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  const upperDateStr =
    options?.denNgay && options.denNgay < todayStr ? options.denNgay : todayStr;
  const maxDate = new Date(`${upperDateStr}T00:00:00Z`);
  const minDate = options?.tuNgay
    ? new Date(`${options.tuNgay}T00:00:00Z`)
    : undefined;

  return withDbRetry(async (db) => {
    await chotTangCaHetHan({ db, manv: options?.manv, now });

    const lichLams = await db.lichLam.findMany({
      where: {
        Ngaylam: {
          lte: maxDate,
          ...(minDate ? { gte: minDate } : {}),
        },
      },
      select: {
        Malich: true,
        Ngaylam: true,
        CaLam: {
          select: {
            Maca: true,
            Loaica: true,
            Giobatdau: true,
            Gioketthuc: true,
          },
        },
        NhanVien_LichLam: {
          select: {
            Manv: true,
            NhanVien: { select: { Manv: true, Hoten: true } },
          },
        },
        DonXinDoiCa: {
          where: {
            Madon: { not: { startsWith: "TD" } },
            Trangthaixuly: "Đã xử lý",
            Manvnhanthay: { not: null },
          },
          select: {
            Manv: true,
            Manvnhanthay: true,
            NhanVien_DonXinDoiCa_ManvnhanthayToNhanVien: {
              select: { Manv: true, Hoten: true },
            },
          },
        },
        ChamCong: {
          select: {
            Manv: true,
            Thoigiancheckin: true,
            Thoigiancheckout: true,
          },
        },
        YeuCauBoSungCC: {
          where: { Mayeucau: { startsWith: "OT" } },
          select: { Manv: true },
        },
      },
      orderBy: [{ Ngaylam: "desc" }, { CaLam: { Giobatdau: "asc" } }],
    });

    const filterManv = options?.manv?.trim().toUpperCase();
    const results: QuenChamCongItem[] = [];

    for (const ll of lichLams) {
      const ngayStr = ll.Ngaylam.toISOString().slice(0, 10);
      const gioBatDau = formatTimeFromDb(ll.CaLam.Giobatdau);
      const gioKetThuc = formatTimeFromDb(ll.CaLam.Gioketthuc);

      // Xác định tập nhân viên chịu trách nhiệm cho ca này (trừ người đã được duyệt đổi, thêm người nhận thay)
      const assignedMap = new Map<string, string>();
      const daNhuongSet = new Set<string>();

      for (const don of ll.DonXinDoiCa) {
        if (
          don.Manvnhanthay &&
          don.Manvnhanthay.trim().toUpperCase() !== don.Manv.trim().toUpperCase()
        ) {
          daNhuongSet.add(don.Manv.trim().toUpperCase());
          const replacement = don.NhanVien_DonXinDoiCa_ManvnhanthayToNhanVien;
          if (replacement) {
            assignedMap.set(
              replacement.Manv.trim().toUpperCase(),
              replacement.Hoten.trim()
            );
          }
        }
      }

      for (const nvl of ll.NhanVien_LichLam) {
        const cleanManv = nvl.Manv.trim().toUpperCase();
        if (!daNhuongSet.has(cleanManv)) {
          assignedMap.set(cleanManv, nvl.NhanVien.Hoten.trim());
        }
      }

      const ccByManv = new Map<
        string,
        { daCheckIn: boolean; daCheckOut: boolean }
      >();
      for (const cc of ll.ChamCong) {
        ccByManv.set(cc.Manv.trim().toUpperCase(), {
          daCheckIn: Boolean(cc.Thoigiancheckin),
          daCheckOut: Boolean(cc.Thoigiancheckout),
        });
      }

      const otManvSet = new Set(
        ll.YeuCauBoSungCC.map((row) => row.Manv.trim().toUpperCase())
      );

      for (const [manv, hoten] of assignedMap.entries()) {
        if (filterManv && manv !== filterManv) continue;

        const cc = ccByManv.get(manv);
        const daCheckIn = cc?.daCheckIn ?? false;
        const daCheckOut = cc?.daCheckOut ?? false;

        const loaiQuen = phanLoaiQuenChamCong({
          ngayLam: ngayStr,
          gioKetThuc,
          todayStr,
          hienTaiPhut,
          daCheckIn,
          daCheckOut,
        });

        if (!loaiQuen) continue;
        if (loaiQuen === "Quên check-out" && otManvSet.has(manv)) continue;

        results.push({
          manv,
          hoten,
          malich: ll.Malich.trim(),
          ngayLam: ngayStr,
          ngayHienThi: formatDDMMYYYY(ngayStr),
          maca: ll.CaLam.Maca.trim(),
          loaica: ll.CaLam.Loaica.trim(),
          caLam: `Ca ${ll.CaLam.Loaica.trim().toLowerCase()}`,
          gioBatDau,
          gioKetThuc,
          loaiQuen,
          thieuCheckIn: !daCheckIn,
          thieuCheckOut: !daCheckOut,
        });
      }
    }

    return results;
  });
}
