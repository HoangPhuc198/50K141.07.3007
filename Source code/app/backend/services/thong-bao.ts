import { AuthError, UserPayload } from "@backend/lib/auth";
import { nowVN } from "@backend/lib/time";
import { getYeuCauCanXuLyList } from "./yeu-cau-can-xu-ly";
import { getNhanVienThongBaoList, ThongBaoItem } from "./tong-quan";
import { layDanhSachQuenChamCong } from "./bao-cao-cham-cong";
import { chotTangCaHetHan } from "./cham-cong";
import {
  layCanhBaoThayCaChoChuQuan,
  pruneDeletedShiftsFromThayCaMap,
} from "./thay-ca";
import { THAY_CA_DA_CO_NV_DONG_Y } from "@frontend/config/thong-bao";
import { filterAndCapNotifications } from "@frontend/lib/thong-bao-da-doc";

export type { ThongBaoItem };

export interface ThongBaoResponseData {
  count: number;
  items: ThongBaoItem[];
}

export interface GetThongBaoOptions {
  readKeys?: Iterable<string>;
  applyCap?: boolean;
}

/**
 * Lấy danh sách thông báo thật cho chuông trên thanh trên (AppShell).
 * Tính tại chỗ từ bảng có sẵn (không có bảng thông báo).
 */
export async function getThongBaoTheoPhien(
  user: UserPayload,
  options?: GetThongBaoOptions
): Promise<ThongBaoResponseData> {
  if (user.role === "NhanVien") {
    const items = await getNhanVienThongBaoList(user.userId, options);
    return { count: items.length, items };
  }

  if (user.role !== "ChuQuan") {
    throw new AuthError(
      "Bạn không có quyền thực hiện thao tác này.",
      403,
      "FORBIDDEN"
    );
  }

  await chotTangCaHetHan();

  const [yeuCauList, quenList, { canhBaoList, daNhanList }] = await Promise.all([
    getYeuCauCanXuLyList(),
    layDanhSachQuenChamCong(),
    layCanhBaoThayCaChoChuQuan(),
    pruneDeletedShiftsFromThayCaMap(),
  ]);

  const items: ThongBaoItem[] = [
    ...canhBaoList.map((cb) => {
      const tinhTrang = cb.khongCoNguoiRanh ? "khong-nguoi-ranh" : "sat-gio";
      return {
        id: `TC-CB-${cb.id}`,
        khoa: `thay-ca-cb:${cb.id}:${tinhTrang}:${cb.ngayLam || cb.ngayHienThi}`,
        suKien: `thay-ca:${cb.id}`,
        nhom: "can-hanh-dong" as const,
        mocThoiGian: cb.taoLucIso || "",
        tieuDe: `${cb.tenNhanVienXinNghi} · Thay ca gấp`,
        thoiGian: `${cb.tenCa} (${cb.khungGio})`,
        chiTiet: `${cb.noiDungCanhBao}${cb.lyDo ? ` · Lý do: ${cb.lyDo}` : ""}`,
        link: "/chu-quan",
      };
    }),
    ...daNhanList.map((dn) => ({
      id: `TC-DN-${dn.id}`,
      khoa: `thay-ca-da-nhan:${dn.id}:${dn.manvNhanThay ?? ""}:${dn.ngayLam || dn.ngayHienThi}`,
      suKien: `thay-ca:${dn.id}`,
      nhom: "thong-tin" as const,
      mocThoiGian: dn.taoLucIso || "",
      tieuDe: `${dn.tenNhanVienNhanThay} · ${THAY_CA_DA_CO_NV_DONG_Y}`,
      thoiGian: `${dn.tenCa} (${dn.khungGio})`,
      chiTiet: `Thay cho ${dn.tenNhanVienXinNghi} ngày ${dn.ngayHienThi}`,
      link: "/chu-quan",
    })),
    ...yeuCauList.map((yc) => {
      const cleanYcId = yc.id.trim();
      const suKien = cleanYcId.startsWith("DD")
        ? `doi-ca:${cleanYcId}`
        : cleanYcId.startsWith("YC")
        ? `bo-sung:${cleanYcId}`
        : cleanYcId.startsWith("PH")
        ? `phan-hoi:${cleanYcId}`
        : `yeu-cau:${cleanYcId}`;
      return {
        id: `YC-${yc.id}`,
        khoa: yc.khoa || `yeu-cau:${yc.id}`,
        suKien,
        nhom: "can-hanh-dong" as const,
        mocThoiGian: yc.mocThoiGian || "",
        tieuDe: `${yc.tenNhanVien} · ${yc.loaiYeuCau}`,
        thoiGian: yc.thoiGian,
        chiTiet: `${yc.caLam} · ${yc.noiDung}`,
        link: yc.linkAction,
      };
    }),
    ...quenList.map((q) => ({
      id: `QCC-${q.manv}-${q.malich}`,
      khoa: `quen-cc:${q.manv}:${q.malich}:${q.loaiQuen}:${q.ngayLam}`,
      suKien: `quen-cc:${q.manv}:${q.malich}`,
      nhom: "can-hanh-dong" as const,
      mocThoiGian: `${q.ngayLam}T${q.gioBatDau}:00`,
      tieuDe: `${q.hoten} · ${q.loaiQuen}`,
      thoiGian: q.ngayHienThi,
      chiTiet: `${q.caLam} (${q.gioBatDau} – ${q.gioKetThuc})`,
      link: "/chu-quan/cham-cong/bao-cao",
    })),
  ];

  const sortedItems = filterAndCapNotifications(
    items,
    options?.readKeys ?? [],
    nowVN(),
    { applyCap: options?.applyCap ?? false }
  ).map((entry) => entry.item);

  return { count: sortedItems.length, items: sortedItems };
}
