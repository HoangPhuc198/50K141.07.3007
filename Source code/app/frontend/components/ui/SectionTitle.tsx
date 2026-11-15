import React from "react";

export interface SectionTitleProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  className?: string;
  id?: string;
  subtitleId?: string;
}

export function SectionTitle({
  title,
  subtitle,
  badge,
  className = "",
  id,
  subtitleId,
}: SectionTitleProps) {
  return (
    <div className={`mb-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2
          id={id}
          className="text-lg sm:text-[20px] font-semibold text-[#334EAC] leading-tight"
        >
          {title}
        </h2>
        {badge}
      </div>
      {subtitle && (
        <p
          id={subtitleId}
          className="text-sm sm:text-base text-[#334EAC] mt-1 font-normal"
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

export default SectionTitle;
