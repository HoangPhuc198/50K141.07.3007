"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { RadioChipGroup, RadioChip } from "@frontend/components/ui/RadioChip";
import { NotificationBanner } from "@frontend/components/ui/NotificationBanner";
import { AppShell, useAppShellUser } from "@frontend/components/layout/AppShell";
import type { ChuQuanTongQuanData } from "@backend/services/tong-quan";
import type { CanhBaoThayCaChuQuanItem } from "@backend/services/thay-ca";
import { mapChuQuanDashboardView } from "@frontend/mappers/tong-quan";

function buildCanhBaoBannerKey(cb: CanhBaoThayCaChuQuanItem): string {
  const tinhTrang = cb.khongCoNguoiRanh ? "khong-nguoi-ranh" : "sat-gio";
  return `banner:thay-ca-cb:${cb.id}:${tinhTrang}`;
}

function ChuQuanCanhBaoBanners({
  canhBaoThayCa,
}: {
  canhBaoThayCa?: CanhBaoThayCaChuQuanItem[];
}) {
  const { userId, shownNotificationKeys, dismissShownNotificationKey } =
    useAppShellUser();

  if (!userId || !canhBaoThayCa || canhBaoThayCa.length === 0) {
    return null;
  }

  const dismissedSet = new Set(shownNotificationKeys);
  const visibleItems = canhBaoThayCa.filter(
    (cb) => !dismissedSet.has(buildCanhBaoBannerKey(cb))
  );
  if (visibleItems.length === 0) return null;

  return (
    <>
      {visibleItems.map((cb) => {
        const bannerKey = buildCanhBaoBannerKey(cb);
        return (
          <NotificationBanner
            key={cb.id}
            type="canh-bao"
            onClose={() => dismissShownNotificationKey(bannerKey)}
            message={`${cb.noiDungCanhBao} — ${cb.tenNhanVienXinNghi} (${cb.manvXinNghi}) · Ca ${cb.tenCa} ${cb.khungGio} ngày ${cb.ngayHienThi}${cb.lyDo ? ` · Lý do: ${cb.lyDo}` : ""}`}
          />
        );
      })}
    </>
  );
}

