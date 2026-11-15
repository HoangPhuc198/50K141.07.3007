import { prisma, withDbRetry } from "@database/client";
import {
  nowVN,
  addDaysVN,
  formatDateVN,
  formatTimeFromDb,
  toDbDateTimeVN,
} from "@backend/lib/time";
import { UserPayload } from "@backend/lib/auth";
import { parseTimeToMinutes, tinhGioLam } from "@backend/calc/chamcong";
import { formatNgay, formatTien, formatGio } from "@frontend/lib/dinh-dang";
import {
  THONG_BAO_THONG_TIN_HET_HAN_NGAY,
  filterAndCapNotifications,
  type LoaiNhomThongBao,
} from "@frontend/lib/thong-bao-da-doc";
import { getYeuCauCanXuLyList } from "./yeu-cau-can-xu-ly";
import { chotTangCaHetHan, layCaHomNayCuaNhanVien } from "./cham-cong";
import { layBangLuongMoiNhat } from "./xem-bang-luong";
import {
  layCanhBaoThayCaChoChuQuan,
  layYeuCauThayCaDangMo,
  pruneDeletedShiftsFromThayCaMap,
  CanhBaoThayCaChuQuanItem,
} from "./thay-ca";
import {
  THAY_CA_LOI_MOI_TIEU_DE,
  THAY_CA_DA_CO_NV_DONG_Y,
} from "@frontend/config/thong-bao";

export interface GioLamTuanNhanVienItem {
  manv: string;
  tenNhanVien: string;
  viTri: string;
  tongGioTuan: number;
  soCaTuan: number;
}

export interface ChuQuanTongQuanData {
  thongKe: {
    nhanVienDangLam: number;
    caLamHomNay: string;
    yeuCauCanXuLy: number;
  };
  danhSachYeuCau: Array<{
    id: string;
    tenNhanVien: string;
    loaiYeuCau: "Đổi ca" | "Chấm công" | "Lương";
    caLam: string;
    noiDung: string;
    thoiGian: string;
    linkAction: string;
    labelAction: string;
  }>;
  caLamHomNay: Array<{
    maca: string;
    tenCa: string;
    khungGio: string;
    trangThai: "Đang diễn ra" | "Chưa bắt đầu" | "Đã kết thúc";
    nhanViens: Array<{
      manv: string;
      tenNhanVien: string;
      viTri: string;
      trangThaiChamCong: "Đã check-in" | "Đã check-out" | "Chưa check-in";
    }>;
  }>;
  tuanHienTai: {
    tuNgay: string;
    denNgay: string;
  };
  gioLamTuanNhanVien: GioLamTuanNhanVienItem[];
  canhBaoThayCa?: CanhBaoThayCaChuQuanItem[];
}

export interface ThongBaoItem {
  id: string;
  khoa?: string;
  suKien?: string;
  nhom?: LoaiNhomThongBao;
  mocThoiGian?: string;
  tieuDe: string;
  thoiGian: string;
  chiTiet: string;
  link?: string;
}

export interface NhanVienTongQuanData {
  nhanVien: {
    manv: string;
    hoten: string;
    vitrilamviec: string;
  };
  caHienTai: {
    coCa: boolean;
    tenCa: string;
    ngayLam: string;
    khungGio: string;
    thoiGianCheckIn: string | null;
    trangThai: "Đang trong ca" | "Chưa vào ca" | "Đã check-out";
    thoiGianLam: string;
    nutHanhDong: "Check-out" | "Check-in" | "Bổ sung chấm công";
  } | null;
  lichRanhTuanMoi: {
    tieuDe: string;
    link: string;
  };
  luongThangGanNhat: {
    coBangLuong: boolean;
    kyLuong: string;
    trangThai: "Dự kiến" | "Đã chốt" | "–";
    tongTien: number;
    tongGioLam: number;
    mucLuongGio: number;
  };
  thongBao: ThongBaoItem[];
}

const TEN_THU_TRONG_TUAN = [
  "Chủ nhật",
  "Thứ hai",
  "Thứ ba",
  "Thứ tư",
  "Thứ năm",
  "Thứ sáu",
  "Thứ bảy",
] as const;

