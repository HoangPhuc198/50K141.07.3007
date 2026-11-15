"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NotificationBanner } from "@frontend/components/ui/NotificationBanner";
import { PageCard } from "@frontend/components/ui/PageCard";
import { SectionTitle } from "@frontend/components/ui/SectionTitle";
import { THAY_CA_DA_CO_NV_DONG_Y } from "@frontend/config/thong-bao";
import { PLACEHOLDER } from "@frontend/config/placeholder";
import type {
  CaTrongNgayThayCaResponse,
  NguoiDuocMoiItem,
  ThayCaPublicItem,
} from "@backend/services/thay-ca";

const POLL_INTERVAL_MS = 6000;

function TrangThaiMoiBadge({ trangThai }: { trangThai: NguoiDuocMoiItem["trangThai"] }) {
  if (trangThai === "Đã nhận ca") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#587554]/50 bg-[#EDF3EB] px-3 py-1 text-xs font-medium text-[#587554]">
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
        </svg>
        <span>Đã nhận ca</span>
      </span>
    );
  }

  if (trangThai === "Đã từ chối") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C0392B]/40 bg-[#FDEDEC] px-3 py-1 text-xs font-medium text-[#C0392B]">
        <span>Đã từ chối</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7096D1]/50 bg-[#F7F2EB] px-3 py-1 text-xs font-medium text-[#334EAC]">
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>Chờ phản hồi</span>
    </span>
  );
}

