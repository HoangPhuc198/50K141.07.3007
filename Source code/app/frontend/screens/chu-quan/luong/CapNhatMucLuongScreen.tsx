"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { parseSoTienNguyenVND } from "@frontend/lib/dinh-dang";
import { NotificationBanner } from "@frontend/components/ui/NotificationBanner";
import {
  CAP_NHAT_LUONG_THANH_CONG,
  CAP_NHAT_LUONG_KHONG_HOP_LE,
  CAP_NHAT_LUONG_VUI_LONG_NHAP,
  CAP_NHAT_LUONG_THAT_BAI,
  xuLyCapNhatLuongXacNhan,
} from "@frontend/config/thong-bao";
import { PLACEHOLDER } from "@frontend/config/placeholder";

// --- Types ---
type NhanVienMucLuong = {
  Manv: string;
  Hoten: string;
  Vitrilamviec: string;
  Mucluongtheogio: number;
};

// --- Hộp xác nhận inline (Figma UC_8.1_03: hiện bên dưới form, trong card phải) ---
function ConfirmBox({
  ten,
  manv,
  mucCu,
  mucMoi,
  onConfirm,
  onCancel,
  loading,
}: {
  ten: string;
  manv: string;
  mucCu: number;
  mucMoi: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="border-[1.2px] border-[#7096D1] rounded-[14.4px] p-5 bg-[#FFF9F0] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.12)] mt-4">
      <div className="flex items-start justify-between mb-3">
        <h4 className="text-sm font-semibold text-[#334EAC]">Xác nhận cập nhật mức lương</h4>
        <button onClick={onCancel} className="w-7 h-7 flex items-center justify-center rounded-full text-[#334EAC] hover:bg-[#F2ECE1] transition-colors" aria-label="Đóng">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="9" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l6 6M15 9l-6 6" />
          </svg>
        </button>
      </div>
      <p className="text-sm text-[#334EAC] mb-5">
        {xuLyCapNhatLuongXacNhan(ten, mucCu, mucMoi)}
      </p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="min-h-[44px] min-w-[88px] px-5 rounded-[9.6px] border-[1.2px] border-[#334EAC] bg-[#FFF9F0] text-[#334EAC] text-sm font-medium hover:bg-[#F2ECE1]"
        >
          Không
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="min-h-[44px] min-w-[88px] px-5 rounded-[9.6px] border-[1.2px] border-[#334EAC] bg-[#334EAC] text-[#FFF9F0] text-sm font-medium hover:bg-[#2a3f8f] disabled:opacity-60"
        >
          {loading ? "Đang lưu..." : "Có"}
        </button>
      </div>
    </div>
  );
}

