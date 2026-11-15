"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { NotificationBanner } from "@frontend/components/ui/NotificationBanner";
import { PageCard } from "@frontend/components/ui/PageCard";
import { SectionTitle } from "@frontend/components/ui/SectionTitle";
import { DetailPanel } from "@frontend/components/ui/DetailPanel";
import { LAYOUT_TOKENS } from "@frontend/config/tokens";
import { XU_LY_DOI_CA_THANH_CONG } from "@frontend/config/thong-bao";
import type { DonDoiCaChuaXuLyItem, NguoiThayItem } from "@backend/services/doi-ca";

function chonNguoiThayMacDinh(
  item: DonDoiCaChuaXuLyItem | null | undefined
): string {
  if (!item || !item.manvnhanthay || !item.nguoiThayHopLe) {
    return "";
  }
  const replacementId = item.manvnhanthay.trim();
  const senderId = item.manv.trim().toUpperCase();
  if (!replacementId || replacementId.toUpperCase() === senderId) {
    return "";
  }
  if (!item.tenNhanVienThay || !item.chucVuNhanVienThay) {
    return "";
  }
  if (item.chucVuNhanVienThay.trim() !== item.chucVuNhanVien.trim()) {
    return "";
  }
  const alreadyInShift = (item.danhSachCaHienTai || []).some(
    (w) => w.manv.trim().toUpperCase() === replacementId.toUpperCase()
  );
  if (alreadyInShift) {
    return "";
  }
  return replacementId;
}