function lamTron2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function getTuanHienTaiRange(baseDate: Date): {
  tuNgayStr: string;
  denNgayStr: string;
  tuNgayDb: Date;
  denNgayDb: Date;
} {
  const dayOfWeek = baseDate.getDay(); // 0 = CN, 1 = T2..6 = T7
  const offsetToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate() + offsetToMonday
  );
  const sunday = new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate() + 6
  );
  const tuNgayStr = formatDateVN(monday);
  const denNgayStr = formatDateVN(sunday);
  return {
    tuNgayStr,
    denNgayStr,
    tuNgayDb: new Date(`${tuNgayStr}T00:00:00Z`),
    denNgayDb: new Date(`${denNgayStr}T00:00:00Z`),
  };
}

/**
 * Lấy dữ liệu tổng quan thật cho Chủ quán (U2) từ CSDL.
 */
export async function getChuQuanTongQuan(): Promise<ChuQuanTongQuanData> {
  const homNayDate = nowVN();
  const homNayStr = formatDateVN(homNayDate);
  const todayDbDate = new Date(`${homNayStr}T00:00:00Z`);
  const hienTaiPhut =
    homNayDate.getHours() * 60 +
    homNayDate.getMinutes() +
    homNayDate.getSeconds() / 60;
  const tuan = getTuanHienTaiRange(homNayDate);

  return await withDbRetry(async (db) => {
    await chotTangCaHetHan({ db, now: homNayDate });

    const [lichLamList, tongSoCaMau, danhSachYeuCau, nhanVienList, chamCongTuan] =
      await Promise.all([
        db.lichLam.findMany({
          where: { Ngaylam: todayDbDate },
          include: {
            CaLam: true,
            NhanVien_LichLam: {
              include: { NhanVien: true },
              orderBy: { Manv: "asc" },
            },
          },
          orderBy: { CaLam: { Giobatdau: "asc" } },
        }),
        db.caLam.count(),
        getYeuCauCanXuLyList(),
        db.nhanVien.findMany({
          select: { Manv: true, Hoten: true, Vitrilamviec: true },
          orderBy: { Manv: "asc" },
        }),
        db.chamCong.findMany({
          where: {
            LichLam: {
              Ngaylam: {
                gte: tuan.tuNgayDb,
                lte: tuan.denNgayDb,
              },
            },
            Thoigiancheckin: { not: null },
            Thoigiancheckout: { not: null },
          },
          select: {
            Manv: true,
            Thoigiancheckin: true,
            Thoigiancheckout: true,
          },
        }),
      ]);

    const lichLamIds = lichLamList.map((ll) => ll.Malich);
    const chamCongHomNay =
      lichLamIds.length > 0
        ? await db.chamCong.findMany({
            where: { Malich: { in: lichLamIds } },
            select: {
              Manv: true,
              Malich: true,
              Thoigiancheckin: true,
              Thoigiancheckout: true,
            },
          })
        : [];

    const chamCongByKey = new Map<
      string,
      { checkin: Date | null; checkout: Date | null }
    >();
    const dangLamManvSet = new Set<string>();

    for (const cc of chamCongHomNay) {
      const cleanManv = cc.Manv.trim().toUpperCase();
      const cleanMalich = cc.Malich.trim().toUpperCase();
      chamCongByKey.set(`${cleanManv}:${cleanMalich}`, {
        checkin: cc.Thoigiancheckin,
        checkout: cc.Thoigiancheckout,
      });
      if (cc.Thoigiancheckin && !cc.Thoigiancheckout) {
        dangLamManvSet.add(cleanManv);
      }
    }

    const caLamHomNayFormatted = lichLamList.map((ll) => {
      const ca = ll.CaLam;
      const gioBatDau = formatTimeFromDb(ca.Giobatdau);
      const gioKetThuc = formatTimeFromDb(ca.Gioketthuc);
      const batDauPhut = parseTimeToMinutes(gioBatDau);
      const ketThucPhut = parseTimeToMinutes(gioKetThuc);

      let trangThai: "Đang diễn ra" | "Chưa bắt đầu" | "Đã kết thúc";
      if (hienTaiPhut < batDauPhut) {
        trangThai = "Chưa bắt đầu";
      } else if (hienTaiPhut < ketThucPhut) {
        trangThai = "Đang diễn ra";
      } else {
        trangThai = "Đã kết thúc";
      }

      const nhanViens = ll.NhanVien_LichLam.map((nvl) => {
        const cleanManv = nvl.Manv.trim().toUpperCase();
        const cc = chamCongByKey.get(`${cleanManv}:${ll.Malich.trim().toUpperCase()}`);
        let trangThaiChamCong: "Đã check-in" | "Đã check-out" | "Chưa check-in";
        if (cc?.checkin && cc?.checkout) {
          trangThaiChamCong = "Đã check-out";
        } else if (cc?.checkin) {
          trangThaiChamCong = "Đã check-in";
        } else {
          trangThaiChamCong = "Chưa check-in";
        }
        return {
          manv: nvl.Manv.trim(),
          tenNhanVien: nvl.NhanVien?.Hoten?.trim() ?? "",
          viTri: nvl.NhanVien?.Vitrilamviec?.trim() ?? "",
          trangThaiChamCong,
        };
      });

      return {
        maca: ca.Maca.trim(),
        tenCa: `Ca ${ca.Loaica.trim().toLowerCase()}`,
        khungGio: `${gioBatDau} – ${gioKetThuc}`,
        trangThai,
        nhanViens,
      };
    });

    // Tổng giờ làm trong tuần hiện tại theo từng nhân viên
    const gioTuanMap = new Map<string, { gio: number; soCa: number }>();
    for (const cc of chamCongTuan) {
      if (!cc.Thoigiancheckin || !cc.Thoigiancheckout) continue;
      const cleanManv = cc.Manv.trim().toUpperCase();
      const gio = tinhGioLam(cc.Thoigiancheckin, cc.Thoigiancheckout);
      const curr = gioTuanMap.get(cleanManv) || { gio: 0, soCa: 0 };
      gioTuanMap.set(cleanManv, {
        gio: lamTron2(curr.gio + gio),
        soCa: curr.soCa + 1,
      });
    }

    const gioLamTuanNhanVien: GioLamTuanNhanVienItem[] = nhanVienList.map((nv) => {
      const cleanManv = nv.Manv.trim().toUpperCase();
      const stat = gioTuanMap.get(cleanManv) || { gio: 0, soCa: 0 };
      return {
        manv: nv.Manv.trim(),
        tenNhanVien: nv.Hoten.trim(),
        viTri: nv.Vitrilamviec.trim(),
        tongGioTuan: stat.gio,
        soCaTuan: stat.soCa,
      };
    });

    await pruneDeletedShiftsFromThayCaMap();
    const { canhBaoList } = await layCanhBaoThayCaChoChuQuan();

    return {
      thongKe: {
        nhanVienDangLam: dangLamManvSet.size,
        caLamHomNay: `${lichLamList.length}/${tongSoCaMau}`,
        yeuCauCanXuLy: danhSachYeuCau.length,
      },
      danhSachYeuCau,
      caLamHomNay: caLamHomNayFormatted,
      tuanHienTai: {
        tuNgay: tuan.tuNgayStr,
        denNgay: tuan.denNgayStr,
      },
      gioLamTuanNhanVien,
      canhBaoThayCa: canhBaoList,
    };
  });
}

