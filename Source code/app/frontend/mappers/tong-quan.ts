import type {
  ChuQuanTongQuanData,
  NhanVienTongQuanData,
  ThongBaoItem,
} from "@backend/services/tong-quan";
import { formatTien, formatGio } from "@frontend/lib/dinh-dang";
import {
  BANG_LUONG_CHUA_TONG_HOP,
  CHECK_IN_KHONG_CO_CA,
} from "@frontend/config/thong-bao";

export interface HeaderUserView {
  userId: string;
  username: string;
  role: "ChuQuan" | "NhanVien";
  name: string;
  position: string;
  initials: string;
}

export function computeAvatarInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "–";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Mapper dùng chung cho thông tin người dùng ở thanh trên (AppShell).
 * Chỉ nhận dữ liệu từ API (/api/auth/me), không gán tên hay chức vụ mẫu cứng.
 */
export function mapHeaderUser(
  raw:
    | {
        userId?: string | null;
        username?: string | null;
        role: "ChuQuan" | "NhanVien";
        name?: string | null;
        position?: string | null;
      }
    | null
    | undefined,
  fallbackRole: "ChuQuan" | "NhanVien"
): HeaderUserView {
  const name = raw?.name?.trim() ?? "";
  return {
    userId: raw?.userId?.trim() ?? "",
    username: raw?.username?.trim() ?? "",
    role: raw?.role ?? fallbackRole,
    name,
    position: raw?.position?.trim() ?? "",
    initials: computeAvatarInitials(name),
  };
}

export interface ChuQuanDashboardView {
  nhanVienDangLamText: string;
  caLamHomNayText: string;
  yeuCauCanXuLyText: string;
  yeuCauBadgeText: string;
  filterChips: Array<{ value: string; label: string }>;
  danhSachYeuCau: ChuQuanTongQuanData["danhSachYeuCau"];
  caLamHomNay: ChuQuanTongQuanData["caLamHomNay"];
  emptyListSymbol: string;
}

/**
 * Mapper dùng chung cho Màn hình chính Chủ quán (U2).
 * Mọi con số, nhãn và trạng thái đều xuất phát từ API CSDL, không dùng fallback mẫu.
 */
export function mapChuQuanDashboardView(
  data: ChuQuanTongQuanData | null,
  selectedFilter: string,
  isLoading: boolean
): ChuQuanDashboardView {
  if (isLoading) {
    return {
      nhanVienDangLamText: "...",
      caLamHomNayText: "...",
      yeuCauCanXuLyText: "...",
      yeuCauBadgeText: "... yêu cầu",
      filterChips: [
        { value: "all", label: "Tất cả" },
        { value: "doi-ca", label: "Đổi ca" },
        { value: "cham-cong", label: "Chấm công" },
        { value: "luong", label: "Lương" },
      ],
      danhSachYeuCau: [],
      caLamHomNay: [],
      emptyListSymbol: "...",
    };
  }

  if (!data) {
    return {
      nhanVienDangLamText: "–",
      caLamHomNayText: "–",
      yeuCauCanXuLyText: "–",
      yeuCauBadgeText: "–",
      filterChips: [
        { value: "all", label: "Tất cả" },
        { value: "doi-ca", label: "Đổi ca" },
        { value: "cham-cong", label: "Chấm công" },
        { value: "luong", label: "Lương" },
      ],
      danhSachYeuCau: [],
      caLamHomNay: [],
      emptyListSymbol: "–",
    };
  }

  const danhSach = data.danhSachYeuCau;
  const countTatCa = danhSach.length;
  const countDoiCa = danhSach.filter((yc) => yc.loaiYeuCau === "Đổi ca").length;
  const countChamCong = danhSach.filter(
    (yc) => yc.loaiYeuCau === "Chấm công"
  ).length;
  const countLuong = danhSach.filter((yc) => yc.loaiYeuCau === "Lương").length;

  const filteredYeuCau = danhSach.filter((yc) => {
    if (selectedFilter === "all") return true;
    if (selectedFilter === "doi-ca") return yc.loaiYeuCau === "Đổi ca";
    if (selectedFilter === "cham-cong") return yc.loaiYeuCau === "Chấm công";
    if (selectedFilter === "luong") return yc.loaiYeuCau === "Lương";
    return true;
  });

  return {
    nhanVienDangLamText: String(data.thongKe.nhanVienDangLam),
    caLamHomNayText: data.thongKe.caLamHomNay,
    yeuCauCanXuLyText: String(countTatCa),
    yeuCauBadgeText: `${countTatCa} yêu cầu`,
    filterChips: [
      { value: "all", label: `Tất cả · ${countTatCa}` },
      { value: "doi-ca", label: `Đổi ca · ${countDoiCa}` },
      { value: "cham-cong", label: `Chấm công · ${countChamCong}` },
      { value: "luong", label: `Lương · ${countLuong}` },
    ],
    danhSachYeuCau: filteredYeuCau,
    caLamHomNay: data.caLamHomNay,
    emptyListSymbol: "–",
  };
}

