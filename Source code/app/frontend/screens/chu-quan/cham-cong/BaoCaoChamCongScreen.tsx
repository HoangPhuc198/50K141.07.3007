"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DatePicker } from "@frontend/components/ui/DatePicker";
import { MonthPicker } from "@frontend/components/ui/MonthPicker";
import {
  formatNgayThang,
  formatThangNam,
  parseThangNamInput,
} from "@frontend/lib/dinh-dang";
import { formatDateVN, nowVN } from "@backend/lib/time";
import { BAO_CAO_CHAM_CONG_TRONG } from "@frontend/config/thong-bao";
import type {
  BaoCaoNgayItem,
  BaoCaoThangNhanVienItem,
} from "@backend/services/bao-cao-cham-cong";

type XemTheoMode = "ngay" | "thang";

const PAGE_SIZE_CHI_TIET = 7;

function formatGioThucTe(
  tongGio: number,
  gioVao: string | null,
  gioRa: string | null
): string {
  if (gioVao && gioRa) {
    const [h1, m1] = gioVao.split(":").map((n) => parseInt(n, 10));
    const [h2, m2] = gioRa.split(":").map((n) => parseInt(n, 10));
    const diffPhut = h2 * 60 + m2 - (h1 * 60 + m1);
    if (diffPhut > 0) {
      const gio = Math.floor(diffPhut / 60);
      const phut = diffPhut % 60;
      if (phut === 0) return `${gio} giờ`;
      if (phut === 30) return `${gio},5 giờ`;
      return `${gio} giờ ${phut} phút`;
    }
  }
  if (tongGio <= 0) return "0 giờ";
  if (Number.isInteger(tongGio)) return `${tongGio} giờ`;
  return `${String(tongGio).replace(".", ",")} giờ`;
}

function formatTongGioThang(tongGio: number): string {
  if (tongGio <= 0) return "0 giờ";
  if (Number.isInteger(tongGio)) return `${tongGio} giờ`;
  return `${String(tongGio).replace(".", ",")} giờ`;
}