export default function XuLyDoiCaScreen() {
  const router = useRouter();

  const [items, setItems] = useState<DonDoiCaChuaXuLyItem[]>([]);
  const [selectedMadon, setSelectedMadon] = useState<string>("");
  const selectedMadonRef = useRef<string>("");
  selectedMadonRef.current = selectedMadon;
  const [nguoiThayList, setNguoiThayList] = useState<NguoiThayItem[]>([]);
  const [selectedManvThay, setSelectedManvThay] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);
  const [banner, setBanner] = useState<{
    type: "thanh-cong" | "loi";
    message: string;
  } | null>(null);

  // 1. Tải danh sách đơn đổi ca chưa xử lý
  const loadDonDoiCa = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/doi-ca/xu-ly", { cache: "no-store" });
      const json = await res.json();
      if (json.ok && json.data?.items) {
        const list = json.data.items as DonDoiCaChuaXuLyItem[];
        setItems(list);
        if (list.length > 0) {
          const currentId = selectedMadonRef.current;
          const existing = list.find((d) => d.madon === currentId);
          const nextItem = existing || list[0];
          if (!existing) {
            setSelectedMadon(nextItem.madon);
            setSelectedManvThay(chonNguoiThayMacDinh(nextItem));
            setSaved(false);
          } else {
            setSelectedManvThay((prev) => prev || chonNguoiThayMacDinh(existing));
          }
        } else {
          setSelectedMadon("");
          setSelectedManvThay("");
        }
      }
    } catch (err) {
      console.error("Lỗi khi tải đơn đổi ca:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDonDoiCa();
  }, [loadDonDoiCa]);

  // Đơn đang chọn
  const selectedItem = useMemo(
    () => items.find((d) => d.madon === selectedMadon) || null,
    [items, selectedMadon]
  );

  // 2. Tải danh sách nhân viên có lịch rảnh (LichRanh) đúng ngày/ca của đơn đang chọn
  useEffect(() => {
    if (!selectedItem) {
      setNguoiThayList([]);
      setSelectedManvThay("");
      return;
    }

    const currentItem = selectedItem;
    const macDinh = chonNguoiThayMacDinh(currentItem);
    setSelectedManvThay(macDinh);
    if (macDinh && currentItem.tenNhanVienThay) {
      setNguoiThayList([
        {
          manv: macDinh,
          hoten: currentItem.tenNhanVienThay,
          chucvu: currentItem.chucVuNhanVienThay || currentItem.chucVuNhanVien,
          coLichRanh: true,
        },
      ]);
    } else {
      setNguoiThayList([]);
    }

    let cancelled = false;

    async function loadNguoiThay() {
      try {
        const res = await fetch(
          `/api/doi-ca/nguoi-thay?malich=${encodeURIComponent(
            currentItem.malich
          )}&manvGui=${encodeURIComponent(currentItem.manv)}&chiLichRanh=true`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (cancelled) return;

        if (json.ok && json.data?.items) {
          let list = json.data.items as NguoiThayItem[];

          if (macDinh) {
            const alreadyInList = list.some((n) => n.manv === macDinh);
            if (!alreadyInList) {
              list = [
                {
                  manv: macDinh,
                  hoten: currentItem.tenNhanVienThay || macDinh,
                  chucvu:
                    currentItem.chucVuNhanVienThay || currentItem.chucVuNhanVien,
                  coLichRanh: true,
                },
                ...list,
              ];
            }
          }

          setNguoiThayList(list);
          setSelectedManvThay(macDinh);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Lỗi khi tải danh sách người thay ca:", err);
        }
      }
    }

    loadNguoiThay();
    return () => {
      cancelled = true;
    };
  }, [selectedItem]);

  // Khi chọn đơn khác
  const handleSelectDon = (madon: string) => {
    setSelectedMadon(madon);
    const target = items.find((d) => d.madon === madon);
    setSelectedManvThay(chonNguoiThayMacDinh(target));
    setSaved(false);
    setBanner(null);
  };

  // 3. Xử lý khi nhấn nút "Lưu"
  const handleSave = async () => {
    if (!selectedItem || !selectedManvThay) {
      return;
    }

    try {
      setSubmitting(true);
      setBanner(null);

      const payload = {
        Madon: selectedItem.madon,
        Manvnhanthay: selectedManvThay,
      };

      const res = await fetch("/api/doi-ca/xu-ly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        setBanner({
          type: "loi",
          message: json.error?.message || "Xử lý đổi ca thất bại.",
        });
        return;
      }

      setSaved(true);
      setBanner({
        type: "thanh-cong",
        message: XU_LY_DOI_CA_THANH_CONG,
      });

      // Làm mới danh sách đơn
      await loadDonDoiCa();
    } catch (err) {
      console.error("Lỗi khi xử lý đổi ca:", err);
      setBanner({
        type: "loi",
        message: "Đã xảy ra lỗi kết nối, vui lòng thử lại.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Đối tượng người thay hợp lệ đang chọn trên dropdown
  const currentNguoiThayObj = useMemo(() => {
    if (!selectedItem || !selectedManvThay) return null;
    const candidate = nguoiThayList.find((n) => n.manv === selectedManvThay);
    if (!candidate) return null;
    if (candidate.chucvu.trim() !== selectedItem.chucVuNhanVien.trim()) {
      return null;
    }
    const candidateId = candidate.manv.trim().toUpperCase();
    const senderId = selectedItem.manv.trim().toUpperCase();
    const alreadyInShift = (selectedItem.danhSachCaHienTai || []).some(
      (w) => w.manv.trim().toUpperCase() === candidateId
    );
    if (alreadyInShift || candidateId === senderId) {
      return null;
    }
    return candidate;
  }, [nguoiThayList, selectedManvThay, selectedItem]);

  return (
    <div className="relative w-full flex flex-col justify-between min-h-[calc(100dvh-144px)] gap-5 text-[#334eac]">
      <div className="w-full flex flex-col gap-5">
        {/* Banner thông báo */}
        {banner ? (
          <div id="notification-message" className="w-full">
            <NotificationBanner
              type={banner.type}
              message={banner.message}
              onClose={() => setBanner(null)}
              className="!mb-0"
            />
          </div>
        ) : (
          <div className="hidden lg:block h-14" aria-hidden="true" />
        )}

        {/* Khung 2 cột theo chuẩn Figma & U20 */}
        <div className="grid grid-cols-1 lg:grid-cols-[46fr_54fr] gap-6 items-stretch">
          {/* CỘT TRÁI: Yêu cầu chưa xử lý */}
          <PageCard
            id="card-yeu-cau-chua-xu-ly"
            className="min-h-[380px] lg:min-h-[500px]"
          >
            <SectionTitle
              id="title-yeu-cau-chua-xu-ly"
              subtitleId="count-yeu-cau"
              title="Yêu cầu chưa xử lý"
              subtitle={`${items.length} yêu cầu`}
              className={LAYOUT_TOKENS.spaceBlockMb}
            />

            {loading ? (
              <div className="space-y-3 animate-pulse py-4">
                <div className="h-10 bg-[#F7F2EB] rounded" />
                <div className="h-12 bg-[#F7F2EB] rounded" />
                <div className="h-12 bg-[#F7F2EB] rounded" />
              </div>
            ) : items.length === 0 ? (
              <div
                id="empty-don-doi-ca"
                className="flex-1 flex flex-col items-center justify-center text-center py-8 px-4 rounded-xl bg-[#F7F2EB]/60 border border-[#7096D1]/40"
              >
                <p className="text-sm font-medium text-[#334EAC]">
                  Hiện không có yêu cầu đổi ca nào cần xử lý.
                </p>
              </div>
            ) : (
              <>
                {/* Bảng danh sách yêu cầu (cuộn bên trong vùng bảng khi dài) */}
                <div className="border border-[#7096d1] rounded-lg overflow-hidden bg-[#fff9f0]">
                  <div className="grid grid-cols-12 bg-[#f7f2eb] px-4 py-3 text-sm font-semibold border-b border-[#7096d1] text-[#334eac]">
                    <div className="col-span-7">Nhân viên / ca</div>
                    <div className="col-span-5 text-right sm:text-left">
                      Người thay
                    </div>
                  </div>

                  <div
                    id="table-yeu-cau-scroll"
                    className="overflow-y-auto max-h-[220px]"
                  >
                    {items.map((item) => {
                      const isSelected = selectedMadon === item.madon;
                      return (
                        <div
                          key={item.madon}
                          role="button"
                          tabIndex={0}
                          data-testid={`row-don-${item.madon}`}
                          aria-pressed={isSelected}
                          onClick={() => handleSelectDon(item.madon)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleSelectDon(item.madon);
                            }
                          }}
                          className={`grid grid-cols-12 items-center px-4 py-3 text-sm border-b border-[#7096d1] last:border-b-0 cursor-pointer transition-colors focus:outline-none ${
                            isSelected
                              ? "bg-[#b7c9ef] font-medium"
                              : "bg-[#fff9f0] hover:bg-[#f7f2eb]"
                          }`}
                        >
                          <div className="col-span-7">
                            <p className="font-medium text-[#334eac]">
                              {item.tenNhanVien}
                            </p>
                            <p className="text-xs text-[#334eac]/80">
                              {item.ngayLamNgan} {item.tenCa.toLowerCase()}
                            </p>
                          </div>
                          <div className="col-span-5 text-right sm:text-left text-[#334eac]">
                            {item.tenNhanVienThay || (
                              <span className="text-xs text-amber-700 italic">
                                Chưa có
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Đường kẻ và Thông tin chi tiết của đơn đang chọn */}
                {selectedItem && (
                  <div
                    id="block-chi-tiet-don"
                    className="mt-4 pt-4 border-t border-[#7096d1]/40 text-sm space-y-1.5 text-[#334eac]"
                  >
                    <p className="font-semibold text-base">
                      {selectedItem.tenNhanVien}
                    </p>
                    <p className="text-[#334eac]/90">
                      Gửi lúc {selectedItem.thoiGian || "08:20"},{" "}
                      {selectedItem.ngayLamHienThi}
                    </p>
                    <p className="text-[#334eac]/90">
                      Lý do: {selectedItem.lyDo}
                    </p>
                  </div>
                )}
              </>
            )}
          </PageCard>

          {/* CỘT PHẢI: Điều chỉnh chi tiết lịch làm */}
          <PageCard
            id="card-dieu-chinh-lich"
            className="min-h-[380px] lg:min-h-[500px]"
          >
            <SectionTitle
              id="title-dieu-chinh-lich"
              title="Điều chỉnh chi tiết lịch làm"
              className={LAYOUT_TOKENS.spaceBlockMb}
            />

            {selectedItem ? (
              <DetailPanel id="panel-dieu-chinh" className="space-y-4">
                {/* Lưới 4 ô điều chỉnh theo U20 (2x2) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 1. Ngày làm (chỉ xem) */}
                  <div>
                    <label className="block text-sm font-semibold text-[#334eac] mb-1.5">
                      Ngày làm
                    </label>
                    <div
                      id="view-ngay-lam"
                      className="bg-[#f7f2eb] border border-[#7096d1] rounded-[9.6px] px-3.5 py-2.5 flex items-center justify-between text-[#334eac] text-sm"
                    >
                      <span>{selectedItem.ngayLamHienThi}</span>
                      <svg
                        className="w-4 h-4 text-[#334eac] shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* 2. Ca cần đổi (chỉ xem) */}
                  <div>
                    <label className="block text-sm font-semibold text-[#334eac] mb-1.5">
                      Ca cần đổi
                    </label>
                    <div
                      id="view-ca-can-doi"
                      className="bg-[#f7f2eb] border border-[#7096d1] rounded-[9.6px] px-3.5 py-2.5 flex items-center justify-between text-[#334eac] text-sm"
                    >
                      <span>
                        {selectedItem.tenCa} {selectedItem.khungGio}
                      </span>
                      <svg
                        className="w-4 h-4 text-[#334eac] shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* 3. Nhân viên đổi ca (chỉ xem, người gửi đơn) */}
                  <div>
                    <label className="block text-sm font-semibold text-[#334eac] mb-1.5">
                      Nhân viên đổi ca
                    </label>
                    <div
                      id="view-nhan-vien-doi"
                      className="bg-[#f7f2eb] border border-[#7096d1] rounded-[9.6px] px-3.5 py-2.5 flex items-center justify-between text-[#334eac] text-sm"
                    >
                      <span>{selectedItem.tenNhanVien}</span>
                      <svg
                        className="w-4 h-4 text-[#334eac] shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* 4. Người thay ca (dropdown) */}
                  <div>
                    <label
                      htmlFor="select-nguoi-thay-cq"
                      className="block text-sm font-semibold text-[#334eac] mb-1.5"
                    >
                      Người thay ca <span className="text-[#334eac]">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id="select-nguoi-thay-cq"
                        value={selectedManvThay}
                        onChange={(e) => {
                          setSelectedManvThay(e.target.value);
                          setSaved(false);
                        }}
                        className="w-full appearance-none bg-[#fff9f0] border border-[#7096d1] rounded-[9.6px] px-3.5 py-2.5 text-sm text-[#334eac] focus:outline-none focus:ring-1 focus:ring-[#334eac] cursor-pointer"
                      >
                        <option value="">-- Chọn người thay --</option>
                        {nguoiThayList.map((nv) => (
                          <option key={nv.manv} value={nv.manv}>
                            {nv.hoten} ({nv.manv}) – {nv.chucvu}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#334eac]">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bảng XEM TRƯỚC: Lịch [Tên ca] (dd/mm/yyyy) sau khi lưu */}
                <div id="block-preview-lich" className="mt-4 pt-2">
                  <h3
                    id="title-preview-ca"
                    className="text-[#334eac] font-semibold text-base mb-2"
                  >
                    Lịch{" "}
                    {selectedItem.tenCa.toLowerCase().startsWith("ca ")
                      ? selectedItem.tenCa.toLowerCase()
                      : `ca ${selectedItem.tenCa.toLowerCase()}`}{" "}
                    ({selectedItem.ngayLamHienThi}) sau khi lưu
                  </h3>

                  <div className="border border-[#7096d1] rounded-lg overflow-hidden bg-[#fff9f0]">
                    <div
                      className={`grid grid-cols-12 bg-[#f7f2eb] px-4 py-2.5 text-sm font-semibold text-[#334eac] ${
                        currentNguoiThayObj ? "border-b border-[#7096d1]" : ""
                      }`}
                    >
                      <div className="col-span-5">Nhân viên</div>
                      <div className="col-span-3">Vị trí</div>
                      <div className="col-span-4 text-right sm:text-left">
                        Trạng thái
                      </div>
                    </div>

                    <div
                      id="preview-body-nguoi-thay"
                      className="overflow-y-auto max-h-[160px]"
                    >
                      {/* Theo SPEC UC_6.3: chỉ hiện đúng 1 dòng người thay hợp lệ, hoặc trống khi chưa chọn / không hợp lệ */}
                      {currentNguoiThayObj ? (
                        <div
                          id="preview-row-nguoi-thay"
                          className="grid grid-cols-12 px-4 py-2.5 text-sm bg-[#fff9f0] items-center font-medium text-[#334eac]"
                        >
                          <div className="col-span-5 text-[#334eac]">
                            {currentNguoiThayObj.hoten}
                          </div>
                          <div className="col-span-3 text-[#334eac]/80">
                            {currentNguoiThayObj.chucvu}
                          </div>
                          <div className="col-span-4 text-right sm:text-left text-[#334eac] font-semibold">
                            Thay cho {selectedItem.tenNhanVien}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </DetailPanel>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center py-12 text-sm text-[#334eac]">
                Vui lòng chọn một đơn đổi ca ở cột bên trái để điều chỉnh lịch.
              </div>
            )}
          </PageCard>
        </div>
      </div>

      {/* THANH THAO TÁC DƯỚI CÙNG (Hủy / Lưu) */}
      <div className="border-t-[1.2px] border-[#7096d1] pt-4 flex items-center justify-end gap-4">
        <button
          type="button"
          id="btn-huy"
          onClick={() => router.push("/chu-quan")}
          className="min-w-[116px] sm:w-[144px] h-[44px] px-6 rounded-[9.6px] border-[1.2px] border-[#334EAC] bg-[#FFF9F0] text-[#334EAC] text-sm font-medium hover:bg-[#F7F2EB] transition-colors"
        >
          Hủy
        </button>

        <button
          type="button"
          id="btn-luu"
          onClick={handleSave}
          disabled={!selectedItem || !selectedManvThay || !currentNguoiThayObj || submitting || saved}
          className={`min-w-[116px] sm:w-[264px] h-[44px] px-6 rounded-[9.6px] bg-[#334EAC] text-[#FFF9F0] text-sm font-medium transition-colors ${
            !selectedItem || !selectedManvThay || !currentNguoiThayObj || submitting || saved
              ? "opacity-45 cursor-not-allowed"
              : "hover:bg-[#283E8C] cursor-pointer"
          }`}
        >
          {submitting ? "Đang lưu..." : saved ? "Đã lưu" : "Lưu"}
        </button>
      </div>
    </div>
  );
}
