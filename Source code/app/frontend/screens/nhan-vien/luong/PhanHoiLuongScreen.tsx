"use client";

import React, { useCallback, useEffect, useState } from "react";
import { NotificationBanner, type BannerVariant } from "@frontend/components/ui/NotificationBanner";
import {
  BANG_LUONG_CHUA_TONG_HOP,
  PHAN_HOI_LUONG_GUI_THANH_CONG,
  PHAN_HOI_LUONG_HET_HAN,
  PHAN_HOI_LUONG_THIEU_NOI_DUNG,
} from "@frontend/config/thong-bao";
import { formatTien } from "@frontend/lib/dinh-dang";
import { PLACEHOLDER } from "@frontend/config/placeholder";
import type { ThongTinPhanHoiLuongDto } from "@backend/services/phan-hoi-luong";
import styles from "./PhanHoiLuongScreen.module.css";

function LockIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#334EAC"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#334EAC"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#334EAC"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

export function PhanHoiLuongScreen() {
  const [data, setData] = useState<ThongTinPhanHoiLuongDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [noidung, setNoidung] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [emptyError, setEmptyError] = useState(false);
  const [banner, setBanner] = useState<{ type: BannerVariant; message: string } | null>(null);

  const taiDuLieu = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/phan-hoi-luong", {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setBanner({
          type: "loi",
          message: json?.error?.message || BANG_LUONG_CHUA_TONG_HOP,
        });
        return;
      }
      const dto = json.data as ThongTinPhanHoiLuongDto;
      setData(dto);
      if (!dto.coBangLuong) {
        setBanner({ type: "loi", message: BANG_LUONG_CHUA_TONG_HOP });
      } else if (dto.quaHan) {
        setBanner({ type: "loi", message: PHAN_HOI_LUONG_HET_HAN });
      }
    } catch {
      setBanner({ type: "loi", message: BANG_LUONG_CHUA_TONG_HOP });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void taiDuLieu();
  }, [taiDuLieu]);

  const quaHan = Boolean(data?.quaHan);
  const coBangLuong = Boolean(data?.coBangLuong);
  const formDisabled = loading || submitting || !coBangLuong || quaHan;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formDisabled) return;

    const trimmed = noidung.trim();
    if (!trimmed) {
      setEmptyError(true);
      setBanner({ type: "loi", message: PHAN_HOI_LUONG_THIEU_NOI_DUNG });
      return;
    }

    setEmptyError(false);
    setSubmitting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/phan-hoi-luong", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mabangluong: data?.bangLuong?.mabangluong,
          noidung: trimmed,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        const msg = json?.error?.message || PHAN_HOI_LUONG_THIEU_NOI_DUNG;
        if (msg === PHAN_HOI_LUONG_THIEU_NOI_DUNG) {
          setEmptyError(true);
        }
        setBanner({ type: "loi", message: msg });
        return;
      }
      setNoidung("");
      setEmptyError(false);
      setBanner({ type: "thanh-cong", message: PHAN_HOI_LUONG_GUI_THANH_CONG });
      await taiDuLieu();
    } catch {
      setBanner({ type: "loi", message: "Không thể kết nối máy chủ" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setNoidung("");
    setEmptyError(false);
    if (quaHan) {
      setBanner({ type: "loi", message: PHAN_HOI_LUONG_HET_HAN });
    } else if (!coBangLuong && !loading) {
      setBanner({ type: "loi", message: BANG_LUONG_CHUA_TONG_HOP });
    } else {
      setBanner(null);
    }
  };

  const tenNhanVien = data?.nhanVien?.tennv ?? "—";
  const kyLuongText = data?.kyLuong ? `Tháng ${data.kyLuong.hienThi}` : "—";
  const trangThaiKy = data?.kyLuong?.trangthai ?? "—";
  const tongLuongText =
    data?.bangLuong != null ? formatTien(data.bangLuong.tongluong) : "—";

  return (
    <div className="space-y-6 pb-8">
      {banner && (
        <NotificationBanner
          type={banner.type}
          message={banner.message}
          onClose={quaHan ? undefined : () => setBanner(null)}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] 2xl:grid-cols-[minmax(0,1fr)_minmax(320px,490px)] gap-7 items-stretch">
          {/* Thẻ trái: Nội dung phản hồi */}
          <section
            id="uc42-card-phan-hoi"
            className="bg-[#FFF9F0] border-[1.2px] border-[#7096D1] rounded-[14.4px] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.2)] p-6 sm:p-7 flex flex-col justify-between min-w-0 min-h-[420px] lg:min-h-[504px]"
          >
            <div className={`space-y-7 min-w-0 ${styles.fieldsContainer}`}>
              <h2 className="text-[22px] sm:text-[24px] font-semibold text-[#334EAC] leading-[1.4]">
                Nội dung phản hồi
              </h2>

              <div className={styles.fieldsGrid}>
                <div className="space-y-2.5 min-w-0">
                  <label className="block text-[17px] sm:text-[19.2px] font-medium text-[#334EAC]">
                    Nhân viên
                  </label>
                  <div
                    id="uc42-box-nhan-vien"
                    className="min-h-[56px] sm:h-[56px] px-4 rounded-[9.6px] border-[1.2px] border-[#7096D1] bg-[#F7F2EB] flex items-center justify-between gap-3 min-w-0"
                  >
                    <span
                      title={loading ? undefined : tenNhanVien}
                      className="text-[16.8px] text-[#334EAC] truncate min-w-0 flex-1"
                    >
                      {loading ? "Đang tải..." : tenNhanVien}
                    </span>
                    <LockIcon />
                  </div>
                </div>

                <div className="space-y-2.5 min-w-0">
                  <label className="block text-[17px] sm:text-[19.2px] font-medium text-[#334EAC]">
                    Kỳ lương
                  </label>
                  <div
                    id="uc42-box-ky-luong"
                    className="min-h-[56px] sm:h-[56px] px-4 rounded-[9.6px] border-[1.2px] border-[#7096D1] bg-[#F7F2EB] flex items-center justify-between gap-3 min-w-0"
                  >
                    <span
                      title={loading ? undefined : kyLuongText}
                      className="text-[16.8px] text-[#334EAC] truncate min-w-0 flex-1"
                    >
                      {loading ? "Đang tải..." : kyLuongText}
                    </span>
                    <LockIcon />
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <label
                  htmlFor="phan-hoi-noi-dung"
                  className="block text-[17px] sm:text-[19.2px] font-medium text-[#334EAC]"
                >
                  Nội dung sai sót *
                </label>
                <textarea
                  id="phan-hoi-noi-dung"
                  name="noidung"
                  rows={4}
                  maxLength={500}
                  placeholder={PLACEHOLDER.noiDungPhanHoi}
                  value={noidung}
                  readOnly={formDisabled}
                  onChange={(e) => {
                    setNoidung(e.target.value);
                    if (emptyError && e.target.value.trim().length > 0) {
                      setEmptyError(false);
                    }
                  }}
                  className={`w-full min-h-[144px] rounded-[9.6px] border-[1.2px] bg-[#FFF9F0] px-4 py-3.5 text-[16.8px] leading-6 outline-none transition-colors resize-y ${
                    emptyError
                      ? "border-[#C0392B] text-[#334EAC] placeholder:text-[#C0392B]"
                      : "border-[#7096D1] text-[#334EAC] placeholder:text-[#7096D1] focus:border-[#334EAC]"
                  } ${formDisabled ? "opacity-70 cursor-not-allowed bg-[#F7F2EB]" : ""}`}
                />
              </div>
            </div>
          </section>

          {/* Thẻ phải: Thông tin kỳ lương */}
          <aside
            id="uc42-card-ky-luong"
            className="bg-[#F7F2EB] border-[1.2px] border-[#7096D1] rounded-[14.4px] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.2)] p-6 sm:p-7 flex flex-col justify-between min-w-0 lg:min-h-[504px]"
          >
            <div className="space-y-6 min-w-0">
              <div className="flex items-center gap-3 min-w-0">
                <CalendarIcon />
                <h2 className="text-[22px] sm:text-[24px] font-semibold text-[#334EAC] leading-[1.4]">
                  Thông tin kỳ lương
                </h2>
              </div>

              <div className="space-y-4 text-[#334EAC] min-w-0">
                <p className="text-[21px] sm:text-[23px] font-semibold break-words">
                  {loading ? "Đang tải..." : kyLuongText}
                </p>

                <div className="flex items-center flex-wrap gap-2.5 text-[19px] sm:text-[22px] font-medium">
                  <ClockIcon />
                  <span>Trạng thái:</span>
                  <span>{loading ? "..." : trangThaiKy}</span>
                </div>

                <p className="text-[19px] sm:text-[22px] font-normal break-words">
                  Tổng lương:{" "}
                  <span className="font-semibold text-[#334EAC]">
                    {loading ? "..." : tongLuongText}
                  </span>
                </p>
              </div>
            </div>
          </aside>
        </div>

        {/* Thanh thao tác dưới cùng */}
        <div className="border-t-[1.2px] border-[#7096D1] pt-5 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-4">
          <button
            type="button"
            onClick={handleCancel}
            className="min-h-[48px] sm:h-[57.6px] sm:w-[144px] px-6 rounded-[9.6px] border-[1.2px] border-[#334EAC] bg-[#FFF9F0] text-[#334EAC] text-[18px] sm:text-[19.2px] font-medium hover:bg-[#F7F2EB] transition-colors"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={formDisabled}
            className={`min-h-[48px] sm:h-[57.6px] sm:w-[264px] px-8 rounded-[9.6px] border-[1.2px] border-[#334EAC] bg-[#334EAC] text-[#FFF9F0] text-[18px] sm:text-[19.2px] font-medium transition-opacity ${
              quaHan || !coBangLuong || noidung.trim() === ""
                ? "opacity-45"
                : "hover:bg-[#273E8C]"
            } ${formDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
          >
            {submitting ? "Đang gửi..." : "Gửi"}
          </button>
        </div>
      </form>
    </div>
  );
}
