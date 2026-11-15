"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NotificationBanner } from "@frontend/components/ui/NotificationBanner";
import { RadioChip, RadioChipGroup } from "@frontend/components/ui/RadioChip";
import { PLACEHOLDER } from "@frontend/config/placeholder";
import {
  BO_SUNG_CC_GUI_THANH_CONG,
  BO_SUNG_CC_THIEU_TRUONG,
} from "@frontend/config/thong-bao";
import type {
  CaThieuChamCongItem,
  LoaiYeuCauBoSung,
} from "@backend/services/bo-sung-cc";
import styles from "./YeuCauBoSungScreen.module.css";

const HH_MM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizeHHmm(raw: string): string {
  const trimmed = raw.trim();
  const afterDot = trimmed.includes("·")
    ? trimmed.split("·").pop()!.trim()
    : trimmed;
  const match = afterDot.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  const hh = match[1].padStart(2, "0");
  const mm = match[2];
  const formatted = `${hh}:${mm}`;
  return HH_MM_REGEX.test(formatted) ? formatted : "";
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
}

function CalendarIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function CalendarCheckIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2zm9-6l2 2 4-4"
      />
    </svg>
  );
}

function PencilIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
    </svg>
  );
}

export default function YeuCauBoSungScreen() {
  const router = useRouter();
  const [items, setItems] = useState<CaThieuChamCongItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [selectedMalich, setSelectedMalich] = useState<string>("");
  const [loaiYeuCau, setLoaiYeuCau] =
    useState<LoaiYeuCauBoSung>("Quên check-out");
  const [gioVaoInput, setGioVaoInput] = useState<string>("");
  const [gioRaInput, setGioRaInput] = useState<string>("");
  const [lydo, setLydo] = useState<string>("");

  const [banner, setBanner] = useState<{
    type: "loi" | "thanh-cong";
    message: string;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    gioVao?: boolean;
    gioRa?: boolean;
    lydo?: boolean;
  }>({});

  const applyShiftToForm = useCallback((shift: CaThieuChamCongItem | null) => {
    if (!shift) {
      setSelectedMalich("");
      setLoaiYeuCau("Quên check-out");
      setGioVaoInput("");
      setGioRaInput("");
      setLydo("");
      setFieldErrors({});
      return;
    }
    setSelectedMalich(shift.malich);
    setLoaiYeuCau(shift.loaiThieu);
    setGioVaoInput(
      shift.loaiThieu === "Quên check-out"
        ? shift.gioDaCheckIn || shift.gioBatDau
        : shift.gioBatDau
    );
    setGioRaInput(shift.gioKetThuc);
    setLydo("");
    setFieldErrors({});
  }, []);

  const loadCaThieu = useCallback(
    async (keepBanner = false) => {
      try {
        const res = await fetch("/api/bo-sung-cc/ca-thieu", {
          cache: "no-store",
        });
        const json = await res.json();
        if (json.ok && json.data) {
          const list = (json.data.items || []) as CaThieuChamCongItem[];
          setItems(list);
          if (list.length > 0) {
            applyShiftToForm(list[0]);
          } else {
            applyShiftToForm(null);
          }
          if (!keepBanner) setBanner(null);
        }
      } catch {
        // giữ nguyên trạng thái nếu lỗi mạng tạm thời
      } finally {
        setLoading(false);
      }
    },
    [applyShiftToForm]
  );

  useEffect(() => {
    loadCaThieu(false);
  }, [loadCaThieu]);

  const selectedItem =
    items.find((i) => i.malich === selectedMalich) ?? null;

  const handleSelectShift = (malich: string) => {
    const found = items.find((i) => i.malich === malich) ?? null;
    setBanner(null);
    applyShiftToForm(found);
  };

  const handleCancel = () => {
    setBanner(null);
    setFieldErrors({});
    if (selectedItem) {
      applyShiftToForm(selectedItem);
    } else {
      router.push("/nhan-vien");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !selectedItem) return;

    const cleanGioVao = normalizeHHmm(gioVaoInput);
    const cleanGioRa = normalizeHHmm(gioRaInput);
    const cleanLydo = lydo.trim();

    const nextErrors: {
      gioVao?: boolean;
      gioRa?: boolean;
      lydo?: boolean;
    } = {};

    if (loaiYeuCau === "Quên check-in" && !cleanGioVao) {
      nextErrors.gioVao = true;
    }
    if (!cleanGioRa) {
      nextErrors.gioRa = true;
    }
    if (!cleanLydo) {
      nextErrors.lydo = true;
    }

    if (nextErrors.gioVao || nextErrors.gioRa || nextErrors.lydo) {
      setFieldErrors(nextErrors);
      setBanner({ type: "loi", message: BO_SUNG_CC_THIEU_TRUONG });
      return;
    }

    const gioVaoToCompare =
      loaiYeuCau === "Quên check-out"
        ? selectedItem.gioDaCheckIn || selectedItem.gioBatDau
        : cleanGioVao;

    if (toMinutes(cleanGioRa) <= toMinutes(gioVaoToCompare)) {
      setFieldErrors({ gioRa: true });
      setBanner({
        type: "loi",
        message: "Giờ kết thúc ca phải sau giờ vào ca",
      });
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    setBanner(null);

    try {
      const res = await fetch("/api/bo-sung-cc", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          malich: selectedItem.malich,
          loaiYeuCau,
          giovaobosung:
            loaiYeuCau === "Quên check-in" ? cleanGioVao : null,
          giorabosung: cleanGioRa,
          lydo: cleanLydo,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setBanner({
          type: "thanh-cong",
          message: BO_SUNG_CC_GUI_THANH_CONG,
        });
        await loadCaThieu(true);
      } else {
        setBanner({
          type: "loi",
          message: json.error?.message || BO_SUNG_CC_THIEU_TRUONG,
        });
      }
    } catch {
      setBanner({ type: "loi", message: "Lỗi kết nối máy chủ" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-hydrated="true"
      className="relative w-full flex flex-col justify-between min-h-[calc(100dvh-144px)] gap-5"
    >
      <div className="w-full flex flex-col gap-5">
        {banner ? (
          <div id="notification-message" className="w-full">
            <NotificationBanner
              type={banner.type}
              message={banner.message}
              className="!mb-0"
            />
          </div>
        ) : (
          <div className="hidden lg:block h-16" aria-hidden="true" />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[38fr_62fr] gap-6 items-stretch">
          {/* Cột trái: Ca của bạn thiếu chấm công */}
          <section className="min-w-0 border-[1.2px] border-[#7096D1] rounded-[14.4px] bg-[#FFF9F0] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.12)] p-5 sm:p-7 flex flex-col min-h-[340px] lg:min-h-[620px]">
            <h2 className="text-lg sm:text-[20px] font-semibold text-[#334EAC] mb-5">
              Ca của bạn thiếu chấm công
            </h2>

            {loading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-11 bg-[#F7F2EB] rounded" />
                <div className="h-14 bg-[#F7F2EB] rounded" />
                <div className="h-14 bg-[#F7F2EB] rounded" />
              </div>
            ) : items.length === 0 ? (
              <div
                id="empty-ca-thieu"
                className="flex-1 flex flex-col items-center justify-center text-center py-8 px-4 rounded-xl bg-[#F7F2EB]/60 border border-[#7096D1]/40"
              >
                <p className="text-sm font-medium text-[#334EAC]">
                  Không có ca làm nào thiếu chấm công
                </p>
              </div>
            ) : (
              <div className="w-full">
                {/* Tiêu đề bảng desktop */}
                <div className="hidden md:grid grid-cols-2 bg-[#F7F2EB] text-[#334EAC] text-sm font-medium px-4 py-3.5">
                  <span>Ngày / ca</span>
                  <span>Dữ liệu còn thiếu</span>
                </div>

                <RadioChipGroup
                  value={selectedMalich}
                  onChange={handleSelectShift}
                  ariaLabel="Ca của bạn thiếu chấm công"
                  className="flex flex-col"
                >
                  {items.map((item) => (
                    <RadioChip
                      key={item.malich}
                      value={item.malich}
                      ariaLabel={`${item.ngayNgan} · ${item.loaica} — ${item.loaiThieu}`}
                      className={(checked) =>
                        `w-full flex flex-col gap-2 md:grid md:grid-cols-2 md:items-center text-left px-4 py-4 min-h-[56px] border-b border-[#7096D1] text-sm text-[#334EAC] transition-colors ${
                          checked ? "bg-[#F7F2EB]" : "bg-[#F7F2EB]/50 hover:bg-[#F7F2EB]/80"
                        }`
                      }
                    >
                      {(checked) => (
                        <>
                          <span className="flex items-center gap-2.5 min-w-0">
                            <CalendarIcon className="w-5 h-5 text-[#334EAC] flex-shrink-0" />
                            <span className="truncate font-normal">
                              <span className="md:hidden font-medium mr-1">
                                Ngày / ca:
                              </span>
                              {`${item.ngayNgan} · ${item.loaica}`}
                            </span>
                          </span>

                          <span className="flex items-center gap-2.5 min-w-0">
                            <span
                              aria-hidden="true"
                              data-testid="radio-dot"
                              className="w-4 h-4 rounded-full border-[1.5px] border-[#334EAC] flex items-center justify-center flex-shrink-0"
                            >
                              {checked && (
                                <span className="w-2 h-2 rounded-full bg-[#334EAC]" />
                              )}
                            </span>
                            <span className="truncate">
                              <span className="md:hidden font-medium mr-1">
                                Dữ liệu còn thiếu:
                              </span>
                              {item.loaiThieu}
                            </span>
                          </span>
                        </>
                      )}
                    </RadioChip>
                  ))}
                </RadioChipGroup>
              </div>
            )}
          </section>

          {/* Cột phải: Thông tin cần bổ sung */}
          <section className="min-w-0 border-[1.2px] border-[#7096D1] rounded-[14.4px] bg-[#FFF9F0] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.12)] p-5 sm:p-7 flex flex-col min-h-[340px] lg:min-h-[620px]">
            <div className="flex items-center gap-2.5 mb-5">
              <PencilIcon className="w-6 h-6 text-[#334EAC] flex-shrink-0" />
              <h2 className="text-lg sm:text-[20px] font-semibold text-[#334EAC]">
                Thông tin cần bổ sung
              </h2>
            </div>

            <div className={`space-y-5 flex-1 min-w-0 ${styles.fieldsContainer}`}>
              {/* Loại yêu cầu * */}
              <div>
                <label
                  htmlFor="select-loai-yeu-cau"
                  className="block text-sm sm:text-[15px] font-medium text-[#334EAC] mb-2"
                >
                  Loại yêu cầu *
                </label>
                <select
                  id="select-loai-yeu-cau"
                  value={loaiYeuCau}
                  disabled={!selectedItem}
                  onChange={(e) => {
                    const nextType = e.target.value as LoaiYeuCauBoSung;
                    setLoaiYeuCau(nextType);
                    setFieldErrors({});
                    setBanner(null);
                    if (selectedItem && nextType === "Quên check-out") {
                      setGioVaoInput(
                        selectedItem.gioDaCheckIn || selectedItem.gioBatDau
                      );
                    }
                  }}
                  className="w-full h-[46px] px-4 rounded-[9.6px] border-[1.2px] border-[#7096D1] bg-[#FFF9F0] text-sm text-[#334EAC] focus:outline-none focus:ring-2 focus:ring-[#334EAC]/30 disabled:opacity-60"
                >
                  <option value="Quên check-out">Quên check-out</option>
                  <option value="Quên check-in">Quên check-in</option>
                </select>
              </div>

              {/* Giờ vào * & Giờ kết thúc * */}
              <div className={styles.timePairGrid}>
                <div className="min-w-0">
                  <label
                    htmlFor="input-gio-vao"
                    className="block text-sm sm:text-[15px] font-medium text-[#334EAC] mb-2"
                  >
                    Giờ vào *
                  </label>
                  {loaiYeuCau === "Quên check-out" ? (
                    <div
                      id="readonly-gio-vao"
                      className="w-full h-[46px] px-4 rounded-[9.6px] border-[1.2px] border-[#7096D1] bg-[#F7F2EB] flex items-center justify-between gap-2 text-sm text-[#334EAC] min-w-0"
                    >
                      <span className="truncate tabular-nums">
                        {selectedItem
                          ? `${selectedItem.ngayHienThi} · ${
                              selectedItem.gioDaCheckIn ||
                              selectedItem.gioBatDau
                            }`
                          : "—"}
                      </span>
                      <CalendarCheckIcon className="w-5 h-5 text-[#334EAC] flex-shrink-0" />
                    </div>
                  ) : (
                    <div
                      className={`w-full h-[46px] px-4 rounded-[9.6px] border-[1.2px] bg-[#FFF9F0] flex items-center gap-1.5 ${
                        fieldErrors.gioVao
                          ? "border-[#C0392B]"
                          : "border-[#7096D1]"
                      }`}
                    >
                      {selectedItem && gioVaoInput.trim() !== "" && (
                        <span className="text-sm text-[#334EAC] whitespace-nowrap select-none">
                          {`${selectedItem.ngayHienThi} ·`}
                        </span>
                      )}
                      <input
                        id="input-gio-vao"
                        type="text"
                        placeholder={PLACEHOLDER.gioVao}
                        disabled={!selectedItem}
                        value={gioVaoInput}
                        onChange={(e) => {
                          setGioVaoInput(e.target.value);
                          setFieldErrors((p) => ({ ...p, gioVao: false }));
                        }}
                        className={`w-full min-w-0 bg-transparent text-sm focus:outline-none tabular-nums ${
                          fieldErrors.gioVao
                            ? "text-[#C0392B] placeholder:text-[#C0392B]"
                            : "text-[#334EAC] placeholder:text-[#334EAC]/50"
                        }`}
                      />
                      <CalendarCheckIcon
                        className={`w-5 h-5 flex-shrink-0 ${
                          fieldErrors.gioVao
                            ? "text-[#C0392B]"
                            : "text-[#334EAC]"
                        }`}
                      />
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <label
                    htmlFor="input-gio-ket-thuc"
                    className="block text-sm sm:text-[15px] font-medium text-[#334EAC] mb-2"
                  >
                    Giờ kết thúc *
                  </label>
                  <div
                    className={`w-full h-[46px] px-4 rounded-[9.6px] border-[1.2px] bg-[#FFF9F0] flex items-center gap-1.5 ${
                      fieldErrors.gioRa
                        ? "border-[#C0392B]"
                        : "border-[#7096D1]"
                    }`}
                  >
                    {selectedItem && gioRaInput.trim() !== "" && (
                      <span className="text-sm text-[#334EAC] whitespace-nowrap select-none">
                        {`${selectedItem.ngayHienThi} ·`}
                      </span>
                    )}
                    <input
                      id="input-gio-ket-thuc"
                      type="text"
                      placeholder={PLACEHOLDER.gioKetThuc}
                      disabled={!selectedItem}
                      value={gioRaInput}
                      onChange={(e) => {
                        setGioRaInput(e.target.value);
                        setFieldErrors((p) => ({ ...p, gioRa: false }));
                      }}
                      className={`w-full min-w-0 bg-transparent text-sm focus:outline-none tabular-nums ${
                        fieldErrors.gioRa
                          ? "text-[#C0392B] placeholder:text-[#C0392B]"
                          : "text-[#334EAC] placeholder:text-[#334EAC]/50"
                      }`}
                    />
                    <CalendarCheckIcon
                      className={`w-5 h-5 flex-shrink-0 ${
                        fieldErrors.gioRa
                          ? "text-[#C0392B]"
                          : "text-[#334EAC]"
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Lý do quên chấm công * */}
              <div>
                <label
                  htmlFor="input-ly-do"
                  className="block text-sm sm:text-[15px] font-medium text-[#334EAC] mb-2"
                >
                  Lý do quên chấm công *
                </label>
                <textarea
                  id="input-ly-do"
                  rows={4}
                  placeholder={PLACEHOLDER.lyDoQuenChamCong}
                  disabled={!selectedItem}
                  maxLength={200}
                  value={lydo}
                  onChange={(e) => {
                    setLydo(e.target.value);
                    setFieldErrors((p) => ({ ...p, lydo: false }));
                  }}
                  className={`w-full rounded-[9.6px] border-[1.2px] bg-[#FFF9F0] px-4 py-3 text-sm focus:outline-none resize-none disabled:opacity-60 ${
                    fieldErrors.lydo
                      ? "border-[#C0392B] placeholder:text-[#C0392B] text-[#334EAC]"
                      : "border-[#7096D1] placeholder:text-[#334EAC]/50 text-[#334EAC]"
                  }`}
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Thanh thao tác dưới */}
      <div className="border-t-[1.2px] border-[#7096D1] pt-4 flex items-center justify-end gap-4">
        <button
          type="button"
          id="btn-huy"
          onClick={handleCancel}
          className="min-w-[116px] h-[44px] px-6 rounded-[9.6px] border-[1.2px] border-[#334EAC] bg-[#FFF9F0] text-[#334EAC] text-sm font-medium hover:bg-[#F7F2EB] transition-colors"
        >
          Hủy
        </button>
        <button
          type="submit"
          id="btn-xac-nhan"
          disabled={!selectedItem || submitting}
          className="min-w-[180px] sm:min-w-[210px] h-[44px] px-6 rounded-[9.6px] bg-[#334EAC] text-[#FFF9F0] text-sm font-medium hover:bg-[#283E8C] transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
        >
          {submitting ? "Đang gửi..." : "Xác nhận"}
        </button>
      </div>
    </form>
  );
}
