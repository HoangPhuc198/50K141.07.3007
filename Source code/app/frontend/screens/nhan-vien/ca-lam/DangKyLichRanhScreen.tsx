"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NotificationBanner } from "@frontend/components/ui/NotificationBanner";
import { ChonKhoi, DauTich } from "@frontend/components/ui/ChonKhoi";
import {
  DANG_KY_LICH_RANH_THANH_CONG,
  DANG_KY_LICH_RANH_CHUA_CHON,
} from "@frontend/config/thong-bao";
import type { TuanLamViec } from "@backend/lib/time";

interface CaLamInfo {
  Maca: string;
  Loaica: string;
  Giobatdau: string;
  Gioketthuc: string;
  Sonvquydinh: number;
}

export default function DangKyLichRanhScreen() {
  const router = useRouter();
  const [week, setWeek] = useState<TuanLamViec | null>(null);
  const [caLams, setCaLams] = useState<CaLamInfo[]>([]);
  const [loadingCa, setLoadingCa] = useState(true);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ngayDaKhoa, setNgayDaKhoa] = useState<Set<string>>(new Set());
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        // Lấy tuần hiển thị trực tiếp từ máy chủ (tính bằng nowVN() + LICH_RANH_CHUYEN_TUAN)
        const res = await fetch("/api/nhan-vien/lich-ranh", { cache: "no-store" });
        const json = await res.json();
        if (json.ok && json.data) {
          if (json.data.tuan) {
            setWeek(json.data.tuan);
          }
          if (json.data.caLams && json.data.caLams.length > 0) {
            setCaLams(json.data.caLams);
          }
          if (Array.isArray(json.data.ngayDaKhoa)) {
            setNgayDaKhoa(new Set<string>(json.data.ngayDaKhoa));
          }
          if (json.data.lichRanhs && json.data.lichRanhs.length > 0) {
            const set = new Set<string>();
            for (const item of json.data.lichRanhs) {
              set.add(`${item.Ngayranh}_${item.Caranh}`);
            }
            setSelected(set);
          }
        }
      } catch (err) {
        console.error("Lỗi khi tải lịch rảnh:", err);
      } finally {
        setLoadingCa(false);
      }
    }
    loadData();
  }, []);

  const allDaysLocked = week ? week.days.every((d) => ngayDaKhoa.has(d.fullDate)) : false;

  const toggleSelect = (fullDate: string, maCa: string) => {
    if (submitted || ngayDaKhoa.has(fullDate)) return;
    setBanner(null);
    setSelected((prev) => {
      const next = new Set(prev);
      const key = `${fullDate}_${maCa}`;
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleCancel = () => {
    if (allDaysLocked) return;
    router.push("/nhan-vien");
  };

  const handleSubmit = async () => {
    if (submitted || loading || !week || allDaysLocked) return;

    const danhSach = Array.from(selected)
      .map((k) => {
        const [ngay, maCa] = k.split("_");
        return { ngay, maCa };
      })
      .filter((item) => !ngayDaKhoa.has(item.ngay));

    if (danhSach.length === 0) {
      setBanner({
        type: "error",
        message: DANG_KY_LICH_RANH_CHUA_CHON,
      });
      return;
    }

    setLoading(true);
    setBanner(null);

    try {
      const res = await fetch("/api/nhan-vien/lich-ranh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startDate: week.startDate,
          endDate: week.endDate,
          danhSach,
        }),
      });

      const json = await res.json();
      if (json.ok) {
        setBanner({
          type: "success",
          message: DANG_KY_LICH_RANH_THANH_CONG,
        });
        setSubmitted(true);
      } else {
        setBanner({
          type: "error",
          message: json.error?.message || DANG_KY_LICH_RANH_CHUA_CHON,
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
        {/* Banner thông báo */}
        {banner && (
          <div id="notification-message" className="mb-5">
            <NotificationBanner type={banner.type} message={banner.message} />
          </div>
        )}

        {/* Card lớn theo Figma UC_2.1 */}
        <div className="border border-[#94AFD9] rounded-2xl bg-[#FFF9F0] shadow-sm p-4 sm:p-6">
          <h2 className="text-[22px] font-semibold text-[#334EAC] mb-6">
            {week ? `Lịch rảnh tuần ${week.titleRange}` : "Lịch rảnh tuần"}
          </h2>

          {/* ================= DESKTOP VIEW: Bảng lưới (>= 768px) ================= */}
          {!week || caLams.length === 0 ? (
            <p className="text-sm text-[#7096D1] text-center py-8">
              {loadingCa ? "Đang tải..." : "Chưa có dữ liệu ca làm"}
            </p>
          ) : (
            <>
          <div className="hidden md:block w-full">
            <table className="w-full border-collapse table-fixed">
              <thead>
                <tr className="bg-[#F3EFEA] text-[#334EAC]">
                  <th className="w-52 py-3.5 px-4 text-left text-sm font-medium">
                    Ca làm / ngày
                  </th>
                  {week.days.map((d) => (
                    <th
                      key={d.fullDate}
                      className="py-3 px-2 text-center text-sm font-medium"
                    >
                      <div>{d.label}</div>
                      <div className="text-sm font-normal mt-0.5">{d.shortDate}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {caLams.map((ca) => (
                  <tr
                    key={ca.Maca}
                    className="h-[135px] border-b border-[#94AFD9]/70"
                  >
                    <td className="px-4 text-left">
                      <div className="text-base font-medium text-[#334EAC]">{`Ca ${ca.Loaica.toLowerCase()}`}</div>
                      <div className="text-xs text-[#334EAC]/85 mt-1">
                        {`${ca.Giobatdau} – ${ca.Gioketthuc}`}
                      </div>
                    </td>

                    {week.days.map((d) => {
                      const key = `${d.fullDate}_${ca.Maca}`;
                      const isChecked = selected.has(key);
                      const isLockedDay = ngayDaKhoa.has(d.fullDate);
                      return (
                        <td key={d.fullDate} className="p-0 text-center">
                          <ChonKhoi
                            checked={isChecked}
                            disabled={submitted || isLockedDay}
                            onChange={() => toggleSelect(d.fullDate, ca.Maca)}
                            ariaLabel={`${ca.Loaica} ${d.label} ${d.shortDate}`}
                            className={`flex justify-center items-center w-full h-[135px] transition-colors ${
                              isLockedDay ? "bg-[#F3EFEA]/50" : "hover:bg-[#EAF0FB]/40"
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`w-6 h-6 rounded border-[1.5px] flex items-center justify-center transition-colors ${
                                isChecked
                                  ? "border-[#334EAC] bg-[#334EAC]"
                                  : "border-[#334EAC]/70 bg-transparent"
                              } ${submitted || isLockedDay ? "opacity-60" : ""}`}
                            >
                              {isChecked && <DauTich className="w-4 h-4 text-white" />}
                            </span>
                          </ChonKhoi>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ================= MOBILE VIEW (< 768px): Danh sách thẻ từng ngày (KHÔNG cuộn ngang) ================= */}
          <div className="block md:hidden space-y-4">
            {week.days.map((d) => {
              const isLockedDay = ngayDaKhoa.has(d.fullDate);
              return (
              <div
                key={d.fullDate}
                className="border border-[#94AFD9] rounded-xl p-4 bg-[#FAF4EB]/60 space-y-2"
              >
                <div className="flex justify-between items-center border-b border-[#94AFD9]/60 pb-2">
                  <span className="font-semibold text-sm text-[#334EAC]">{d.label}</span>
                  <span className="text-xs text-[#334EAC]/80">{d.shortDate}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {caLams.map((ca) => {
                    const key = `${d.fullDate}_${ca.Maca}`;
                    const isChecked = selected.has(key);
                    return (
                      <ChonKhoi
                        key={ca.Maca}
                        checked={isChecked}
                        disabled={submitted || isLockedDay}
                        onChange={() => toggleSelect(d.fullDate, ca.Maca)}
                        ariaLabel={`${ca.Loaica} ${d.label} ${d.shortDate}`}
                        className={`flex flex-col items-center justify-center p-2 min-h-[48px] rounded-lg border text-xs transition-all ${
                          isChecked
                            ? "bg-[#334EAC] text-white border-[#334EAC] font-semibold"
                            : "bg-white text-[#334EAC] border-[#94AFD9] hover:bg-[#EAF0FB]"
                        } ${isLockedDay ? "opacity-60" : ""}`}
                      >
                        <span>{`Ca ${ca.Loaica.toLowerCase()}`}</span>
                        <span className="text-[10px] opacity-80">{ca.Giobatdau}</span>
                      </ChonKhoi>
                    );
                  })}
                </div>
              </div>
              );
            })}
          </div>
            </>
          )}
        </div>
      </div>

      {/* Đường kẻ ngang + nút hành động đúng kích thước Figma */}
      <div className="border-t border-[#94AFD9] pt-5 mt-8 flex justify-end items-center gap-5">
        <button
          type="button"
          id="btn-cancel"
          onClick={handleCancel}
          disabled={allDaysLocked}
          className={`w-[143px] h-[52px] rounded-xl border border-[#334EAC] text-[#334EAC] font-medium text-base bg-[#FFF9F0] transition-colors ${
            allDaysLocked ? "opacity-50 cursor-not-allowed" : "hover:bg-[#EAF0FB]"
          }`}
        >
          Hủy
        </button>
        <button
          type="button"
          id="btn-submit"
          onClick={handleSubmit}
          disabled={loading || submitted || !week || allDaysLocked}
          className={`w-[264px] h-[52px] rounded-xl font-medium text-base text-white transition-colors ${
            submitted || allDaysLocked
              ? "bg-[#334EAC]/50 cursor-not-allowed"
              : "bg-[#334EAC] hover:bg-[#283e8a]"
          }`}
        >
          {loading ? "Đang gửi..." : "Gửi"}
        </button>
      </div>
    </div>
  );
}
