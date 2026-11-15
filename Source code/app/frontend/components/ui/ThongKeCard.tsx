import React from "react";

export interface ThongKeCardProps {
  label: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
  id?: string;
}

/** Thẻ số liệu (nhãn nhỏ + giá trị lớn), dùng chung cho các màn có hàng thẻ tổng hợp. */
export function ThongKeCard({ label, value, subtitle, className = "", id }: ThongKeCardProps) {
  return (
    <section
      id={id}
      className={`border-[1.2px] border-[#7096D1] rounded-[14.4px] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.12)] bg-[#FFF9F0] p-5 sm:p-6 flex flex-col gap-2 min-w-0 ${className}`}
    >
      <p className="text-sm sm:text-base font-medium text-[#334EAC]">{label}</p>
      <p className="text-2xl sm:text-[28px] leading-tight font-bold text-[#334EAC] break-words">{value}</p>
      {subtitle ? (
        <p className="text-xs sm:text-sm text-[#334EAC] break-words">{subtitle}</p>
      ) : null}
    </section>
  );
}

export default ThongKeCard;
