"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { parseSoTienNguyenVND } from "@frontend/lib/dinh-dang";
import { NotificationBanner } from "@frontend/components/ui/NotificationBanner";
import { PageCard } from "@frontend/components/ui/PageCard";
import { RadioChipGroup, RadioChip } from "@frontend/components/ui/RadioChip";
import { PLACEHOLDER } from "@frontend/config/placeholder";
import {
  TIEN_THUONG_CHUA_LUU,
  TIEN_THUONG_THANH_CONG,
  TIEN_THUONG_KHONG_HOP_LE,
  TIEN_THUONG_THIEU_LY_DO,
} from "@frontend/config/thong-bao";

export type KyLuongOption = {
  Makyluong: string;
  Thang: number;
  Nam: number;
  Trangthai: string;
  Label: string;
};

export type NhanVienTienThuong = {
  Manv: string;
  Hoten: string;
  Vitrilamviec: string;
  Tienthuong: number;
  Lydothuong: string | null;
  Mabangluong: string | null;
};

export default function NhapTienThuongScreen() {
  const router = useRouter();
  const [kyLuongList, setKyLuongList] = useState<KyLuongOption[]>([]);
  const [selectedKyLuong, setSelectedKyLuong] = useState<string>("");
  const [selectedKyInfo, setSelectedKyInfo] = useState<KyLuongOption | null>(null);

  const [nhanVienList, setNhanVienList] = useState<NhanVienTienThuong[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Nhân viên đang được chọn để nhập thưởng
  const [selectedManv, setSelectedManv] = useState<string>("");

  // Form fields
  const [soTienStr, setSoTienStr] = useState("0");
  const [lyDoStr, setLyDoStr] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  // Thông báo & Lỗi viền đỏ
  const [banner, setBanner] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    soTien?: boolean;
    lyDo?: boolean;
  }>({});

  const selectedEmployee = useMemo(() => {
    return nhanVienList.find((nv) => nv.Manv === selectedManv) || null;
  }, [nhanVienList, selectedManv]);

  // Tải dữ liệu kỳ lương & danh sách nhân viên
  const fetchData = useCallback(async (makyluong?: string) => {
    setLoading(true);
    try {
      const url = makyluong
        ? `/api/tien-thuong?makyluong=${encodeURIComponent(makyluong)}`
        : "/api/tien-thuong";
      const res = await fetch(url);
      const json = await res.json();
      if (res.ok && json.ok && json.data) {
        setKyLuongList(json.data.danhSachKyLuong || []);
        if (json.data.kyLuongHienTai) {
          setSelectedKyLuong(json.data.kyLuongHienTai.Makyluong);
          setSelectedKyInfo(json.data.kyLuongHienTai);
        }
        setNhanVienList(json.data.danhSachNhanVien || []);
      }
    } catch {
      // bỏ qua
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Đổi kỳ lương từ dropdown
  const handleSelectKyLuong = (makyluong: string) => {
    if (isDirty) {
      setBanner({ type: "warning", message: TIEN_THUONG_CHUA_LUU });
    }
    setSelectedKyLuong(makyluong);
    setSelectedManv("");
    setSoTienStr("0");
    setLyDoStr("");
    setIsDirty(false);
    setFieldErrors({});
    fetchData(makyluong);
  };

  // Chọn 1 nhân viên
  const handleSelectNhanVien = (manv: string) => {
    const nv = nhanVienList.find((item) => item.Manv === manv);
    if (!nv) return;

    setSelectedManv(manv);
    setSoTienStr(String(nv.Tienthuong || 0));
    setLyDoStr(nv.Lydothuong || "");
    setIsDirty(false);
    setFieldErrors({});
    setBanner(null);
  };

  // Nút Hủy
  const handleCancel = () => {
    router.push("/chu-quan");
  };

  // Nút Lưu
  const handleSave = async () => {
    setBanner(null);
    setFieldErrors({});

    if (!selectedEmployee || !selectedKyLuong) {
      return;
    }

    // 1. Kiểm tra số tiền: phải là số nguyên ≥ 0
    const tienNum = parseSoTienNguyenVND(soTienStr);
    if (tienNum === null || tienNum < 0) {
      setFieldErrors((prev) => ({ ...prev, soTien: true }));
      setBanner({ type: "error", message: TIEN_THUONG_KHONG_HOP_LE });
      return;
    }

    // 2. Kiểm tra lý do: bắt buộc không được để trống
    const trimmedLyDo = lyDoStr.trim();
    if (!trimmedLyDo) {
      setFieldErrors((prev) => ({ ...prev, lyDo: true }));
      setBanner({ type: "error", message: TIEN_THUONG_THIEU_LY_DO });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/tien-thuong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Makyluong: selectedKyLuong,
          Manv: selectedEmployee.Manv,
          Tienthuong: tienNum,
          Lydothuong: trimmedLyDo,
        }),
      });

      const json = await res.json();
      if (res.ok && json.ok) {
        setBanner({ type: "success", message: TIEN_THUONG_THANH_CONG });
        setIsDirty(false);
        // Cập nhật lại danh sách local
        setNhanVienList((prev) =>
          prev.map((item) =>
            item.Manv === selectedEmployee.Manv
              ? {
                  ...item,
                  Tienthuong: tienNum,
                  Lydothuong: trimmedLyDo,
                  Mabangluong: json.data?.Mabangluong || item.Mabangluong,
                }
              : item
          )
        );
      } else {
        const errorMsg = json.error?.message || "Lưu thất bại";
        if (errorMsg === TIEN_THUONG_KHONG_HOP_LE) {
          setFieldErrors((prev) => ({ ...prev, soTien: true }));
        } else if (errorMsg === TIEN_THUONG_THIEU_LY_DO) {
          setFieldErrors((prev) => ({ ...prev, lyDo: true }));
        }
        setBanner({ type: "error", message: errorMsg });
      }
    } catch {
      setBanner({ type: "error", message: "Lưu thất bại" });
    } finally {
      setSaving(false);
    }
  };

  const isKyDaChot = selectedKyInfo?.Trangthai === "Đã chốt";

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Banner thông báo */}
      {banner && (
        <NotificationBanner
          type={banner.type}
          message={banner.message}
          onClose={() => setBanner(null)}
        />
      )}

      {/* Bố cục 2 cột theo Figma UC_8.5_01 */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Cột trái: Tiền thưởng trong kỳ */}
        <PageCard className="flex-[3_3_0%] min-w-0">
          <h2 className="text-xl sm:text-2xl font-semibold text-[#334EAC] mb-4">
            Tiền thưởng trong kỳ
          </h2>

          {/* Bộ lọc kỳ lương chưa chốt */}
          <div className="mb-6">
            <label
              htmlFor="select-ky-luong"
              className="block text-sm sm:text-base font-medium text-[#334EAC] mb-2"
            >
              Kỳ lương chưa chốt
            </label>
            <div className="relative">
              <select
                id="select-ky-luong"
                value={selectedKyLuong}
                onChange={(e) => handleSelectKyLuong(e.target.value)}
                className="w-full px-4 py-3 rounded-[9.6px] bg-[#FFF9F0] border-[1.2px] border-[#7096D1] text-[#334EAC] text-sm sm:text-base appearance-none focus:outline-none focus:border-[#334EAC] transition-colors min-h-[44px]"
              >
                {kyLuongList.map((ky) => (
                  <option key={ky.Makyluong} value={ky.Makyluong}>
                    {ky.Label}
                  </option>
                ))}
              </select>
              {/* Biểu tượng mở danh sách */}
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[#334EAC]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Bảng dữ liệu nhân viên & tiền thưởng */}
          {loading ? (
            <p className="text-sm text-[#334EAC] text-center py-8">Đang tải danh sách...</p>
          ) : nhanVienList.length === 0 ? (
            <p className="text-sm text-[#7096D1] text-center py-8">Chưa có nhân viên nào</p>
          ) : (
            <RadioChipGroup
              value={selectedManv}
              onChange={handleSelectNhanVien}
              ariaLabel="Danh sách nhân viên nhập tiền thưởng"
              className="border border-[#7096D1] rounded-[12px] overflow-hidden"
            >
              {/* Bảng cho Desktop */}
              <div className="hidden sm:block">
                <table className="w-full text-left border-collapse text-sm text-[#334EAC]">
                  <thead>
                    <tr className="bg-[#B7C9EF] font-bold text-[#334EAC]">
                      <th className="py-3 px-4 font-bold">Nhân viên</th>
                      <th className="py-3 px-4 font-bold">Vị trí</th>
                      <th className="py-3 px-4 font-bold">Tiền thưởng (đ)</th>
                      <th className="py-3 px-4 font-bold">Lý do đã lưu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nhanVienList.map((nv) => {
                      const isSelected = selectedManv === nv.Manv;
                      const bgRow = isSelected ? "bg-[#EAF0FB]" : "bg-[#FFF9F0]";
                      return (
                        <tr
                          key={nv.Manv}
                          tabIndex={0}
                          role="radio"
                          aria-checked={isSelected}
                          data-value={nv.Manv}
                          onClick={() => handleSelectNhanVien(nv.Manv)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleSelectNhanVien(nv.Manv);
                            }
                          }}
                          className={`border-t border-[#7096D1] ${bgRow} hover:bg-[#EAF0FB] cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-[#334EAC]`}
                        >
                          <td className="py-3 px-4 font-normal">{nv.Hoten}</td>
                          <td className="py-3 px-4 font-normal">{nv.Vitrilamviec}</td>
                          <td className="py-3 px-4 font-normal">
                            {nv.Tienthuong.toLocaleString("vi-VN")}
                          </td>
                          <td className="py-3 px-4 font-normal text-[#334EAC]/80">
                            {nv.Lydothuong || "Chưa có"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Danh sách thẻ cho Mobile (< 640px) */}
              <div className="sm:hidden flex flex-col divide-y divide-[#7096D1]">
                {nhanVienList.map((nv) => (
                  <RadioChip
                    key={nv.Manv}
                    value={nv.Manv}
                    ariaLabel={`Chọn nhân viên ${nv.Hoten}`}
                    className={(checked) =>
                      `p-4 text-left transition-colors min-h-[44px] flex flex-col gap-2 ${
                        checked ? "bg-[#EAF0FB]" : "bg-[#FFF9F0]"
                      }`
                    }
                  >
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-semibold text-[#334EAC]">{nv.Hoten}</span>
                      <span className="text-xs text-[#7096D1] bg-[#FFF9F0] px-2 py-0.5 rounded border border-[#7096D1]">
                        {nv.Vitrilamviec}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[#7096D1]">Tiền thưởng:</span>
                      <span className="font-medium text-[#334EAC]">
                        {nv.Tienthuong.toLocaleString("vi-VN")} đ
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[#7096D1]">Lý do:</span>
                      <span className="text-[#334EAC]/80">{nv.Lydothuong || "Chưa có"}</span>
                    </div>
                  </RadioChip>
                ))}
              </div>
            </RadioChipGroup>
          )}
        </PageCard>

        {/* Cột phải: Form nhập tiền thưởng cho nhân viên được chọn */}
        <PageCard className="flex-[2_2_0%] min-w-0">
          <h2 className="text-xl sm:text-2xl font-semibold text-[#334EAC] mb-6">
            {selectedEmployee
              ? `Thưởng cho ${selectedEmployee.Hoten}`
              : "Chọn 1 nhân viên để nhập tiền thưởng"}
          </h2>

          <div className="flex flex-col gap-5">
            {/* Số tiền thưởng / đề xuất */}
            <div>
              <label
                htmlFor="input-so-tien-thuong"
                className="block text-sm sm:text-base font-medium text-[#334EAC] mb-2"
              >
                {selectedEmployee ? "Số tiền đề xuất (đ) *" : "Số tiền thưởng (đ) *"}
              </label>
              <input
                id="input-so-tien-thuong"
                type="text"
                placeholder={PLACEHOLDER.soTienThuong}
                disabled={!selectedEmployee || isKyDaChot}
                value={soTienStr}
                onChange={(e) => {
                  setSoTienStr(e.target.value);
                  setIsDirty(true);
                  setFieldErrors((prev) => ({ ...prev, soTien: false }));
                }}
                className={`w-full px-4 py-3 rounded-[9.6px] bg-[#FFF9F0] border-[1.2px] text-[#334EAC] placeholder:text-[#7096D1] text-sm sm:text-base outline-none transition-colors min-h-[44px] disabled:opacity-50 disabled:bg-[#F7F2EB] ${
                  fieldErrors.soTien
                    ? "border-[#C0392B] focus:border-[#C0392B]"
                    : "border-[#7096D1] focus:border-[#334EAC]"
                }`}
              />
            </div>

            {/* Lý do thưởng */}
            <div>
              <label
                htmlFor="input-ly-do-thuong"
                className="block text-sm sm:text-base font-medium text-[#334EAC] mb-2"
              >
                Lý do thưởng *
              </label>
              <textarea
                id="input-ly-do-thuong"
                rows={5}
                placeholder={PLACEHOLDER.lyDoThuong}
                disabled={!selectedEmployee || isKyDaChot}
                value={lyDoStr}
                onChange={(e) => {
                  setLyDoStr(e.target.value);
                  setIsDirty(true);
                  setFieldErrors((prev) => ({ ...prev, lyDo: false }));
                }}
                className={`w-full px-4 py-3 rounded-[9.6px] bg-[#FFF9F0] border-[1.2px] text-[#334EAC] placeholder:text-[#7096D1] text-sm sm:text-base outline-none transition-colors resize-none disabled:opacity-50 disabled:bg-[#F7F2EB] ${
                  fieldErrors.lyDo
                    ? "border-[#C0392B] focus:border-[#C0392B]"
                    : "border-[#7096D1] focus:border-[#334EAC]"
                }`}
              />
            </div>
          </div>
        </PageCard>
      </div>

      {/* Thanh thao tác dưới cùng (Figma UC_8.5_01: Thanh thao tác) */}
      <div className="border-t-[1.2px] border-[#7096D1] pt-4 flex justify-end gap-4">
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving}
          className="px-8 py-3 rounded-[9.6px] bg-[#FFF9F0] border-[1.2px] border-[#334EAC] text-[#334EAC] text-sm sm:text-base font-medium hover:bg-[#F2ECE1] transition-colors min-h-[44px] min-w-[120px] disabled:opacity-50"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !selectedEmployee || isKyDaChot}
          className="px-10 py-3 rounded-[9.6px] bg-[#334EAC] border-[1.2px] border-[#334EAC] text-[#FFF9F0] text-sm sm:text-base font-medium hover:bg-[#2A3F8F] transition-colors min-h-[44px] min-w-[140px] disabled:opacity-60"
        >
          {saving ? "Đang lưu..." : "Lưu"}
        </button>
      </div>
    </div>
  );
}
