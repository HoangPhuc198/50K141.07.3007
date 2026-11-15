"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@frontend/components/ui/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@frontend/components/ui/DataTable";
import { DetailPanel } from "@frontend/components/ui/DetailPanel";
import { NotificationBanner } from "@frontend/components/ui/NotificationBanner";
import { PageCard } from "@frontend/components/ui/PageCard";
import { Pagination } from "@frontend/components/ui/Pagination";
import { SectionTitle } from "@frontend/components/ui/SectionTitle";
import { ThongKeCard } from "@frontend/components/ui/ThongKeCard";
import { LAYOUT_TOKENS } from "@frontend/config/tokens";
import {
  GUI_BANG_LUONG_CO,
  GUI_BANG_LUONG_KHONG,
  GUI_BANG_LUONG_NOI_DUNG,
  GUI_BANG_LUONG_THANH_CONG,
  GUI_BANG_LUONG_TIEU_DE,
  TINH_LUONG_THANH_CONG,
  TINH_LUONG_THAT_BAI,
} from "@frontend/config/thong-bao";
import {
  formatGio,
  formatNgay,
  formatNgayThang,
  formatSoTien,
  formatTien,
} from "@frontend/lib/dinh-dang";
import type {
  BangLuongTinhDto,
  ChiTietNgayDto,
  ChiTietNhanVienDto,
  KetQuaKyDto,
  KyLuongHienTaiDto,
} from "@backend/services/tinh-luong";

const SO_DONG_CHI_TIET = 6;

type PlaceholderRow = { id: string };
const DONG_TRONG: PlaceholderRow[] = Array.from({ length: SO_DONG_CHI_TIET }, (_, i) => ({
  id: `empty-${i}`,
}));

