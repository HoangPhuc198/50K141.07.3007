"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@frontend/components/ui/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@frontend/components/ui/DataTable";
import { MonthPicker } from "@frontend/components/ui/MonthPicker";
import { NotificationBanner, type BannerVariant } from "@frontend/components/ui/NotificationBanner";
import { Pagination } from "@frontend/components/ui/Pagination";
import { PLACEHOLDER } from "@frontend/config/placeholder";
import {
  CHINH_SUA_LUONG_CO,
  CHINH_SUA_LUONG_KHONG,
  CHINH_SUA_LUONG_KHONG_DOI,
  CHINH_SUA_LUONG_KHONG_THAY_DOI,
  CHINH_SUA_LUONG_THANH_CONG,
  CHINH_SUA_LUONG_THAT_BAI,
  CHINH_SUA_LUONG_THIEU_LY_DO,
  CHINH_SUA_LUONG_THUONG_KHONG_HOP_LE,
  CHINH_SUA_LUONG_XAC_NHAN_NOI_DUNG,
  CHINH_SUA_LUONG_XAC_NHAN_TIEU_DE,
} from "@frontend/config/thong-bao";
import { formatTien } from "@frontend/lib/dinh-dang";
import type {
  ChiTietSaiSotKyDto,
  KyLuongSummaryItem,
  ShiftEditItem,
  YeuCauSaiSotItem,
} from "@backend/services/chinh-sua-luong";

const SO_DONG_MOI_TRANG = 6;

interface KyOption {
  makyluong: string;
  thang: number;
  nam: number;
  kyLuongHienThi: string;
  trangthai: string;
}

interface CardDraft {
  maphanhoi: string;
  mabangluong: string;
  machamcong: string | null;
  ngaylam: string;
  giovao: string;
  giora: string;
  heso: string;
  tienthuong: string;
  lydochinhsua: string;
  // Giá trị gốc để phát hiện thay đổi
  origGiovao: string;
  origGiora: string;
  origHeso: number;
  origTienthuong: number;
  noEditCleared?: boolean;
}

function LockIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#334EAC"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" />
    </svg>
  );
}

function parseClientDateTime(raw: string): number | null {
  const s = raw.trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*[·\-]?\s*(\d{1,2}):(\d{2})$/.exec(s);
  if (m) {
    const year = parseInt(m[3], 10);
    const month = parseInt(m[2], 10);
    const day = parseInt(m[1], 10);
    const hour = parseInt(m[4], 10);
    const minute = parseInt(m[5], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
    const t = Date.UTC(year, month - 1, day, hour, minute);
    const d = new Date(t);
    if (d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) {
      return null;
    }
    return t;
  }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})[T\s](\d{1,2}):(\d{2})/.exec(s);
  if (m) {
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    const hour = parseInt(m[4], 10);
    const minute = parseInt(m[5], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
    return Date.UTC(year, month - 1, day, hour, minute);
  }
  return null;
}

function buildDraftFromYeuCau(yc: YeuCauSaiSotItem, shift?: ShiftEditItem): CardDraft {
  const ca = shift ?? yc.caMacDinh;
  return {
    maphanhoi: yc.maphanhoi,
    mabangluong: yc.mabangluong,
    machamcong: ca.machamcong,
    ngaylam: ca.ngaylam,
    giovao: ca.giovao,
    giora: ca.giora,
    heso: String(ca.heso),
    tienthuong: String(yc.tienthuong),
    lydochinhsua: yc.lydochinhsua || "",
    origGiovao: ca.giovao,
    origGiora: ca.giora,
    origHeso: ca.heso,
    origTienthuong: yc.tienthuong,
  };
}

