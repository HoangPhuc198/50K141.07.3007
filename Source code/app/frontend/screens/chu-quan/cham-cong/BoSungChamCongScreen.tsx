"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NotificationBanner } from "@frontend/components/ui/NotificationBanner";
import {
  BO_SUNG_CC_THANH_CONG,
  BO_SUNG_CC_THIEU_TRUONG,
} from "@frontend/config/thong-bao";
import { PLACEHOLDER } from "@frontend/config/placeholder";
import type { YeuCauBoSungItem } from "@backend/services/bo-sung-cc";
import styles from "./BoSungChamCongScreen.module.css";

const HH_MM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function normalizeHHmm(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  const formatted = `${match[1].padStart(2, "0")}:${match[2]}`;
  return HH_MM_REGEX.test(formatted) ? formatted : "";
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
}

export default function BoSungChamCongScreen() {
  const router = useRouter();
  const [items, setItems] = useState<YeuCauBoSungItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [selectedId, setSelectedId] = useState<string>("");
  const [gioBatDauInput, setGioBatDauInput] = useState<string>("");
  const [gioKetThucInput, setGioKetThucInput] = useState<string>("");

  const [banner, setBanner] = useState<{
    type: "loi" | "thanh-cong";
    message: string;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    gioBatDau?: boolean;
    gioKetThuc?: boolean;
  }>({});

  const applySelection = useCallback((item: YeuCauBoSungItem | null) => {
    if (!item) {
      setSelectedId("");
      setGioBatDauInput("");
      setGioKetThucInput("");
      setFieldErrors({});
      return;
    }
    setSelectedId(item.mayeucau);
    setGioBatDauInput(item.giovaobosung || "");
    setGioKetThucInput(item.giorabosung || "");
    setFieldErrors({});
  }, []);

  const loadList = useCallback(
    async (keepBanner = false) => {
      try {
        const res = await fetch("/api/bo-sung-cc/xu-ly", {
          cache: "no-store",
        });
        const json = await res.json();
        if (json.ok && json.data) {
          const list = (json.data.items || []) as YeuCauBoSungItem[];
          setItems(list);
          if (list.length > 0) {
            applySelection(list[0]);
          } else {
            applySelection(null);
          }
          if (!keepBanner) setBanner(null);
        }
      } catch {
        // giữ nguyên trạng thái khi lỗi mạng tạm thời
      } finally {
        setLoading(false);
      }
    },
    [applySelection]
  );

  useEffect(() => {
    loadList(false);
  }, [loadList]);

  const selectedItem =
    items.find((i) => i.mayeucau === selectedId) ?? null;

  const handleSelectRow = (item: YeuCauBoSungItem) => {
    setBanner(null);
    applySelection(item);
  };

  const handleCancel = () => {
    setBanner(null);
    setFieldErrors({});
    if (selectedItem) {
      applySelection(selectedItem);
    } else {
      router.push("/chu-quan");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !selectedItem) return;

    const cleanGioRa = normalizeHHmm(gioKetThucInput);
    const isQuenCheckIn = selectedItem.loaiYeuCau === "Quên check-in";
    const cleanGioVao = isQuenCheckIn ? normalizeHHmm(gioBatDauInput) : "";

    const nextErrs: { gioBatDau?: boolean; gioKetThuc?: boolean } = {};
    if (isQuenCheckIn && !cleanGioVao) nextErrs.gioBatDau = true;
    if (!cleanGioRa) nextErrs.gioKetThuc = true;

    if (nextErrs.gioBatDau || nextErrs.gioKetThuc) {
      setFieldErrors(nextErrs);
      setBanner(null);
      return;
    }

    const baseCheckIn = isQuenCheckIn
      ? cleanGioVao
      : selectedItem.gioCheckInHienTai || selectedItem.gioBatDauCa;

    if (toMinutes(cleanGioRa) <= toMinutes(baseCheckIn)) {
      setFieldErrors({ gioKetThuc: true });
      setBanner({
        type: "loi",
        message: "Giờ kết thúc ca bổ sung phải sau giờ vào ca của ca làm",
      });
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    setBanner(null);

    try {
      const res = await fetch("/api/bo-sung-cc/xu-ly", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mayeucau: selectedItem.mayeucau,
          giovaobosung: isQuenCheckIn ? cleanGioVao : null,
          giorabosung: cleanGioRa,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setBanner({
          type: "thanh-cong",
          message: BO_SUNG_CC_THANH_CONG,
        });
        await loadList(true);
      } else {
        const errMsg = json.error?.message as string | undefined;
        if (
          json.error?.code === "MISSING_FIELDS" ||
          errMsg === BO_SUNG_CC_THIEU_TRUONG
        ) {
          setFieldErrors({
            gioBatDau: isQuenCheckIn && !cleanGioVao,
            gioKetThuc: !cleanGioRa,
          });
          setBanner(null);
        } else {
          setBanner({
            type: "loi",
            message: errMsg || "Lưu bổ sung thất bại",
          });
        }
      }
    } catch {
      setBanner({ type: "loi", message: "Lỗi kết nối máy chủ" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSave}
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
          <div className="hidden lg:block h-14" aria-hidden="true" />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[46fr_54fr] gap-6 items-stretch">
          {/* Cột trái: Danh sách yêu cầu chưa xử lý */}
          <section className="min-w-0 border-[1.2px] border-[#7096D1] rounded-[14.4px] bg-[#FFF9F0] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.12)] p-5 sm:p-7 flex flex-col min-h-[340px] lg:min-h-[520px]">
            <h2 className="text-lg sm:text-[20px] font-semibold text-[#334EAC] mb-5">
              Danh sách yêu cầu chưa xử lý
            </h2>

            {loading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-11 bg-[#F7F2EB] rounded" />
                <div className="h-12 bg-[#F7F2EB] rounded" />
                <div className="h-12 bg-[#F7F2EB] rounded" />
              </div>
            ) : items.length === 0 ? (
              <div
                id="empty-yeu-cau-bo-sung"
                className="flex-1 flex flex-col items-center justify-center text-center py-8 px-4 rounded-xl bg-[#F7F2EB]/60 border border-[#7096D1]/40"
              >
                <p className="text-sm font-medium text-[#334EAC]">
                  Không có yêu cầu bổ sung chấm công chưa xử lý
                </p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block w-full">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-[#F7F2EB] text-[#334EAC] text-sm font-medium">
                        <th className="px-4 py-3.5 font-medium">Họ và tên</th>
                        <th className="px-4 py-3.5 font-medium">Ngày làm</th>
                        <th className="px-4 py-3.5 font-medium">
                          Lý do chỉnh sửa
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const isSelected = item.mayeucau === selectedId;
                        return (
                          <tr
                            key={item.mayeucau}
                            tabIndex={0}
                            role="button"
                            aria-pressed={isSelected}
                            data-testid={`yeu-cau-row-${item.mayeucau}`}
                            onClick={() => handleSelectRow(item)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleSelectRow(item);
                              }
                            }}
                            className={`border-b border-[#7096D1] text-sm text-[#334EAC] cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#334EAC]/50 ${
                              isSelected
                                ? "bg-[#B7C9EF]"
                                : "bg-[#FFF9F0] hover:bg-[#F7F2EB]"
                            }`}
                          >
                            <td className="px-4 py-3.5">{item.tenNhanVien}</td>
                            <td className="px-4 py-3.5 tabular-nums">
                              {item.ngayHienThi}
                            </td>
                            <td className="px-4 py-3.5">{item.loaiYeuCau}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards (< 768px) */}
                <div className="md:hidden space-y-3">
                  {items.map((item) => {
                    const isSelected = item.mayeucau === selectedId;
                    return (
                      <button
                        key={item.mayeucau}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleSelectRow(item)}
                        className={`w-full text-left p-4 rounded-xl border border-[#7096D1] min-h-[44px] space-y-1.5 text-sm text-[#334EAC] transition-colors ${
                          isSelected ? "bg-[#B7C9EF]" : "bg-[#FFF9F0]"
                        }`}
                      >
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">Họ và tên:</span>
                          <span>{item.tenNhanVien}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">Ngày làm:</span>
                          <span className="tabular-nums">
                            {item.ngayHienThi}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">Lý do chỉnh sửa:</span>
                          <span>{item.loaiYeuCau}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          {/* Cột phải: Chi tiết yêu cầu */}
          <section className="min-w-0 border-[1.2px] border-[#7096D1] rounded-[14.4px] bg-[#FFF9F0] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.12)] p-5 sm:p-7 flex flex-col min-h-[340px] lg:min-h-[520px]">
            <h2 className="text-lg sm:text-[20px] font-semibold text-[#334EAC] mb-5">
              Chi tiết yêu cầu
            </h2>

            {!selectedItem ? (
              <div className="flex-1 flex items-center justify-center text-center py-8 px-4 rounded-xl bg-[#F7F2EB]/60 border border-[#7096D1]/40">
                <p className="text-sm text-[#334EAC]">
                  Chọn một yêu cầu ở danh sách bên trái để xem chi tiết
                </p>
              </div>
            ) : (
              <div className={`${styles.fieldsContainer} space-y-5 flex-1`}>
                {/* Tên nhân viên */}
                <div>
                  <label className="block text-sm sm:text-[15px] font-semibold text-[#334EAC] mb-2">
                    Tên nhân viên
                  </label>
                  <div
                    id="detail-ten-nhan-vien"
                    className="w-full h-[46px] px-4 rounded-[9.6px] border-[1.2px] border-[#7096D1] bg-[#FFF9F0] flex items-center text-sm text-[#334EAC]"
                  >
                    {selectedItem.tenNhanVien}
                  </div>
                </div>

                {/* Hai nhánh: Quên check-out (Ca làm + Giờ kết thúc*) vs Quên check-in (Ca làm full + Giờ bắt đầu* & Giờ kết thúc*) */}
                {selectedItem.loaiYeuCau === "Quên check-out" ? (
                  <div className={styles.checkOutPairGrid}>
                    <div className="min-w-0">
                      <label className="block text-sm sm:text-[15px] font-semibold text-[#334EAC] mb-2">
                        Ca làm
                      </label>
                      <div
                        id="detail-ca-lam"
                        className="w-full h-[46px] px-4 rounded-[9.6px] border-[1.2px] border-[#7096D1] bg-[#FFF9F0] flex items-center text-sm text-[#334EAC]"
                      >
                        {selectedItem.caLam}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <label
                        htmlFor="input-gio-ket-thuc"
                        className="block text-sm sm:text-[15px] font-semibold text-[#334EAC] mb-2"
                      >
                        Giờ kết thúc*
                      </label>
                      <input
                        id="input-gio-ket-thuc"
                        type="text"
                        placeholder={PLACEHOLDER.gioKetThuc}
                        value={gioKetThucInput}
                        onChange={(e) => {
                          setGioKetThucInput(e.target.value);
                          setFieldErrors((p) => ({
                            ...p,
                            gioKetThuc: false,
                          }));
                        }}
                        className={`w-full h-[46px] px-4 rounded-[9.6px] border-[1.2px] bg-[#FFF9F0] text-sm placeholder:text-[#7096D1] tabular-nums focus:outline-none ${
                          fieldErrors.gioKetThuc
                            ? "border-[#C0392B] text-[#C0392B]"
                            : "border-[#7096D1] text-[#334EAC]"
                        }`}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm sm:text-[15px] font-semibold text-[#334EAC] mb-2">
                        Ca làm
                      </label>
                      <div
                        id="detail-ca-lam"
                        className="w-full h-[46px] px-4 rounded-[9.6px] border-[1.2px] border-[#7096D1] bg-[#FFF9F0] flex items-center text-sm text-[#334EAC]"
                      >
                        {selectedItem.caLam}
                      </div>
                    </div>

                    <div className={styles.checkInPairGrid}>
                      <div className="min-w-0">
                        <label
                          htmlFor="input-gio-bat-dau"
                          className="block text-sm sm:text-[15px] font-semibold text-[#334EAC] mb-2"
                        >
                          Giờ bắt đầu*
                        </label>
                        <input
                          id="input-gio-bat-dau"
                          type="text"
                          placeholder={PLACEHOLDER.gioBatDau}
                          value={gioBatDauInput}
                          onChange={(e) => {
                            setGioBatDauInput(e.target.value);
                            setFieldErrors((p) => ({
                              ...p,
                              gioBatDau: false,
                            }));
                          }}
                          className={`w-full h-[46px] px-4 rounded-[9.6px] border-[1.2px] bg-[#FFF9F0] text-sm placeholder:text-[#7096D1] tabular-nums focus:outline-none ${
                            fieldErrors.gioBatDau
                              ? "border-[#C0392B] text-[#C0392B]"
                              : "border-[#7096D1] text-[#334EAC]"
                          }`}
                        />
                      </div>

                      <div className="min-w-0">
                        <label
                          htmlFor="input-gio-ket-thuc"
                          className="block text-sm sm:text-[15px] font-semibold text-[#334EAC] mb-2"
                        >
                          Giờ kết thúc*
                        </label>
                        <input
                          id="input-gio-ket-thuc"
                          type="text"
                          placeholder={PLACEHOLDER.gioKetThuc}
                          value={gioKetThucInput}
                          onChange={(e) => {
                            setGioKetThucInput(e.target.value);
                            setFieldErrors((p) => ({
                              ...p,
                              gioKetThuc: false,
                            }));
                          }}
                          className={`w-full h-[46px] px-4 rounded-[9.6px] border-[1.2px] bg-[#FFF9F0] text-sm placeholder:text-[#7096D1] tabular-nums focus:outline-none ${
                            fieldErrors.gioKetThuc
                              ? "border-[#C0392B] text-[#C0392B]"
                              : "border-[#7096D1] text-[#334EAC]"
                          }`}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Lý do */}
                <div>
                  <label className="block text-sm sm:text-[15px] font-semibold text-[#334EAC] mb-2">
                    Lý do
                  </label>
                  <div
                    id="detail-ly-do"
                    className="w-full min-h-[46px] px-4 py-3 rounded-[9.6px] border-[1.2px] border-[#7096D1] bg-[#FFF9F0] text-sm text-[#334EAC] break-words"
                  >
                    {selectedItem.lydo}
                  </div>
                </div>
              </div>
            )}
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
          id="btn-luu"
          disabled={!selectedItem || submitting}
          className="min-w-[116px] h-[44px] px-6 rounded-[9.6px] bg-[#334EAC] text-[#FFF9F0] text-sm font-medium hover:bg-[#283E8C] transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
        >
          {submitting ? "Đang lưu..." : "Lưu"}
        </button>
      </div>
    </form>
  );
}