export default function BaoCaoChamCongScreen() {
  const router = useRouter();

  const initialToday = useMemo(() => formatDateVN(nowVN()), []);
  const initialYear = parseInt(initialToday.slice(0, 4), 10);
  const initialMonth = parseInt(initialToday.slice(5, 7), 10);

  const [xemTheo, setXemTheo] = useState<XemTheoMode>("ngay");

  // Bộ lọc theo ngày
  const [selectedDate, setSelectedDate] = useState<string>(initialToday);

  // Bộ lọc theo tháng ("YYYY-MM")
  const [selectedMonthIso, setSelectedMonthIso] = useState<string>(
    `${initialYear}-${String(initialMonth).padStart(2, "0")}`
  );
  const parsedMonth = parseThangNamInput(selectedMonthIso);
  const selectedMonth = parsedMonth?.thang ?? initialMonth;
  const selectedYear = parsedMonth?.nam ?? initialYear;

  // Dữ liệu từ API
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dailyItems, setDailyItems] = useState<BaoCaoNgayItem[]>([]);
  const [monthlyItems, setMonthlyItems] = useState<BaoCaoThangNhanVienItem[]>(
    []
  );

  // Màn chi tiết theo nhân viên (UC_7.2_03)
  const [selectedEmployee, setSelectedEmployee] =
    useState<BaoCaoThangNhanVienItem | null>(null);
  const [detailPage, setDetailPage] = useState<number>(1);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const qs =
        xemTheo === "ngay"
          ? `ngay=${encodeURIComponent(selectedDate)}`
          : `thang=${encodeURIComponent(
              `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`
            )}`;
      const res = await fetch(`/api/bao-cao/cham-cong?${qs}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setErrorMsg(json.error?.message || "Không thể tải báo cáo chấm công");
        setDailyItems([]);
        setMonthlyItems([]);
        return;
      }

      if (json.data.mode === "ngay") {
        setDailyItems(json.data.items || []);
      } else {
        setMonthlyItems(json.data.items || []);
      }
    } catch {
      setErrorMsg("Lỗi kết nối máy chủ");
      setDailyItems([]);
      setMonthlyItems([]);
    } finally {
      setLoading(false);
    }
  }, [xemTheo, selectedDate, selectedMonth, selectedYear]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleSelectMode = (mode: XemTheoMode) => {
    setXemTheo(mode);
    setSelectedEmployee(null);
    setDetailPage(1);
  };

  const handleOpenDetail = (emp: BaoCaoThangNhanVienItem) => {
    setSelectedEmployee(emp);
    setDetailPage(1);
  };

  const handleClose = () => {
    if (selectedEmployee) {
      setSelectedEmployee(null);
      setDetailPage(1);
      return;
    }
    router.push("/chu-quan/cham-cong");
  };

  // Phân trang chi tiết (7 dòng/trang)
  const detailRows = selectedEmployee?.chiTiet ?? [];
  const totalDetailPages = Math.max(
    1,
    Math.ceil(detailRows.length / PAGE_SIZE_CHI_TIET)
  );
  const safeDetailPage = Math.min(detailPage, totalDetailPages);
  const pagedDetailRows = detailRows.slice(
    (safeDetailPage - 1) * PAGE_SIZE_CHI_TIET,
    safeDetailPage * PAGE_SIZE_CHI_TIET
  );

  const rightHeading =
    xemTheo === "ngay"
      ? `Chấm công ngày ${formatNgayThang(selectedDate)}`
      : `Chấm công tháng ${formatThangNam(selectedMonth, selectedYear)}`;

  const isEmpty =
    !loading &&
    (xemTheo === "ngay" ? dailyItems.length === 0 : monthlyItems.length === 0);

  return (
    <div
      data-hydrated="true"
      className="relative w-full flex flex-col justify-between min-h-[calc(100dvh-144px)] gap-5"
    >
      {/* Khung nội dung chính */}
      {selectedEmployee ? (
        /* ============ MÀN CHI TIẾT CHẤM CÔNG (UC_7.2_03) ============ */
        <section
          aria-label={`Chi tiết chấm công - ${selectedEmployee.hoten}`}
          className="border-[1.2px] border-[#7096D1] rounded-[14.4px] bg-[#FFF9F0] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.2)] p-5 sm:p-6 flex flex-col justify-between flex-1 min-h-[420px]"
        >
          <div>
            <h2 className="text-lg sm:text-[20px] font-semibold text-[#334EAC] mb-5">
              Chi tiết chấm công - {selectedEmployee.hoten}
            </h2>

            {/* Desktop table */}
            <div className="hidden md:block w-full">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-[#F7F2EB] text-[#334EAC] text-sm font-medium">
                    <th className="px-4 py-3.5 font-medium">Ngày làm</th>
                    <th className="px-4 py-3.5 font-medium">Ca làm</th>
                    <th className="px-4 py-3.5 font-medium">Giờ vào</th>
                    <th className="px-4 py-3.5 font-medium">Giờ kết thúc</th>
                    <th className="px-4 py-3.5 font-medium">Giờ thực tế</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedDetailRows.map((row) => (
                    <tr
                      key={row.machamcong}
                      className="border-b border-[#7096D1] text-sm text-[#334EAC] bg-[#FFF9F0]"
                    >
                      <td className="px-4 py-3.5 tabular-nums">
                        {row.ngayHienThi}
                      </td>
                      <td className="px-4 py-3.5">{row.caLam}</td>
                      <td className="px-4 py-3.5 tabular-nums">
                        {row.gioVao ?? "--:--"}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums">
                        {row.gioRa ?? "--:--"}
                      </td>
                      <td className="px-4 py-3.5">
                        {formatGioThucTe(row.tongGio, row.gioVao, row.gioRa)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards (< 768px) */}
            <div className="md:hidden space-y-3">
              {pagedDetailRows.map((row) => (
                <div
                  key={row.machamcong}
                  className="p-4 rounded-xl border border-[#7096D1] bg-[#FFF9F0] space-y-1.5 text-sm text-[#334EAC]"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">Ngày làm:</span>
                    <span className="tabular-nums">{row.ngayHienThi}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">Ca làm:</span>
                    <span>{row.caLam}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">Giờ vào:</span>
                    <span className="tabular-nums">{row.gioVao ?? "--:--"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">Giờ kết thúc:</span>
                    <span className="tabular-nums">{row.gioRa ?? "--:--"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">Giờ thực tế:</span>
                    <span>
                      {formatGioThucTe(row.tongGio, row.gioVao, row.gioRa)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Phân trang chi tiết */}
          {detailRows.length > 0 && (
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-end gap-3 sm:gap-4">
              <span
                id="pagination-summary"
                className="text-xs sm:text-sm text-[#334EAC]"
              >
                Hiển thị {pagedDetailRows.length}/{detailRows.length} ngày
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  aria-label="Trang trước"
                  disabled={safeDetailPage <= 1}
                  onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                  className="min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] px-2 rounded-[8px] border-[1.2px] border-[#334EAC] bg-[#FFF9F0] text-[#334EAC] text-sm font-medium disabled:opacity-40"
                >
                  ‹
                </button>
                {Array.from({ length: totalDetailPages }, (_, idx) => idx + 1).map(
                  (p) => (
                    <button
                      key={p}
                      type="button"
                      aria-current={p === safeDetailPage ? "page" : undefined}
                      onClick={() => setDetailPage(p)}
                      className={`min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] px-2 rounded-[8px] text-sm font-medium transition-colors ${
                        p === safeDetailPage
                          ? "bg-[#334EAC] text-[#FFF9F0]"
                          : "border-[1.2px] border-[#334EAC] bg-[#FFF9F0] text-[#334EAC] hover:bg-[#F7F2EB]"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  type="button"
                  aria-label="Trang sau"
                  disabled={safeDetailPage >= totalDetailPages}
                  onClick={() =>
                    setDetailPage((p) => Math.min(totalDetailPages, p + 1))
                  }
                  className="min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] px-2 rounded-[8px] border-[1.2px] border-[#334EAC] bg-[#FFF9F0] text-[#334EAC] text-sm font-medium disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </section>
      ) : (
        /* ============ MÀN CHÍNH: BỘ LỌC + BẢNG / TRỐNG (UC_7.2_01, 02, 04) ============ */
        <div className="grid grid-cols-1 lg:grid-cols-[310px_1fr] xl:grid-cols-[340px_1fr] gap-6 items-stretch flex-1">
          {/* Cột trái: Bộ lọc thời gian */}
          <section className="border-[1.2px] border-[#7096D1] rounded-[14.4px] bg-[#FFF9F0] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.2)] p-5 sm:p-6 flex flex-col">
            <h2 className="text-lg sm:text-[20px] font-semibold text-[#334EAC] mb-5">
              Bộ lọc thời gian
            </h2>

            {/* Xem theo */}
            <div className="mb-4">
              <label
                htmlFor="select-xem-theo"
                className="block text-sm font-medium text-[#334EAC] mb-2"
              >
                Xem theo
              </label>
              <select
                id="select-xem-theo"
                value={xemTheo}
                onChange={(e) =>
                  handleSelectMode(e.target.value as XemTheoMode)
                }
                className="w-full h-[46px] px-3.5 rounded-[9.6px] border-[1.2px] border-[#7096D1] bg-[#FFF9F0] text-sm text-[#334EAC] focus:outline-none focus:ring-2 focus:ring-[#334EAC]/25"
              >
                <option value="ngay">Ngày</option>
                <option value="thang">Tháng</option>
              </select>
            </div>

            {xemTheo === "ngay" ? (
              <div className="mb-1">
                <label
                  htmlFor="input-ngay-bao-cao"
                  className="block text-sm font-medium text-[#334EAC] mb-2"
                >
                  Ngày báo cáo
                </label>
                <DatePicker
                  id="input-ngay-bao-cao"
                  inline
                  value={selectedDate}
                  onChange={(iso) => {
                    if (iso) setSelectedDate(iso);
                  }}
                  inputClassName="h-[46px] px-3.5 text-sm"
                />
              </div>
            ) : (
              <div className="mb-1">
                <label
                  htmlFor="input-thang-bao-cao"
                  className="block text-sm font-medium text-[#334EAC] mb-2"
                >
                  Tháng báo cáo
                </label>
                <MonthPicker
                  id="input-thang-bao-cao"
                  inline
                  value={selectedMonthIso}
                  onChange={(iso) => {
                    if (iso) {
                      setSelectedMonthIso(iso);
                      setSelectedEmployee(null);
                      setDetailPage(1);
                    }
                  }}
                  inputClassName="h-[46px] px-3.5 text-sm"
                />
              </div>
            )}
          </section>

          {/* Cột phải: Bảng dữ liệu hoặc Trống */}
          <section className="border-[1.2px] border-[#7096D1] rounded-[14.4px] bg-[#FFF9F0] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.2)] p-5 sm:p-6 flex flex-col min-h-[360px]">
            <h2 className="text-lg sm:text-[20px] font-semibold text-[#334EAC] mb-5">
              {rightHeading}
            </h2>

            {loading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-11 bg-[#F7F2EB] rounded" />
                <div className="h-12 bg-[#F7F2EB] rounded" />
                <div className="h-12 bg-[#F7F2EB] rounded" />
              </div>
            ) : errorMsg ? (
              <div className="flex-1 flex items-center justify-center text-center py-8 px-4">
                <p className="text-sm font-medium text-[#C0392B]">{errorMsg}</p>
              </div>
            ) : isEmpty ? (
              /* Trạng thái trống (UC_7.2_04) */
              <div
                data-testid="empty-bao-cao"
                className="flex-1 flex flex-col items-center justify-center text-center py-10 px-4 gap-4"
              >
                <svg
                  className="w-16 h-16 text-[#334EAC]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.6}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 6h.01M9 15h.01M12 11h3m-3 4h3"
                  />
                </svg>
                <p className="text-2xl sm:text-[28px] font-bold text-[#334EAC]">
                  {BAO_CAO_CHAM_CONG_TRONG}
                </p>
              </div>
            ) : xemTheo === "ngay" ? (
              <>
                {/* Desktop table: Theo ngày (UC_7.2_01) */}
                <div className="hidden md:block w-full">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-[#F7F2EB] text-[#334EAC] text-sm font-medium">
                        <th className="px-4 py-3.5 font-medium">Họ và tên</th>
                        <th className="px-4 py-3.5 font-medium">Ca làm</th>
                        <th className="px-4 py-3.5 font-medium">Giờ vào</th>
                        <th className="px-4 py-3.5 font-medium">
                          Giờ kết thúc
                        </th>
                        <th className="px-4 py-3.5 font-medium">Giờ thực tế</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyItems.map((item) => (
                        <tr
                          key={item.machamcong}
                          className="border-b border-[#7096D1] text-sm text-[#334EAC] bg-[#FFF9F0]"
                        >
                          <td className="px-4 py-3.5">{item.hoten}</td>
                          <td className="px-4 py-3.5">{item.caLam}</td>
                          <td className="px-4 py-3.5 tabular-nums">
                            {item.gioVao ?? "--:--"}
                          </td>
                          <td className="px-4 py-3.5 tabular-nums">
                            {item.gioRa ?? "--:--"}
                          </td>
                          <td className="px-4 py-3.5">
                            {formatGioThucTe(
                              item.tongGio,
                              item.gioVao,
                              item.gioRa
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards: Theo ngày (< 768px) */}
                <div className="md:hidden space-y-3">
                  {dailyItems.map((item) => (
                    <div
                      key={item.machamcong}
                      className="p-4 rounded-xl border border-[#7096D1] bg-[#FFF9F0] space-y-1.5 text-sm text-[#334EAC]"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">Họ và tên:</span>
                        <span>{item.hoten}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">Ca làm:</span>
                        <span>{item.caLam}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">Giờ vào:</span>
                        <span className="tabular-nums">
                          {item.gioVao ?? "--:--"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">Giờ kết thúc:</span>
                        <span className="tabular-nums">
                          {item.gioRa ?? "--:--"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">Giờ thực tế:</span>
                        <span>
                          {formatGioThucTe(
                            item.tongGio,
                            item.gioVao,
                            item.gioRa
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                {/* Desktop table: Theo tháng (UC_7.2_02) */}
                <div className="hidden md:block w-full">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-[#F7F2EB] text-[#334EAC] text-sm font-medium">
                        <th className="px-4 py-3.5 font-medium">Họ và tên</th>
                        <th className="px-4 py-3.5 font-medium">
                          Số ca đã làm
                        </th>
                        <th className="px-4 py-3.5 font-medium">
                          Tổng giờ thực tế
                        </th>
                        <th className="px-4 py-3.5 font-medium text-center">
                          Xem chi tiết
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyItems.map((item) => (
                        <tr
                          key={item.manv}
                          className="border-b border-[#7096D1] text-sm text-[#334EAC] bg-[#FFF9F0]"
                        >
                          <td className="px-4 py-3.5">{item.hoten}</td>
                          <td className="px-4 py-3.5 tabular-nums">
                            {item.tongCa}
                          </td>
                          <td className="px-4 py-3.5">
                            {formatTongGioThang(item.tongGio)}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(item)}
                              className="px-4 py-1.5 rounded-[7.2px] text-xs font-semibold text-[#334EAC] hover:bg-[#7096D1]/35 transition-colors"
                            >
                              Chi tiết
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards: Theo tháng (< 768px) */}
                <div className="md:hidden space-y-3">
                  {monthlyItems.map((item) => (
                    <div
                      key={item.manv}
                      className="p-4 rounded-xl border border-[#7096D1] bg-[#FFF9F0] space-y-1.5 text-sm text-[#334EAC]"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">Họ và tên:</span>
                        <span>{item.hoten}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">Số ca đã làm:</span>
                        <span className="tabular-nums">{item.tongCa}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="font-medium">Tổng giờ thực tế:</span>
                        <span>{formatTongGioThang(item.tongGio)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(item)}
                        className="w-full min-h-[44px] mt-2 rounded-[9.6px] border border-[#334EAC] bg-[#F7F2EB] text-[#334EAC] text-sm font-semibold hover:bg-[#7096D1]/20 transition-colors"
                      >
                        Chi tiết
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* Thanh thao tác đáy */}
      <div className="border-t-[1.2px] border-[#7096D1] pt-4 flex items-center justify-end">
        <button
          type="button"
          id="btn-dong"
          onClick={handleClose}
          className="w-full sm:w-auto min-w-[144px] h-[44px] px-6 rounded-[9.6px] border-[1.2px] border-[#334EAC] bg-[#FFF9F0] text-[#334EAC] text-sm font-medium hover:bg-[#F7F2EB] transition-colors"
        >
          Đóng
        </button>
      </div>
    </div>
  );
}