// --- Màn hình chính ---
export default function CapNhatMucLuongScreen() {
  const router = useRouter();
  const [list, setList] = useState<NhanVienMucLuong[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selected, setSelected] = useState<NhanVienMucLuong | null>(null);
  const [mucMoiStr, setMucMoiStr] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [fieldError, setFieldError] = useState("");

  const fetchList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/chu-quan/muc-luong");
      const json = await res.json();
      if (res.ok && json.ok) {
        setList(json.data);
      }
    } catch {
      // bỏ qua
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleSelectNV = (nv: NhanVienMucLuong) => {
    setSelected(nv);
    setMucMoiStr("");
    setShowConfirm(false);
    setFieldError("");
    setBanner(null);
  };

  const handleLuu = () => {
    if (!mucMoiStr.trim()) {
      setFieldError(CAP_NHAT_LUONG_VUI_LONG_NHAP);
      return;
    }
    const val = parseSoTienNguyenVND(mucMoiStr);
    if (val === null || val <= 0) {
      setFieldError(CAP_NHAT_LUONG_KHONG_HOP_LE);
      return;
    }
    setFieldError("");
    setShowConfirm(true);
  };

  const handleHuy = () => {
    setSelected(null);
    setMucMoiStr("");
    setShowConfirm(false);
    setFieldError("");
    router.push("/chu-quan");
  };

  const handleConfirm = async () => {
    if (!selected) return;
    const mucMoi = parseSoTienNguyenVND(mucMoiStr);
    if (mucMoi === null || mucMoi <= 0) {
      setFieldError(CAP_NHAT_LUONG_KHONG_HOP_LE);
      setShowConfirm(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/chu-quan/muc-luong", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Manv: selected.Manv, Mucluongtheogio: mucMoi }),
      });
      const json = await res.json();
      setShowConfirm(false);
      if (res.ok && json.ok) {
        setBanner({ type: "success", message: CAP_NHAT_LUONG_THANH_CONG });
        // Cập nhật list local + reset
        setList((prev) =>
          prev.map((nv) =>
            nv.Manv === selected.Manv ? { ...nv, Mucluongtheogio: mucMoi } : nv
          )
        );
        setSelected(null);
        setMucMoiStr("");
      } else {
        setBanner({ type: "error", message: json.error?.message || CAP_NHAT_LUONG_THAT_BAI });
      }
    } catch {
      setShowConfirm(false);
      setBanner({ type: "error", message: CAP_NHAT_LUONG_THAT_BAI });
    } finally {
      setSaving(false);
    }
  };

  const mucMoiNum = parseSoTienNguyenVND(mucMoiStr);

  return (
    <div className="flex flex-col gap-5">
      {/* Banner */}
      {banner && <NotificationBanner type={banner.type} message={banner.message} />}

      {/* Layout 2 cột theo Figma */}
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Cột trái: danh sách nhân viên */}
        <div className="flex-1 bg-white rounded-2xl border border-[#94AFD9] p-6">
          <h2 className="text-base font-semibold text-[#334EAC] mb-4">Chọn nhân viên</h2>
          {loadingList ? (
            <p className="text-sm text-[#94AFD9] text-center py-6">Đang tải...</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-[#7096D1] text-center py-6">Chưa có nhân viên nào</p>
          ) : (
            <>
              <div className="hidden sm:block">
                <table className="w-full text-sm text-[#334EAC]">
                  <thead>
                    <tr className="border-b border-[#94AFD9]">
                      <th className="text-left pb-2 pr-4 font-medium">Nhân viên</th>
                      <th className="text-left pb-2 pr-4 font-medium">Vị trí</th>
                      <th className="text-right pb-2 font-medium">Lương/giờ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((nv) => {
                      const isSelected = selected?.Manv === nv.Manv;
                      return (
                        <tr
                          key={nv.Manv}
                          tabIndex={0}
                          aria-selected={isSelected}
                          onClick={() => handleSelectNV(nv)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleSelectNV(nv);
                            }
                          }}
                          className={`border-b border-[#E8E0D5] cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#334EAC] ${
                            isSelected ? "bg-[#334EAC] text-white" : "hover:bg-[#EAF0FB]"
                          }`}
                        >
                          <td className="py-2.5 pr-4">{nv.Hoten}</td>
                          <td className="py-2.5 pr-4">{nv.Vitrilamviec}</td>
                          <td className="py-2.5 text-right tabular-nums">
                            {nv.Mucluongtheogio.toLocaleString("vi-VN")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="sm:hidden space-y-2">
                {list.map((nv) => {
                  const isSelected = selected?.Manv === nv.Manv;
                  return (
                    <button
                      key={nv.Manv}
                      type="button"
                      onClick={() => handleSelectNV(nv)}
                      className={`w-full text-left min-h-[44px] rounded-xl border p-3 transition-colors ${
                        isSelected
                          ? "bg-[#334EAC] text-white border-[#334EAC]"
                          : "bg-[#FFF9F0] text-[#334EAC] border-[#94AFD9] hover:bg-[#EAF0FB]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 font-medium text-sm">
                        <span>{nv.Hoten}</span>
                        <span className="tabular-nums">
                          {nv.Mucluongtheogio.toLocaleString("vi-VN")}đ
                        </span>
                      </div>
                      <div className="text-xs opacity-80 mt-0.5">{nv.Vitrilamviec}</div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Cột phải: form cập nhật */}
        <div className="lg:w-[460px] flex-shrink-0 bg-white rounded-2xl border border-[#94AFD9] p-6 flex flex-col">
          {!selected ? (
            <>
              <h2 className="text-base font-semibold text-[#334EAC] mb-2">Chọn nhân viên</h2>
              <p className="text-sm text-[#334EAC]">
                Vui lòng chọn nhân viên từ danh sách bên trái để xem thông tin và cập nhật mức lương.
              </p>
              {/* Ô nhập mức lương mới (trống, disabled) */}
              <div className="mt-5">
                <label className="block text-sm font-medium text-[#334EAC] mb-1.5">
                  Mức lương mới (đ/giờ) <span className="text-[#C0392B]">*</span>
                </label>
                <input
                  disabled
                  value=""
                  readOnly
                  placeholder={PLACEHOLDER.mucLuongMoi}
                  className="w-full px-4 py-3 rounded-lg border border-[#94AFD9] text-sm bg-[#F7F2EB] text-[#334EAC] placeholder:text-[#7096D1] opacity-60 cursor-not-allowed"
                />
              </div>
            </>
          ) : (
            <>
              {/* Tiêu đề: Tên · Mã · Mức lương hiện tại (Figma _02) */}
              <h2 className="text-base font-semibold text-[#334EAC] mb-5">
                {selected.Hoten} · {selected.Manv} · {selected.Mucluongtheogio.toLocaleString("vi-VN")}đ/giờ
              </h2>

              {/* Ô nhập mức lương mới */}
              <div>
                <label className="block text-sm font-medium text-[#334EAC] mb-1.5">
                  Mức lương mới (đ/giờ) <span className="text-[#C0392B]">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={PLACEHOLDER.mucLuongMoi}
                  value={mucMoiStr}
                  onChange={(e) => {
                    setMucMoiStr(e.target.value);
                    setFieldError("");
                    setShowConfirm(false);
                  }}
                  className={`w-full px-4 py-3 rounded-lg border text-sm text-[#334EAC] placeholder:text-[#7096D1] bg-white focus:outline-none focus:ring-2 ${
                    fieldError
                      ? "border-[#C0392B] focus:ring-[#C0392B]/30"
                      : "border-[#94AFD9] focus:ring-[#334EAC]/30"
                  }`}
                />
                {fieldError && (
                  <p className="text-xs mt-1" style={{ color: "#C0392B" }}>{fieldError}</p>
                )}
              </div>

              {/* Hộp xác nhận inline (Figma _03) */}
              {showConfirm && mucMoiNum !== null && mucMoiNum > 0 && (
                <ConfirmBox
                  ten={selected.Hoten}
                  manv={selected.Manv}
                  mucCu={selected.Mucluongtheogio}
                  mucMoi={mucMoiNum}
                  onConfirm={handleConfirm}
                  onCancel={() => setShowConfirm(false)}
                  loading={saving}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer: Hủy / Lưu */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          onClick={handleHuy}
          className="min-h-[44px] px-6 py-2.5 rounded-lg border border-[#334EAC] text-[#334EAC] text-sm font-medium hover:bg-[#EAF0FB]"
        >
          Hủy
        </button>
        <button
          onClick={handleLuu}
          disabled={!selected}
          className="min-h-[44px] px-6 py-2.5 rounded-lg bg-[#334EAC] text-white text-sm font-medium hover:bg-[#2a3f8f] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Lưu
        </button>
      </div>
    </div>
  );
}
