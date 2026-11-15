import React from "react";

export interface NhanVienOption {
  Manv: string;
  Hoten: string;
  Vitrilamviec?: string;
}

export interface NhanVienSelectProps {
  id?: string;
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  ranhNvs: NhanVienOption[];
  khacNvs: NhanVienOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function NhanVienSelect({
  id,
  ariaLabel,
  value,
  onChange,
  ranhNvs,
  khacNvs,
  placeholder = "Chọn nhân viên cho ca này",
  disabled = false,
  className = "",
}: NhanVienSelectProps) {
  return (
    <select
      id={id}
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`w-full h-[50px] px-4 rounded-xl border border-[#94AFD9] bg-[#FFF9F0] text-sm text-[#334EAC] focus:outline-none focus:ring-1 focus:ring-[#334EAC] ${className}`}
    >
      <option value="">{placeholder}</option>
      {ranhNvs.length > 0 && (
        <optgroup label="Đăng ký rảnh ca này">
          {ranhNvs.map((nv) => (
            <option key={nv.Manv} value={nv.Manv}>
              {nv.Hoten}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label={ranhNvs.length > 0 ? "Nhân viên khác" : "Danh sách nhân viên"}>
        {khacNvs.map((nv) => (
          <option key={nv.Manv} value={nv.Manv}>
            {nv.Hoten}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