export function ChuQuanDashboard() {
  const [data, setData] = useState<ChuQuanTongQuanData | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchTongQuan = useCallback(async (isInitial = false) => {
    if (
      !isInitial &&
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    ) {
      return;
    }
    try {
      if (isInitial) setLoadError(null);
      const res = await fetch("/api/chu-quan/tong-quan", { cache: "no-store" });
      if (!res.ok) {
        if (isInitial) {
          const errJson = await res.json().catch(() => null);
          const errMsg =
            errJson?.error?.message ||
            (typeof errJson?.error === "string" ? errJson.error : null) ||
            "Không thể tải dữ liệu tổng quan";
          setLoadError(errMsg);
        }
        return;
      }
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      console.error("Lỗi tải tổng quan chủ quán:", err);
      if (isInitial) {
        setLoadError("Không thể kết nối máy chủ");
      }
    } finally {
      if (isInitial) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchTongQuan(true);

    let timer: ReturnType<typeof setInterval> | null = setInterval(() => {
      fetchTongQuan(false);
    }, 8000);

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      } else {
        fetchTongQuan(false);
        if (timer) clearInterval(timer);
        timer = setInterval(() => fetchTongQuan(false), 8000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchTongQuan]);

  const view = mapChuQuanDashboardView(data, selectedFilter, isLoading);

  return (
    <AppShell>
      <div className="space-y-6">
        {loadError && (
          <div
            role="alert"
            className="rounded-[9.6px] border border-[#C0392B] bg-[#F7ECEA] px-4 py-3 text-sm text-[#C0392B]"
          >
            {loadError}
          </div>
        )}

        <ChuQuanCanhBaoBanners canhBaoThayCa={data?.canhBaoThayCa} />

        {/* Nút hành động nhanh trên cùng (Figma: Xếp lịch làm, Xếp ca làm) */}
        <div className="flex items-center justify-end gap-4 flex-wrap pt-3 pb-3">
          <Link
            href="/chu-quan/lich-lam/xep-lich"
            className="inline-flex items-center justify-center gap-2 h-[42px] px-4 bg-[#334EAC] hover:bg-[#283E8C] text-[#FFF9F0] text-xs sm:text-sm font-medium rounded-[9.6px] shadow-sm transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Xếp lịch làm</span>
          </Link>

          <Link
            href="/chu-quan/lich-lam/xep-ca"
            className="inline-flex items-center justify-center gap-2 h-[42px] px-4 bg-[#F7F2EB] border-[1.2px] border-[#334EAC] text-[#334EAC] hover:bg-[#334EAC]/5 text-xs sm:text-sm font-medium rounded-[9.6px] transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Xếp ca làm</span>
          </Link>
        </div>

        {/* 3 Thẻ thống kê (Figma: Nhân viên đang làm, Ca làm hôm nay, Yêu cầu cần xử lý) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* Thẻ 1 */}
          <div className="bg-[#F7F2EB] rounded-[14.4px] border-[1.2px] border-[#7096D1] p-5 sm:p-6 min-h-[126px] flex flex-col justify-between shadow-[0px_4px_16px_0px_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between text-[#334EAC] mb-2">
              <span className="text-sm font-medium">Nhân viên đang làm</span>
              <svg className="w-5 h-5 text-[#334EAC]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656-.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#334EAC]">
                {view.nhanVienDangLamText}
              </span>
              <span className="text-xs text-[#334EAC]/80">đã check-in</span>
            </div>
          </div>

          {/* Thẻ 2 */}
          <div className="bg-[#FFF9F0] rounded-[14.4px] border-[1.2px] border-[#7096D1] p-5 sm:p-6 min-h-[126px] flex flex-col justify-between shadow-[0px_4px_16px_0px_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between text-[#334EAC] mb-2">
              <span className="text-sm font-medium">Ca làm hôm nay</span>
              <svg className="w-5 h-5 text-[#334EAC]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#334EAC]">
                {view.caLamHomNayText}
              </span>
            </div>
          </div>

          {/* Thẻ 3 */}
          <div className="bg-[#F7F2EB] rounded-[14.4px] border-[1.2px] border-[#7096D1] p-5 sm:p-6 min-h-[126px] flex flex-col justify-between shadow-[0px_4px_16px_0px_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between text-[#334EAC] mb-2">
              <span className="text-sm font-medium">Yêu cầu cần xử lý</span>
              <svg className="w-5 h-5 text-[#334EAC]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#334EAC]">
                {view.yeuCauCanXuLyText}
              </span>
            </div>
          </div>
        </div>

        {/* Bố cục 2 khối chính bên dưới (Desktop: tỷ lệ 2 cột theo bố cục Figma; Mobile: 1 cột) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.26fr_1fr] gap-6 items-start pt-4">
          {/* Khối Trái: Yêu cầu cần xử lý */}
          <div className="bg-[#F7F2EB] rounded-[14.4px] border-[1.2px] border-[#7096D1] p-5 shadow-[0px_4px_16px_0px_rgba(0,0,0,0.08)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#334EAC]">Yêu cầu cần xử lý</h3>
              <span className="text-xs bg-[#FFF9F0] text-[#334EAC] px-2.5 py-1 rounded-[7.2px] font-medium">
                {view.yeuCauBadgeText}
              </span>
            </div>

            {/* Các nút lọc */}
            <RadioChipGroup
              value={selectedFilter}
              onChange={setSelectedFilter}
              ariaLabel="Lọc yêu cầu"
              className="flex gap-2 mb-4 flex-wrap"
            >
              {view.filterChips.map((chip) => (
                <RadioChip
                  key={chip.value}
                  value={chip.value}
                  ariaLabel={chip.label}
                  className={(isSelected) =>
                    `px-3 py-1 max-md:min-h-[44px] max-md:px-4 inline-flex items-center rounded-[7.2px] text-xs transition-colors ${
                      isSelected
                        ? "bg-[#E2E9F7] border border-[#334EAC] text-[#334EAC] font-semibold"
                        : "bg-[#FFF9F0] border border-transparent text-[#334EAC] font-medium hover:bg-[#EBF0FA]"
                    }`
                  }
                >
                  <span>{chip.label}</span>
                </RadioChip>
              ))}
            </RadioChipGroup>

            {/* Danh sách yêu cầu */}
            <div className="divide-y divide-[#7096D1]/40">
              {view.danhSachYeuCau.length === 0 ? (
                <p className="py-6 text-center text-xs text-[#334EAC]/70">
                  {view.emptyListSymbol}
                </p>
              ) : (
                view.danhSachYeuCau.map((yc) => (
                  <div key={yc.id} className="py-3.5 first:pt-1 last:pb-1">
                    <div className="flex items-baseline justify-between mb-1 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-sm text-[#334EAC]">
                          {yc.tenNhanVien}
                        </span>
                        <span className="text-xs text-[#334EAC]/80 font-normal">
                          {yc.loaiYeuCau}
                        </span>
                      </div>
                      <span className="text-xs text-[#334EAC]/70 whitespace-nowrap">
                        {yc.thoiGian}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#334EAC]/90 mt-1 gap-2">
                      <span className="min-w-0 break-words">
                        {yc.caLam} · {yc.noiDung}
                      </span>
                      <Link
                        href={yc.linkAction}
                        className="text-[#334EAC] font-medium hover:underline inline-flex items-center gap-1 ml-2 flex-shrink-0 whitespace-nowrap"
                      >
                        <span>{yc.labelAction}</span>
                        <span>→</span>
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Khối Phải: Ca làm hôm nay */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#334EAC]">Ca làm hôm nay</h3>
              <Link
                href="/chu-quan/cham-cong/bao-cao"
                className="text-xs text-[#334EAC] hover:underline font-medium inline-flex items-center gap-1"
              >
                <span>Báo cáo chấm công</span>
                <span>→</span>
              </Link>
            </div>

            {/* Danh sách từng ca */}
            <div className="space-y-4">
              {view.caLamHomNay.length === 0 ? (
                <div className="bg-[#FFF9F0] border-[1.2px] border-[#7096D1] rounded-[14.4px] p-4 text-xs text-[#334EAC]/70">
                  {view.emptyListSymbol}
                </div>
              ) : (
                view.caLamHomNay.map((ca, idx) => (
                  <div
                    key={ca.maca}
                    className={`border-[1.2px] border-[#7096D1] rounded-[14.4px] p-4 shadow-[0px_4px_16px_0px_rgba(0,0,0,0.08)] ${
                      idx === 0 ? "bg-[#F7F2EB]" : "bg-[#FFF9F0]"
                    }`}
                  >
                    <div className="mb-2 pb-2 border-b border-[#7096D1]/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-[#334EAC]">
                          {ca.tenCa}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-[7.2px] font-medium bg-[#FFF9F0] text-[#334EAC] border border-[#7096D1]/30">
                          {ca.trangThai}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-[#334EAC]/85">
                        {ca.khungGio}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      {ca.nhanViens.length === 0 ? (
                        <p className="text-xs text-[#334EAC]/70 py-1">
                          {view.emptyListSymbol}
                        </p>
                      ) : (
                        ca.nhanViens.map((nv) => (
                          <div
                            key={nv.manv}
                            className="flex items-center justify-between text-xs py-0.5 text-[#334EAC] gap-2"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="font-medium truncate">
                                {nv.tenNhanVien}
                              </span>
                              <span className="text-[#334EAC]/80 whitespace-nowrap">
                                {nv.viTri}
                              </span>
                            </div>
                            <span className="font-medium whitespace-nowrap">
                              {nv.trangThaiChamCong}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
