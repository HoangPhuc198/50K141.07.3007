"use client";

import React, { useEffect, useRef } from "react";

export interface PopupModalProps {
  open: boolean;
  onClose?: () => void;
  closeOnEscape?: boolean;
  backdrop?: "none" | "dim";
  /** Bù chiều rộng sidebar 336px trên desktop khi không làm tối toàn màn hình */
  offsetSidebarOnDesktop?: boolean;
  maxWidthClass?: string;
  paddingClass?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  id?: string;
  dataTestId?: string;
  children: React.ReactNode;
}

/**
 * Khung hộp thoại (popup) dùng chung toàn hệ thống (Figma 417:735 & 05-THONG-SO-FIGMA.md):
 * nền #FFF9F0, viền 1.2px #7096D1, bo góc 14.4px, bóng 0px 4px 16px rgba(0,0,0,0.2).
 */
export function PopupModal({
  open,
  onClose,
  closeOnEscape = true,
  backdrop = "none",
  offsetSidebarOnDesktop = backdrop === "none",
  maxWidthClass = "max-w-[440px]",
  paddingClass = "p-5 sm:p-6",
  ariaLabelledBy,
  ariaDescribedBy,
  id,
  dataTestId,
  children,
}: PopupModalProps) {
  useEffect(() => {
    if (!open || !closeOnEscape || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeOnEscape, onClose]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto ${
        backdrop === "dim" ? "bg-[#0A1329]/45" : "bg-transparent"
      } ${offsetSidebarOnDesktop ? "lg:pl-[352px]" : ""}`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        id={id}
        data-testid={dataTestId}
        className={`relative w-full ${maxWidthClass} rounded-[14.4px] border-[1.2px] border-[#7096D1] bg-[#FFF9F0] ${paddingClass} shadow-[0px_4px_16px_0px_rgba(0,0,0,0.2)] text-[#334EAC]`}
      >
        {children}
      </div>
    </div>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  hideCancel?: boolean;
  variant?: "default" | "centered-info";
  headerIcon?: "none" | "info";
  backdrop?: "none" | "dim";
  showCloseButton?: boolean;
  closeOnEscape?: boolean;
  maxWidthClass?: string;
  onConfirm: () => void;
  /** Bấm nút huỷ, biểu tượng đóng hoặc phím Esc: đóng hộp thoại */
  onCancel: () => void;
  busy?: boolean;
  id?: string;
  dataTestId?: string;
  titleId?: string;
  closeButtonId?: string;
  cancelButtonId?: string;
  confirmButtonId?: string;
}

/**
 * Hộp thoại xác nhận / thông báo chặn dùng chung toàn hệ thống (P13B):
 * - variant="default": tiêu đề (kèm icon (i) nếu cần), nút đóng ⊗, nội dung, nút huỷ/xác nhận.
 * - variant="centered-info": biểu tượng (i) tròn giữa, tiêu đề nổi bật, 2 nút chọn cân đối (Figma UC_3.2_02).
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Hủy",
  hideCancel = false,
  variant = "default",
  headerIcon = "none",
  backdrop = variant === "centered-info" ? "dim" : "none",
  showCloseButton = variant !== "centered-info",
  closeOnEscape = variant !== "centered-info",
  maxWidthClass = variant === "centered-info" ? "max-w-[620px]" : "max-w-[460px]",
  onConfirm,
  onCancel,
  busy = false,
  id = "confirm-dialog",
  dataTestId,
  titleId,
  closeButtonId,
  cancelButtonId,
  confirmButtonId,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const resolvedTitleId = titleId ?? `${id}-title`;
  const resolvedMessageId = message ? `${id}-message` : undefined;

  useEffect(() => {
    if (!open) return;
    if (hideCancel) {
      confirmRef.current?.focus();
    } else {
      cancelRef.current?.focus();
    }
  }, [open, hideCancel]);

  return (
    <PopupModal
      open={open}
      onClose={onCancel}
      closeOnEscape={closeOnEscape}
      backdrop={backdrop}
      offsetSidebarOnDesktop={backdrop === "none"}
      maxWidthClass={maxWidthClass}
      paddingClass={variant === "centered-info" ? "p-8 sm:p-10 text-center" : "p-5 sm:p-6"}
      ariaLabelledBy={resolvedTitleId}
      ariaDescribedBy={resolvedMessageId}
      id={id}
      dataTestId={dataTestId}
    >
      {variant === "centered-info" ? (
        <div>
          <div className="w-16 h-16 rounded-full bg-[#EBF0FA] text-[#334EAC] flex items-center justify-center mx-auto mb-6 text-3xl font-bold select-none">
            i
          </div>

          <h3
            id={resolvedTitleId}
            className="text-xl sm:text-[24px] font-bold text-[#334EAC] mb-6"
          >
            {title}
          </h3>

          {message && (
            <div id={resolvedMessageId} className="text-sm text-[#334EAC] mb-6">
              {message}
            </div>
          )}

          <div
            className={`grid gap-4 mt-2 ${
              hideCancel ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
            }`}
          >
            {!hideCancel && (
              <button
                ref={cancelRef}
                id={cancelButtonId}
                type="button"
                disabled={busy}
                onClick={onCancel}
                className="h-[52px] rounded-[9.6px] border-[1.2px] border-[#334EAC] bg-[#FFF9F0] text-[#334EAC] font-bold text-base hover:bg-[#EBF0FA] transition-colors cursor-pointer disabled:opacity-50"
              >
                {cancelLabel}
              </button>
            )}
            <button
              ref={confirmRef}
              id={confirmButtonId}
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className="h-[52px] rounded-[9.6px] border-[1.2px] border-[#334EAC] bg-[#334EAC] text-[#FFF9F0] font-bold text-base hover:bg-[#2A3F8F] transition-colors cursor-pointer disabled:opacity-50"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {showCloseButton && (
            <button
              id={closeButtonId}
              type="button"
              aria-label="Đóng"
              onClick={onCancel}
              className="absolute top-3 right-3 w-[44px] h-[44px] sm:w-8 sm:h-8 flex items-center justify-center text-[#334EAC] rounded-full hover:bg-[#F2ECE1] transition-colors cursor-pointer"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M9 9l6 6M15 9l-6 6" strokeLinecap="round" />
              </svg>
            </button>
          )}

          <div className="flex items-start gap-2.5 pr-10">
            {headerIcon === "info" && (
              <svg
                className="w-5 h-5 shrink-0 mt-0.5 text-[#334EAC]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <circle cx="12" cy="12" r="9" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 16v-4m0-4h.01"
                />
              </svg>
            )}
            <h3
              id={resolvedTitleId}
              className="text-lg sm:text-xl font-semibold text-[#334EAC] leading-snug"
            >
              {title}
            </h3>
          </div>

          {message && (
            <div id={resolvedMessageId} className="text-sm text-[#334EAC]">
              {message}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            {!hideCancel && (
              <button
                ref={cancelRef}
                id={cancelButtonId}
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="min-h-[44px] min-w-[88px] px-5 rounded-[9.6px] bg-[#FFF9F0] border-[1.2px] border-[#334EAC] text-[#334EAC] text-sm font-medium hover:bg-[#F2ECE1] transition-colors cursor-pointer disabled:opacity-50"
              >
                {cancelLabel}
              </button>
            )}
            <button
              ref={confirmRef}
              id={confirmButtonId}
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="min-h-[44px] min-w-[88px] px-5 rounded-[9.6px] bg-[#334EAC] border-[1.2px] border-[#334EAC] text-[#FFF9F0] text-sm font-medium hover:bg-[#2A3F8F] transition-colors cursor-pointer disabled:opacity-60"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </PopupModal>
  );
}

export default ConfirmDialog;
