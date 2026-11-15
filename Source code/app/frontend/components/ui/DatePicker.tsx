"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { nowVN } from "@backend/lib/time";
import { PLACEHOLDER } from "@frontend/config/placeholder";
import {
  CALENDAR_WEEKDAYS,
  autoFormatNgayInput,
  buildCalendarCells,
  extractIsoDateParts,
  formatCalendarMonthTitle,
  formatNgay,
  isValidCalendarDate,
  parseNgayVNToIso,
  toIsoDate,
} from "@frontend/lib/dinh-dang";

export interface DatePickerProps {
  id?: string;
  value: string; // ISO "yyyy-mm-dd" hoặc ""
  onChange: (isoDate: string) => void;
  onInvalidChange?: (invalid: boolean) => void;
  error?: boolean;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  calendarButtonAriaLabel?: string;
  inline?: boolean;
  popoverAlign?: "left" | "right";
  wrapperClassName?: string;
  inputClassName?: string;
}

export function DatePicker({
  id,
  value,
  onChange,
  onInvalidChange,
  error = false,
  disabled = false,
  required = false,
  placeholder = PLACEHOLDER.chonNgay,
  ariaLabel,
  ariaLabelledBy,
  calendarButtonAriaLabel = "Mở lịch chọn ngày",
  inline = false,
  popoverAlign = "left",
  wrapperClassName = "",
  inputClassName = "",
}: DatePickerProps) {
  const generatedId = useId();
  const inputId = id ?? `datepicker-${generatedId}`;
  const dialogId = `${inputId}-calendar`;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const lastEmittedRef = useRef<string | null>(null);
  const keepInvalidTextRef = useRef(false);
  const onInvalidChangeRef = useRef(onInvalidChange);
  onInvalidChangeRef.current = onInvalidChange;

  const initialParts = extractIsoDateParts(value);
  const [displayText, setDisplayText] = useState<string>(() => formatNgay(value));
  const [internalInvalid, setInternalInvalid] = useState(false);
  const [open, setOpen] = useState(false);

  const [viewYear, setViewYear] = useState<number>(() => initialParts?.year ?? 2026);
  const [viewMonth, setViewMonth] = useState<number>(() => initialParts?.month ?? 1);
  const [focusedDay, setFocusedDay] = useState<number | null>(() => initialParts?.day ?? null);
  const [todayIso, setTodayIso] = useState<string>("");

  // Khởi tạo ngày hôm nay theo giờ VN phía client để tránh lệch hydration SSR
  useEffect(() => {
    const vnParts = extractIsoDateParts(nowVN());
    if (!vnParts) return;
    setTodayIso(toIsoDate(vnParts.year, vnParts.month, vnParts.day));
    if (!extractIsoDateParts(value)) {
      setViewYear(vnParts.year);
      setViewMonth(vnParts.month);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Đồng bộ khi value thay đổi từ bên ngoài
  useEffect(() => {
    if (lastEmittedRef.current === value && keepInvalidTextRef.current) {
      lastEmittedRef.current = null;
      return;
    }
    lastEmittedRef.current = null;
    keepInvalidTextRef.current = false;

    const formatted = formatNgay(value);
    setDisplayText(formatted);
    setInternalInvalid(false);
    onInvalidChangeRef.current?.(false);

    const parts = extractIsoDateParts(value);
    if (parts) {
      setViewYear(parts.year);
      setViewMonth(parts.month);
      setFocusedDay(parts.day);
    }
  }, [value]);

  // Đóng popover khi bấm ra ngoài hoặc nhấn Esc
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

  // Focus vào ngày đang chọn khi chuyển tháng bằng bàn phím
  useEffect(() => {
    if ((!open && !inline) || focusedDay === null) return;
    const targetBtn = gridRef.current?.querySelector<HTMLButtonElement>(
      `button[data-day="${focusedDay}"]`
    );
    if (targetBtn && document.activeElement?.closest(`[data-calendar-grid="${dialogId}"]`)) {
      targetBtn.focus();
    }
  }, [viewYear, viewMonth, focusedDay, open, inline, dialogId]);

  const calendarCells = useMemo(
    () => buildCalendarCells(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  function emitChange(nextIso: string, keepInvalidText: boolean) {
    lastEmittedRef.current = nextIso;
    keepInvalidTextRef.current = keepInvalidText;
    onChange(nextIso);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = autoFormatNgayInput(e.target.value);
    setDisplayText(formatted);

    const digitsLen = formatted.replace(/\D/g, "").length;
    if (digitsLen === 0) {
      setInternalInvalid(false);
      onInvalidChange?.(false);
      if (value !== "") emitChange("", false);
      return;
    }

    if (digitsLen === 8) {
      const iso = parseNgayVNToIso(formatted);
      if (iso) {
        setInternalInvalid(false);
        onInvalidChange?.(false);
        const parts = extractIsoDateParts(iso);
        if (parts) {
          setViewYear(parts.year);
          setViewMonth(parts.month);
          setFocusedDay(parts.day);
        }
        if (iso !== value) emitChange(iso, false);
      } else {
        setInternalInvalid(true);
        onInvalidChange?.(true);
        if (value !== "") emitChange("", true);
        else keepInvalidTextRef.current = true;
      }
      return;
    }

    // Đang gõ dở (< 8 chữ số)
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
    const iso = parseNgayVNToIso(trimmed);
    if (!iso) {
      setInternalInvalid(true);
      onInvalidChange?.(true);
      keepInvalidTextRef.current = true;
      if (value !== "") emitChange("", true);
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!inline && (e.key === "ArrowDown" && (e.altKey || !open))) {
      e.preventDefault();
      openCalendarPopup();
      return;
    }
    if (e.key === "Enter") {
      const iso = parseNgayVNToIso(displayText);
      if (displayText.trim() !== "" && !iso) {
        e.preventDefault();
        setInternalInvalid(true);
        onInvalidChange?.(true);
      }
    }
  }

  function openCalendarPopup() {
    if (disabled) return;
    const parts = extractIsoDateParts(value) ?? extractIsoDateParts(nowVN());
    if (parts) {
      setViewYear(parts.year);
      setViewMonth(parts.month);
      setFocusedDay(parts.day);
    }
    setOpen(true);
  }

  function handlePrevMonth() {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function handleNextMonth() {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function handlePickDay(day: number) {
    if (!isValidCalendarDate(viewYear, viewMonth, day)) return;
    const iso = toIsoDate(viewYear, viewMonth, day);
    setDisplayText(formatNgay(iso));
    setInternalInvalid(false);
    onInvalidChange?.(false);
    setFocusedDay(day);
    keepInvalidTextRef.current = false;
    emitChange(iso, false);
    if (!inline) {
      setOpen(false);
      inputRef.current?.focus();
    }
  }

  function moveFocusByDays(currentDay: number, delta: number) {
    const dt = new Date(Date.UTC(viewYear, viewMonth - 1, currentDay + delta));
    const nextYear = dt.getUTCFullYear();
    const nextMonth = dt.getUTCMonth() + 1;
    const nextDay = dt.getUTCDate();
    if (nextYear < 1900 || nextYear > 2100) return;
    setViewYear(nextYear);
    setViewMonth(nextMonth);
    setFocusedDay(nextDay);
    requestAnimationFrame(() => {
      gridRef.current
        ?.querySelector<HTMLButtonElement>(`button[data-day="${nextDay}"]`)
        ?.focus();
    });
  }

  function handleDayKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, day: number) {
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        moveFocusByDays(day, -1);
        break;
      case "ArrowRight":
        e.preventDefault();
        moveFocusByDays(day, 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveFocusByDays(day, -7);
        break;
      case "ArrowDown":
        e.preventDefault();
        moveFocusByDays(day, 7);
        break;
      case "Home":
        e.preventDefault();
        setFocusedDay(1);
        gridRef.current?.querySelector<HTMLButtonElement>('button[data-day="1"]')?.focus();
        break;
      case "End":
        e.preventDefault();
        setFocusedDay(daysInMonth);
        gridRef.current
          ?.querySelector<HTMLButtonElement>(`button[data-day="${daysInMonth}"]`)
          ?.focus();
        break;
      case "PageUp":
        e.preventDefault();
        handlePrevMonth();
        setFocusedDay((d) => Math.min(d ?? day, 28));
        break;
      case "PageDown":
        e.preventDefault();
        handleNextMonth();
        setFocusedDay((d) => Math.min(d ?? day, 28));
        break;
      case "Escape":
        if (!inline) {
          e.preventDefault();
          setOpen(false);
          inputRef.current?.focus();
        }
        break;
    }
  }

  const hasError = error || internalInvalid;
  const calendarVisible = inline || open;

  const calendarPanel = (
    <div
      id={dialogId}
      role={inline ? "group" : "dialog"}
      aria-modal={inline ? undefined : "false"}
      aria-label="Lịch chọn ngày"
      className={
        inline
          ? "mt-3"
          : `absolute ${popoverAlign === "right" ? "right-0" : "left-0"} top-full mt-1.5 z-50 w-[340px] max-w-[calc(100vw-16px)] rounded-[14.4px] border-[1.2px] border-[#7096D1] bg-[#FFF9F0] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.2)] p-2.5`
      }
    >
      <div className="flex items-center justify-between px-1 mb-2">
        <button
          type="button"
          aria-label="Tháng trước"
          onClick={handlePrevMonth}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[9.6px] text-[#334EAC] text-lg hover:bg-[#F7F2EB] focus:outline-none focus:ring-2 focus:ring-[#334EAC]"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-[#334EAC]">
          {formatCalendarMonthTitle(viewYear, viewMonth)}
        </span>
        <button
          type="button"
          aria-label="Tháng sau"
          onClick={handleNextMonth}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-[9.6px] text-[#334EAC] text-lg hover:bg-[#F7F2EB] focus:outline-none focus:ring-2 focus:ring-[#334EAC]"
        >
          ›
        </button>
      </div>

      <div role="grid" aria-label={formatCalendarMonthTitle(viewYear, viewMonth)}>
        <div role="row" className="grid grid-cols-7 gap-[1px] text-center mb-1">
          {CALENDAR_WEEKDAYS.map((wd) => (
            <span
              key={wd}
              role="columnheader"
              className="text-xs sm:text-sm font-medium text-[#334EAC] py-1"
            >
              {wd}
            </span>
          ))}
        </div>

        <div
          ref={gridRef}
          data-calendar-grid={dialogId}
          role="rowgroup"
          className="grid grid-cols-7 gap-[1px] text-center"
        >
          {calendarCells.map((day, idx) => {
            if (day === null) {
              return <span key={`empty-${idx}`} aria-hidden="true" />;
            }
            const iso = toIsoDate(viewYear, viewMonth, day);
            const isSelected = iso === value;
            const isToday = iso === todayIso;
            const isTabTarget = focusedDay ? day === focusedDay : day === 1;
            return (
              <button
                key={iso}
                type="button"
                data-day={day}
                role="gridcell"
                tabIndex={isTabTarget ? 0 : -1}
                aria-label={`Ngày ${formatNgay(iso)}`}
                aria-selected={isSelected}
                aria-pressed={isSelected}
                onClick={() => handlePickDay(day)}
                onKeyDown={(e) => handleDayKeyDown(e, day)}
                className={`min-w-[44px] min-h-[44px] w-full rounded-[9.6px] text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#334EAC] ${
                  isSelected
                    ? "bg-[#334EAC] text-[#FFF9F0] font-semibold"
                    : isToday
                    ? "border border-[#334EAC] text-[#334EAC] font-medium hover:bg-[#F7F2EB]"
                    : "text-[#334EAC] hover:bg-[#F7F2EB]"
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
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
          maxLength={10}
          disabled={disabled}
          required={required}
          value={displayText}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
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
            onClick={() => (open ? setOpen(false) : openCalendarPopup())}
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

      {calendarVisible && calendarPanel}
    </div>
  );
}
