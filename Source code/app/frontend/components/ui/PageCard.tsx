import React from "react";

export interface PageCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "primary" | "secondary";
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export function PageCard({
  variant = "primary",
  children,
  className = "",
  id,
  ...props
}: PageCardProps) {
  const bgClass = variant === "primary" ? "bg-[#FFF9F0]" : "bg-[#F7F2EB]";
  return (
    <section
      id={id}
      className={`border-[1.2px] border-[#7096D1] rounded-[14.4px] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.12)] p-5 sm:p-6 flex flex-col ${bgClass} ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}

export default PageCard;