function badgeTrangThaiKy(trangthai: string) {
  if (trangthai === "Đã chốt") {
    return (
      <span className="inline-flex items-center justify-center rounded-[8px] border border-[#095D11] bg-[#DAE8DA] px-3 py-1 text-[14px] font-medium text-[#095D11]">
        {trangthai}
      </span>
    );
  }
  if (trangthai === "Dự kiến") {
    return (
      <span className="inline-flex items-center justify-center rounded-[8px] border border-[#334EAC] bg-[#B7C9EF] px-3 py-1 text-[14px] font-medium text-[#334EAC]">
        {trangthai}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center rounded-[8px] border border-[#7096D1] bg-[#F7F2EB] px-3 py-1 text-[14px] font-medium text-[#334EAC]">
      {trangthai}
    </span>
  );
}

export function ChinhSuaBangLuongScreen() {
  // Màn 1: danh sách kỳ lương
  const [filterKy, setFilterKy] = useState("");
  const [filterThangNam, setFilterThangNam] = useState("");
  const [filterTrangThai, setFilterTrangThai] = useState("");
  const [appliedFilter, setAppliedFilter] = useState({
    makyluong: "",
    thangNam: "",
    trangthai: "",
  });
  const [trang, setTrang] = useState(1);
  const [listLoading, setListLoading] = useState(true);
  const [danhSach, setDanhSach] = useState<KyLuongSummaryItem[]>([]);
  const [danhSachKy, setDanhSachKy] = useState<KyOption[]>([]);
  const [tongTrang, setTongTrang] = useState(0);

  // Màn 2: chi tiết sai sót kỳ lương
  const [selectedKyId, setSelectedKyId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<ChiTietSaiSotKyDto | null>(null);
  const [drafts, setDrafts] = useState<Record<string, CardDraft>>({});
  const [clearedCards, setClearedCards] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ type: BannerVariant; message: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingPayloads, setPendingPayloads] = useState<CardDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const taiDanhSachKy = useCallback(
    async (
      pageNum: number,
      filter: { makyluong: string; thangNam: string; trangthai: string }
    ) => {
      setListLoading(true);
      try {
        const qs = new URLSearchParams({
          trang: String(pageNum),
          soDong: String(SO_DONG_MOI_TRANG),
        });
        if (filter.makyluong) qs.set("makyluong", filter.makyluong);
        if (filter.thangNam) qs.set("thangNam", filter.thangNam);
        if (filter.trangthai) qs.set("trangthai", filter.trangthai);

        const res = await fetch(`/api/ky-luong?${qs.toString()}`, {
          credentials: "include",
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          setBanner({
            type: "loi",
            message: json?.error?.message || "Không thể tải danh sách kỳ lương",
          });
          return;
        }
        setDanhSach(json.data.danhSach as KyLuongSummaryItem[]);
        setDanhSachKy(json.data.danhSachKy as KyOption[]);
        setTongTrang(json.data.phanTrang.tongSoTrang as number);
      } catch {
        setBanner({ type: "loi", message: "Không thể kết nối máy chủ" });
      } finally {
        setListLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedKyId) {
      void taiDanhSachKy(trang, appliedFilter);
    }
  }, [selectedKyId, trang, appliedFilter, taiDanhSachKy]);

  const taiChiTietKy = useCallback(async (makyluong: string, preserveCleared?: Record<string, boolean>) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/ky-luong/${encodeURIComponent(makyluong)}/sai-sot`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setBanner({
          type: "loi",
          message: json?.error?.message || CHINH_SUA_LUONG_THAT_BAI,
        });
        return;
      }
      const dto = json.data as ChiTietSaiSotKyDto;
      setDetail(dto);
      const nextDrafts: Record<string, CardDraft> = {};
      for (const yc of dto.danhSachYeuCau) {
        const d = buildDraftFromYeuCau(yc);
        if (preserveCleared?.[yc.maphanhoi]) {
          d.giovao = "";
          d.giora = "";
          d.lydochinhsua = "";
          d.noEditCleared = true;
        }
        nextDrafts[yc.maphanhoi] = d;
      }
      setDrafts(nextDrafts);
    } catch {
      setBanner({ type: "loi", message: CHINH_SUA_LUONG_THAT_BAI });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleOpenDetail = async (makyluong: string) => {
    setBanner(null);
    setFieldErrors({});
    setClearedCards({});
    setSelectedKyId(makyluong);
    await taiChiTietKy(makyluong);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    setTrang(1);
    setAppliedFilter({
      makyluong: filterKy,
      thangNam: filterThangNam.trim(),
      trangthai: filterTrangThai,
    });
  };

  const handleShiftChange = (yc: YeuCauSaiSotItem, machamcongOrDate: string) => {
    const found = yc.danhSachCa.find(
      (c) => (c.machamcong ?? c.ngaylam) === machamcongOrDate
    );
    if (!found) return;
    setDrafts((prev) => ({
      ...prev,
      [yc.maphanhoi]: buildDraftFromYeuCau(yc, found),
    }));
  };

  const updateDraftField = (
    maphanhoi: string,
    field: keyof Pick<CardDraft, "giovao" | "giora" | "heso" | "tienthuong" | "lydochinhsua">,
    value: string
  ) => {
    setDrafts((prev) => {
      const curr = prev[maphanhoi];
      if (!curr) return prev;
      return { ...prev, [maphanhoi]: { ...curr, [field]: value } };
    });
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[`${maphanhoi}.${field}`];
      return next;
    });
  };

  const handleKhongChinhSua = async (yc: YeuCauSaiSotItem) => {
    if (!detail || detail.chiXem || yc.trangthai === "Đã xử lý" || saving) return;
    setSaving(true);
    setBanner(null);
    try {
      const res = await fetch(
        `/api/phan-hoi-luong/${encodeURIComponent(yc.maphanhoi)}/khong-chinh-sua`,
        {
          method: "POST",
          credentials: "include",
        }
      );
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setBanner({
          type: "loi",
          message: json?.error?.message || CHINH_SUA_LUONG_THAT_BAI,
        });
        return;
      }
      const nextCleared = { ...clearedCards, [yc.maphanhoi]: true };
      setClearedCards(nextCleared);
      setBanner({ type: "thanh-cong", message: CHINH_SUA_LUONG_KHONG_DOI });
      await taiChiTietKy(detail.kyLuong.makyluong, nextCleared);
    } catch {
      setBanner({ type: "loi", message: CHINH_SUA_LUONG_THAT_BAI });
    } finally {
      setSaving(false);
    }
  };

  const isDraftChanged = (d: CardDraft): boolean => {
    const hsNum = Number(d.heso.trim().replace(",", "."));
    const thuongTrim = d.tienthuong.trim();
    const thuongNum = /^\d+$/.test(thuongTrim) ? Number(thuongTrim) : NaN;
    return (
      d.giovao.trim() !== d.origGiovao.trim() ||
      d.giora.trim() !== d.origGiora.trim() ||
      hsNum !== d.origHeso ||
      thuongNum !== d.origTienthuong
    );
  };

  const handlePreSaveClick = () => {
    if (!detail || detail.chiXem || saving) return;
    setBanner(null);
    setFieldErrors({});

    const editableRequests = detail.danhSachYeuCau.filter(
      (yc) => yc.trangthai !== "Đã xử lý"
    );
    if (editableRequests.length === 0) return;

    const changedList: CardDraft[] = [];
    const errors: Record<string, string> = {};

    for (const yc of editableRequests) {
      const d = drafts[yc.maphanhoi];
      if (!d) continue;

      const thuongRaw = d.tienthuong.trim();
      if (!/^-?\d+$/.test(thuongRaw) || Number(thuongRaw) < 0) {
        errors[`${yc.maphanhoi}.tienthuong`] = CHINH_SUA_LUONG_THUONG_KHONG_HOP_LE;
        setFieldErrors(errors);
        setBanner({ type: "loi", message: CHINH_SUA_LUONG_THUONG_KHONG_HOP_LE });
        return;
      }

      const hsNum = Number(d.heso.trim().replace(",", "."));
      if (!Number.isFinite(hsNum) || hsNum <= 0) {
        errors[`${yc.maphanhoi}.heso`] = CHINH_SUA_LUONG_THAT_BAI;
        setFieldErrors(errors);
        setBanner({ type: "loi", message: CHINH_SUA_LUONG_THAT_BAI });
        return;
      }

      const tIn = parseClientDateTime(d.giovao);
      const tOut = parseClientDateTime(d.giora);
      if (tIn === null || tOut === null || tOut <= tIn) {
        errors[`${yc.maphanhoi}.giora`] = CHINH_SUA_LUONG_THAT_BAI;
        setFieldErrors(errors);
        setBanner({ type: "loi", message: CHINH_SUA_LUONG_THAT_BAI });
        return;
      }

      if (isDraftChanged(d)) {
        if (!d.lydochinhsua.trim()) {
          errors[`${yc.maphanhoi}.lydochinhsua`] = CHINH_SUA_LUONG_THIEU_LY_DO;
          setFieldErrors(errors);
          setBanner({ type: "loi", message: CHINH_SUA_LUONG_THIEU_LY_DO });
          return;
        }
        changedList.push(d);
      }
    }

    if (changedList.length === 0) {
      setBanner({ type: "loi", message: CHINH_SUA_LUONG_KHONG_THAY_DOI });
      return;
    }

    setPendingPayloads(changedList);
    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    if (!detail || pendingPayloads.length === 0) return;
    setSaving(true);
    try {
      for (const item of pendingPayloads) {
        const res = await fetch(
          `/api/bang-luong/${encodeURIComponent(item.mabangluong)}`,
          {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              maphanhoi: item.maphanhoi,
              machamcong: item.machamcong,
              ngaylam: item.ngaylam,
              giovao: item.giovao.trim(),
              giora: item.giora.trim(),
              heso: Number(item.heso.trim().replace(",", ".")),
              tienthuong: Number(item.tienthuong.trim()),
              lydochinhsua: item.lydochinhsua.trim(),
            }),
          }
        );
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          setConfirmOpen(false);
          setBanner({
            type: "loi",
            message: json?.error?.message || CHINH_SUA_LUONG_THAT_BAI,
          });
          return;
        }
      }
      setConfirmOpen(false);
      setPendingPayloads([]);
      setBanner({ type: "thanh-cong", message: CHINH_SUA_LUONG_THANH_CONG });
      await taiChiTietKy(detail.kyLuong.makyluong, clearedCards);
    } catch {
      setConfirmOpen(false);
      setBanner({ type: "loi", message: CHINH_SUA_LUONG_THAT_BAI });
    } finally {
      setSaving(false);
    }
  };

  const columns: DataTableColumn<KyLuongSummaryItem>[] = useMemo(
    () => [
      {
        key: "kyLuongHienThi",
        header: "Kỳ lương",
        render: (r) => (
          <span className="font-medium text-[#334EAC]">
            Tháng {r.kyLuongHienThi}
          </span>
        ),
      },
      {
        key: "ngayTao",
        header: "Ngày tạo",
        render: (r) => <span className="text-[#334EAC]">{r.ngayTao}</span>,
      },
      {
        key: "tongLuong",
        header: "Tổng lương",
        render: (r) => (
          <span className="font-medium text-[#334EAC]">
            {Math.round(r.tongLuong).toLocaleString("vi-VN")}
          </span>
        ),
      },
      {
        key: "trangthai",
        header: "Trạng thái",
        render: (r) => badgeTrangThaiKy(r.trangthai),
      },
      {
        key: "soPhanHoi",
        header: "Số phản hồi",
        render: (r) => <span className="text-[#334EAC]">{r.soPhanHoi}</span>,
      },
      {
        key: "thaoTac",
        header: "Thao tác",
        render: (r) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void handleOpenDetail(r.makyluong);
            }}
            className="min-h-[36px] min-w-[84px] px-4 rounded-[8px] border border-[#334EAC] bg-[#FFF9F0] text-[#334EAC] text-[15px] font-medium hover:bg-[#F7F2EB] transition-colors"
          >
            Xem
          </button>
        ),
      },
    ],
    []
  );

  // ================= GIAO DIỆN CHI TIẾT KỲ (U26 MÀN 2..5) =================
  if (selectedKyId) {
    const hasPending = Boolean(
      detail?.danhSachYeuCau.some((y) => y.trangthai !== "Đã xử lý")
    );
    const saveDisabled = Boolean(detail?.chiXem) || !hasPending || saving || detailLoading;

    return (
      <div className="space-y-6 pb-8">
        {banner && (
          <NotificationBanner
            type={banner.type}
            message={banner.message}
            onClose={() => setBanner(null)}
          />
        )}

        {detailLoading && !detail ? (
          <div className="bg-[#FFF9F0] border-[1.2px] border-[#7096D1] rounded-[14.4px] p-8 text-[#334EAC] text-[17px]">
            Đang tải chi tiết phản hồi...
          </div>
        ) : detail ? (
          <>
            {detail.chiXem && (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F7F2EB] border-[1.2px] border-[#7096D1] rounded-[12px] px-5 py-3 text-[#334EAC]">
                <span className="font-semibold text-[16px]">
                  Kỳ lương Tháng {detail.kyLuong.kyLuongHienThi} ({detail.kyLuong.trangthai})
                </span>
                <span className="inline-flex items-center rounded-[8px] border border-[#095D11] bg-[#DAE8DA] px-3 py-1 text-[14px] font-medium text-[#095D11]">
                  Đã chốt · Chỉ xem
                </span>
              </div>
            )}

            {detail.danhSachYeuCau.length > 0 ? (
              <div className="space-y-7">
                {detail.danhSachYeuCau.map((yc) => {
                  const draft = drafts[yc.maphanhoi] ?? buildDraftFromYeuCau(yc);
                  const isProcessed = yc.trangthai === "Đã xử lý";
                  const cardReadonly = detail.chiXem || isProcessed || saving;
                  const errGioRa = fieldErrors[`${yc.maphanhoi}.giora`];
                  const errHeSo = fieldErrors[`${yc.maphanhoi}.heso`];
                  const errThuong = fieldErrors[`${yc.maphanhoi}.tienthuong`];
                  const errLyDo = fieldErrors[`${yc.maphanhoi}.lydochinhsua`];

                  return (
                    <div
                      key={yc.maphanhoi}
                      data-testid={`feedback-pair-${yc.maphanhoi}`}
                      className="grid grid-cols-1 xl:grid-cols-[minmax(320px,461px)_minmax(0,1fr)] gap-7 items-start"
                    >
                      {/* Thẻ trái: Thông tin yêu cầu */}
                      <section className="bg-[#FFF9F0] border-[1.2px] border-[#7096D1] rounded-[14.4px] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.2)] p-6 text-[#334EAC] space-y-4">
                        <h3 className="text-[22px] sm:text-[24px] font-semibold">
                          Thông tin yêu cầu
                        </h3>
                        <dl className="space-y-1.5 text-[17px] leading-[28px]">
                          <div className="flex gap-2">
                            <dt className="font-bold min-w-[105px]">Nhân viên:</dt>
                            <dd className="font-normal break-words">{yc.tenNhanVien}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="font-bold min-w-[105px]">Kỳ lương:</dt>
                            <dd className="font-normal">{yc.kyLuongHienThi}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="font-bold min-w-[105px]">Nội dung:</dt>
                            <dd className="font-normal break-words">{yc.noidung}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="font-bold min-w-[105px]">Ngày gửi:</dt>
                            <dd className="font-normal">{yc.ngaygui}</dd>
                          </div>
                        </dl>
                      </section>

                      {/* Thẻ phải: Cập nhật thông tin */}
                      <section className="bg-[#FFF9F0] border-[1.2px] border-[#7096D1] rounded-[14.4px] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.2)] p-6 space-y-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h3 className="text-[22px] sm:text-[24px] font-semibold text-[#334EAC]">
                            Cập nhật thông tin
                          </h3>
                          <div className="flex flex-wrap items-center gap-3">
                            <span
                              className={`inline-flex items-center justify-center rounded-[8px] border px-3 py-1 text-[15px] font-medium ${
                                yc.trangThaiThe === "Đã chỉnh sửa"
                                  ? "border-[#095D11] bg-[#DAE8DA] text-[#095D11]"
                                  : "border-[#334EAC] bg-[#B7C9EF] text-[#334EAC]"
                              }`}
                            >
                              {yc.trangThaiThe}
                            </span>
                            <button
                              type="button"
                              disabled={cardReadonly}
                              onClick={() => void handleKhongChinhSua(yc)}
                              className={`min-h-[46px] px-5 rounded-[9.6px] border-[1.2px] text-[17px] font-bold transition-colors ${
                                cardReadonly
                                  ? "border-[#7096D1] bg-[#7096D1] text-[#FFF9F0] cursor-not-allowed opacity-90"
                                  : "border-[#334EAC] bg-[#334EAC] text-[#FFF9F0] hover:bg-[#273E8C]"
                              }`}
                            >
                              Không chỉnh sửa
                            </button>
                          </div>
                        </div>

                        {yc.danhSachCa.length > 1 && (
                          <div className="flex flex-wrap items-center gap-2 text-[14px] text-[#334EAC]">
                            <label htmlFor={`ca-${yc.maphanhoi}`} className="font-medium">
                              Ca làm cần đối chiếu:
                            </label>
                            <select
                              id={`ca-${yc.maphanhoi}`}
                              disabled={cardReadonly}
                              value={draft.machamcong ?? draft.ngaylam}
                              onChange={(e) => handleShiftChange(yc, e.target.value)}
                              className="rounded-[8px] border border-[#7096D1] bg-[#FFF9F0] px-3 py-1.5 text-[15px] text-[#334EAC]"
                            >
                              {yc.danhSachCa.map((c) => {
                                const val = c.machamcong ?? c.ngaylam;
                                return (
                                  <option key={val} value={val}>
                                    {c.giovao} ({c.tenCa})
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                          <div className="space-y-2">
                            <label
                              htmlFor={`giovao-${yc.maphanhoi}`}
                              className="block text-[17px] sm:text-[18.5px] font-medium text-[#334EAC]"
                            >
                              Giờ vào *
                            </label>
                            <input
                              id={`giovao-${yc.maphanhoi}`}
                              type="text"
                              placeholder={PLACEHOLDER.gioVao}
                              disabled={cardReadonly}
                              value={draft.giovao}
                              onChange={(e) =>
                                updateDraftField(yc.maphanhoi, "giovao", e.target.value)
                              }
                              className={`w-full h-[54px] px-4 rounded-[9.6px] border-[1.2px] text-[16px] text-[#334EAC] placeholder:text-[#7096D1] outline-none ${
                                cardReadonly ? "bg-[#F7F2EB]" : "bg-[#FFF9F0]"
                              } border-[#7096D1] focus:border-[#334EAC]`}
                            />
                          </div>

                          <div className="space-y-2">
                            <label
                              htmlFor={`giora-${yc.maphanhoi}`}
                              className="block text-[17px] sm:text-[18.5px] font-medium text-[#334EAC]"
                            >
                              Giờ ra *
                            </label>
                            <input
                              id={`giora-${yc.maphanhoi}`}
                              type="text"
                              placeholder={PLACEHOLDER.gioRa}
                              disabled={cardReadonly}
                              value={draft.giora}
                              onChange={(e) =>
                                updateDraftField(yc.maphanhoi, "giora", e.target.value)
                              }
                              className={`w-full h-[54px] px-4 rounded-[9.6px] border-[1.2px] text-[16px] text-[#334EAC] placeholder:text-[#7096D1] outline-none ${
                                cardReadonly ? "bg-[#F7F2EB]" : "bg-[#FFF9F0]"
                              } ${errGioRa ? "border-[#C0392B]" : "border-[#7096D1] focus:border-[#334EAC]"}`}
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="block text-[17px] sm:text-[18.5px] font-medium text-[#334EAC]">
                              Lương/giờ
                            </label>
                            <div className="w-full h-[54px] px-4 rounded-[9.6px] border-[1.2px] border-[#7096D1] bg-[#F7F2EB] flex items-center justify-between gap-2 text-[16px] text-[#334EAC]">
                              <span>{formatTien(yc.caMacDinh.mucluong)}</span>
                              <LockIcon />
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_2.15fr] gap-5">
                          <div className="space-y-2">
                            <label
                              htmlFor={`heso-${yc.maphanhoi}`}
                              className="block text-[17px] sm:text-[18.5px] font-medium text-[#334EAC]"
                            >
                              Hệ số
                            </label>
                            <input
                              id={`heso-${yc.maphanhoi}`}
                              type="text"
                              inputMode="decimal"
                              placeholder={PLACEHOLDER.heSo}
                              disabled={cardReadonly}
                              value={draft.heso}
                              onChange={(e) =>
                                updateDraftField(yc.maphanhoi, "heso", e.target.value)
                              }
                              className={`w-full h-[54px] px-4 rounded-[9.6px] border-[1.2px] text-[16px] text-[#334EAC] placeholder:text-[#7096D1] outline-none ${
                                cardReadonly ? "bg-[#F7F2EB]" : "bg-[#FFF9F0]"
                              } ${errHeSo ? "border-[#C0392B]" : "border-[#7096D1] focus:border-[#334EAC]"}`}
                            />
                          </div>

                          <div className="space-y-2">
                            <label
                              htmlFor={`thuong-${yc.maphanhoi}`}
                              className="block text-[17px] sm:text-[18.5px] font-medium text-[#334EAC]"
                            >
                              Thưởng (đ)
                            </label>
                            <input
                              id={`thuong-${yc.maphanhoi}`}
                              type="text"
                              inputMode="numeric"
                              placeholder={PLACEHOLDER.soTienThuong}
                              disabled={cardReadonly}
                              value={draft.tienthuong}
                              onChange={(e) =>
                                updateDraftField(yc.maphanhoi, "tienthuong", e.target.value)
                              }
                              className={`w-full h-[54px] px-4 rounded-[9.6px] border-[1.2px] text-[16px] text-[#334EAC] placeholder:text-[#7096D1] outline-none ${
                                cardReadonly ? "bg-[#F7F2EB]" : "bg-[#FFF9F0]"
                              } ${errThuong ? "border-[#C0392B]" : "border-[#7096D1] focus:border-[#334EAC]"}`}
                            />
                          </div>

                          <div className="space-y-2">
                            <label
                              htmlFor={`lydo-${yc.maphanhoi}`}
                              className="block text-[17px] sm:text-[18.5px] font-medium text-[#334EAC]"
                            >
                              Lý do chỉnh sửa *
                            </label>
                            <input
                              id={`lydo-${yc.maphanhoi}`}
                              type="text"
                              maxLength={200}
                              placeholder={PLACEHOLDER.lyDoChinhSua}
                              disabled={cardReadonly}
                              value={draft.lydochinhsua}
                              onChange={(e) =>
                                updateDraftField(yc.maphanhoi, "lydochinhsua", e.target.value)
                              }
                              className={`w-full h-[54px] px-4 rounded-[9.6px] border-[1.2px] text-[16px] text-[#334EAC] placeholder:text-[#7096D1] outline-none ${
                                cardReadonly ? "bg-[#F7F2EB]" : "bg-[#FFF9F0]"
                              } ${errLyDo ? "border-[#C0392B] placeholder:text-[#C0392B]" : "border-[#7096D1] focus:border-[#334EAC]"}`}
                            />
                          </div>
                        </div>
                      </section>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-[16px] text-[#334EAC] font-medium">
                  Chưa có phản hồi sai sót trong kỳ lương Tháng {detail.kyLuong.kyLuongHienThi}.
                </p>
                <DataTable
                  ariaLabel="Tổng hợp bảng lương kỳ đã chọn"
                  mobileCards
                  maxHeight="max-h-none"
                  keyExtractor={(r) => r.mabangluong}
                  data={detail.bangLuongTongHop}
                  columns={[
                    { key: "tenNhanVien", header: "Nhân viên" },
                    {
                      key: "tonggiolam",
                      header: "Tổng giờ",
                      render: (r) => `${r.tonggiolam} giờ`,
                    },
                    {
                      key: "mucluong",
                      header: "Lương/giờ",
                      render: (r) => formatTien(r.mucluong),
                    },
                    {
                      key: "tienthuong",
                      header: "Thưởng",
                      render: (r) => formatTien(r.tienthuong),
                    },
                    {
                      key: "tongluong",
                      header: "Tổng lương",
                      render: (r) => formatTien(r.tongluong),
                    },
                  ]}
                />
              </div>
            )}
          </>
        ) : null}

        {/* Thanh thao tác dưới cùng */}
        <div className="border-t-[1.2px] border-[#7096D1] pt-5 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-4">
          <button
            type="button"
            onClick={() => {
              setSelectedKyId(null);
              setDetail(null);
              setBanner(null);
              setFieldErrors({});
            }}
            className="min-h-[48px] sm:h-[57.6px] sm:w-[144px] px-6 rounded-[9.6px] border-[1.2px] border-[#334EAC] bg-[#FFF9F0] text-[#334EAC] text-[18px] sm:text-[19.2px] font-medium hover:bg-[#F7F2EB] transition-colors"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={saveDisabled}
            onClick={handlePreSaveClick}
            className={`min-h-[48px] sm:h-[57.6px] sm:w-[264px] px-8 rounded-[9.6px] border-[1.2px] text-[#FFF9F0] text-[18px] sm:text-[19.2px] font-medium transition-colors ${
              saveDisabled
                ? "border-[#7096D1] bg-[#7096D1] cursor-not-allowed"
                : "border-[#334EAC] bg-[#334EAC] hover:bg-[#273E8C]"
            }`}
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>

        <ConfirmDialog
          open={confirmOpen}
          title={CHINH_SUA_LUONG_XAC_NHAN_TIEU_DE}
          message={CHINH_SUA_LUONG_XAC_NHAN_NOI_DUNG}
          cancelLabel={CHINH_SUA_LUONG_KHONG}
          confirmLabel={CHINH_SUA_LUONG_CO}
          busy={saving}
          onCancel={() => {
            setConfirmOpen(false);
            setPendingPayloads([]);
          }}
          onConfirm={() => void handleConfirmSave()}
        />
      </div>
    );
  }

  // ================= GIAO DIỆN DANH SÁCH KỲ LƯƠNG (U26 MÀN 1) =================
  return (
    <div className="space-y-7 pb-8">
      {banner && (
        <NotificationBanner
          type={banner.type}
          message={banner.message}
          onClose={() => setBanner(null)}
        />
      )}

      <form
        onSubmit={handleSearch}
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_240px] gap-5 items-end"
      >
        <div className="space-y-2">
          <label
            htmlFor="filter-ky-luong"
            className="block text-[18px] sm:text-[21px] font-semibold text-[#334EAC]"
          >
            Kỳ lương
          </label>
          <select
            id="filter-ky-luong"
            value={filterKy}
            onChange={(e) => setFilterKy(e.target.value)}
            className="w-full h-[56px] px-4 rounded-[12px] border border-[#334EAC] bg-[#FFF9F0] text-[17px] sm:text-[18px] font-semibold text-[#334EAC] shadow-[0px_4px_8px_rgba(0,0,0,0.08)] outline-none"
          >
            <option value="">Tất cả</option>
            {danhSachKy.map((k) => (
              <option key={k.makyluong} value={k.makyluong}>
                Tháng {k.kyLuongHienThi}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="filter-thang-nam"
            className="block text-[18px] sm:text-[21px] font-semibold text-[#334EAC]"
          >
            Tháng/Năm
          </label>
          <MonthPicker
            id="filter-thang-nam"
            value={filterThangNam}
            onChange={setFilterThangNam}
            allowClear
            calendarButtonAriaLabel="Mở lịch chọn tháng năm"
            inputClassName="h-[56px] rounded-[12px] border border-[#334EAC] text-[17px] sm:text-[18px] font-semibold shadow-[0px_4px_8px_rgba(0,0,0,0.08)]"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="filter-trang-thai"
            className="block text-[18px] sm:text-[21px] font-semibold text-[#334EAC]"
          >
            Trạng thái
          </label>
          <select
            id="filter-trang-thai"
            value={filterTrangThai}
            onChange={(e) => setFilterTrangThai(e.target.value)}
            className="w-full h-[56px] px-4 rounded-[12px] border border-[#334EAC] bg-[#FFF9F0] text-[17px] sm:text-[18px] font-semibold text-[#334EAC] shadow-[0px_4px_8px_rgba(0,0,0,0.08)] outline-none"
          >
            <option value="">Tất cả</option>
            <option value="Dự kiến">Dự kiến</option>
            <option value="Đã chốt">Đã chốt</option>
            <option value="Chưa tính">Chưa tính</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full h-[56px] px-6 rounded-[9.6px] border-[1.2px] border-[#334EAC] bg-[#334EAC] text-[#FFF9F0] text-[18px] font-bold shadow-[0px_4px_16px_0px_rgba(0,0,0,0.16)] hover:bg-[#273E8C] transition-colors"
        >
          Tìm kiếm
        </button>
      </form>

      <div className="space-y-4">
        {listLoading ? (
          <div className="bg-[#FFF9F0] border-[1.2px] border-[#7096D1] rounded-[14.4px] p-8 text-[#334EAC] text-[16px]">
            Đang tải danh sách kỳ lương...
          </div>
        ) : (
          <DataTable
            ariaLabel="Danh sách kỳ lương"
            mobileCards
            maxHeight="max-h-none"
            className="rounded-[14.4px] border-[#334EAC] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.16)]"
            columns={columns}
            data={danhSach}
            keyExtractor={(r) => r.makyluong}
            emptyText="Không có kỳ lương nào phù hợp"
          />
        )}

        <div className="flex justify-end pt-2">
          <Pagination
            trang={trang}
            tongTrang={tongTrang}
            onChange={(t) => setTrang(t)}
          />
        </div>
      </div>
    </div>
  );
}
