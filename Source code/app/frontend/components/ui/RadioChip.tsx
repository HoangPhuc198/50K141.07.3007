"use client";

import React, { createContext, useContext, useRef } from "react";

interface RadioChipGroupContextValue {
  value: string;
  onChange: (nextValue: string) => void;
  focusAndSelectAt: (currentValue: string, delta: -1 | 1 | "first" | "last") => void;
}

const RadioChipGroupContext = createContext<RadioChipGroupContextValue | null>(null);

export interface RadioChipGroupProps {
  value: string;
  onChange: (nextValue: string) => void;
  ariaLabel: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Nhóm chip/thẻ chọn một (single-select) chuẩn WAI-ARIA `radiogroup`.
 * Hỗ trợ phím mũi tên trái/phải đổi chip và di chuyển focus, Enter/Space chọn.
 */
export function RadioChipGroup({
  value,
  onChange,
  ariaLabel,
  className = "",
  children,
}: RadioChipGroupProps) {
  const groupRef = useRef<HTMLDivElement>(null);

  const focusAndSelectAt = (
    currentValue: string,
    direction: -1 | 1 | "first" | "last"
  ) => {
    const container = groupRef.current;
    if (!container) return;
    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[role="radio"]:not([disabled])')
    );
    if (buttons.length === 0) return;

    const currentIdx = buttons.findIndex(
      (btn) => btn.getAttribute("data-value") === currentValue
    );

    let nextIdx = 0;
    if (direction === "first") {
      nextIdx = 0;
    } else if (direction === "last") {
      nextIdx = buttons.length - 1;
    } else if (currentIdx >= 0) {
      nextIdx = (currentIdx + direction + buttons.length) % buttons.length;
    }

    const targetBtn = buttons[nextIdx];
    const targetValue = targetBtn?.getAttribute("data-value");
    if (targetBtn && targetValue !== null) {
      targetBtn.focus();
      if (targetValue !== value) {
        onChange(targetValue);
      }
    }
  };

  return (
    <RadioChipGroupContext.Provider value={{ value, onChange, focusAndSelectAt }}>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label={ariaLabel}
        className={className}
      >
        {children}
      </div>
    </RadioChipGroupContext.Provider>
  );
}

export interface RadioChipProps {
  value: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string | ((checked: boolean) => string);
  children: React.ReactNode | ((checked: boolean) => React.ReactNode);
}

/**
 * Chip/thẻ chọn một dùng bên trong `RadioChipGroup`.
 * Bấm vào cả khối để chọn, bấm lại chip đang chọn thì giữ nguyên không bỏ chọn.
 */
export function RadioChip({
  value,
  ariaLabel,
  disabled = false,
  className = "",
  children,
}: RadioChipProps) {
  const ctx = useContext(RadioChipGroupContext);
  if (!ctx) {
    throw new Error("RadioChip phải được đặt bên trong RadioChipGroup");
  }

  const checked = ctx.value === value;
  const resolvedClass = typeof className === "function" ? className(checked) : className;
  const resolvedChildren = typeof children === "function" ? children(checked) : children;

  const handleSelect = () => {
    if (disabled) return;
    if (!checked) {
      ctx.onChange(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        ctx.focusAndSelectAt(value, 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        ctx.focusAndSelectAt(value, -1);
        break;
      case "Home":
        e.preventDefault();
        ctx.focusAndSelectAt(value, "first");
        break;
      case "End":
        e.preventDefault();
        ctx.focusAndSelectAt(value, "last");
        break;
      case " ":
      case "Enter":
        e.preventDefault();
        handleSelect();
        break;
    }
  };

  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={ariaLabel}
      data-value={value}
      disabled={disabled}
      tabIndex={checked ? 0 : -1}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      className={`select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#334EAC]/50 focus-visible:ring-offset-1 ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      } ${resolvedClass}`}
    >
      {resolvedChildren}
    </button>
  );
}
