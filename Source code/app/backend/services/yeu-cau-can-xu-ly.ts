import { withDbRetry } from "@database/client";
import { formatDateVN, formatTimeFromDb } from "@backend/lib/time";
import { formatNgay } from "@frontend/lib/dinh-dang";

export type LoaiYeuCauCanXuLy = "Đổi ca" | "Chấm công" | "Lương";

export interface YeuCauCanXuLyItem {
  id: string;
  khoa?: string;
  mocThoiGian?: string;
  tenNhanVien: string;
  loaiYeuCau: LoaiYeuCauCanXuLy;
  caLam: string;
  noiDung: string;
  thoiGian: string;
  linkAction: string;
  labelAction: string;
}

function formatNgayNgan(d: Date | null | undefined): string {
  if (!d) return "";
  return formatNgay(formatDateVN(d));
}

/**
 * Lấy toàn bộ yêu cầu cần xử lý từ CSDL:
 * - Đơn đổi ca chưa xử lý (DonXinDoiCa)
 * - Yêu cầu bổ sung chấm công chưa xử lý (YeuCauBoSungCC)
 * - Phản hồi lương chưa xử lý (PhanHoiLuong)
 * Trả về MỘT danh sách duy nhất. Dùng cho màn hình chính Chủ quán, P13A, P13B.
 */
export async function getYeuCauCanXuLyList(): Promise<YeuCauCanXuLyItem[]> {
  return await withDbRetry(async (db) => {
    const [doiCaList, boSungList, phanHoiLuongList] = await Promise.all([
      db.donXinDoiCa.findMany({
        where: {
          Madon: { startsWith: "DD" },
          Trangthaixuly: "Chưa xử lý",
        },
        include: {
          NhanVien_DonXinDoiCa_ManvToNhanVien: true,
          LichLam: { include: { CaLam: true } },
        },
        orderBy: { Madon: "asc" },
      }),
      db.yeuCauBoSungCC.findMany({
        where: {
          Mayeucau: { startsWith: "YC" },
          Trangthai: "Chưa xử lý",
        },
        include: {
          NhanVien: true,
          LichLam: { include: { CaLam: true } },
        },
        orderBy: { Mayeucau: "asc" },
      }),
      db.phanHoiLuong.findMany({
        where: { Trangthai: "Chưa xử lý" },
        include: {
          BangLuong: { include: { NhanVien: true, KyLuong: true } },
        },
        orderBy: { Maphanhoi: "asc" },
      }),
    ]);

    const items: YeuCauCanXuLyItem[] = [
      ...doiCaList.map((d) => {
        const id = d.Madon.trim();
        const ngayIso = d.LichLam ? formatDateVN(d.LichLam.Ngaylam) : "";
        const gioIso = d.LichLam?.CaLam
          ? formatTimeFromDb(d.LichLam.CaLam.Giobatdau)
          : "00:00";
        const manvNhan = d.Manvnhanthay ? d.Manvnhanthay.trim().toUpperCase() : "";
        const ngayNgan = formatNgayNgan(d.LichLam?.Ngaylam);
        const tenCa = d.LichLam?.CaLam
          ? `Ca ${d.LichLam.CaLam.Loaica.trim().toLowerCase()}`
          : "Ca làm";
        const caLamStr = ngayNgan ? `${tenCa} ${ngayNgan}` : tenCa;
        return {
          id,
          khoa: manvNhan ? `doi-ca:${id}:${manvNhan}` : `doi-ca:${id}`,
          mocThoiGian: ngayIso ? `${ngayIso}T${gioIso}:00` : "",
          tenNhanVien: d.NhanVien_DonXinDoiCa_ManvToNhanVien?.Hoten?.trim() ?? "",
          loaiYeuCau: "Đổi ca" as const,
          caLam: caLamStr,
          noiDung: manvNhan ? "Đã có người nhận thay" : "Chưa có người thay",
          thoiGian: ngayNgan || "–",
          linkAction: "/chu-quan/lich-lam/doi-ca",
          labelAction: "Xử lý đổi ca",
        };
      }),
      ...boSungList.map((b) => {
        const id = b.Mayeucau.trim();
        const ngayIso = b.LichLam ? formatDateVN(b.LichLam.Ngaylam) : "";
        const gioIso = b.LichLam?.CaLam
          ? formatTimeFromDb(b.LichLam.CaLam.Giobatdau)
          : "00:00";
        const ngayNgan = formatNgayNgan(b.LichLam?.Ngaylam);
        const tenCa = b.LichLam?.CaLam
          ? `Ca ${b.LichLam.CaLam.Loaica.trim().toLowerCase()}`
          : "Chấm công";
        const caLamStr = ngayNgan ? `${tenCa} ${ngayNgan}` : tenCa;
        return {
          id,
          khoa: ngayIso ? `bo-sung:${id}:${ngayIso}` : `bo-sung:${id}`,
          mocThoiGian: ngayIso ? `${ngayIso}T${gioIso}:00` : "",
          tenNhanVien: b.NhanVien?.Hoten?.trim() ?? "",
          loaiYeuCau: "Chấm công" as const,
          caLam: caLamStr,
          noiDung: b.Lydo?.trim() || "Bổ sung chấm công",
          thoiGian: ngayNgan || "–",
          linkAction: "/chu-quan/cham-cong/bo-sung",
          labelAction: "Bổ sung chấm công",
        };
      }),
      ...phanHoiLuongList.map((p) => {
        const id = p.Maphanhoi.trim();
        const ngayIso = p.Ngaygui ? formatDateVN(p.Ngaygui) : "";
        const thang = p.BangLuong?.KyLuong?.Thang;
        const ngayGuiNgan = formatNgayNgan(p.Ngaygui);
        return {
          id,
          khoa: ngayIso ? `phan-hoi:${id}:${ngayIso}` : `phan-hoi:${id}`,
          mocThoiGian: ngayIso ? `${ngayIso}T00:00:00` : "",
          tenNhanVien: p.BangLuong?.NhanVien?.Hoten?.trim() ?? "",
          loaiYeuCau: "Lương" as const,
          caLam: thang ? `Tháng ${thang}` : `Kỳ lương ${p.Mabangluong.trim()}`,
          noiDung: p.Noidung?.trim() || "Phản hồi sai sót lương",
          thoiGian: ngayGuiNgan || "–",
          linkAction: "/chu-quan/luong/chinh-sua",
          labelAction: "Xem phản hồi",
        };
      }),
    ];

    return items;
  });
}
