"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { NotificationBanner } from "@frontend/components/ui/NotificationBanner";
import { ChonKhoi, DauTich } from "@frontend/components/ui/ChonKhoi";
import { RadioChipGroup, RadioChip } from "@frontend/components/ui/RadioChip";
import { PageCard } from "@frontend/components/ui/PageCard";
import { SectionTitle } from "@frontend/components/ui/SectionTitle";
import { LAYOUT_TOKENS } from "@frontend/config/tokens";
import { YEU_CAU_DOI_CA_THANH_CONG } from "@frontend/config/thong-bao";
import type { CaCuaToiItem, NguoiThayItem } from "@backend/services/doi-ca";

export default function YeuCauDoiCaScreen() {
  const router = useRouter();

  const [caLams, setCaLams] = useState<CaCuaToiItem[]>([]);
  const [selectedMalich, setSelectedMalich] = useState<string>("");
  const [nguoiThayList, setNguoiThayList] = useState<NguoiThayItem[]>([]);
  const [selectedManvThay, setSelectedManvThay] = useState<string>("");
  const [khongCoNguoiThay, setKhongCoNguoiThay] = useState<boolean>(false);

  const [currentUser, setCurrentUser] = useState<{
    userId: string;
    name: string;
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [banner, setBanner] = useState<{
    type: "thanh-cong" | "loi";
    message: string;
  } | null>(null);

  // 1. Tải thông tin người dùng hiện tại
  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/auth/me");
        const json = await res.json();
        if (json.ok && json.data?.user) {
          setCurrentUser(json.data.user);
        }
      } catch (err) {
        console.error("Lỗi tải thông tin user:", err);
      }
    }
    loadUser();
  }, []);

  // 2. Tải danh sách ca của tôi (chỉ ca chưa bắt đầu)
  const loadCaCuaToi = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/doi-ca/ca-cua-toi", { cache: "no-store" });
      const json = await res.json();
      if (json.ok && json.data?.items) {
        const items = json.data.items as CaCuaToiItem[];
        setCaLams(items);
        if (items.length > 0 && !selectedMalich) {
          const available = items.find((i) => !i.daGuiYeuCau) || items[0];
          setSelectedMalich(available.malich);
        }
      }
    } catch (err) {
      console.error("Lỗi khi tải ca làm:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedMalich]);

  useEffect(() => {
    loadCaCuaToi();
  }, [loadCaCuaToi]);

  // 3. Khi đổi ca làm, tải danh sách người thay phù hợp
  useEffect(() => {
    if (!selectedMalich) {
      setNguoiThayList([]);
      return;
    }

    async function loadNguoiThay() {
      try {
        const res = await fetch(
          `/api/doi-ca/nguoi-thay?malich=${encodeURIComponent(selectedMalich)}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (json.ok && json.data?.items) {
          const list = json.data.items as NguoiThayItem[];
          setNguoiThayList(list);
          if (list.length > 0 && !khongCoNguoiThay) {
            if (
              !selectedManvThay ||
              !list.some((x) => x.manv === selectedManvThay)
            ) {
              setSelectedManvThay(list[0].manv);
            }
          }
        }
      } catch (err) {
        console.error("Lỗi tải người thay:", err);
      }
    }

    loadNguoiThay();
  }, [selectedMalich, khongCoNguoiThay, selectedManvThay]);

  // Thông tin ca đang chọn
  const selectedCa = useMemo(
    () => caLams.find((c) => c.malich === selectedMalich) || null,
    [caLams, selectedMalich]
  );

  const selectedNguoiThayObj = useMemo(
    () => nguoiThayList.find((n) => n.manv === selectedManvThay) || null,
    [nguoiThayList, selectedManvThay]
  );

  // Xử lý khi bấm nút Gửi
  const handleSubmit = async () => {
    if (!selectedMalich) {
      setBanner({
        type: "loi",
        message: "Vui lòng chọn một ca làm cần đổi.",
      });
      return;
    }

    if (!khongCoNguoiThay && !selectedManvThay) {
      setBanner({
        type: "loi",
        message:
          "Vui lòng chọn nhân viên làm thay hoặc tích chọn 'Không có người thay thế'.",
      });
      return;
    }

    try {
      setSubmitting(true);
      setBanner(null);

      const payload = {
        Malich: selectedMalich,
        Manvnhanthay: khongCoNguoiThay ? null : selectedManvThay,
        khongCoNguoiThay,
      };

      const res = await fetch("/api/doi-ca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        setBanner({
          type: "loi",
          message: json.error?.message || "Gửi yêu cầu đổi ca thất bại.",
        });
        return;
      }

      setSubmitted(true);
      setBanner({
        type: "thanh-cong",
        message: YEU_CAU_DOI_CA_THANH_CONG,
      });

      // Làm mới danh sách ca
      await loadCaCuaToi();
    } catch (err) {
      console.error("Lỗi khi gửi yêu cầu đổi ca:", err);
      setBanner({
        type: "loi",
        message: "Đã xảy ra lỗi kết nối, vui lòng thử lại.",
      });
    } finally {
      setSubmitting(false);
    }
  };

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

        {/* Khung 2 cột theo chuẩn Figma & UC_2.2 */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 items-stretch">
          {/* CỘT TRÁI: Danh sách ca làm & chọn người thay */}
          <PageCard
            id="card-danh-sach-ca"
            className="min-h-[380px] lg:min-h-[500px]"
          >
            <SectionTitle
              id="title-danh-sach-ca"
              title="Danh sách ca làm"
              className={LAYOUT_TOKENS.spaceBlockMb}
            />

            {loading ? (
              <div className="space-y-3 animate-pulse py-4">
                <div className="h-10 bg-[#F7F2EB] rounded" />
                <div className="h-12 bg-[#F7F2EB] rounded" />
                <div className="h-12 bg-[#F7F2EB] rounded" />
              </div>
            ) : caLams.length === 0 ? (
              <div
                id="empty-ca-lam"
                className="flex-1 flex flex-col items-center justify-center text-center py-8 px-4 rounded-xl bg-[#F7F2EB]/60 border border-[#7096D1]/40"
              >
                <p className="text-sm font-medium text-[#334EAC]">
                  Bạn không có ca làm nào sắp tới để đổi ca.
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <RadioChipGroup
                    value={selectedMalich}
                    onChange={(nextVal) => {
                      setSelectedMalich(nextVal);
                      setSubmitted(false);
                    }}
                    ariaLabel="Danh sách ca làm cần đổi"
                    className="space-y-0 border border-[#7096d1] rounded-lg overflow-hidden"
                  >
                    {/* Tiêu đề bảng */}
                    <div className="hidden sm:grid grid-cols-12 bg-[#f7f2eb] px-4 py-2.5 items-center text-sm font-semibold border-b border-[#7096d1] text-[#334eac]">
                      <div className="col-span-2 text-left pl-1">Chọn</div>
                      <div className="col-span-3">Ngày làm</div>
                      <div className="col-span-4">Ca / khung giờ</div>
                      <div className="col-span-3 text-right">Vị trí</div>
                    </div>

                    {/* Vùng cuộn bên trong danh sách ca */}
                    <div
                      id="table-ca-lam-scroll"
                      className="overflow-y-auto max-h-[220px]"
                    >
                      {caLams.map((ca) => {
                        const isSelected = selectedMalich === ca.malich;
                        return (
                          <RadioChip
                            key={ca.malich}
                            value={ca.malich}
                            ariaLabel={`${ca.thu}, ${ca.ngayHienThi}, ${ca.khungGio}`}
                            disabled={ca.daGuiYeuCau}
                            className={(checked) =>
                              `w-full text-left transition-colors border-b border-[#7096d1] last:border-b-0 ${
                                checked
                                  ? "bg-[#7096d1] text-[#fff9f0]"
                                  : "bg-[#fff9f0] hover:bg-[#f7f2eb] text-[#334eac]"
                              } ${
                                ca.daGuiYeuCau
                                  ? "opacity-60 cursor-not-allowed"
                                  : ""
                              }`
                            }
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-12 items-center px-4 py-2.5 text-sm">
                              {/* Cột radio */}
                              <div className="sm:col-span-2 flex items-center justify-start gap-2 mb-1 sm:mb-0 pl-1">
                                <span className="text-base select-none">
                                  {isSelected ? "◉" : "○"}
                                </span>
                                <span className="sm:hidden font-medium">
                                  Chọn
                                </span>
                              </div>

                              {/* Ngày làm */}
                              <div className="sm:col-span-3 font-medium">
                                {ca.ngayHienThi}
                              </div>

                              {/* Ca / khung giờ */}
                              <div className="sm:col-span-4">
                                {ca.khungGio}
                                {ca.daGuiYeuCau && (
                                  <span className="ml-2 text-xs text-[#c0392b] block sm:inline">
                                    (Đã gửi đơn)
                                  </span>
                                )}
                              </div>

                              {/* Vị trí */}
                              <div className="sm:col-span-3 sm:text-right font-medium">
                                {ca.viTri}
                              </div>
                            </div>
                          </RadioChip>
                        );
                      })}
                    </div>
                  </RadioChipGroup>
                </div>

                {/* Chọn người thay thế */}
                <div className="mt-4 pt-4 border-t border-[#7096d1]/40 space-y-3">
                  <div>
                    <label
                      htmlFor="select-nguoi-thay"
                      className="block text-sm font-semibold text-[#334eac] mb-1.5"
                    >
                      Nhân viên làm thay
                    </label>
                    <div className="relative">
                      <select
                        id="select-nguoi-thay"
                        value={khongCoNguoiThay ? "" : selectedManvThay}
                        disabled={khongCoNguoiThay}
                        onChange={(e) => {
                          setSelectedManvThay(e.target.value);
                          setKhongCoNguoiThay(false);
                          setSubmitted(false);
                        }}
                        className={`w-full h-[44px] px-3.5 rounded-[9.6px] border border-[#7096d1] bg-[#fff9f0] text-[#334eac] text-sm focus:outline-none transition ${
                          khongCoNguoiThay
                            ? "opacity-65 cursor-not-allowed bg-slate-50"
                            : "cursor-pointer"
                        }`}
                      >
                        {khongCoNguoiThay ? (
                          <option value="">Không có người thay thế</option>
                        ) : nguoiThayList.length === 0 ? (
                          <option value="">Không có nhân viên khả dụng</option>
                        ) : (
                          nguoiThayList.map((nv) => (
                            <option key={nv.manv} value={nv.manv}>
                              {nv.hoten} ({nv.manv}) – {nv.chucvu}
                              {nv.coLichRanh ? " [Có lịch rảnh]" : ""}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Ô chọn "Không có người thay thế" */}
                  <ChonKhoi
                    type="checkbox"
                    checked={khongCoNguoiThay}
                    ariaLabel="Không có người thay thế"
                    onChange={() => {
                      const nextVal = !khongCoNguoiThay;
                      setKhongCoNguoiThay(nextVal);
                      if (nextVal) {
                        setSelectedManvThay("");
                      } else if (nguoiThayList.length > 0) {
                        setSelectedManvThay(nguoiThayList[0].manv);
                      }
                      setSubmitted(false);
                    }}
                    className="inline-flex items-center gap-3 cursor-pointer select-none py-1 min-h-[44px]"
                  >
                    <div
                      className={`w-5 h-5 rounded-[4.8px] border-[1.2px] flex items-center justify-center transition-colors ${
                        khongCoNguoiThay
                          ? "bg-[#334eac] border-[#334eac] text-white"
                          : "bg-[#fff9f0] border-[#334eac]"
                      }`}
                    >
                      {khongCoNguoiThay && <DauTich className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-[#334eac] text-sm font-medium">
                      Không có người thay thế
                    </span>
                  </ChonKhoi>
                </div>
              </div>
            )}
          </PageCard>

          {/* CỘT PHẢI: Tóm tắt yêu cầu */}
          <PageCard
            variant="secondary"
            id="card-tom-tat-yeu-cau"
            className="min-h-[380px] lg:min-h-[500px]"
          >
            <SectionTitle
              id="title-tom-tat-yeu-cau"
              title="Yêu cầu"
              className={LAYOUT_TOKENS.spaceBlockMb}
            />

            <div className="space-y-4 text-[#334eac]">
              <div>
                <p className="font-semibold text-lg">
                  {currentUser?.name || "–"}
                </p>
              </div>

              <div>
                <p className="font-medium text-sm sm:text-base">
                  {selectedCa
                    ? `${selectedCa.thu}, ${selectedCa.ngayHienThi}`
                    : "Chưa chọn ca"}
                </p>
              </div>

              <div>
                <p className="font-medium text-sm sm:text-base">
                  {selectedCa
                    ? `Ca ${selectedCa.loaica.toLowerCase()} · ${selectedCa.gioBatDau} – ${selectedCa.gioKetThuc}`
                    : ""}
                </p>
              </div>

              <div className="pt-3 border-t border-[#7096d1]/40">
                <p className="font-medium text-sm sm:text-base">
                  Nhân viên thay:{" "}
                  <span className="font-semibold">
                    {khongCoNguoiThay
                      ? "Không có người thay thế"
                      : selectedNguoiThayObj
                      ? selectedNguoiThayObj.hoten
                      : "Chưa chọn"}
                  </span>
                </p>
              </div>
            </div>
          </PageCard>
        </div>
      </div>

      {/* THANH THAO TÁC DƯỚI CÙNG (Hủy / Gửi) */}
      <div className="border-t-[1.2px] border-[#7096d1] pt-4 flex items-center justify-end gap-4">
        <button
          type="button"
          id="btn-huy"
          onClick={() => router.push("/nhan-vien")}
          className="min-w-[116px] sm:w-[144px] h-[44px] px-6 rounded-[9.6px] border-[1.2px] border-[#334EAC] bg-[#FFF9F0] text-[#334EAC] text-sm font-medium hover:bg-[#F7F2EB] transition-colors"
        >
          Hủy
        </button>

        <button
          type="button"
          id="btn-gui"
          onClick={handleSubmit}
          disabled={submitting || submitted || !selectedMalich}
          className={`min-w-[116px] sm:w-[264px] h-[44px] px-6 rounded-[9.6px] bg-[#334EAC] text-[#FFF9F0] text-sm font-medium transition-colors ${
            submitting || submitted || !selectedMalich
              ? "opacity-45 cursor-not-allowed"
              : "hover:bg-[#283E8C] cursor-pointer"
          }`}
        >
          {submitting ? "Đang gửi..." : "Gửi"}
        </button>
      </div>
    </div>
  );
}
