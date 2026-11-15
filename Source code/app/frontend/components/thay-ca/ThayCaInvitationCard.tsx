"use client";

import React from "react";
import { NotificationBanner } from "@frontend/components/ui/NotificationBanner";
import { PageCard } from "@frontend/components/ui/PageCard";
import {
  THAY_CA_DA_CO_NGUOI_NHAN,
  THAY_CA_LOI_MOI_TIEU_DE,
  THAY_CA_XAC_NHAN_THANH_CONG,
} from "@frontend/config/thong-bao";
import type { ThayCaPublicItem } from "@backend/services/thay-ca";

export type ThayCaInviteStatus = "accepted" | "taken" | null;

interface ThayCaInvitationCardProps {
  loiMoi: ThayCaPublicItem;
  status: ThayCaInviteStatus;
  errorMessage?: string | null;
  submitting?: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onBack: () => void;
}

function LockIcon() {
  return (
    <svg
      className="w-5 h-5 text-[#7096D1] shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );
}

export function ThayCaInvitationCard({
  loiMoi,
  status,
  errorMessage,
  submitting = false,
  onAccept,
  onDecline,
  onBack,
}: ThayCaInvitationCardProps) {
  const bannerType =
    status === "accepted"
      ? "thanh-cong"
      : status === "taken" || errorMessage
      ? "loi"
      : null;

  const bannerMessage =
    status === "accepted"
      ? THAY_CA_XAC_NHAN_THANH_CONG
      : status === "taken"
      ? THAY_CA_DA_CO_NGUOI_NHAN
      : errorMessage || "";

  const isLockedDone = status === "accepted" || status === "taken";

  return (
    <div className="w-full max-w-[540px] mx-auto" data-testid="thay-ca-invitation-card">
      {bannerType && bannerMessage && (
        <NotificationBanner type={bannerType} message={bannerMessage} />
      )}

      <PageCard variant="primary" className="gap-4">
        <h2
          id="thay-ca-invite-title"
          className="text-lg sm:text-xl font-bold text-[#334EAC] leading-snug"
        >
          {THAY_CA_LOI_MOI_TIEU_DE}
        </h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-[9.6px] border-[1.2px] border-[#7096D1] bg-[#F7F2EB] px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#7096D1]">Người xin nghỉ</p>
              <p className="text-sm sm:text-base font-semibold text-[#334EAC] truncate">
                {loiMoi.tenNhanVienXinNghi}
              </p>
            </div>
            <LockIcon />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-[9.6px] border-[1.2px] border-[#7096D1] bg-[#F7F2EB] px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#7096D1]">Vị trí cần thay</p>
              <p className="text-sm sm:text-base font-semibold text-[#334EAC] truncate">
                {loiMoi.viTriCanThay}
              </p>
            </div>
            <LockIcon />
          </div>

          {loiMoi.lyDo && (
            <div className="rounded-[9.6px] border border-[#7096D1]/40 bg-[#F7F2EB]/60 px-4 py-2.5 text-xs sm:text-sm text-[#334EAC]">
              <span className="font-semibold">Lý do xin nghỉ: </span>
              <span>{loiMoi.lyDo}</span>
            </div>
          )}
        </div>

        <div className="pt-1 space-y-1 text-[#334EAC]">
          <p className="text-sm font-medium">
            Ca {loiMoi.tenCa.toLowerCase()} · {loiMoi.ngayHienThi}
          </p>
          <p className="text-2xl sm:text-[26px] font-bold tracking-tight">
            {loiMoi.gioBatDau} – {loiMoi.gioKetThuc}
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {!isLockedDone ? (
            <>
              <button
                type="button"
                id="btn-tu-choi-thay-ca"
                disabled={submitting}
                onClick={onDecline}
                className="flex-1 h-[44px] px-5 rounded-[9.6px] border-[1.2px] border-[#334EAC] bg-[#FFF9F0] text-[#334EAC] text-sm font-medium hover:bg-[#F7F2EB] transition-colors cursor-pointer disabled:opacity-50"
              >
                Không chấp nhận
              </button>
              <button
                type="button"
                id="btn-chap-nhan-thay-ca"
                disabled={submitting}
                onClick={onAccept}
                className="flex-1 h-[44px] px-5 rounded-[9.6px] bg-[#334EAC] hover:bg-[#283E8C] text-[#FFF9F0] text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Đang xử lý..." : "Chấp nhận"}
              </button>
            </>
          ) : (
            <button
              type="button"
              id="btn-chap-nhan-thay-ca-disabled"
              disabled
              className="w-full sm:w-auto min-w-[200px] h-[44px] px-6 rounded-[9.6px] bg-[#334EAC] text-[#FFF9F0] text-sm font-medium opacity-45 cursor-not-allowed"
            >
              Chấp nhận
            </button>
          )}
        </div>
      </PageCard>

      <div className="mt-4 pt-4 border-t-[1.2px] border-[#7096D1] flex justify-end">
        <button
          type="button"
          id="btn-quay-lai-thay-ca"
          onClick={onBack}
          className="min-w-[120px] h-[44px] px-6 rounded-[9.6px] border-[1.2px] border-[#334EAC] bg-[#FFF9F0] text-[#334EAC] text-sm font-medium hover:bg-[#F7F2EB] transition-colors cursor-pointer"
        >
          Quay lại
        </button>
      </div>
    </div>
  );
}

export default ThayCaInvitationCard;