export default function TinhLuongScreen() {
  const [ky, setKy] = useState<KyLuongHienTaiDto | null>(null);
  const [ketQua, setKetQua] = useState<KetQuaKyDto | null>(null);
  const [daTinh, setDaTinh] = useState(false);

  const [selectedManv, setSelectedManv] = useState<string>("");
  const [chiTiet, setChiTiet] = useState<ChiTietNhanVienDto | null>(null);
  const [loadingChiTiet, setLoadingChiTiet] = useState(false);

  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [banner, setBanner] = useState<{
    type: "thanh-cong" | "loi";
    message: string;
  } | null>(null);

  const taiChiTiet = useCallback(async (makyluong: string, manv: string, trang = 1) => {
    setLoadingChiTiet(true);
    try {
      const res = await fetch(
        `/api/ky-luong/${encodeURIComponent(makyluong)}/nhan-vien/${encodeURIComponent(manv)}/chi-tiet?trang=${trang}&soDong=${SO_DONG_CHI_TIET}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (res.ok && json.ok) {
        setChiTiet(json.data);
      } else {
        setChiTiet(null);
      }
    } catch {
      setChiTiet(null);
    } finally {
      setLoadingChiTiet(false);
    }
  }, []);

  const taiDuLieuBanDau = useCallback(async () => {
    setLoading(true);
    setBanner(null);
    try {
      const resKy = await fetch("/api/ky-luong/hien-tai", { cache: "no-store" });
      const jsonKy = await resKy.json();
      if (!resKy.ok || !jsonKy.ok) {
        setBanner({ type: "loi", message: jsonKy.error?.message || TINH_LUONG_THAT_BAI });
        return;
      }
      const kyData: KyLuongHienTaiDto | null = jsonKy.data;
      setKy(kyData);
      if (!kyData) return;

      const resTh = await fetch(
        `/api/ky-luong/${encodeURIComponent(kyData.Makyluong)}/tong-hop`,
        { cache: "no-store" }
      );
      const jsonTh = await resTh.json();
      if (!resTh.ok || !jsonTh.ok) {
        setBanner({ type: "loi", message: jsonTh.error?.message || TINH_LUONG_THAT_BAI });
        return;
      }
      const dataTh: KetQuaKyDto = jsonTh.data;
      setKetQua(dataTh);
      // Kỳ đã "Dự kiến" hoặc "Đã chốt" → mở sẵn chế độ kết quả đã lưu (nút gửi vô hiệu hóa)
      const daLuu = kyData.Trangthai !== "Chưa tính";
      setDaTinh(daLuu);
    } catch {
      setBanner({ type: "loi", message: TINH_LUONG_THAT_BAI });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    taiDuLieuBanDau();
  }, [taiDuLieuBanDau]);

  const danhSach = useMemo(() => ketQua?.BangLuong ?? [], [ketQua]);
  const daLuuTrongDb = (ky?.Trangthai ?? "Chưa tính") !== "Chưa tính";
  const kyCuoiNam = ky?.Kycuoinam ?? false;

  const handleChonNhanVien = async (item: BangLuongTinhDto) => {
    if (!ky) return;
    setSelectedManv(item.Manv);
    await taiChiTiet(ky.Makyluong, item.Manv, 1);
  };

  const handleDoiTrang = async (trang: number) => {
    if (!ky || !selectedManv) return;
    await taiChiTiet(ky.Makyluong, selectedManv, trang);
  };

  const handleTinhLuong = async () => {
    if (!ky || calculating || daLuuTrongDb) return;
    setCalculating(true);
    setBanner(null);
    try {
      const res = await fetch(
        `/api/ky-luong/${encodeURIComponent(ky.Makyluong)}/tinh`,
        { method: "POST" }
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setBanner({ type: "loi", message: json.error?.message || TINH_LUONG_THAT_BAI });
        return;
      }
      const data: KetQuaKyDto = json.data;
      setKetQua(data);
      setDaTinh(true);
      setBanner({ type: "thanh-cong", message: data.Thongbao || TINH_LUONG_THANH_CONG });

      // Chọn sẵn nhân viên đang chọn hoặc dòng đầu tiên để hiện ngay chi tiết (Figma UC_8.2_02)
      const manvMacDinh =
        selectedManv && data.BangLuong.some((b) => b.Manv === selectedManv)
          ? selectedManv
          : data.BangLuong[0]?.Manv ?? "";
      if (manvMacDinh) {
        setSelectedManv(manvMacDinh);
        await taiChiTiet(ky.Makyluong, manvMacDinh, 1);
      }
    } catch {
      setBanner({ type: "loi", message: TINH_LUONG_THAT_BAI });
    } finally {
      setCalculating(false);
    }
  };

  const handleGuiBangLuong = async () => {
    if (!ky || sending || daLuuTrongDb) return;
    setSending(true);
    setBanner(null);
    try {
      const res = await fetch(
        `/api/ky-luong/${encodeURIComponent(ky.Makyluong)}/gui`,
        { method: "POST" }
      );
      const json = await res.json();
      setShowConfirm(false);
      if (!res.ok || !json.ok) {
        setBanner({ type: "loi", message: json.error?.message || TINH_LUONG_THAT_BAI });
        return;
      }
      const data: KetQuaKyDto = json.data;
      setKetQua(data);
      setKy((prev) => (prev ? { ...prev, Trangthai: data.Trangthai } : prev));
      setDaTinh(true);
      // Sau khi gửi: bảng chi tiết trống với dấu "–" và nút gửi bị vô hiệu hóa (SRS U25 mục 7, 8)
      setSelectedManv("");
      setChiTiet(null);
      setBanner({
        type: "thanh-cong",
        message: data.Thongbao || GUI_BANG_LUONG_THANH_CONG,
      });
    } catch {
      setShowConfirm(false);
      setBanner({ type: "loi", message: TINH_LUONG_THAT_BAI });
    } finally {
      setSending(false);
    }
  };

  const cotTongHop = useMemo<DataTableColumn<BangLuongTinhDto>[]>(() => {
    const cellWeight = (r: BangLuongTinhDto, content: string | number) => (
      <span className={selectedManv === r.Manv ? "font-bold" : "font-normal"}>{content}</span>
    );
    const base: DataTableColumn<BangLuongTinhDto>[] = [
      {
        key: "Hoten",
        header: "Nhân viên",
        className: "whitespace-nowrap",
        render: (r) => cellWeight(r, r.Hoten),
      },
      {
        key: "Songay",
        header: "Số ngày",
        className: "tabular-nums",
        render: (r) => cellWeight(r, r.Songay),
      },
      {
        key: "Tonggiolam",
        header: "Giờ",
        className: "tabular-nums",
        render: (r) => cellWeight(r, formatGio(r.Tonggiolam)),
      },
      {
        key: "Mucluong",
        header: "Lương/giờ",
        className: "tabular-nums",
        render: (r) => cellWeight(r, formatSoTien(r.Mucluong)),
      },
      {
        key: "Heso",
        header: "Hệ số",
        className: "tabular-nums",
        render: (r) => cellWeight(r, formatGio(r.Heso)),
      },
      {
        key: "Tienthuong",
        header: "Thưởng",
        className: "tabular-nums",
        render: (r) => cellWeight(r, formatSoTien(r.Tienthuong)),
      },
    ];
    if (daTinh) {
      base.push({
        key: "Tongluong",
        header: "Lương",
        className: "tabular-nums",
        render: (r) => cellWeight(r, formatSoTien(r.Tongluong)),
      });
      if (kyCuoiNam) {
        base.push({
          key: "Luongthang13",
          header: "Lương tháng 13",
          className: "tabular-nums",
          render: (r) => cellWeight(r, formatSoTien(r.Luongthang13 ?? 0)),
        });
      }
    } else if (kyCuoiNam) {
      base.push({
        key: "Luongthang13",
        header: "Lương tháng 13",
        className: "tabular-nums",
        render: (r) => cellWeight(r, formatSoTien(r.Luongthang13 ?? 0)),
      });
    } else {
      base.push({
        key: "Lydothuong",
        header: "Lý do thưởng",
        render: (r) => cellWeight(r, r.Lydothuong || "Không có"),
      });
    }
    return base;
  }, [daTinh, kyCuoiNam, selectedManv]);

  const cotChiTiet = useMemo<DataTableColumn<ChiTietNgayDto>[]>(() => {
    const cols: DataTableColumn<ChiTietNgayDto>[] = [
      {
        key: "Ngaylam",
        header: "Ngày",
        className: "tabular-nums",
        render: (r) => formatNgayThang(r.Ngaylam),
      },
      { key: "Ca", header: "Ca", render: (r) => r.Ca || "–" },
      { key: "Vao", header: "Vào", className: "tabular-nums", render: (r) => r.Vao ?? "–" },
      { key: "Ra", header: "Ra", className: "tabular-nums", render: (r) => r.Ra ?? "–" },
      {
        key: "Giolam",
        header: "Giờ",
        className: "tabular-nums",
        render: (r) => formatGio(r.Giolam),
      },
      {
        key: "Heso",
        header: "Hệ số",
        className: "tabular-nums",
        render: (r) => formatGio(r.Heso),
      },
      {
        key: "Thuong",
        header: "Thưởng",
        className: "tabular-nums",
        render: (r) => formatSoTien(r.Thuong),
      },
    ];
    if (daTinh) {
      cols.push({
        key: "Thanhtien",
        header: "Thành tiền",
        className: "tabular-nums",
        render: (r) => formatSoTien(r.Thanhtien),
      });
    }
    return cols;
  }, [daTinh]);

  const cotTrong = useMemo<DataTableColumn<PlaceholderRow>[]>(() => {
    const headers = daTinh
      ? ["Ngày", "Ca", "Vào", "Ra", "Giờ", "Hệ số", "Thưởng", "Thành tiền"]
      : ["Ngày", "Ca", "Vào", "Ra", "Giờ", "Hệ số", "Thưởng"];
    return headers.map((h, idx) => ({
      key: `c-${idx}`,
      header: h,
      render: () => "–",
    }));
  }, [daTinh]);

  const tongTrangChiTiet = chiTiet
    ? Math.max(1, Math.ceil(chiTiet.Tongsodong / chiTiet.Sodong))
    : 1;

  const tieuDeCard = !daTinh
    ? "Dữ liệu kì lương"
    : ky?.Trangthai === "Đã chốt"
      ? "Kết quả tính lương · Đã chốt"
      : "Kết quả tính lương · Chưa chốt";

  return (
    <div
      data-hydrated="true"
      className={`w-full flex flex-col ${LAYOUT_TOKENS.spaceSection} text-[#334EAC]`}
    >
      {/* Banner thông báo */}
      {banner && (
        <div id="notification-message" className="w-full">
          <NotificationBanner
            type={banner.type}
            message={banner.message}
            onClose={() => setBanner(null)}
            className="!mb-0"
          />
        </div>
      )}

      {/* Hàng thẻ tổng hợp trên cùng */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          <div className="h-[116px] rounded-[14.4px] bg-[#F7F2EB] border border-[#7096D1]" />
          <div className="h-[116px] rounded-[14.4px] bg-[#F7F2EB] border border-[#7096D1]" />
        </div>
      ) : !ky ? (
        <PageCard>
          <p className="text-sm text-[#334EAC] text-center py-6">
            Chưa có kỳ lương để tính
          </p>
        </PageCard>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {!daTinh ? (
              <>
                <ThongKeCard
                  id="card-ky-luong"
                  label="Kỳ lương"
                  value={`Tháng ${ky.Thang}`}
                />
                <ThongKeCard
                  id="card-ngay-chi-tra"
                  label="Ngày chi trả"
                  value={formatNgay(ky.Ngaychitra)}
                />
              </>
            ) : (
              <>
                <ThongKeCard
                  id="card-tong-luong"
                  label={`Tổng lương tháng ${ky.Thang}/${ky.Nam}`}
                  value={formatTien(ketQua?.Tongluong ?? 0)}
                />
                <ThongKeCard
                  id="card-tong-gio"
                  label="Tổng giờ thực tế"
                  value={`${formatGio(ketQua?.Tonggio ?? 0)} giờ`}
                />
                <ThongKeCard
                  id="card-ngay-chi-tra"
                  label="Ngày chi trả"
                  value={formatNgay(ky.Ngaychitra)}
                />
              </>
            )}
          </div>

          {/* Card chính: Tổng hợp và chi tiết */}
          <PageCard id="card-tinh-luong">
            <SectionTitle
              id="title-tinh-luong"
              title={tieuDeCard}
            />

            <div className="grid grid-cols-1 lg:grid-cols-[49fr_51fr] gap-6 items-start">
              {/* Cột trái: Bảng tổng hợp */}
              <div className="flex flex-col gap-3 min-w-0">
                <h3 className="text-sm sm:text-base font-normal text-[#334EAC]">
                  Tổng hợp
                </h3>
                <DataTable
                  columns={cotTongHop}
                  data={danhSach}
                  keyExtractor={(r) => r.Manv}
                  selectedKey={selectedManv}
                  onSelectRow={handleChonNhanVien}
                  radioLabel="Danh sách nhân viên trong kỳ lương"
                  mobileCards
                  compact
                  maxHeight="max-h-[340px]"
                  emptyText="Chưa có dữ liệu chấm công trong kỳ lương"
                />
              </div>

              {/* Cột phải: Chi tiết nhân viên được chọn */}
              <div className="flex flex-col gap-3 min-w-0">
                <h3 className="text-sm sm:text-base font-normal text-[#334EAC]">
                  Chi tiết nhân viên được chọn
                </h3>
                <DetailPanel
                  id="panel-chi-tiet-luong"
                  className="border-[1.2px] border-[#7096D1] rounded-[9.6px] bg-[#FFF9F0] p-4 shadow-[0px_4px_8px_rgba(0,0,0,0.12)]"
                >
                  {loadingChiTiet ? (
                    <div className="py-12 text-center text-sm text-[#334EAC]">
                      Đang tải chi tiết...
                    </div>
                  ) : chiTiet ? (
                    <>
                      <p
                        id="chi-tiet-ten-ma"
                        className="text-sm sm:text-base font-semibold text-[#334EAC]"
                      >
                        {chiTiet.Hoten} · {chiTiet.Manv}
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-[#334EAC]">
                        <span id="chi-tiet-tong">
                          Tổng: {formatGio(chiTiet.Tonggio)} giờ /{" "}
                          {formatTien(chiTiet.Tongluong)}
                        </span>
                        <span className="text-xs font-medium">
                          Trả {formatNgay(chiTiet.Ngaychitra)}
                        </span>
                      </div>
                      <DataTable
                        columns={cotChiTiet}
                        data={chiTiet.Dong}
                        keyExtractor={(r) => r.Ngaylam}
                        mobileCards
                        compact
                        maxHeight="max-h-[260px]"
                        emptyText="Không có dữ liệu"
                        ariaLabel={`Chi tiết ngày làm của ${chiTiet.Hoten}`}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <p
                          id="chi-tiet-hien-thi"
                          className="text-xs sm:text-sm text-[#334EAC]"
                        >
                          Hiển thị {chiTiet.Dong.length}/{chiTiet.Tongsodong} ngày
                        </p>
                        <Pagination
                          trang={chiTiet.Trang}
                          tongTrang={tongTrangChiTiet}
                          onChange={handleDoiTrang}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm sm:text-base font-semibold text-[#334EAC]">
                        Chọn 1 nhân viên để xem chi tiết
                      </p>
                      <div className="hidden md:block">
                        <DataTable
                          columns={cotTrong}
                          data={DONG_TRONG}
                          keyExtractor={(r) => r.id}
                          compact
                          maxHeight="max-h-[260px]"
                        />
                      </div>
                      <div className="md:hidden border-[1.2px] border-[#7096D1] rounded-[9.6px] p-3 text-xs text-[#334EAC] flex flex-col gap-1">
                        <div className="flex justify-between">
                          <span>Ngày:</span>
                          <span>–</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Ca / Giờ:</span>
                          <span>–</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Hệ số / Thưởng:</span>
                          <span>–</span>
                        </div>
                      </div>
                    </>
                  )}
                </DetailPanel>
              </div>
            </div>
          </PageCard>

          {/* Thanh thao tác dưới cùng */}
          <div className="border-t-[1.2px] border-[#7096D1] pt-4 flex justify-end">
            {!daTinh ? (
              <button
                type="button"
                id="btn-tinh-luong"
                onClick={handleTinhLuong}
                disabled={calculating}
                className="min-h-[44px] min-w-[200px] px-8 py-2.5 rounded-[9.6px] bg-[#334EAC] border-[1.2px] border-[#334EAC] text-[#FFF9F0] text-sm sm:text-base font-bold hover:bg-[#2A3F8F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {calculating ? "Đang tính lương..." : "Tính lương"}
              </button>
            ) : (
              <button
                type="button"
                id="btn-gui-bang-luong"
                onClick={() => setShowConfirm(true)}
                disabled={daLuuTrongDb || sending || showConfirm}
                className="min-h-[44px] min-w-[220px] px-8 py-2.5 rounded-[9.6px] bg-[#334EAC] border-[1.2px] border-[#334EAC] text-[#FFF9F0] text-sm sm:text-base font-medium hover:bg-[#2A3F8F] transition-colors disabled:opacity-65 disabled:cursor-not-allowed cursor-pointer"
              >
                {sending ? "Đang gửi..." : "Gửi bảng lương dự kiến"}
              </button>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        id="dialog-xac-nhan-gui"
        open={showConfirm}
        title={GUI_BANG_LUONG_TIEU_DE}
        message={GUI_BANG_LUONG_NOI_DUNG}
        cancelLabel={GUI_BANG_LUONG_KHONG}
        confirmLabel={GUI_BANG_LUONG_CO}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleGuiBangLuong}
        busy={sending}
      />
    </div>
  );
}
