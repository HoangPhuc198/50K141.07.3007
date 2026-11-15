"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NotificationBanner } from "@frontend/components/ui/NotificationBanner";
import { ChonKhoi, DauTich } from "@frontend/components/ui/ChonKhoi";
import { RadioChipGroup, RadioChip } from "@frontend/components/ui/RadioChip";
import { XEP_LICH_LAM_THANH_CONG } from "@frontend/config/thong-bao";
import { formatDateVN, getTuanLamViec, nowVN, TuanLamViec } from "@backend/lib/time";

interface NhanVienInfo {
  Manv: string;
  Hoten: string;
  Vitrilamviec: string;
}

function getDefaultDay(tuan: TuanLamViec): string {
  const today = formatDateVN(nowVN());
  return tuan.days.some((d) => d.fullDate === today) ? today : tuan.days[0].fullDate;
}

export default function XepLichLamScreen() {
  const router = useRouter();

  const [week] = useState<TuanLamViec>(() => getTuanLamViec());
  // Mặc định chọn hôm nay theo nowVN(), hoặc chip đầu tiên nếu hôm nay không nằm trong danh sách
  const [selectedDay, setSelectedDay] = useState<string>(() => getDefaultDay(getTuanLamViec()));

  const [nhanViens, setNhanViens] = useState<NhanVienInfo[]>([]);
  const [ranhTheoNgay, setRanhTheoNgay] = useState<
    Record<string, Array<{ Manv: string; Hoten: string; Vitrilamviec: string; CaRanh: string[] }>>
  >({});
  const [selectedNvsByDay, setSelectedNvsByDay] = useState<Record<string, Set<string>>>({});

  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(
          `/api/chu-quan/lich-lam?startDate=${week.startDate}&endDate=${week.endDate}`
        );
        const json = await res.json();
        if (json.ok && json.data) {
          setNhanViens(json.data.nhanViens || []);
          setRanhTheoNgay(json.data.ranhTheoNgay || {});

          const initSelected: Record<string, Set<string>> = {};
          for (const day of week.days) {
            const list = json.data.ranhTheoNgay?.[day.fullDate] || [];
            initSelected[day.fullDate] = new Set<string>(list.map((item: { Manv: string }) => item.Manv));
          }
          setSelectedNvsByDay(initSelected);
        }
      } catch (err) {
        console.error("Lỗi khi tải dữ liệu xếp lịch:", err);
      }
    }
    loadData();
  }, [week.startDate, week.endDate, week.days]);

  const handleSelectDay = (day: string) => {
    setSelectedDay(day);
    setIsSaved(false);
    setBanner(null);
  };

  const toggleNvForActiveDay = (manv: string) => {
    setIsSaved(false);
    setBanner(null);
    setSelectedNvsByDay((prev) => {
      const currentSet = new Set<string>(prev[selectedDay] || []);
      if (currentSet.has(manv)) {
        currentSet.delete(manv);
      } else {
        currentSet.add(manv);
      }
      return {
        ...prev,
        [selectedDay]: currentSet,
      };
    });
  };

  const handleCancel = () => {
    router.push("/chu-quan");
  };

  const handleSave = async () => {
    if (isSaved || loading) return;

    // Lưu tất cả ngày có nhân viên đã chọn trong tuần cùng với ngày đang đứng
    const daysWithSelected = week.days
      .map((d) => d.fullDate)
      .filter((d) => (selectedNvsByDay[d]?.size ?? 0) > 0);
    const targetDays = Array.from(new Set([selectedDay, ...daysWithSelected]));

    setLoading(true);
    setBanner(null);

    const nhanVienTheoNgay: Record<string, string[]> = {};
    for (const d of targetDays) {
      nhanVienTheoNgay[d] = Array.from(selectedNvsByDay[d] || []);
    }

    try {
      const res = await fetch("/api/chu-quan/lich-lam", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cacNgay: targetDays,
          nhanVienTheoNgay,
        }),
      });

      const json = await res.json();
      if (json.ok) {
        setBanner({
          type: "success",
          message: XEP_LICH_LAM_THANH_CONG,
        });
        setIsSaved(true);
      } else {
        setBanner({
          type: "error",
          message: json.error?.message || "Lưu lịch làm thất bại",
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

  const currentDayInfo = week.days.find((d) => d.fullDate === selectedDay) || week.days[0];
  const activeDayRanhList = ranhTheoNgay[selectedDay] || [];
  const activeDaySelectedNvs = selectedNvsByDay[selectedDay] || new Set<string>();

  return (
    <div className="relative w-full flex flex-col justify-between min-h-[calc(100dvh-130px)]">
      <div className="w-full">
        {/* Banner thông báo (hiện phía trên 2 card giống UC_6.1_02) */}
        {banner && (
          <div id="notification-message" className="mb-5">
            <NotificationBanner type={banner.type} message={banner.message} />
          </div>
        )}

        {/* Bố cục 2 card theo Figma: Cột trái ~2/3 (Lịch & Rảnh) | Cột phải ~1/3 (Chi tiết ngày) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.85fr_1fr] gap-6 items-start">
          {/* CARD TRÁI */}
          <div className="border border-[#94AFD9] rounded-2xl bg-[#FFF9F0] shadow-sm p-6 min-h-[620px] flex flex-col">
            <h2 className="text-[22px] font-semibold text-[#334EAC] mb-5">
              Lịch làm và thời gian rảnh đăng ký
            </h2>

            {/* Hàng 7 chip ngày trong tuần: chỉ chọn 1 ngày (single-select RadioChip) */}
            <RadioChipGroup
              value={selectedDay}
              onChange={handleSelectDay}
              ariaLabel="Chọn ngày trong tuần"
              className="flex flex-wrap items-center gap-2.5 mb-7"
            >
              {week.days.map((d) => (
                <RadioChip
                  key={d.fullDate}
                  value={d.fullDate}
                  ariaLabel={`Chọn ngày ${d.shortDate}`}
                  className={(isChecked) =>
                    `inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg border text-sm font-medium transition-colors ${
                      isChecked
                        ? "bg-[#334EAC] text-white border-[#334EAC]"
                        : "bg-[#FFF9F0] text-[#334EAC] border-[#94AFD9] hover:bg-[#EAF0FB]"
                    }`
                  }
                >
                  {(isChecked) => (
                    <>
                      <span
                        aria-hidden="true"
                        className={`w-4 h-4 rounded-[3px] border flex items-center justify-center transition-colors ${
                          isChecked
                            ? "border-white bg-transparent"
                            : "border-[#334EAC]/70 bg-transparent"
                        }`}
                      >
                        {isChecked && <DauTich className="w-3 h-3 text-white" />}
                      </span>
                      <span>{d.shortDate}</span>
                    </>
                  )}
                </RadioChip>
              ))}
            </RadioChipGroup>

            {/* Bảng nhân viên đăng ký rảnh trong card trái */}
            <div className="px-2 md:px-6 flex-1 overflow-y-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-[#F3EFEA] text-[#334EAC]">
                    <th className="py-3 px-4 font-medium w-1/2">Nhân viên</th>
                    <th className="py-3 px-4 font-medium w-1/2">Ca rảnh</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDayRanhList.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="py-10 text-center text-[#334EAC]/60 italic">
                        Chưa có nhân viên đăng ký rảnh vào ngày này
                      </td>
                    </tr>
                  ) : (
                    activeDayRanhList.map((nv) => (
                      <tr key={nv.Manv} className="border-b border-[#94AFD9]/70">
                        <td className="py-3.5 px-4 text-[#334EAC]">{nv.Hoten}</td>
                        <td className="py-3.5 px-4 text-[#334EAC]">{nv.CaRanh.join(", ")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* CARD PHẢI */}
          <div className="border border-[#94AFD9] rounded-2xl bg-[#FFF9F0] shadow-sm p-6 min-h-[590px] flex flex-col">
            <div className="mb-4">
              <h3 className="text-[22px] font-semibold text-[#334EAC]">
                Chi tiết ngày {currentDayInfo.shortDate}
              </h3>
              <p className="text-sm text-[#334EAC] mt-1">
                Đã chọn {activeDaySelectedNvs.size} nhân viên
              </p>
            </div>

            <div className="overflow-y-auto flex-1 space-y-1">
              {nhanViens.map((nv) => {
                const isSelected = activeDaySelectedNvs.has(nv.Manv);
                return (
                  <ChonKhoi
                    key={`${selectedDay}_${nv.Manv}`}
                    checked={isSelected}
                    onChange={() => toggleNvForActiveDay(nv.Manv)}
                    ariaLabel={nv.Hoten}
                    className="flex items-center gap-3 py-2.5 px-1 max-md:min-h-[44px] rounded-lg hover:bg-[#F5F0E8]/60 transition-colors"
                  >
                    <span
                      aria-hidden="true"
                      className={`w-5 h-5 rounded border-[1.5px] flex-shrink-0 flex items-center justify-center transition-colors ${
                        isSelected
                          ? "border-[#334EAC] bg-[#334EAC]"
                          : "border-[#334EAC]/70 bg-transparent"
                      }`}
                    >
                      {isSelected && <DauTich className="w-3.5 h-3.5 text-white" />}
                    </span>
                    <span className="text-[15px] text-[#334EAC]">{nv.Hoten}</span>
                  </ChonKhoi>
                );
              })}
            </div>
          </div>
        </div>
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
          {loading ? "Đang lưu..." : "Lưu"}
        </button>
      </div>
    </div>
  );
}
