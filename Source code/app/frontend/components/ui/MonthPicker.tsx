"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { nowVN } from "@backend/lib/time";
import { PLACEHOLDER } from "@frontend/config/placeholder";
import {
  autoFormatThangNamInput,
  extractIsoDateParts,
  formatThangNam,
  parseThangNamInput,
} from "@frontend/lib/dinh-dang";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export interface MonthPickerProps {
  id?: string;
  value: string; // ISO "yyyy-mm" hoặc "mm/yyyy" hoặc ""
  onChange: (isoMonth: string) => void;
  onInvalidChange?: (invalid: boolean) => void;
  error?: boolean;
  disabled?: boolean;
  allowClear?: boolean;
  inline?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  calendarButtonAriaLabel?: string;
  popoverAlign?: "left" | "right";
  wrapperClassName?: string;
  inputClassName?: string;
}

function toIsoMonth(nam: number, thang: number): string {
  return `${nam}-${String(thang).padStart(2, "0")}`;
}

export function MonthPicker({
  id,
  value,
  onChange,
  onInvalidChange,
  error = false,
  disabled = false,
  allowClear = false,
  inline = false,
  placeholder = PLACEHOLDER.chonThang,
  ariaLabel,
  calendarButtonAriaLabel = "Mở lịch chọn tháng",
  popoverAlign = "left",
  wrapperClassName = "",
  inputClassName = "",
}: MonthPickerProps) {
  const generatedId = useId();
  const inputId = id ?? `monthpicker-${generatedId}`;
  const dialogId = `${inputId}-calendar`;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastEmittedRef = useRef<string | null>(null);
  const keepInvalidTextRef = useRef(false);
  const onInvalidChangeRef = useRef(onInvalidChange);
  onInvalidChangeRef.current = onInvalidChange;

  const initialParsed = parseThangNamInput(value);
  const [displayText, setDisplayText] = useState<string>(() =>
    initialParsed ? formatThangNam(initialParsed.thang, initialParsed.nam) : ""
  );
  const [internalInvalid, setInternalInvalid] = useState(false);
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState<number>(() => initialParsed?.nam ?? 2026);

  useEffect(() => {
    const vnParts = extractIsoDateParts(nowVN());
    if (vnParts && !parseThangNamInput(value)) {
      setPickerYear(vnParts.year);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (lastEmittedRef.current === value && keepInvalidTextRef.current) {
      lastEmittedRef.current = null;
      return;
    }
    lastEmittedRef.current = null;
    keepInvalidTextRef.current = false;

    const parsed = parseThangNamInput(value);
    setDisplayText(parsed ? formatThangNam(parsed.thang, parsed.nam) : "");
    setInternalInvalid(false);
    onInvalidChangeRef.current?.(false);
    if (parsed) {
      setPickerYear(parsed.nam);
    }
  }, [value]);

  useEffect(() => {
    if (inline || !open) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [inline, open]);

  function emitChange(nextIso: string, keepInvalidText: boolean) {
    lastEmittedRef.current = nextIso;
    keepInvalidTextRef.current = keepInvalidText;
    onChange(nextIso);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = autoFormatThangNamInput(e.target.value);
    setDisplayText(formatted);

    const digitsLen = formatted.replace(/\D/g, "").length;
    if (digitsLen === 0) {
      setInternalInvalid(false);
      onInvalidChange?.(false);
      if (value !== "") emitChange("", false);
      return;
    }

    if (digitsLen === 6) {
      const parsed = parseThangNamInput(formatted);
      if (parsed) {
        setInternalInvalid(false);
        onInvalidChange?.(false);
        setPickerYear(parsed.nam);
        const iso = toIsoMonth(parsed.nam, parsed.thang);
        if (iso !== value) emitChange(iso, false);
      } else {
        setInternalInvalid(true);
        onInvalidChange?.(true);
        if (value !== "") emitChange("", true);
        else keepInvalidTextRef.current = true;
      }
      return;
    }

    setInternalInvalid(false);
    onInvalidChange?.(false);
    keepInvalidTextRef.current = true;
    if (value !== "") emitChange("", true);
  }

  function handleInputBlur() {
    const trimmed = displayText.trim();
    if (!trimmed) {
      setInternalInvalid(false);
      onInvalidChange?.(false);
      return;
    }
    const parsed = parseThangNamInput(trimmed);
    if (!parsed) {
      setInternalInvalid(true);
      onInvalidChange?.(true);
      keepInvalidTextRef.current = true;
      if (value !== "") emitChange("", true);
    }
  }

  function handlePickMonth(thang: number) {
    const iso = toIsoMonth(pickerYear, thang);
    setDisplayText(formatThangNam(thang, pickerYear));
    setInternalInvalid(false);
    onInvalidChange?.(false);
    keepInvalidTextRef.current = false;
    emitChange(iso, false);
    if (!inline) {
      setOpen(false);
      inputRef.current?.focus();
    }
  }

  function handleClear() {
    setDisplayText("");
    setInternalInvalid(false);
    onInvalidChange?.(false);
    keepInvalidTextRef.current = false;
    emitChange("", false);
    if (!inline) setOpen(false);
  }

  const parsedCurrent = parseThangNamInput(value);
  const hasError = error || internalInvalid;
  const panelVisible = inline || open;

  const panel = (
    <div
      id={dialogId}
      role={inline ? "group" : "dialog"}
      aria-modal={inline ? undefined : "false"}
      aria-label="Lịch chọn tháng"
      className={
        inline
          ? "mt-3"
          : `absolute ${popoverAlign === "right" ? "right-0" : "left-0"} top-full mt-1.5 z-50 w-[320px] max-w-[calc(100vw-16px)] rounded-[14.4px] border-[1.2px] border-[#7096D1] bg-[#FFF9F0] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.2)] p-3`
      }
    >
      <div className="flex items-center justify-between px-1 mb-3">
        <button
          type="button"
          aria-label="Năm trước"
          onClick={() => setPickerYear((y) => y - 1)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[9.6px] text-[#334EAC] text-lg hover:bg-[#F7F2EB] focus:outline-none focus:ring-2 focus:ring-[#334EAC]"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-[#334EAC]">Năm {pickerYear}</span>
        <button
          type="button"
          aria-label="Năm sau"
          onClick={() => setPickerYear((y) => y + 1)}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[9.6px] text-[#334EAC] text-lg hover:bg-[#F7F2EB] focus:outline-none focus:ring-2 focus:ring-[#334EAC]"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {MONTHS.map((m) => {
          const isSelected =
            parsedCurrent?.thang === m && parsedCurrent?.nam === pickerYear;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={isSelected}
              onClick={() => handlePickMonth(m)}
              className={`min-h-[44px] rounded-[9.6px] text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#334EAC] ${
                isSelected
                  ? "bg-[#334EAC] text-[#FFF9F0] font-semibold"
                  : "bg-[#FFF9F0] text-[#334EAC] hover:bg-[#F7F2EB]"
              }`}
            >
              Tháng {m}
            </button>
          );
        })}
      </div>

      {allowClear && !inline && displayText !== "" && (
        <div className="mt-2 pt-2 border-t border-[#7096D1]/30 flex justify-end">
          <button
            type="button"
            onClick={handleClear}
            className="min-h-[44px] px-3 rounded-[9.6px] text-sm font-medium text-[#334EAC] hover:bg-[#F7F2EB]"
          >
            Tất cả tháng
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div ref={containerRef} className={`relative ${wrapperClassName}`}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          inputMode="numeric"
          maxLength={7}
          disabled={disabled}
          value={displayText}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={(e) => {
            if (!inline && e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
            }
          }}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-invalid={hasError ? "true" : undefined}
          className={`w-full px-4 py-3 ${inline ? "pr-4" : "pr-12"} rounded-[9.6px] bg-[#FFF9F0] border-[1.2px] text-[#334EAC] placeholder:text-[#7096D1] text-sm sm:text-base tabular-nums outline-none transition-colors min-h-[44px] ${
            hasError
              ? "border-[#C0392B] focus:border-[#C0392B]"
              : "border-[#7096D1] focus:border-[#334EAC]"
          } ${inputClassName}`}
        />
        {!inline && (
          <button
            type="button"
            disabled={disabled}
            aria-label={calendarButtonAriaLabel}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-controls={dialogId}
            onClick={() => {
              if (!open) {
                const parsed = parseThangNamInput(value);
                if (parsed) setPickerYear(parsed.nam);
                else {
                  const vn = extractIsoDateParts(nowVN());
                  if (vn) setPickerYear(vn.year);
                }
              }
              setOpen((o) => !o);
            }}
            className="absolute right-0 top-0 bottom-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-r-[9.6px] text-[#334EAC] hover:bg-[#F7F2EB] focus:outline-none focus:ring-2 focus:ring-[#334EAC] disabled:opacity-50"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </button>
        )}
      </div>

      {panelVisible && panel}
    </div>
  );
}
