"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AppShell,
  useAppShellUser,
  type HeaderThongBaoItem,
} from "@frontend/components/layout/AppShell";
import { nowVN } from "@backend/lib/time";
import { filterUnreadNotifications } from "@frontend/lib/thong-bao-da-doc";
import type { NhanVienTongQuanData, ThongBaoItem } from "@backend/services/tong-quan";
import { mapNhanVienDashboardView } from "@frontend/mappers/tong-quan";

function NhanVienThongBaoCard({
  thongBao,
  emptySymbol,
  isLoading,
}: {
  thongBao: ThongBaoItem[];
  emptySymbol: string;
  isLoading: boolean;
}) {
  const router = useRouter();
  const {
    notifications: shellNotifications,
    hasLoadedNotifications,
    isNotificationsReady,
    readNotificationKeys,
    activateNotification,
  } = useAppShellUser();

  const isSyncing = isLoading || !isNotificationsReady;
  const visibleEntries = useMemo(() => {
    if (isSyncing) return [];
    const sourceItems: HeaderThongBaoItem[] = hasLoadedNotifications
      ? shellNotifications
      : thongBao;
    return filterUnreadNotifications(sourceItems, readNotificationKeys, nowVN());
  }, [
    isSyncing,
    hasLoadedNotifications,
    shellNotifications,
    thongBao,
    readNotificationKeys,
  ]);

  return (
    <div className="bg-[#F7F2EB] rounded-[14.4px] border-[1.2px] border-[#7096D1] p-5 sm:p-6 shadow-[0px_4px_16px_0px_rgba(0,0,0,0.08)] flex flex-col">
      <h3 className="text-base font-bold text-[#334EAC] mb-4">
        Thông báo của bạn
      </h3>

      <div
        data-testid="dashboard-notification-list"
        className="border-[1.2px] border-[#7096D1] rounded-[9.6px] p-4 space-y-4 bg-[#F7F2EB] flex-1 max-h-80 overflow-y-auto overflow-x-hidden"
      >
        {visibleEntries.length === 0 ? (
          <p className="text-xs text-[#334EAC]/70">
            {isSyncing ? "..." : emptySymbol}
          </p>
        ) : (
          visibleEntries.map((entry, idx) => {
            const tb = entry.item;
            const content = (
              <div
                className={`space-y-1 ${
                  idx > 0 ? "pt-3 border-t border-[#FFF9F0]" : ""
                }`}
              >
                <p className="font-semibold text-xs sm:text-sm text-[#334EAC] break-words">
                  {tb.tieuDe}
                </p>
                <p className="text-[11px] text-[#334EAC]/70 font-normal">
                  {tb.thoiGian}
                </p>
                <p className="text-xs text-[#334EAC]/90 break-words">
                  {tb.chiTiet}
                </p>
              </div>
            );

            return tb.link ? (
              <Link
                key={tb.id}
                href={tb.link}
                data-testid={`dashboard-notification-item-${tb.id}`}
                data-notification-key={entry.key}
                onClick={() => activateNotification(tb)}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Spacebar") {
                    e.preventDefault();
                    activateNotification(tb);
                    router.push(tb.link!);
                  }
                }}
                className="block w-full text-left min-h-[44px] hover:opacity-85 transition-opacity cursor-pointer"
              >
                {content}
              </Link>
            ) : (
              <button
                key={tb.id}
                type="button"
                data-testid={`dashboard-notification-item-${tb.id}`}
                data-notification-key={entry.key}
                onClick={() => activateNotification(tb)}
                className="block w-full text-left min-h-[44px] hover:opacity-85 transition-opacity cursor-pointer"
              >
                {content}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export function NhanVienDashboard() {
  const [data, setData] = useState<NhanVienTongQuanData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        setLoadError(null);
        const res = await fetch("/api/nhan-vien/tong-quan");
        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          if (active) {
            const errMsg =
              errJson?.error?.message ||
              (typeof errJson?.error === "string" ? errJson.error : null) ||
              "Không thể tải dữ liệu tổng quan";
            setLoadError(errMsg);
          }
          return;
        }
        const json = await res.json();
        if (active) {
          setData(json.data);
        }
      } catch (err) {
        console.error("Lỗi tải tổng quan nhân viên:", err);
        if (active) {
          setLoadError("Không thể kết nối máy chủ");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }
    loadData();
    return () => {
      active = false;
    };
  }, []);

  const view = mapNhanVienDashboardView(data, isLoading);

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

        {/* Thẻ 1: Ca hiện tại của bạn (Figma) */}
        <div className="bg-[#F7F2EB] rounded-[14.4px] border-[1.2px] border-[#7096D1] p-5 sm:p-6 shadow-[0px_4px_16px_0px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-bold text-[#334EAC]">
              Ca hiện tại của bạn
            </h3>
            <span className="text-xs bg-[#FFF9F0] text-[#334EAC] border border-[#7096D1]/40 px-2.5 py-0.5 rounded-[7.2px] font-medium">
              {view.ca.trangThaiText}
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mt-3">
            {/* Thông tin ca */}
            <div>
              <div className="text-2xl sm:text-3xl font-bold text-[#334EAC] mb-2 tracking-tight">
                {view.ca.khungGioText}
              </div>
              <div className="space-y-0.5 text-xs sm:text-sm text-[#334EAC]">
                <p className="font-medium">{view.ca.tenCaText}</p>
                <p>{view.ca.ngayLamText}</p>
                <p className="text-[#334EAC]/80">{view.ca.checkInText}</p>
              </div>
            </div>

            {/* Thời gian làm & nút hành động (Check-in / Check-out / Bổ sung chấm công) */}
            <div className="flex flex-col md:items-end justify-between gap-3">
              <div className="md:text-right">
                <p className="text-xs text-[#334EAC]/80 font-medium">Thời gian làm</p>
                <p className="text-xl sm:text-2xl font-bold text-[#334EAC]">
                  {view.ca.thoiGianLamText}
                </p>
              </div>

              <Link
                href={view.ca.actionHref}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#334EAC] hover:bg-[#283E8C] text-[#FFF9F0] font-medium rounded-[9.6px] text-sm shadow-sm transition-colors cursor-pointer w-full md:w-auto"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>{view.ca.actionLabel}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Thẻ 2: Đăng ký lịch rảnh tuần mới (Figma) */}
        <div className="bg-[#F7F2EB] rounded-[14.4px] border-[1.2px] border-[#7096D1] p-4 sm:p-5 shadow-[0px_4px_16px_0px_rgba(0,0,0,0.08)] flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[9.6px] bg-[#FFF9F0] flex items-center justify-center text-[#334EAC] flex-shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-semibold text-sm sm:text-base text-[#334EAC]">
              {view.lichRanh.tieuDe}
            </span>
          </div>

          <Link
            href={view.lichRanh.link}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#334EAC] hover:bg-[#283E8C] text-[#FFF9F0] text-xs sm:text-sm font-medium rounded-[9.6px] shadow-sm transition-colors cursor-pointer w-full sm:w-auto justify-center"
          >
            <span>+</span>
            <span>Đăng ký lịch rảnh</span>
          </Link>
        </div>

        {/* Bố cục 2 cột bên dưới (Lương ~1/3 & Thông báo ~2/3 theo bố cục Figma) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.9fr] gap-6 items-stretch">
          {/* Cột trái: Lương tháng gần nhất */}
          <div className="bg-[#F7F2EB] rounded-[14.4px] border-[1.2px] border-[#7096D1] p-5 sm:p-6 shadow-[0px_4px_16px_0px_rgba(0,0,0,0.08)] flex flex-col justify-between min-h-[250px]">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-bold text-[#334EAC]">
                  {view.luong.kyLuongText}
                </h3>
                <span className="text-xs bg-[#FFF9F0] text-[#334EAC] border border-[#7096D1]/40 px-2 py-0.5 rounded-[7.2px] font-medium">
                  {view.luong.trangThaiText}
                </span>
              </div>

              {/* Số tiền lớn hoặc thông báo chưa tổng hợp */}
              {isLoading ? (
                <div className="text-3xl font-extrabold text-[#334EAC] my-3">
                  {view.luong.tongTienText}
                </div>
              ) : view.luong.coBangLuong ? (
                <div className="text-3xl font-extrabold text-[#334EAC] my-3">
                  {view.luong.tongTienText}
                </div>
              ) : (
                <div className="text-base font-bold text-[#334EAC] my-4">
                  {view.luong.tongTienText}
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-[#334EAC] font-medium">
                <span>{view.luong.tongGioLamText}</span>
                <span>{view.luong.mucLuongGioText}</span>
              </div>
            </div>

            <div className="pt-4 mt-4">
              <Link
                href="/nhan-vien/luong/xem"
                className="text-xs text-[#334EAC] font-semibold hover:underline inline-flex items-center gap-1"
              >
                <span>Xem bảng lương</span>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* Cột phải: Thông báo của bạn */}
          <NhanVienThongBaoCard
            thongBao={view.thongBao}
            emptySymbol={view.emptySymbol}
            isLoading={isLoading}
          />
        </div>
      </div>
    </AppShell>
  );
}
