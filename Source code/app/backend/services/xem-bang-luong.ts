import { withDbRetry } from "@database/client";
import { ngayChiTra, tinhTongGioLam, tinhTongLuong } from "@backend/calc/luong";
import { formatDateVN } from "@backend/lib/time";
import { mapChiTietNgay, type ChiTietNgayDto, type NgayLamRaw } from "@backend/mappers/bang-luong";

export type TrangThaiBangLuong = "Dự kiến" | "Đã chốt";

export type KyLuongHienThiDto = {
  makyluong: string;
  thang: number;
  nam: number;
  trangthai: TrangThaiBangLuong;
  ngaychitra: string;
  ngaychot: string | null;
};

export type BangLuongCaNhanDto = {
  mabangluong: string;
  manv: string;
  tennv: string;
  mucluong: number;
  tonggiolam: number;
  tienthuong: number;
  lydothuong: string | null;
  tongluong: number;
  trangthai: TrangThaiBangLuong;
};

export type PhanTrangDto = {
  trang: number;
  soDong: number;
  tongSoDong: number;
  tongSoTrang: number;
};

export type BangLuongMoiNhatDto = {
  coBangLuong: boolean;
  kyLuong: KyLuongHienThiDto | null;
  bangLuong: BangLuongCaNhanDto | null;
  chiTiet: ChiTietNgayDto[];
  phanTrang: PhanTrangDto;
};

function bangLuongTrong(trang: number, soDong: number): BangLuongMoiNhatDto {
  return {
    coBangLuong: false,
    kyLuong: null,
    bangLuong: null,
    chiTiet: [],
    phanTrang: {
      trang,
      soDong,
      tongSoDong: 0,
      tongSoTrang: 0,
    },
  };
}

/**
 * Lấy bảng lương kỳ gần nhất đã tổng hợp ("Dự kiến" hoặc "Đã chốt") cho đúng nhân viên từ phiên.
 * Mọi giá trị dẫn xuất (giờ làm, thành tiền, tổng lương) được tính tại chỗ khi đọc.
 */
export async function layBangLuongMoiNhat(
  manv: string,
  trang = 1,
  soDong = 6
): Promise<BangLuongMoiNhatDto> {
  const maNhanVien = manv.trim();
  if (!maNhanVien) return bangLuongTrong(1, soDong);

  return withDbRetry(async (db) => {
    const kyMoiNhat = await db.kyLuong.findFirst({
      where: {
        Trangthai: { in: ["Dự kiến", "Đã chốt"] },
        BangLuong: { some: { Manv: maNhanVien } },
      },
      orderBy: [{ Nam: "desc" }, { Thang: "desc" }],
    });

    if (!kyMoiNhat) {
      return bangLuongTrong(1, soDong);
    }

    const bl = await db.bangLuong.findFirst({
      where: {
        Makyluong: kyMoiNhat.Makyluong,
        Manv: maNhanVien,
      },
      include: {
        NhanVien: {
          select: {
            Manv: true,
            Hoten: true,
            Mucluongtheogio: true,
          },
        },
        ChiTietBangLuong: {
          include: {
            HeSoLuong: {
              select: { Heso: true },
            },
          },
          orderBy: { Ngaylam: "asc" },
        },
      },
    });

    if (!bl) {
      return bangLuongTrong(1, soDong);
    }

    const trangThai = kyMoiNhat.Trangthai as TrangThaiBangLuong;
    const ngayRaws: NgayLamRaw[] = bl.ChiTietBangLuong.map((ct) => ({
      Ngaylam: formatDateVN(ct.Ngaylam),
      Giolam: Number(ct.Giolam),
      Mucluong: Number(ct.Mucluong),
      Maheso: ct.Maheso ?? null,
      Heso: ct.HeSoLuong ? Number(ct.HeSoLuong.Heso) : 1,
      Ca: "",
      Vao: null,
      Ra: null,
    }));

    const tongSoDong = ngayRaws.length;
    const tongSoTrang = tongSoDong === 0 ? 0 : Math.ceil(tongSoDong / soDong);
    const trangHienTai = tongSoTrang === 0 ? 1 : Math.min(Math.max(1, trang), tongSoTrang);
    const batDau = (trangHienTai - 1) * soDong;
    const chiTiet = ngayRaws.slice(batDau, batDau + soDong).map(mapChiTietNgay);

    const tienthuong = Number(bl.Tienthuong);
    const mucluong = ngayRaws[0]?.Mucluong ?? Number(bl.NhanVien.Mucluongtheogio);

    return {
      coBangLuong: true,
      kyLuong: {
        makyluong: kyMoiNhat.Makyluong,
        thang: kyMoiNhat.Thang,
        nam: kyMoiNhat.Nam,
        trangthai: trangThai,
        ngaychitra: ngayChiTra(kyMoiNhat.Thang, kyMoiNhat.Nam),
        ngaychot: kyMoiNhat.Ngaychot ? formatDateVN(kyMoiNhat.Ngaychot) : null,
      },
      bangLuong: {
        mabangluong: bl.Mabangluong,
        manv: bl.Manv.trim(),
        tennv: bl.NhanVien.Hoten,
        mucluong,
        tonggiolam: tinhTongGioLam(ngayRaws),
        tienthuong,
        lydothuong: bl.Lydothuong ?? null,
        tongluong: tinhTongLuong(ngayRaws, tienthuong),
        trangthai: trangThai,
      },
      chiTiet,
      phanTrang: {
        trang: trangHienTai,
        soDong,
        tongSoDong,
        tongSoTrang,
      },
    };
  });
}