export default function ThayCaScreen() {
  const router = useRouter();

  const [caData, setCaData] = useState<CaTrongNgayThayCaResponse | null>(null);
  const [selectedMalich, setSelectedMalich] = useState<string>("");
  const [lyDo, setLyDo] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string>("");

  const loadCaTrongNgay = useCallback(async (isInitial = false) => {
    try {
      const res = await fetch("/api/thay-ca/ca-trong-ngay", { cache: "no-store" });
      if (!res.ok) {
        if (isInitial) {
          const errJson = await res.json().catch(() => null);
          const errMsg =
            errJson?.error?.message ||
            (typeof errJson?.error === "string" ? errJson.error : null) ||
            "Không thể tải danh sách ca làm trong ngày.";
          setErrorBanner(errMsg);
        }
        return;
      }
      const json = await res.json();
      if (json?.ok && json.data) {
        const nextData: CaTrongNgayThayCaResponse = json.data;
        setCaData(nextData);
        setSelectedMalich((prev) => {
          if (prev && nextData.danhSachCa.some((c) => c.malich === prev)) {
            return prev;
          }
          return nextData.danhSachCa[0]?.malich || "";
        });
      }
    } catch {
      if (isInitial) {
        setErrorBanner("Không thể kết nối máy chủ.");
      }
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  const applyMyRequestsFromPoll = useCallback((myReqs: ThayCaPublicItem[]) => {
    if (!Array.isArray(myReqs) || myReqs.length === 0) return;

    setCaData((prev) => {
      if (!prev) return prev;
      let changed = false;
      const nextList = prev.danhSachCa.map((ca) => {
        const matched = myReqs.find((r) => r.malich === ca.malich);
        if (!matched) return ca;
        changed = true;
        return {
          ...ca,
          daGuiYeuCau: true,
          yeuCauHienTai: matched,
          nhanViensRanh: matched.nguoiDuocMoi,
        };
      });
      return changed ? { ...prev, danhSachCa: nextList } : prev;
    });
  }, []);

  useEffect(() => {
    loadCaTrongNgay(true);
  }, [loadCaTrongNgay]);

  // Lắng nghe sự kiện polling duy nhất từ AppShell (layout của nhân viên) để cập nhật trạng thái
  useEffect(() => {
    const handlePollEvent = (e: Event) => {
      const custom = e as CustomEvent<{ yeuCauCuaToi?: ThayCaPublicItem[] }>;
      if (Array.isArray(custom.detail?.yeuCauCuaToi)) {
        applyMyRequestsFromPoll(custom.detail.yeuCauCuaToi);
      }
    };

    const handleCustomUpdate = () => {
      loadCaTrongNgay(false);
    };

    window.addEventListener("thanhha:thay-ca-poll", handlePollEvent);
    window.addEventListener("thanhha:thay-ca-updated", handleCustomUpdate);

    return () => {
      window.removeEventListener("thanhha:thay-ca-poll", handlePollEvent);
      window.removeEventListener("thanhha:thay-ca-updated", handleCustomUpdate);
    };
  }, [applyMyRequestsFromPoll, loadCaTrongNgay]);

  const selectedCa = useMemo(() => {
    if (!caData) return null;
    return (
      caData.danhSachCa.find((c) => c.malich === selectedMalich) ||
      caData.danhSachCa[0] ||
      null
    );
  }, [caData, selectedMalich]);

  useEffect(() => {
    if (selectedCa?.yeuCauHienTai?.lyDo !== undefined && selectedCa.daGuiYeuCau) {
      setLyDo(selectedCa.yeuCauHienTai.lyDo);
    }
  }, [selectedCa?.malich, selectedCa?.daGuiYeuCau, selectedCa?.yeuCauHienTai?.lyDo]);

  const yeuCauHienTai = selectedCa?.yeuCauHienTai || null;
  const daCoNguoiNhan = yeuCauHienTai?.trangThai === "Đã nhận";
  const daGuiYeuCau = Boolean(selectedCa?.daGuiYeuCau);
  const danhSachNguoiRanh = selectedCa?.nhanViensRanh || [];

  const handleSubmit = async () => {
    if (!selectedCa || submitting || daGuiYeuCau) return;
    setErrorBanner("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/thay-ca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          malich: selectedCa.malich,
          lyDo: lyDo.trim(),
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        const errMsg =
          json?.error?.message ||
          (typeof json?.error === "string" ? json.error : null) ||
          "Không thể gửi yêu cầu thay ca.";
        setErrorBanner(errMsg);
        return;
      }

      await loadCaTrongNgay(false);
      window.dispatchEvent(new CustomEvent("thanhha:thay-ca-updated"));
    } catch {
      setErrorBanner("Không thể kết nối máy chủ.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {errorBanner && (
        <NotificationBanner
          type="loi"
          message={errorBanner}
          onClose={() => setErrorBanner("")}
        />
      )}

      {daCoNguoiNhan && (
        <NotificationBanner
          type="thanh-cong"
          message={THAY_CA_DA_CO_NV_DONG_Y}
        />
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.85fr)] gap-6">
          <PageCard variant="primary" className="min-h-[340px] justify-center items-center">
            <p className="text-sm text-[#7096D1]">Đang tải danh sách ca làm hôm nay...</p>
          </PageCard>
          <PageCard variant="primary" className="min-h-[340px] justify-center items-center">
            <p className="text-sm text-[#7096D1]">Đang tìm nhân viên có lịch rảnh...</p>
          </PageCard>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.85fr)] gap-6 items-stretch">
          {/* CỘT TRÁI: Chọn ca nghỉ gấp */}
          <PageCard variant="primary" id="card-chon-ca-nghi-gap" className="gap-4">
            <SectionTitle
              id="title-chon-ca-nghi-gap"
              title={daCoNguoiNhan ? "Chọn ca cần nghỉ gấp" : "Chọn ca nghỉ gấp"}
            />

            <div className="space-y-4">
              <p
                id="thay-ca-ngay-hom-nay"
                className="text-sm sm:text-base font-medium text-[#334EAC]"
              >
                {caData?.ngayDai || "Hôm nay"}
              </p>

              {caData && caData.danhSachCa.length > 0 ? (
                <>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="thay-ca-select-shift"
                      className="block text-sm font-medium text-[#334EAC]"
                    >
                      Ca làm cần nghỉ
                    </label>
                    <select
                      id="thay-ca-select-shift"
                      value={selectedCa?.malich || ""}
                      onChange={(e) => {
                        setSelectedMalich(e.target.value);
                        setErrorBanner("");
                      }}
                      className="w-full h-[44px] px-3.5 rounded-[9.6px] border-[1.2px] border-[#7096D1] bg-[#F7F2EB] text-[#334EAC] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#334EAC]"
                    >
                      {caData.danhSachCa.map((ca) => (
                        <option key={ca.malich} value={ca.malich}>
                          {ca.nhanOptionLabel}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="thay-ca-ly-do"
                      className="block text-sm font-medium text-[#334EAC]"
                    >
                      Lý do xin nghỉ
                    </label>
                    <textarea
                      id="thay-ca-ly-do"
                      rows={4}
                      maxLength={200}
                      placeholder={PLACEHOLDER.lyDoXinNghi}
                      value={lyDo}
                      onChange={(e) => setLyDo(e.target.value)}
                      disabled={daGuiYeuCau}
                      className="w-full rounded-[9.6px] border-[1.2px] border-[#7096D1] bg-[#FFF9F0] p-3 text-sm text-[#334EAC] placeholder:text-[#7096D1]/80 focus:outline-none focus:ring-2 focus:ring-[#334EAC] disabled:bg-[#F7F2EB] disabled:opacity-80"
                    />
                  </div>
                </>
              ) : (
                <div className="rounded-[9.6px] border border-[#7096D1]/40 bg-[#F7F2EB] p-4 text-sm text-[#334EAC]">
                  Hôm nay bạn không có ca làm sắp diễn ra để báo nghỉ gấp.
                </div>
              )}
            </div>
          </PageCard>

          {/* CỘT PHẢI: Người có lịch rảnh trong ngày */}
          <PageCard variant="primary" id="card-nguoi-ranh" className="gap-4 min-w-0">
            <div className="space-y-1">
              <SectionTitle
                id="title-nguoi-ranh"
                title="Người có lịch rảnh trong ngày"
              />
              {daGuiYeuCau && (
                <p className="text-xs sm:text-sm text-[#7096D1]">
                  Hệ thống tìm người đã đăng ký rảnh trong ngày để gửi lời mời thay ca.
                </p>
              )}
            </div>

            {!selectedCa ? (
              <div className="flex-1 flex items-center justify-center rounded-[9.6px] border border-dashed border-[#7096D1]/50 p-6 text-sm text-[#7096D1]">
                Chưa có ca làm được chọn.
              </div>
            ) : danhSachNguoiRanh.length === 0 ? (
              <div className="rounded-[9.6px] border border-[#D35400]/50 bg-[#FEF9E7] p-4 text-sm text-[#D35400]">
                Hiện chưa có nhân viên nào đăng ký lịch rảnh cho ca {selectedCa.loaica.toLowerCase()} (
                {selectedCa.khungGio}). Nếu bạn gửi yêu cầu, hệ thống sẽ gửi cảnh báo gấp cho Chủ quán.
              </div>
            ) : (
              <>
                {/* Bảng trên tablet/desktop */}
                <div className="hidden md:block overflow-hidden rounded-[9.6px] border border-[#7096D1]/50">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F7F2EB] text-[#334EAC] text-sm font-semibold border-b border-[#7096D1]/40">
                        <th className="py-3 px-4">Nhân viên</th>
                        <th className="py-3 px-4">Lịch rảnh</th>
                        <th className="py-3 px-4">Trạng thái lời mời</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#7096D1]/25 text-sm text-[#334EAC]">
                      {danhSachNguoiRanh.map((nv) => (
                        <tr key={nv.manv} className="hover:bg-[#F7F2EB]/40 transition-colors">
                          <td className="py-3.5 px-4 font-medium">
                            {nv.hoten} · {nv.manv}
                          </td>
                          <td className="py-3.5 px-4 tabular-nums">{nv.lichRanh}</td>
                          <td className="py-3.5 px-4">
                            <TrangThaiMoiBadge trangThai={nv.trangThai} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Dạng thẻ dọc trên mobile < 768px */}
                <div className="md:hidden space-y-3">
                  {danhSachNguoiRanh.map((nv) => (
                    <div
                      key={nv.manv}
                      className="rounded-[9.6px] border border-[#7096D1]/50 bg-[#F7F2EB]/50 p-3.5 space-y-2 text-sm text-[#334EAC]"
                    >
                      <div className="font-semibold">
                        {nv.hoten} · {nv.manv}
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-[#7096D1]">Lịch rảnh: {nv.lichRanh}</span>
                        <TrangThaiMoiBadge trangThai={nv.trangThai} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {daGuiYeuCau && yeuCauHienTai && !daCoNguoiNhan && (
              <p className="text-xs text-[#7096D1] mt-auto pt-2">
                Đã gửi lời mời thay ca · Tự động cập nhật trạng thái mỗi 6 giây.
                {yeuCauHienTai.satGio
                  ? " Lưu ý: Ca làm sắp bắt đầu (≤30 phút), đã gửi cảnh báo gấp cho Chủ quán."
                  : ""}
              </p>
            )}
          </PageCard>
        </div>
      )}

      {/* THANH THAO TÁC DƯỚI CÙNG */}
      <div className="border-t-[1.2px] border-[#7096D1] pt-4 flex items-center justify-end gap-4">
        {daGuiYeuCau ? (
          <button
            type="button"
            id="btn-quay-lai-thay-ca"
            onClick={() => router.push("/nhan-vien")}
            className="min-w-[128px] h-[44px] px-6 rounded-[9.6px] border-[1.2px] border-[#334EAC] bg-[#FFF9F0] text-[#334EAC] text-sm font-medium hover:bg-[#F7F2EB] transition-colors cursor-pointer"
          >
            Quay lại
          </button>
        ) : (
          <>
            <button
              type="button"
              id="btn-huy-thay-ca"
              onClick={() => router.push("/nhan-vien")}
              className="min-w-[116px] sm:w-[144px] h-[44px] px-6 rounded-[9.6px] border-[1.2px] border-[#334EAC] bg-[#FFF9F0] text-[#334EAC] text-sm font-medium hover:bg-[#F7F2EB] transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              id="btn-gui-thay-ca"
              onClick={handleSubmit}
              disabled={submitting || loading || !selectedCa}
              className={`min-w-[116px] sm:w-[264px] h-[44px] px-6 rounded-[9.6px] bg-[#334EAC] text-[#FFF9F0] text-sm font-medium transition-colors ${
                submitting || loading || !selectedCa
                  ? "opacity-45 cursor-not-allowed"
                  : "hover:bg-[#283E8C] cursor-pointer"
              }`}
            >
              {submitting ? "Đang gửi..." : "Gửi"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
