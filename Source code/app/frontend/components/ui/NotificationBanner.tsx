"use client";

import React from "react";
import { MAU_THONG_BAO, LoaiThongBao } from "@frontend/config/thong-bao";

export type BannerVariant = "loi" | "thanh-cong" | "canh-bao" | "error" | "success" | "warning";

interface NotificationBannerProps {
  type: BannerVariant | null;
  message: string;
  className?: string;
  onClose?: () => void;
}

function normalizeType(type: BannerVariant): LoaiThongBao {
  if (type === "error" || type === "loi") return "loi";
  if (type === "success" || type === "thanh-cong") return "thanh-cong";
  return "canh-bao";
}

export function NotificationBanner({
  type,
  message,
  className = "",
  onClose,
}: NotificationBannerProps) {
  const safeMessage =
    typeof message === "string"
      ? message
      : message &&
        typeof message === "object" &&
        "message" in message &&
        typeof (message as { message?: unknown }).message === "string"
      ? (message as { message: string }).message
      : message
      ? String(message)
      : "";

  if (!type || !safeMessage) return null;

  const key = normalizeType(type);
  const cfg = MAU_THONG_BAO[key];

  return (
    <div
      role="alert"
      data-testid="notification-banner"
      data-type={key}
      className={`flex items-center gap-3 px-5 py-3 rounded-lg text-sm font-medium mb-5 border transition-all ${className}`}
      style={{
        backgroundColor: cfg.nen,
        color: cfg.chu,
        borderColor: cfg.vien,
      }}
    >
      {/* Biểu tượng theo loại (chuẩn Figma UC_5.1_02, UC_5.1_03 & 08-THONG-BAO.md) */}
      {key === "thanh-cong" && (
        <svg
          className="w-5 h-5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          style={{ color: cfg.bieuTuong }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )}

      {key === "loi" && (
        <svg
          className="w-5 h-5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          style={{ color: cfg.bieuTuong }}
        >
          <circle cx="12" cy="12" r="9" strokeWidth={2} />
          <line x1="12" y1="8" x2="12" y2="12" strokeWidth={2} strokeLinecap="round" />
          <circle cx="12" cy="16" r="0.75" fill={cfg.bieuTuong} />
        </svg>
      )}

      {key === "canh-bao" && (
        <svg
          className="w-5 h-5 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          style={{ color: cfg.bieuTuong }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      )}

      <span className="flex-1 text-left">{safeMessage}</span>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1 hover:opacity-75 focus:outline-none text-current"
          aria-label="Đóng thông báo"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default NotificationBanner;
