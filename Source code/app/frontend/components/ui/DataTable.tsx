"use client";

import React from "react";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  selectedKey?: string;
  onSelectRow?: (item: T) => void;
  maxHeight?: string;
  className?: string;
  emptyText?: string;
  /**
   * Bật kiểu chọn MỘT (radiogroup, theo mục ĐIỀU KHIỂN CHỌN của RULES.md):
   * dòng có role="radio", aria-checked, bấm cả dòng, mũi tên lên/xuống đổi dòng.
   * Không truyền thì giữ kiểu nút (aria-pressed) như trước.
   */
  radioLabel?: string;
  /** Dưới 768px mỗi dòng đổi thành một thẻ xếp dọc (nhãn: giá trị), không cuộn ngang. */
  mobileCards?: boolean;
  /** Bảng nhiều cột: thu gọn padding & cỡ chữ để vừa khung desktop không tràn ngang. */
  compact?: boolean;
  /** Nhãn bảng cho trình đọc màn hình */
  ariaLabel?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  selectedKey,
  onSelectRow,
  maxHeight = "max-h-[300px]",
  className = "",
  emptyText = "Không có dữ liệu",
  radioLabel,
  mobileCards = false,
  compact = false,
  ariaLabel,
}: DataTableProps<T>) {
  const cellPad = compact ? "px-2.5 py-2.5 text-xs xl:text-[13px]" : "px-4 py-3 text-sm";
  const isClickable = !!onSelectRow;
  const isRadio = isClickable && !!radioLabel;

  const handleKey = (e: React.KeyboardEvent<HTMLElement>, item: T, idx: number) => {
    if (!isClickable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelectRow?.(item);
      return;
    }
    if (isRadio && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const next = idx + (e.key === "ArrowDown" ? 1 : -1);
      if (next < 0 || next >= data.length) return;
      const rows = e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]');
      rows?.[next]?.focus();
      onSelectRow?.(data[next]);
    }
  };

  const roleOf = (selected: boolean, idx: number) => {
    if (!isClickable) return {};
    if (isRadio) {
      const focusable = selected || (!selectedKey && idx === 0);
      return { role: "radio", "aria-checked": selected, tabIndex: focusable ? 0 : -1 } as const;
    }
    return { role: "button", "aria-pressed": selected, tabIndex: 0 } as const;
  };

  return (
    <div
      role={isRadio ? "radiogroup" : undefined}
      aria-label={isRadio ? radioLabel : ariaLabel}
      className={`border-[1.2px] border-[#7096D1] rounded-[9.6px] overflow-hidden bg-[#FFF9F0] flex flex-col ${className}`}
    >
      <div className={`overflow-y-auto ${maxHeight} ${mobileCards ? "hidden md:block" : ""}`}>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-[#F7F2EB] text-[#334EAC] font-semibold border-b border-[#7096D1] sticky top-0 z-10">
              {columns.map((col) => (
                <th key={col.key} className={`${cellPad} font-semibold whitespace-nowrap ${col.headerClassName || ""}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-6 text-center text-sm text-[#334EAC]">
                  {emptyText}
                </td>
              </tr>
            ) : (
              data.map((item, idx) => {
                const key = keyExtractor(item);
                const isSelected = selectedKey === key;
                return (
                  <tr
                    key={key}
                    data-value={key}
                    {...roleOf(isSelected, idx)}
                    onClick={() => onSelectRow?.(item)}
                    onKeyDown={(e) => handleKey(e, item, idx)}
                    className={`border-b border-[#7096D1] last:border-b-0 text-sm text-[#334EAC] transition-colors ${
                      isClickable ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#334EAC]/50" : ""
                    } ${isSelected ? "bg-[#B7C9EF] font-medium" : "bg-[#FFF9F0] hover:bg-[#F7F2EB]"}`}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={`${cellPad} ${col.className || ""}`}>
                        {col.render ? col.render(item, idx) : String((item as Record<string, unknown>)[col.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {mobileCards && (
        <div className={`md:hidden overflow-y-auto ${maxHeight} flex flex-col`}>
          {data.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#334EAC]">{emptyText}</p>
          ) : (
            data.map((item, idx) => {
              const key = keyExtractor(item);
              const isSelected = selectedKey === key;
              return (
                <div
                  key={key}
                  data-value={key}
                  {...roleOf(isSelected, idx)}
                  onClick={() => onSelectRow?.(item)}
                  onKeyDown={(e) => handleKey(e, item, idx)}
                  className={`border-b border-[#7096D1] last:border-b-0 p-4 min-h-[44px] flex flex-col gap-1 shrink-0 text-sm text-[#334EAC] ${
                    isClickable ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#334EAC]/50" : ""
                  } ${isSelected ? "bg-[#B7C9EF]" : "bg-[#FFF9F0]"}`}
                >
                  {columns.map((col) => (
                    <div key={col.key} className="flex justify-between gap-3 min-w-0">
                      <span className="font-medium shrink-0">{col.header}:</span>
                      <span className="text-right break-words min-w-0">
                        {col.render ? col.render(item, idx) : String((item as Record<string, unknown>)[col.key] ?? "")}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default DataTable;
