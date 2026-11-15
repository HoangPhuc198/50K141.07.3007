"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "@frontend/components/ui/DataTable";
import { ConfirmDialog } from "@frontend/components/ui/ConfirmDialog";
import { NotificationBanner } from "@frontend/components/ui/NotificationBanner";
import { PageCard } from "@frontend/components/ui/PageCard";
import { ThongKeCard } from "@frontend/components/ui/ThongKeCard";
import { LAYOUT_TOKENS } from "@frontend/config/tokens";
import {
  CHOT_LUONG_CO_PHAN_HOI_NOI_DUNG,
  CHOT_LUONG_CO_PHAN_HOI_TIEU_DE,
  CHOT_LUONG_THANH_CONG,
} from "@frontend/config/thong-bao";
import { formatGio, formatSoTien, formatTien } from "@frontend/lib/dinh-dang";
import type { BangLuongTinhDto } from "@backend/services/tinh-luong";
import type { ChotBangLuongDto } from "@backend/services/chot-luong";

export default function ChotBangLuongScreen() {
  const [duLieu, setDuLieu] = useState<ChotBangLuongDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showBlockingModal, setShowBlockingModal] = useState(false);
  const [banner, setBanner] = useState<{
    type: "thanh-cong" | "loi";
    message: string;
  } | null>(null);

  const taiDuLieu = useCallback(async (overrideMaKy?: string) => {
    setLoading(true);
    try {
      let targetMaKy = overrideMaKy?.trim() || "";
      if (!targetMaKy && typeof window !== "undefined") {
        targetMaKy =
          new URLSearchParams(window.location.search).get("makyluong")?.trim() || "";
      }

      if (!targetMaKy) {
        const resKy = await fetch("/api/ky-luong/hien-tai", { cache: "no-store" });
        const jsonKy = await resKy.json();
        if (!resKy.ok || !jsonKy.ok || !jsonKy.data?.Makyluong) {
          setDuLieu(null);
          return;
        }
        targetMaKy = jsonKy.data.Makyluong;
      }

      const res = await fetch(
        `/api/ky-luong/${encodeURIComponent(targetMaKy)}/bang-luong`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (res.ok && json.ok) {
        setDuLieu(json.data as ChotBangLuongDto);
      } else {
        setDuLieu(null);
        setBanner({
          type: "loi",
          message: json.error?.message || "Không tải được dữ liệu bảng lương",
        });
      }
    } catch {
      setDuLieu(null);
      setBanner({
        type: "loi",
        message: "Không thể kết nối máy chủ",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    taiDuLieu();
  }, [taiDuLieu]);

  useEffect(() => {
    if (!showBlockingModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowBlockingModal(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showBlockingModal]);

  const handleChotBangLuong = async () => {
    if (!duLieu || duLieu.kyLuong.Trangthai !== "Dự kiến" || submitting) return;
    setBanner(null);

    if (duLieu.soPhanHoiChuaXuLy > 0) {
      setShowBlockingModal(true);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/ky-luong/${encodeURIComponent(duLieu.kyLuong.Makyluong)}/chot`,
        { method: "POST" }
      );
      const json = await res.json();
      if (!res.ok || !json.ok) {
        if (json.error?.code === "CO_PHAN_HOI_CHUA_XU_LY") {
          setShowBlockingModal(true);
          await taiDuLieu(duLieu.kyLuong.Makyluong);
          return;
        }
        setBanner({
          type: "loi",
          message: json.error?.message || "Không thể chốt bảng lương",
        });
        return;
      }

      const ketQua = json.data as ChotBangLuongDto & { message?: string };
      setDuLieu(ketQua);
      setBanner({
        type: "thanh-cong",
        message: ketQua.message || CHOT_LUONG_THANH_CONG,
      });
    } catch {
      setBanner({
        type: "loi",
        message: "Không thể kết nối máy chủ",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const columns = useMemo<DataTableColumn<BangLuongTinhDto>[]>(
    () => [
      {
        key: "Hoten",
        header: "Nhân viên",
        render: (row) => <span className="font-medium">{row.Hoten}</span>,
      },
      {
        key: "Songay",
        header: "Số ngày",
        render: (row) => row.Songay,
      },
      {
        key: "Tonggiolam",
        header: "Giờ",
        render: (row) => formatGio(row.Tonggiolam),
      },
      {
        key: "Mucluong",
        header: "Lương/giờ",
        render: (row) => formatSoTien(row.Mucluong),
      },
      {
        key: "Heso",
        header: "Hệ số",
        render: (row) => formatGio(row.Heso),
      },
      {
        key: "Tienthuong",
        header: "Thưởng",
        render: (row) => formatSoTien(row.Tienthuong),
      },
      {
        key: "Tongluong",
        header: "Lương",
        render: (row) => <span className="font-semibold">{formatSoTien(row.Tongluong)}</span>,
      },
    ],
    []
  );

  const ky = duLieu?.kyLuong ?? null;
  const daChot = ky?.Trangthai === "Đã chốt";
  const duKien = ky?.Trangthai === "Dự kiến";
  const coTheChot = duKien && !submitting;

  const nhanTrangThai = daChot
    ? "Bảng lương đã chốt"
    : duKien
      ? "Bảng lương dự kiến"
      : "Bảng lương chưa tính";

  const phuDePhanHoi =
    (duLieu?.soPhanHoiChuaXuLy ?? 0) === 0
      ? "Đủ điều kiện để chốt bảng lương"
      : "Cần xử lý trước khi chốt bảng lương";

  return (
    <div
      data-hydrated="true"
      className={`w-full flex flex-col ${LAYOUT_TOKENS.spaceSection} text-[#334EAC]`}
    >
      {/* Banner thông báo thành công / lỗi (chuẩn 08-THONG-BAO.md) */}
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

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          <div className="h-[136px] rounded-[14.4px] bg-[#F7F2EB] border border-[#7096D1]" />
          <div className="h-[136px] rounded-[14.4px] bg-[#F7F2EB] border border-[#7096D1]" />
          <div className="h-[136px] rounded-[14.4px] bg-[#F7F2EB] border border-[#7096D1]" />
        </div>
      ) : !duLieu || !ky ? (
        <PageCard>
          <p className="text-sm text-[#334EAC] text-center py-8">
            Chưa có dữ liệu kỳ lương để chốt
          </p>
        </PageCard>
      ) : (
        <>
          {/* Hàng 3 thẻ tổng hợp trên cùng (theo Figma UC_8.6_01..03) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ThongKeCard
              id="card-tong-luong"
              label="Tổng lương đã cập nhật"
              value={formatTien(duLieu.tongLuong)}
              subtitle={`Tháng ${ky.Thang}/${ky.Nam} · ${duLieu.soNhanVien} nhân viên`}
            />
            <ThongKeCard
              id="card-phan-hoi"
              label="Phản hồi chờ xử lý"
              value={`${duLieu.soPhanHoiChuaXuLy} phản hồi`}
              subtitle={phuDePhanHoi}
            />
            <ThongKeCard
              id="card-trang-thai"
              label="Trạng thái"
              value={nhanTrangThai}
            />
          </div>

          {/* Bảng tổng hợp lương nhân viên */}
          <div className="w-full max-w-[1045px] mx-auto shadow-[0px_4px_8px_rgba(0,0,0,0.2)] rounded-[9.6px]">
            <DataTable
              columns={columns}
              data={duLieu.danhSach}
              keyExtractor={(row) => row.Manv}
              maxHeight="max-h-[474px]"
              emptyText="Chưa có dữ liệu bảng lương dự kiến"
              mobileCards
              ariaLabel="Bảng tổng hợp lương nhân viên trước khi chốt"
            />
          </div>

          {/* Thanh thao tác dưới cùng */}
          <div className="border-t-[1.2px] border-[#7096D1] pt-4 flex justify-end">
            <button
              id="btn-chot-bang-luong"
              type="button"
              disabled={!coTheChot}
              onClick={handleChotBangLuong}
              className={`min-h-[48px] min-w-[220px] px-8 py-2.5 rounded-[9.6px] font-bold text-base border-[1.2px] transition-colors ${
                coTheChot
                  ? "bg-[#334EAC] hover:bg-[#273d88] border-[#334EAC] text-[#FFF9F0] cursor-pointer"
                  : "bg-[#7096D1] border-[#334EAC] text-[#FFF9F0] cursor-not-allowed"
              }`}
            >
              {submitting ? "Đang chốt..." : "Chốt bảng lương"}
            </button>
          </div>
        </>
      )}

      {/* Hộp thoại chặn khi còn phản hồi chưa xử lý (dùng ConfirmDialog chung, chuẩn Figma UC_8.6_03) */}
      <ConfirmDialog
        open={showBlockingModal}
        id="blocking-chot-dialog"
        dataTestId="blocking-feedback-dialog"
        titleId="blocking-dialog-title"
        closeButtonId="btn-dong-chot-dialog"
        confirmButtonId="btn-xac-nhan-chot-dialog"
        maxWidthClass="max-w-[480px]"
        title={CHOT_LUONG_CO_PHAN_HOI_TIEU_DE}
        message={CHOT_LUONG_CO_PHAN_HOI_NOI_DUNG}
        confirmLabel="Xác nhận"
        hideCancel
        onConfirm={() => setShowBlockingModal(false)}
        onCancel={() => setShowBlockingModal(false)}
      />
    </div>
  );
}