/**
 * Lấy danh sách thông báo thật của nhân viên từ các bảng có sẵn (không dùng bảng thông báo).
 */
export async function getNhanVienThongBaoList(
  manv: string,
  options?: {
    readKeys?: Iterable<string>;
    applyCap?: boolean;
  }
): Promise<ThongBaoItem[]> {
  const cleanManv = manv.trim().toUpperCase();
  const now = nowVN();
  const cutoffDateStr = formatDateVN(
    addDaysVN(now, -(THONG_BAO_THONG_TIN_HET_HAN_NGAY + 1))
  );
  const cutoffDbDate = new Date(`${cutoffDateStr}T00:00:00Z`);

  await chotTangCaHetHan({ manv: cleanManv, now });

  const [bangLuongMoiNhat, doiCaDaXuLy, boSungDaXuLy, thayCaDangMo] =
    await Promise.all([
      layBangLuongMoiNhat(cleanManv, 1, 1),
      withDbRetry((db) =>
        db.donXinDoiCa.findMany({
          where: {
            Madon: { startsWith: "DD" },
            Trangthaixuly: "Đã xử lý",
            OR: [{ Manv: cleanManv }, { Manvnhanthay: cleanManv }],
            LichLam: { Ngaylam: { gte: cutoffDbDate } },
          },
          include: {
            LichLam: { include: { CaLam: true } },
          },
          orderBy: { Madon: "desc" },
        })
      ),
      withDbRetry((db) =>
        db.yeuCauBoSungCC.findMany({
          where: {
            Mayeucau: { startsWith: "YC" },
            Manv: cleanManv,
            Trangthai: "Đã xử lý",
            LichLam: { Ngaylam: { gte: cutoffDbDate } },
          },
          include: {
            LichLam: { include: { CaLam: true } },
          },
          orderBy: { Mayeucau: "desc" },
        })
      ),
      layYeuCauThayCaDangMo(cleanManv),
    ]);

  const items: ThongBaoItem[] = [];

  for (const lm of thayCaDangMo.loiMoi) {
    items.push({
      id: `TC-MO-${lm.id}`,
      khoa: `thay-ca-moi:${lm.id}:${lm.ngayLam}`,
      suKien: `thay-ca:${lm.id}`,
      nhom: "can-hanh-dong",
      mocThoiGian: lm.taoLucIso || `${lm.ngayLam}T${lm.gioBatDau}:00`,
      tieuDe: `${lm.tenNhanVienXinNghi} · Thay ca gấp`,
      thoiGian: `${lm.tenCa} (${lm.gioBatDau} – ${lm.gioKetThuc})`,
      chiTiet: `${THAY_CA_LOI_MOI_TIEU_DE}${lm.lyDo ? ` · Lý do: ${lm.lyDo}` : ""}`,
      link: "/nhan-vien/ca-lam/thay-ca",
    });
  }

  for (const yc of thayCaDangMo.yeuCauCuaToi) {
    if (yc.trangThai === "Đang mở") {
      items.push({
        id: `TC-YC-${yc.id}`,
        // Khóa cố định theo sự kiện & trạng thái Đang mở; KHÔNG đưa số người được mời / số lần từ chối vào khóa
        khoa: `thay-ca-yc:${yc.id}:${yc.ngayLam}:dang-mo`,
        suKien: `thay-ca:${yc.id}`,
        nhom: "thong-tin",
        mocThoiGian: yc.taoLucIso || `${yc.ngayLam}T${yc.gioBatDau}:00`,
        tieuDe: "Yêu cầu thay ca gấp đang mở",
        thoiGian: `${yc.tenCa} (${yc.gioBatDau} – ${yc.gioKetThuc})`,
        chiTiet: `Đang chờ nhân viên nhận thay (${yc.nguoiDuocMoi.length} nhân viên phù hợp)`,
        link: "/nhan-vien/ca-lam/thay-ca",
      });
    } else if (yc.trangThai === "Đã nhận") {
      items.push({
        id: `TC-DN-${yc.id}`,
        khoa: `thay-ca-da-nhan:${yc.id}:${yc.manvNhanThay ?? ""}:${yc.ngayLam}`,
        suKien: `thay-ca:${yc.id}`,
        nhom: "thong-tin",
        mocThoiGian: yc.taoLucIso || `${yc.ngayLam}T${yc.gioBatDau}:00`,
        tieuDe: `${yc.tenNhanVienNhanThay || ""} · ${THAY_CA_DA_CO_NV_DONG_Y}`,
        thoiGian: `${yc.tenCa} (${yc.gioBatDau} – ${yc.gioKetThuc})`,
        chiTiet: `Thay ca ngày ${yc.ngayHienThi}`,
        link: "/nhan-vien/ca-lam/thay-ca",
      });
    }
  }

  if (
    bangLuongMoiNhat.coBangLuong &&
    bangLuongMoiNhat.kyLuong &&
    bangLuongMoiNhat.bangLuong
  ) {
    const { kyLuong, bangLuong } = bangLuongMoiNhat;
    const maKyLuong = kyLuong.makyluong.trim();
    const fallbackKyDate = `${kyLuong.nam}-${String(kyLuong.thang).padStart(2, "0")}-01`;
    items.push({
      id: `BL-${maKyLuong}`,
      khoa: `luong:${maKyLuong}:${kyLuong.trangthai}`,
      suKien: `luong:${maKyLuong}`,
      nhom: "bang-luong",
      mocThoiGian: kyLuong.ngaychot
        ? `${kyLuong.ngaychot}T00:00:00`
        : `${fallbackKyDate}T00:00:00`,
      tieuDe:
        kyLuong.trangthai === "Đã chốt"
          ? `Bảng lương tháng ${kyLuong.thang} đã chốt`
          : `Bảng lương tháng ${kyLuong.thang} đã sẵn sàng`,
      thoiGian:
        kyLuong.trangthai === "Đã chốt" && kyLuong.ngaychot
          ? `Chốt ngày ${formatNgay(kyLuong.ngaychot)}`
          : `Tháng ${String(kyLuong.thang).padStart(2, "0")}/${kyLuong.nam}`,
      chiTiet: `${kyLuong.trangthai} · ${formatGio(bangLuong.tonggiolam)} giờ · ${formatTien(bangLuong.tongluong)}`,
      link: "/nhan-vien/luong/xem",
    });
  }

  for (const d of doiCaDaXuLy) {
    const ca = d.LichLam?.CaLam;
    const ngayIso = d.LichLam ? formatDateVN(d.LichLam.Ngaylam) : "";
    const gioIso = ca ? formatTimeFromDb(ca.Giobatdau) : "00:00";
    const ngayStr = d.LichLam ? formatNgay(ngayIso) : "";
    const madon = d.Madon.trim();
    const manvNhan = d.Manvnhanthay ? d.Manvnhanthay.trim().toUpperCase() : "huy";
    items.push({
      id: `DC-${madon}`,
      khoa: `doi-ca-kq:${madon}:${manvNhan}`,
      suKien: `doi-ca:${madon}`,
      nhom: "thong-tin",
      mocThoiGian: ngayIso ? `${ngayIso}T${gioIso}:00` : "",
      tieuDe: "Đơn xin đổi ca đã được xử lý",
      thoiGian: ca ? `Ca ${ca.Loaica.trim().toLowerCase()} ${ngayStr}` : ngayStr,
      chiTiet: d.Manvnhanthay
        ? "Chủ quán đã duyệt thay đổi nhân viên nhận ca"
        : "Đơn đổi ca đã được xử lý",
      link: "/nhan-vien/ca-lam/doi-ca",
    });
  }

  for (const b of boSungDaXuLy) {
    const ca = b.LichLam?.CaLam;
    const ngayIso = b.LichLam ? formatDateVN(b.LichLam.Ngaylam) : "";
    const gioIso = ca ? formatTimeFromDb(ca.Giobatdau) : "00:00";
    const ngayStr = b.LichLam ? formatNgay(ngayIso) : "";
    const mayeucau = b.Mayeucau.trim();
    items.push({
      id: `BS-${mayeucau}`,
      khoa: ngayIso ? `bo-sung-kq:${mayeucau}:${ngayIso}` : `bo-sung-kq:${mayeucau}`,
      suKien: `bo-sung:${mayeucau}`,
      nhom: "thong-tin",
      mocThoiGian: ngayIso ? `${ngayIso}T${gioIso}:00` : "",
      tieuDe: "Yêu cầu bổ sung chấm công đã xử lý",
      thoiGian: ca ? `Ca ${ca.Loaica.trim().toLowerCase()} ${ngayStr}` : ngayStr,
      chiTiet: b.Lydo?.trim() || "Đã cập nhật dữ liệu chấm công",
      link: "/nhan-vien/cham-cong/bo-sung",
    });
  }

  return filterAndCapNotifications(items, options?.readKeys ?? [], now, {
    applyCap: options?.applyCap ?? false,
  }).map((entry) => entry.item);
}

