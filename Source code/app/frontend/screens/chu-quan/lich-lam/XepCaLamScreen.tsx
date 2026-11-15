"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NotificationBanner } from "@frontend/components/ui/NotificationBanner";
import { NhanVienSelect } from "@frontend/components/ui/NhanVienSelect";
import { DatePicker } from "@frontend/components/ui/DatePicker";
import { getTuanLamViec } from "@backend/lib/time";

interface NhanVienInfo {
  Manv: string;
  Hoten: string;
  Vitrilamviec?: string;
}

interface CaDetail {
  Malich: string;
  Maca: string;
  Loaica: string;
  Giobatdau: string;
  Gioketthuc: string;
  Sonvquydinh: number;
  nhanVienDaXep: NhanVienInfo[];
  nhanVienRanh: Array<{ Manv: string; Hoten: string }>;
}

function buildInitialSlots(cas: CaDetail[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const ca of cas) {
    const daXep = (ca.nhanVienDaXep || []).map((nv) => nv.Manv);
    const totalSlots = Math.max(ca.Sonvquydinh, daXep.length);
    const arr = Array.from({ length: totalSlots }, (_, idx) => daXep[idx] || "");
    result[ca.Maca] = arr;
  }
  return result;
}

export default function XepCaLamScreen() {
  const router = useRouter();

  const [selectedDay, setSelectedDay] = useState<string>(() => getTuanLamViec().days[0].fullDate);
  const [caDetails, setCaDetails] = useState<CaDetail[]>([]);
  const [tatCaNhanVien, setTatCaNhanVien] = useState<NhanVienInfo[]>([]);

  const [slots, setSlots] = useState<Record<string, string[]>>({});
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!selectedDay) return;
    let cancelled = false;
    async function loadData() {
      try {
        setLoading(true);
        setIsSaved(false);
        setBanner(null);
        // Đổi ngày thì LUÔN xóa sạch lựa chọn của ngày trước
        setSlots({});

        const res = await fetch(`/api/chu-quan/lich-lam/xep-ca?ngay=${selectedDay}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.ok && json.data) {
          const loadedCas: CaDetail[] = Array.isArray(json.data.caDetails)
            ? json.data.caDetails
            : [];
          setCaDetails(loadedCas);
          setTatCaNhanVien(json.data.tatCaNhanVien || []);
          setSlots(buildInitialSlots(loadedCas));
        } else {
          setCaDetails([]);
          setSlots({});
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Lỗi khi tải dữ liệu xếp ca:", err);
        setCaDetails([]);
        setSlots({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, [selectedDay]);

  const handleSelectDay = (newDay: string) => {
    if (!newDay) return;
    setSelectedDay(newDay);
    setIsSaved(false);
    setBanner(null);
    // Hủy bỏ thay đổi chưa lưu và tải lại dữ liệu theo ngày mới
    setSlots({});
  };

  const handleSlotChange = (maCa: string, slotIndex: number, manv: string) => {
    setIsSaved(false);
    setBanner(null);
    setSlots((prev) => {
      const current = [...(prev[maCa] || [])];
      current[slotIndex] = manv;
      return {
        ...prev,
        [maCa]: current,
      };
    });
  };

  const handleCancel = () => {
    const hasAnySelected = Object.values(slots).some((arr) => arr.some((id) => id !== ""));
    if (hasAnySelected) {
      // Đưa tất cả các ô chọn về trống như trạng thái UC_6.2_03
      const cleared: Record<string, string[]> = {};
      for (const ca of caDetails) {
        cleared[ca.Maca] = Array.from({ length: ca.Sonvquydinh }, () => "");
      }
      setSlots(cleared);
      setIsSaved(false);
      setBanner(null);
    } else {
      router.push("/chu-quan");
    }
  };

  const handleSave = async () => {
    if (loading || isSaved) return;
    setLoading(true);
    setBanner(null);

    const phanCong = caDetails.map((c) => {
      const ids = (slots[c.Maca] || []).filter((id) => id !== "");
      return {
        maCa: c.Maca,
        nhanVienIds: Array.from(new Set(ids)),
      };
    });

    try {
      const res = await fetch("/api/chu-quan/lich-lam/xep-ca", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ngay: selectedDay,
          phanCong,
        }),
      });

      const json = await res.json();
      if (json.ok) {
        setIsSaved(true);
      } else {
        setBanner({
          type: "error",
          message: json.error?.message || "Lưu ca làm thất bại",
        });
      }
    } catch {
      setBanner({
        type: "error",
        message: "Lỗi kết nối máy chủ",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-full flex flex-col justify-between min-h-[calc(100dvh-130px)]">
      <div className="w-full">
        {/* Banner thông báo lỗi (nếu có) */}
        {banner && (
          <div id="notification-message" className="mb-5">
            <NotificationBanner type={banner.type} message={banner.message} />
          </div>
        )}

        {/* Bộ chọn ngày xếp ca dùng chung dd/mm/yyyy */}
        <div className="mb-6">
          <label
            htmlFor="select-ngay-xep-ca"
            className="block text-sm font-medium text-[#334EAC] mb-2"
          >
            Ngày xếp ca
          </label>
          <DatePicker
            id="select-ngay-xep-ca"
            value={selectedDay}
            onChange={handleSelectDay}
            calendarButtonAriaLabel="Mở lịch chọn ngày xếp ca"
            wrapperClassName="w-full md:w-[460px]"
            inputClassName="h-[52px] rounded-xl border-[#94AFD9] shadow-sm text-sm"
          />
        </div>

        {/* 3 thẻ Ca làm theo đúng Figma UC_6.2_01, _02, _03 */}
        {caDetails.length === 0 ? (
          <div className="border border-[#94AFD9] rounded-2xl bg-[#FFF9F0] p-8 text-center text-sm text-[#7096D1]">
            {loading ? "Đang tải..." : "Không có dữ liệu ca làm"}
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {caDetails.map((ca) => {
            const caSlots = slots[ca.Maca] || Array.from({ length: ca.Sonvquydinh }, () => "");
            const assignedIds = caSlots.filter((id) => id !== "");
            const count = assignedIds.length;
            const ranhIds = new Set(ca.nhanVienRanh.map((r) => r.Manv));
            const ranhNvs = tatCaNhanVien.filter((nv) => ranhIds.has(nv.Manv));
            const khacNvs = tatCaNhanVien.filter((nv) => !ranhIds.has(nv.Manv));

            return (
              <div
                key={ca.Maca}
                className="border border-[#94AFD9] rounded-2xl bg-[#FFF9F0] shadow-sm p-6 flex flex-col min-h-[450px]"
              >
                <h3 className="text-[22px] font-semibold text-[#334EAC]">
                  {`Ca ${ca.Loaica.toLowerCase()}`}
                </h3>
                <p className="text-sm text-[#334EAC] mt-1">
                  {`${ca.Giobatdau} – ${ca.Gioketthuc}`}
                </p>
                <p className="text-lg font-medium text-[#334EAC] mt-3">
                  {`${count} / ${ca.Sonvquydinh} người`}
                </p>

                <div className="mt-5">
                  <p className="text-sm text-[#334EAC] mb-3">Nhân viên trong ca</p>
                  <div className="space-y-4">
                    {caSlots.map((selectedManv, idx) => {
                      const otherSelected = new Set(
                        caSlots.filter((id, i) => i !== idx && id !== "")
                      );
                      const ranhAvailable = ranhNvs.filter((nv) => !otherSelected.has(nv.Manv));
                      const khacAvailable = khacNvs.filter((nv) => !otherSelected.has(nv.Manv));

                      return (
                        <NhanVienSelect
                          key={`${ca.Maca}-slot-${idx}`}
                          ariaLabel={`Ca ${ca.Loaica.toLowerCase()} - Nhân viên ${idx + 1}`}
                          value={selectedManv}
                          onChange={(val) => handleSlotChange(ca.Maca, idx, val)}
                          ranhNvs={ranhAvailable}
                          khacNvs={khacAvailable}
                          placeholder="Chọn nhân viên cho ca này"
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Đường kẻ ngang + 2 nút Hủy / Lưu đúng kích thước Figma */}
      <div className="border-t border-[#94AFD9] pt-5 mt-8 flex justify-end items-center gap-5">
        <button
          type="button"
          id="btn-cancel"
          onClick={handleCancel}
          className="w-[143px] h-[52px] rounded-xl border border-[#334EAC] text-[#334EAC] font-medium text-base bg-[#FFF9F0] hover:bg-[#EAF0FB] transition-colors"
        >
          Hủy
        </button>
        <button
          type="button"
          id="btn-save"
          onClick={handleSave}
          disabled={loading || isSaved}
          className={`w-[264px] h-[52px] rounded-xl font-medium text-base text-white transition-colors ${
            isSaved
              ? "bg-[#334EAC]/50 cursor-not-allowed"
              : "bg-[#334EAC] hover:bg-[#283e8a] disabled:opacity-60"
          }`}
        >
          {loading ? "Đang lưu..." : isSaved ? "Đã lưu" : "Lưu"}
        </button>
      </div>
    </div>
  );
}
