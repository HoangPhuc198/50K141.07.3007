"use client";

import React from "react";

export interface PaginationProps {
  trang: number;
  tongTrang: number;
  onChange: (trang: number) => void;
  className?: string;
}

const nutCls =
  "min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] px-2 rounded-[7.2px] border-[1.2px] border-[#334EAC] text-sm font-medium flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

/** Phân trang số trang + nút trước/sau; chỉ báo trang hiện tại bằng aria-current. */
export function Pagination({ trang, tongTrang, onChange, className = "" }: PaginationProps) {
  if (tongTrang <= 1) return null;
  const trangs = Array.from({ length: tongTrang }, (_, i) => i + 1);
  return (
    <nav aria-label="Phân trang" className={`flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        aria-label="Trang trước"
        disabled={trang <= 1}
        onClick={() => onChange(trang - 1)}
        className={`${nutCls} bg-[#FFF9F0] text-[#334EAC] hover:bg-[#F2ECE1]`}
      >
        ‹
      </button>
      {trangs.map((t) => (
        <button
          key={t}
          type="button"
          aria-label={`Trang ${t}`}
          aria-current={t === trang ? "page" : undefined}
          onClick={() => t !== trang && onChange(t)}
          className={`${nutCls} ${t === trang ? "bg-[#334EAC] text-[#FFF9F0]" : "bg-[#FFF9F0] text-[#334EAC] hover:bg-[#F2ECE1]"}`}
        >
          {t}
        </button>
      ))}
      <button
        type="button"
        aria-label="Trang sau"
        disabled={trang >= tongTrang}
        onClick={() => onChange(trang + 1)}
        className={`${nutCls} bg-[#FFF9F0] text-[#334EAC] hover:bg-[#F2ECE1]`}
      >
        ›
      </button>
    </nav>
  );
}

export default Pagination;