export interface NhanVienDashboardView {
  ca: {
    trangThaiText: string;
    khungGioText: string;
    tenCaText: string;
    ngayLamText: string;
    checkInText: string;
    thoiGianLamText: string;
    actionLabel: string;
    actionHref: string;
  };
  lichRanh: {
    tieuDe: string;
    link: string;
  };
  luong: {
    kyLuongText: string;
    trangThaiText: string;
    coBangLuong: boolean;
    tongTienText: string;
    tongGioLamText: string;
    mucLuongGioText: string;
  };
  thongBao: ThongBaoItem[];
  emptySymbol: string;
}

/**
 * Mapper dùng chung cho Màn hình chính Nhân viên (U3).
 * Khi CSDL rỗng: giờ hiện "0 giờ", tiền hiện "0đ", trạng thái rỗng theo SRS/08-THONG-BAO.md hoặc "–".
 */
export function mapNhanVienDashboardView(
  data: NhanVienTongQuanData | null,
  isLoading: boolean
): NhanVienDashboardView {
  if (isLoading) {
    return {
      ca: {
        trangThaiText: "...",
        khungGioText: "...",
        tenCaText: "...",
        ngayLamText: "",
        checkInText: "",
        thoiGianLamText: "...",
        actionLabel: "...",
        actionHref: "/nhan-vien/cham-cong/bo-sung",
      },
      lichRanh: {
        tieuDe: "Đăng ký lịch rảnh tuần mới",
        link: "/nhan-vien/ca-lam/lich-ranh",
      },
      luong: {
        kyLuongText: "...",
        trangThaiText: "...",
        coBangLuong: false,
        tongTienText: "...",
        tongGioLamText: "...",
        mucLuongGioText: "...",
      },
      thongBao: [],
      emptySymbol: "...",
    };
  }

  if (!data) {
    return {
      ca: {
        trangThaiText: "–",
        khungGioText: "–",
        tenCaText: "–",
        ngayLamText: "",
        checkInText: "",
        thoiGianLamText: "0 giờ",
        actionLabel: "Bổ sung chấm công",
        actionHref: "/nhan-vien/cham-cong/bo-sung",
      },
      lichRanh: {
        tieuDe: "Đăng ký lịch rảnh tuần mới",
        link: "/nhan-vien/ca-lam/lich-ranh",
      },
      luong: {
        kyLuongText: "Bảng lương",
        trangThaiText: "–",
        coBangLuong: false,
        tongTienText: "0đ",
        tongGioLamText: "0 giờ làm",
        mucLuongGioText: "0đ/giờ",
      },
      thongBao: [],
      emptySymbol: "–",
    };
  }

  const ca = data.caHienTai;
  const actionLabel = ca ? ca.nutHanhDong : "Bổ sung chấm công";
  const actionHref =
    actionLabel === "Check-out"
      ? "/nhan-vien/cham-cong/check-out"
      : actionLabel === "Check-in"
      ? "/nhan-vien/cham-cong/check-in"
      : "/nhan-vien/cham-cong/bo-sung";

  const luong = data.luongThangGanNhat;

  return {
    ca: {
      trangThaiText: ca ? ca.trangThai : "Không có ca làm",
      khungGioText: ca ? ca.khungGio : "–",
      tenCaText: ca ? ca.tenCa : CHECK_IN_KHONG_CO_CA,
      ngayLamText: ca ? ca.ngayLam : "",
      checkInText: ca
        ? ca.thoiGianCheckIn
          ? `Đã check-in lúc ${ca.thoiGianCheckIn}`
          : "Chưa check-in"
        : "",
      thoiGianLamText: ca ? ca.thoiGianLam : "0 giờ",
      actionLabel,
      actionHref,
    },
    lichRanh: {
      tieuDe: data.lichRanhTuanMoi.tieuDe,
      link: data.lichRanhTuanMoi.link,
    },
    luong: {
      kyLuongText: luong.coBangLuong ? luong.kyLuong : "Bảng lương",
      trangThaiText: luong.coBangLuong ? luong.trangThai : "–",
      coBangLuong: luong.coBangLuong,
      tongTienText: luong.coBangLuong
        ? formatTien(luong.tongTien)
        : BANG_LUONG_CHUA_TONG_HOP,
      tongGioLamText: `${formatGio(luong.tongGioLam)} giờ làm`,
      mucLuongGioText: `${formatTien(luong.mucLuongGio)}/giờ`,
    },
    thongBao: data.thongBao,
    emptySymbol: "–",
  };
}
