"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NotificationBanner } from "@frontend/components/ui/NotificationBanner";
import { CHECK_IN_KHONG_CO_CA, CHECK_IN_THANH_CONG } from "@frontend/config/thong-bao";
import { formatNgayDaiVN } from "@frontend/lib/dinh-dang";
import {
  addMillisecondsVN,
  formatTimeVN,
  nowVN,
  parseDateTimeVN,
} from "@backend/lib/time";
import type {
  ChamCongHomNayData,
  ThongBaoManHinh,
} from "@backend/services/cham-cong";

export default function CheckInScreen() {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const serverOffsetMsRef = useRef<number>(0);
  const [data, setData] = useState<ChamCongHomNayData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [banner, setBanner] = useState<ThongBaoManHinh | null>(null);

  const syncClockOffset = useCallback((d: ChamCongHomNayData) => {
    const serverDate = parseDateTimeVN(d.ngayHomNay, d.gioHeThong);
    if (!serverDate) return;
    const diffMs = serverDate.getTime() - nowVN().getTime();
    serverOffsetMsRef.current = Math.abs(diffMs) > 60_000 ? diffMs : 0;
    setNow(addMillisecondsVN(nowVN(), serverOffsetMsRef.current));
  }, []);

  const loadHomNay = useCallback(async () => {
    try {
      const res = await fetch("/api/cham-cong/hom-nay", { cache: "no-store" });
      const json = await res.json();
      if (json.ok && json.data) {
        const d: ChamCongHomNayData = json.data;
        syncClockOffset(d);
        setData(d);
        setBanner(d.thongBao);
      } else {
        setBanner({
          type: "loi",
          message: json.error?.message || CHECK_IN_KHONG_CO_CA,
        });
      }
    } catch {
      setBanner({
        type: "loi",
        message: CHECK_IN_KHONG_CO_CA,
      });
    } finally {
      setLoading(false);
    }
  }, [syncClockOffset]);

  useEffect(() => {
    loadHomNay();
  }, [loadHomNay]);

  // Đồng hồ theo giờ hệ thống (nowVN) và đồng bộ lại trạng thái ca khi qua phút
  useEffect(() => {
    const initial = addMillisecondsVN(nowVN(), serverOffsetMsRef.current);
    setNow(initial);
    let lastMinute = formatTimeVN(initial).slice(0, 5);
    const timer = setInterval(() => {
      const cur = addMillisecondsVN(nowVN(), serverOffsetMsRef.current);
      setNow(cur);
      const curMin = formatTimeVN(cur).slice(0, 5);
      if (curMin !== lastMinute) {
        lastMinute = curMin;
        loadHomNay();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [loadHomNay]);

  const handleCheckIn = async () => {
    if (submitting || !data?.caHienTai || data.caHienTai.trangThai !== "co-the-check-in") {
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/cham-cong/check-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ malich: data.caHienTai.malich }),
      });
      const json = await res.json();
      if (json.ok && json.data) {
        if (json.data.homNay) {
          setData(json.data.homNay);
        }
        setBanner({
          type: "thanh-cong",
          message: CHECK_IN_THANH_CONG,
        });
      } else {
        setBanner({
          type: "loi",
          message: json.error?.message || CHECK_IN_KHONG_CO_CA,
        });
        await loadHomNay();
      }
    } catch {
      setBanner({
        type: "loi",
        message: CHECK_IN_KHONG_CO_CA,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const ca = data?.caHienTai ?? null;
  const canCheckIn =
    !loading &&
    !submitting &&
    Boolean(ca) &&
    ca?.trangThai === "co-the-check-in";

  const hienNutQuayLai = !loading && (data?.trangThaiManHinh !== "mac-dinh" || Boolean(banner));
  const ngayHienThi = now ? formatNgayDaiVN(now) : "–";
  const gioHienThi = now ? formatTimeVN(now).slice(0, 5) : "--:--";

  return (
    <div
      data-hydrated="true"
      className="relative w-full flex flex-col justify-between min-h-[calc(100dvh-144px)]"
    >
      <div className="w-full">
        {/* Vùng đầu: tiêu đề "Check-in" (trạng thái 1) hoặc Banner thông báo (trạng thái 2–5) */}
        <div className="mb-5 lg:mb-8 min-h-[52px] flex items-center">
          {banner ? (
            <div id="notification-message" className="w-full">
              <NotificationBanner type={banner.type} message={banner.message} />
            </div>
          ) : (
            <h1 className="text-[28px] sm:text-[34px] font-bold text-[#334EAC] leading-tight">
              Check-in
            </h1>
          )}
        </div>

        {/* Hai thẻ ngang theo bố cục Figma UC_3.1 (trái ~48%, phải ~52%) */}
        <div className="grid grid-cols-1 md:grid-cols-[48fr_52fr] gap-6 items-stretch">
          {/* Thẻ trái: Ngày, Đồng hồ hệ thống, Nút Check-in */}
          <section className="border border-[#7096D1] rounded-2xl bg-[#FFF9F0] px-6 py-8 sm:px-10 sm:py-10 flex flex-col items-center justify-between text-center min-h-[320px] md:min-h-[clamp(340px,54dvh,560px)]">
            <p
              id="checkin-date"
              className="text-xl sm:text-[26px] lg:text-[32px] font-normal text-[#334EAC] mt-1"
            >
              {ngayHienThi}
            </p>

            <div
              id="checkin-clock"
              className="text-6xl sm:text-[84px] lg:text-[clamp(72px,10dvh,116px)] font-bold text-[#334EAC] leading-none tracking-tight tabular-nums my-4"
            >
              {gioHienThi}
            </div>

            <button
              type="button"
              id="btn-check-in"
              onClick={handleCheckIn}
              disabled={!canCheckIn}
              className={`w-full max-w-[460px] h-[52px] sm:h-[64px] rounded-xl font-bold text-lg sm:text-[20px] text-[#FFF9F0] transition-colors mb-1 ${
                canCheckIn
                  ? "bg-[#334EAC] hover:bg-[#283E8C] cursor-pointer"
                  : "bg-[#334EAC]/45 cursor-not-allowed"
              }`}
            >
              {submitting ? "Đang xử lý..." : "Check-in"}
            </button>
          </section>

          {/* Thẻ phải: Ca làm hôm nay */}
          <section className="border border-[#7096D1] rounded-2xl bg-[#FFF9F0] px-6 py-6 sm:px-9 sm:py-8 flex flex-col justify-center md:justify-start min-h-[320px] md:min-h-[clamp(340px,54dvh,560px)]">
            <h2 className="text-xl sm:text-[22px] font-bold text-[#334EAC] mb-4 lg:mb-6">
              Ca làm hôm nay
            </h2>

            {loading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-7 w-40 bg-[#F7F2EB] rounded" />
                <div className="h-11 w-full bg-[#F7F2EB] rounded" />
                <div className="h-11 w-full bg-[#F7F2EB] rounded" />
                <div className="h-11 w-full bg-[#F7F2EB] rounded" />
              </div>
            ) : (
              <div>
                <p
                  id="checkin-shift-name"
                  className="text-lg sm:text-[20px] font-bold text-[#334EAC] pb-4 lg:pb-5 border-b border-[#7096D1]/70"
                >
                  {ca ? ca.tenCa : "Không có ca làm hôm nay"}
                </p>

                <div className="flex items-center justify-between gap-4 py-4 lg:py-6 border-b border-[#7096D1]/70">
                  <span className="text-sm sm:text-base font-normal text-[#334EAC]">
                    Thời gian ca:
                  </span>
                  <span
                    id="checkin-shift-time"
                    className="text-sm sm:text-base font-bold text-[#334EAC] text-right tabular-nums"
                  >
                    {ca ? ca.khungGio : "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 py-4 lg:py-6 border-b border-[#7096D1]/70">
                  <span className="text-sm sm:text-base font-normal text-[#334EAC]">
                    Được check-in từ:
                  </span>
                  <span
                    id="checkin-early-time"
                    className="text-sm sm:text-base font-bold text-[#334EAC] text-right tabular-nums"
                  >
                    {ca ? ca.duocCheckInTu : "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 py-4 lg:py-6 border-b border-[#7096D1]/70">
                  <span className="text-sm sm:text-base font-normal text-[#334EAC]">
                    Trạng thái:
                  </span>
                  <span
                    id="checkin-status"
                    className="text-sm sm:text-base font-bold text-[#334EAC] text-right"
                  >
                    {ca ? ca.trangThaiHienThi : "Không có ca làm"}
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Thanh thao tác đáy: đường kẻ ngang + nút Quay lại khi ở trạng thái 2–5 */}
      <div className="border-t border-[#7096D1] pt-4 mt-4 flex justify-end items-center min-h-[60px]">
        {hienNutQuayLai && (
          <button
            type="button"
            id="btn-quay-lai"
            onClick={() => router.push("/nhan-vien")}
            className="w-[143px] h-[52px] rounded-xl border border-[#334EAC] text-[#334EAC] font-medium text-base bg-[#FFF9F0] hover:bg-[#EBF0FA] transition-colors cursor-pointer"
          >
            Quay lại
          </button>
        )}
      </div>
    </div>
  );
}