/**
 * Lấy dữ liệu tổng quan thật cho Nhân viên (U3); mã NV luôn lấy từ phiên đăng nhập.
 */
export async function getNhanVienTongQuan(
  user: UserPayload
): Promise<NhanVienTongQuanData> {
  const cleanManv = user.userId.trim().toUpperCase();
  const homNayDate = nowVN();
  const homNayStr = formatDateVN(homNayDate);
  const thuHienTai = TEN_THU_TRONG_TUAN[homNayDate.getDay()] || "Hôm nay";

  const [homNayData, bangLuongMoiNhat, thongBao, nv] = await Promise.all([
    layCaHomNayCuaNhanVien(cleanManv),
    layBangLuongMoiNhat(cleanManv, 1, 1),
    getNhanVienThongBaoList(cleanManv),
    withDbRetry((db) =>
      db.nhanVien.findUnique({
        where: { Manv: cleanManv },
        select: {
          Manv: true,
          Hoten: true,
          Vitrilamviec: true,
          Mucluongtheogio: true,
        },
      })
    ),
  ]);

  const ca = homNayData.caHienTai;
  let caHienTaiOut: NhanVienTongQuanData["caHienTai"] = null;

  if (ca) {
    const chamCong = await withDbRetry((db) =>
      db.chamCong.findUnique({
        where: {
          Manv_Malich: {
            Manv: cleanManv,
            Malich: ca.malich,
          },
        },
        select: {
          Thoigiancheckin: true,
          Thoigiancheckout: true,
        },
      })
    );

    let thoiGianLam = "0 giờ 0 phút";
    if (chamCong?.Thoigiancheckin) {
      const mocCuoi = chamCong.Thoigiancheckout ?? toDbDateTimeVN(homNayDate);
      const diffPhut = Math.max(
        0,
        Math.floor((mocCuoi.getTime() - chamCong.Thoigiancheckin.getTime()) / 60000)
      );
      thoiGianLam = `${Math.floor(diffPhut / 60)} giờ ${diffPhut % 60} phút`;
    }

    let trangThai: "Đang trong ca" | "Chưa vào ca" | "Đã check-out";
    let nutHanhDong: "Check-out" | "Check-in" | "Bổ sung chấm công";

    if (ca.daCheckIn && !ca.daCheckOut) {
      if (ca.trangThaiCheckOut === "quen-check-out") {
        trangThai = "Đang trong ca";
        nutHanhDong = "Bổ sung chấm công";
      } else {
        trangThai = "Đang trong ca";
        nutHanhDong = "Check-out";
      }
    } else if (ca.daCheckOut) {
      trangThai = "Đã check-out";
      nutHanhDong = "Bổ sung chấm công";
    } else if (ca.trangThai === "quen-check-in") {
      trangThai = "Chưa vào ca";
      nutHanhDong = "Bổ sung chấm công";
    } else {
      trangThai = "Chưa vào ca";
      nutHanhDong = "Check-in";
    }

    caHienTaiOut = {
      coCa: true,
      tenCa: `Ca ${ca.loaica.trim().toLowerCase()}`,
      ngayLam: `${thuHienTai}, ${formatNgay(homNayStr)}`,
      khungGio: ca.khungGio,
      thoiGianCheckIn: ca.thoiGianCheckIn,
      trangThai,
      thoiGianLam,
      nutHanhDong,
    };
  }

  const mucLuongHienTai = Number(nv?.Mucluongtheogio ?? 0);
  const luongThangGanNhat: NhanVienTongQuanData["luongThangGanNhat"] =
    bangLuongMoiNhat.coBangLuong &&
    bangLuongMoiNhat.bangLuong &&
    bangLuongMoiNhat.kyLuong
      ? {
          coBangLuong: true,
          kyLuong: `Lương tháng ${bangLuongMoiNhat.kyLuong.thang}`,
          trangThai: bangLuongMoiNhat.kyLuong.trangthai,
          tongTien: bangLuongMoiNhat.bangLuong.tongluong,
          tongGioLam: bangLuongMoiNhat.bangLuong.tonggiolam,
          mucLuongGio: bangLuongMoiNhat.bangLuong.mucluong,
        }
      : {
          coBangLuong: false,
          kyLuong: "Bảng lương",
          trangThai: "–",
          tongTien: 0,
          tongGioLam: 0,
          mucLuongGio: mucLuongHienTai,
        };

  return {
    nhanVien: {
      manv: nv?.Manv?.trim() ?? "",
      hoten: nv?.Hoten?.trim() ?? "",
      vitrilamviec: nv?.Vitrilamviec?.trim() ?? "",
    },
    caHienTai: caHienTaiOut,
    lichRanhTuanMoi: {
      tieuDe: "Đăng ký lịch rảnh tuần mới",
      link: "/nhan-vien/ca-lam/lich-ranh",
    },
    luongThangGanNhat,
    thongBao,
  };
}
