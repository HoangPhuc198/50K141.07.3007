import React from "react";

export interface DetailPanelProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export function DetailPanel({
  children,
  className = "",
  id,
}: DetailPanelProps) {
  return (
    <div id={id} className={`flex flex-col gap-4 ${className}`}>
      {children}
    </div>
  );
}

export default DetailPanel;
