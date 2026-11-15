"use client";

import React from "react";

export interface ChonKhoiProps {
  /** Loại điều khiển: checkbox (mặc định) hoặc radio */
  type?: "checkbox" | "radio";
  /** Trạng thái đang được chọn */
  checked: boolean;
  /** Hàm xử lý khi đổi trạng thái chọn (gọi đúng 1 lần mỗi lần bấm/Space) */
  onChange: () => void;
  /** Nhãn accessibility cho input thật */
  ariaLabel: string;
  /** Vô hiệu hóa thao tác */
  disabled?: boolean;
  /** Tên nhóm (dùng cho radio) */
  name?: string;
  /** Giá trị (dùng cho radio) */
  value?: string;
  /** Lớp CSS tùy chỉnh của khối label (giữ nguyên giao diện Figma) */
  className?: string;
  /** Nội dung hiển thị bên trong khối (chữ, ô tick giả lập aria-hidden, khoảng trống...) */
  children: React.ReactNode;
}

/**
 * Component dùng chung cho các khối điều khiển chọn (checkbox card, radio card, chip chọn).
 * Bao bọc `<input>` thật bằng `<label>` để bấm bất kỳ điểm nào trong khối đều đổi trạng thái
 * đúng một lần, hỗ trợ Tab + Space và giữ nguyên giao diện Figma.
 */
export function ChonKhoi({
  type = "checkbox",
  checked,
  onChange,
  ariaLabel,
  disabled = false,
  name,
  value,
  className = "",
  children,
}: ChonKhoiProps) {
  return (
    <label
      className={`select-none focus-within:ring-2 focus-within:ring-[#334EAC]/50 focus-within:ring-offset-1 ${
        disabled ? "cursor-not-allowed" : "cursor-pointer"
      } ${className}`}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      {children}
    </label>
  );
}

/**
 * Icon dấu tích dùng chung cho các ô checkbox tùy biến giao diện Figma.
 */
export function DauTich({ className = "w-3.5 h-3.5 text-white" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 12 12" fill="none">
      <path
        d="M2 6l3 3 5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
