"use client";

import React from "react";
import Link from "next/link";

interface PlaceholderScreenProps {
  title: string;
  ucCode?: string;
  role?: "ChuQuan" | "NhanVien";
}

export function PlaceholderScreen({
  title,
  ucCode,
  role = "ChuQuan",
}: PlaceholderScreenProps) {
  const backHref = role === "ChuQuan" ? "/chu-quan" : "/nhan-vien";

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 text-center min-h-[60vh]">
      <div className="bg-[#FFF9F0] border border-[#EFE9E0] rounded-2xl shadow-sm p-6 sm:p-10 max-w-lg w-full flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-[#EBF0FA] flex items-center justify-center mb-4 text-[#334EAC]">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </div>

        {ucCode && (
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EBF0FA] text-[#334EAC] mb-2 tracking-wide">
            {ucCode}
          </span>
        )}

        <h1 className="text-xl sm:text-2xl font-bold text-[#334EAC] mb-2">
          {title}
        </h1>

        <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-6">
          Chức năng đang được xây dựng
        </p>

        <Link
          href={backHref}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm text-white bg-[#334EAC] hover:bg-[#283E8C] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Quay lại màn hình chính
        </Link>
      </div>
    </div>
  );
}
