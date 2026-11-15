"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@frontend/components/ui/ConfirmDialog";
import { NotificationBanner } from "@frontend/components/ui/NotificationBanner";
import {
  CHECK_OUT_HOI_TANG_CA,
  CHECK_OUT_QUEN,
  CHECK_OUT_THANH_CONG,
} from "@frontend/config/thong-bao";
import { formatNgayDaiVN, formatTien } from "@frontend/lib/dinh-dang";
import {
  addMillisecondsVN,
  formatTimeVN,
  nowVN,
  parseDateTimeVN,
} from "@backend/lib/time";
import type {
  ChamCongHomNayData,
  KetQuaCheckOut,
  ThongBaoManHinh,
} from "@backend/services/cham-cong";

export default function CheckOutScreen() {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const serverOffsetMsRef = useRef<number>(0);
  const [data, setData] = useState<ChamCongHomNayData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showTangCaPopup, setShowTangCaPopup] = useState<boolean>(false);
  const [banner, setBanner] = useState<ThongBaoManHinh | null>(null);
  const [ketQua, setKetQua] = useState<KetQuaCheckOut | null>(null);

  const syncFromHomNay = useCallback((d: ChamCongHomNayData) => {
    const serverDate = parseDateTimeVN(d.ngayHomNay, d.gioHeThong);
    if (serverDate) {
      const diffMs = serverDate.getTime() - nowVN().getTime();
      serverOffsetMsRef.current = Math.abs(diffMs) > 60_000 ? diffMs : 0;
      setNow(addMillisecondsVN(nowVN(), serverOffsetMsRef.current));
    }
    setData(d);
    const ca = d.caCheckOut;
    if (!ca) {
      setKetQua(null);
      setBanner(null);
      return;
    }

    if (ca.trangThaiCheckOut === "da-check-out" && ca.ketQuaCheckOut) {
      setKetQua(ca.ketQuaCheckOut);
      setBanner({ type: "thanh-cong", message: CHECK_OUT_THANH_CONG });
      return;
    }

    setKetQua(null);
    if (ca.trangThaiCheckOut === "quen-check-out") {
      setBanner({ type: "loi", message: CHECK_OUT_QUEN });
      return;
    }

    setBanner(null);
  }, []);

  const loadHomNay = useCallback(async () => {
    try {
      const res = await fetch("/api/cham-cong/hom-nay", { cache: "no-store" });
      const json = await res.json();
      if (json.ok && json.data) {
        syncFromHomNay(json.data as ChamCongHomNayData);
      }
    } catch {
      // giữ nguyên trạng thái hiện tại nếu lỗi mạng tạm thời
    } finally {
      setLoading(false);
    }
  }, [syncFromHomNay]);

  useEffect(() => {
    loadHomNay();
  }, [loadHomNay]);

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

  useEffect(() => {
    if (!showTangCaPopup) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) {
        setShowTangCaPopup(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showTangCaPopup, submitting]);

  const guiCheckOut = async (tangCa: boolean) => {
    if (submitting || !data?.caCheckOut) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/cham-cong/check-out", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tangCa,
          malich: data.caCheckOut.malich,
        }),
      });
      const json = await res.json();
      setShowTangCaPopup(false);

      if (json.ok && json.data) {
        if (json.data.homNay) {
          syncFromHomNay(json.data.homNay as ChamCongHomNayData);
        }
        if (!json.data.dangTangCa && json.data.ketQua) {
          setKetQua(json.data.ketQua as KetQuaCheckOut);
          setBanner({ type: "thanh-cong", message: CHECK_OUT_THANH_CONG });
        }
      } else {
        setBanner({
          type: "loi",
          message: json.error?.message || CHECK_OUT_QUEN,
        });
        await loadHomNay();
      }
    } catch {
      setShowTangCaPopup(false);
      setBanner({ type: "loi", message: CHECK_OUT_QUEN });
    } finally {
      setSubmitting(false);
    }
  };

  const ca = data?.caCheckOut ?? null;
  const canCheckOut =
    !loading &&
    !submitting &&
    Boolean(ca) &&
    (ca?.trangThaiCheckOut === "dang-lam-viec" ||
      ca?.trangThaiCheckOut === "dang-tang-ca");

  const trangThaiText = !ca
    ? "Không có ca làm"
    : ca.trangThaiCheckOut === "dang-tang-ca"
    ? `Đang tăng ca (đến ${ca.gioKetThucTangCa || "15:00"})`
    : ca.trangThaiCheckOut === "dang-lam-viec"
    ? "Đang làm việc"
    : ca.trangThaiCheckOut === "da-check-out"
    ? "Check-out thành công"
    : "Chưa check-in";

  const ngayHienThi = now ? formatNgayDaiVN(now) : "–";
  const gioHienThi = now ? formatTimeVN(now).slice(0, 5) : "--:--";

  return (
    <div
      data-hydrated="true"
      className="relative w-full flex flex-col justify-between min-h-[calc(100dvh-144px)] lg:pt-[clamp(4px,2.2dvh,24px)]"
    >
      <div className="w-full">
        {/* Vùng đầu: tiêu đề "Check-out" hoặc Banner thông báo */}
        <div className="mb-5 lg:mb-[clamp(24px,8.5dvh,92px)] min-h-[52px] flex items-center">
          {banner ? (
            <div id="notification-message" className="w-full">
              <NotificationBanner type={banner.type} message={banner.message} />
            </div>
          ) : (
            <h1 className="text-[28px] sm:text-[34px] font-bold text-[#334EAC] leading-tight">
              Check-out
            </h1>
          )}
        </div>

        {/* Trạng thái 3: 4 thẻ tổng kết sau khi Check-out thành công (UC_3.2_check-out_03.png) */}
        {ketQua ? (
          <div
            id="checkout-summary"
            className="border border-[#7096D1] rounded-2xl bg-[#FFF9F0] p-6 sm:p-10 min-h-[320px] md:min-h-[clamp(330px,51dvh,550px)] flex items-center"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 w-full">
              <div className="border border-[#7096D1] rounded-2xl bg-[#FFF9F0] p-6 shadow-[0px_4px_16px_0px_rgba(0,0,0,0.12)] flex flex-col justify-between min-h-[170px] sm:min-h-[240px]">
                <p className="text-lg sm:text-[22px] font-semibold text-[#334EAC]">
                  Giờ check-in
                </p>
                <p
                  id="summary-checkin"
                  className="text-3xl sm:text-[40px] font-bold text-[#334EAC] text-center tabular-nums my-auto"
                >
                  {ketQua.gioCheckIn}
                </p>
                <span aria-hidden="true" />
              </div>

              <div className="border border-[#7096D1] rounded-2xl bg-[#FFF9F0] p-6 shadow-[0px_4px_16px_0px_rgba(0,0,0,0.12)] flex flex-col justify-between min-h-[170px] sm:min-h-[240px]">
                <p className="text-lg sm:text-[22px] font-semibold text-[#334EAC]">
                  Giờ check-out
                </p>
                <p
                  id="summary-checkout"
                  className="text-3xl sm:text-[40px] font-bold text-[#334EAC] text-center tabular-nums my-auto"
                >
                  {ketQua.gioCheckOut}
                </p>
                <span aria-hidden="true" />
              </div>

              <div className="border border-[#7096D1] rounded-2xl bg-[#FFF9F0] p-6 shadow-[0px_4px_16px_0px_rgba(0,0,0,0.12)] flex flex-col justify-between min-h-[170px] sm:min-h-[240px]">
                <p className="text-lg sm:text-[22px] font-semibold text-[#334EAC]">
                  Tổng giờ làm
                </p>
                <p
                  id="summary-hours"
                  className="text-3xl sm:text-[40px] font-bold text-[#334EAC] text-center tabular-nums my-auto"
                >
                  {`${ketQua.tongGioLam} giờ`}
                </p>
                <span aria-hidden="true" />
              </div>

              <div className="border border-[#7096D1] rounded-2xl bg-[#FFF9F0] p-6 shadow-[0px_4px_16px_0px_rgba(0,0,0,0.12)] flex flex-col justify-between min-h-[170px] sm:min-h-[240px]">
                <p className="text-lg sm:text-[22px] font-semibold text-[#334EAC]">
                  Tổng tiền
                </p>
                <p
                  id="summary-pay"
                  className="text-3xl sm:text-[38px] font-bold text-[#334EAC] text-center tabular-nums my-auto"
                >
                  {formatTien(Math.round(ketQua.tongTien))}
                </p>
                <span aria-hidden="true" />
              </div>
            </div>
          </div>
        ) : (
          /* Trạng thái 1: Đồng hồ + Nút Check-out & Ca làm hôm nay */
          <div className="grid grid-cols-1 md:grid-cols-[48fr_52fr] gap-6 items-stretch">
            <section className="border border-[#7096D1] rounded-2xl bg-[#FFF9F0] px-6 py-8 sm:px-10 sm:py-10 flex flex-col items-center justify-between text-center min-h-[320px] md:min-h-[clamp(330px,51dvh,550px)]">
              <p
                id="checkout-date"
                className="text-xl sm:text-[26px] lg:text-[32px] font-normal text-[#334EAC] mt-1"
              >
                {ngayHienThi}
              </p>

              <div
                id="checkout-clock"
                className="text-6xl sm:text-[84px] lg:text-[clamp(72px,10dvh,116px)] font-bold text-[#334EAC] leading-none tracking-tight tabular-nums my-4"
              >
                {gioHienThi}
              </div>

              <button
                type="button"
                id="btn-check-out"
                onClick={() => setShowTangCaPopup(true)}
                disabled={!canCheckOut}
                className={`w-full max-w-[460px] h-[52px] sm:h-[64px] rounded-xl font-bold text-lg sm:text-[20px] text-[#FFF9F0] transition-colors mb-1 ${
                  canCheckOut
                    ? "bg-[#334EAC] hover:bg-[#283E8C] cursor-pointer"
                    : "bg-[#334EAC]/45 cursor-not-allowed"
                }`}
              >
                {submitting ? "Đang xử lý..." : "Check-out"}
              </button>
            </section>

            <section className="border border-[#7096D1] rounded-2xl bg-[#FFF9F0] px-6 py-6 sm:px-9 sm:py-8 flex flex-col justify-center md:justify-start min-h-[320px] md:min-h-[clamp(330px,51dvh,550px)]">
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
                    id="checkout-shift-name"
                    className="text-lg sm:text-[20px] font-bold text-[#334EAC] pb-4 lg:pb-5 border-b border-[#7096D1]/70"
                  >
                    {ca ? ca.tenCa : "Không có ca làm hôm nay"}
                  </p>

                  <div className="flex items-center justify-between gap-4 py-4 lg:py-6 border-b border-[#7096D1]/70">
                    <span className="text-sm sm:text-base font-normal text-[#334EAC]">
                      Thời gian ca
                    </span>
                    <span
                      id="checkout-shift-time"
                      className="text-sm sm:text-base font-bold text-[#334EAC] text-right tabular-nums"
                    >
                      {ca ? ca.khungGio : "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 py-4 lg:py-6 border-b border-[#7096D1]/70">
                    <span className="text-sm sm:text-base font-normal text-[#334EAC]">
                      Đã check-in lúc
                    </span>
                    <span
                      id="checkout-checkin-time"
                      className="text-sm sm:text-base font-bold text-[#334EAC] text-right tabular-nums"
                    >
                      {ca?.thoiGianCheckIn ? ca.thoiGianCheckIn : "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 py-4 lg:py-6 border-b border-[#7096D1]/70">
                    <span className="text-sm sm:text-base font-normal text-[#334EAC]">
                      Trạng thái
                    </span>
                    <span
                      id="checkout-status"
                      className="text-sm sm:text-base font-bold text-[#334EAC] text-right"
                    >
                      {trangThaiText}
                    </span>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Thanh thao tác đáy: đường kẻ ngang + nút Đóng khi có kết quả */}
      <div className="border-t border-[#7096D1] pt-4 mt-4 flex justify-end items-center min-h-[60px]">
        {ketQua && (
          <button
            type="button"
            id="btn-dong"
            onClick={() => router.push("/nhan-vien")}
            className="w-[143px] h-[48px] rounded-xl border border-[#334EAC] text-[#334EAC] font-medium text-base bg-[#FFF9F0] hover:bg-[#EBF0FA] transition-colors cursor-pointer"
          >
            Đóng
          </button>
        )}
      </div>

      {/* Trạng thái 2: Popup "Bạn có muốn tăng ca không?" (dùng ConfirmDialog chung, Figma UC_3.2_check-out_02.png) */}
      <ConfirmDialog
        open={showTangCaPopup}
        id="dialog-tang-ca"
        variant="centered-info"
        backdrop="dim"
        titleId="popup-tang-ca-title"
        cancelButtonId="btn-khong-tang-ca"
        confirmButtonId="btn-co-tang-ca"
        title={CHECK_OUT_HOI_TANG_CA}
        cancelLabel="Không tăng ca"
        confirmLabel="Có tăng ca"
        onCancel={() => guiCheckOut(false)}
        onConfirm={() => guiCheckOut(true)}
        busy={submitting}
      />
    </div>
  );
}
