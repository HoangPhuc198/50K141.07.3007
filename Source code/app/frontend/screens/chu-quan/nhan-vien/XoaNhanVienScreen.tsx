"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@frontend/components/ui/ConfirmDialog";
import { NotificationBanner } from "@frontend/components/ui/NotificationBanner";
import {
  XOA_NV_XAC_NHAN,
  XOA_NV_THANH_CONG,
  XOA_NV_THAT_BAI,
} from "@frontend/config/thong-bao";
import { PLACEHOLDER } from "@frontend/config/placeholder";

// --- Types ---
type NhanVienItem = {
  Manv: string;
  Hoten: string;
  Trangthai: string;
  kyLuongCuoi?: string | null;
  trangThaiLuong?: string | null;
};

// --- Màn hình chính ---
export default function XoaNhanVienScreen() {
  const router = useRouter();
  const [searchQ, setSearchQ] = useState("");
  const [list, setList] = useState<NhanVienItem[]>([]);
  const [selectedManv, setSelectedManv] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  // Phân trang
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const LIMIT = 6;

  const fetchList = useCallback(async (q: string, pg: number) => {
    setLoadingList(true);
    try {
      const res = await fetch(
        `/api/chu-quan/nhan-vien?q=${encodeURIComponent(q)}&page=${pg}&limit=${LIMIT}`
      );
      const json = await res.json();
      if (res.ok && json.ok) {
        setList(json.data.items);
        setTotalPages(json.data.totalPages || 1);
      }
    } catch {
      // bỏ qua
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchList("", 1);
  }, [fetchList]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchList(searchQ, 1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQ, fetchList]);

  const handleSelectRow = (manv: string) => {
    setSelectedManv(manv);
    setBanner(null);
  };

  const handleXoaClick = () => {
    if (!selectedManv) return;
    setShowPopup(true);
  };

  const handleHuy = () => {
    setShowPopup(false);
  };

  const handleXacNhan = async () => {
    if (!selectedManv) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/chu-quan/nhan-vien/${selectedManv}`, {
        method: "DELETE",
      });
      const json = await res.json();
      setShowPopup(false);
      if (res.ok && json.ok) {
        setBanner({ type: "success", message: XOA_NV_THANH_CONG });
        setSelectedManv(null);
        // Tải lại danh sách
        await fetchList(searchQ, page);
      } else if (json.error?.code === "KY_LUONG_CHUA_CHOT") {
        // Chặn vì còn kỳ lương chưa chốt – hiển thị lỗi riêng
        setBanner({ type: "error", message: json.error.message || XOA_NV_THAT_BAI });
      } else {
        setBanner({ type: "error", message: XOA_NV_THAT_BAI });
      }
    } catch {
      setShowPopup(false);
      setBanner({ type: "error", message: XOA_NV_THAT_BAI });
    } finally {
      setDeleting(false);
    }
  };

  const selectedNv = list.find((nv) => nv.Manv === selectedManv) ?? null;

  // Phân trang
  const goPage = (pg: number) => {
    if (pg < 1 || pg > totalPages) return;
    setPage(pg);
    fetchList(searchQ, pg);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Popup xác nhận xóa dùng chung (chuẩn Figma UC_5.3_02) */}
      {selectedNv && (
        <ConfirmDialog
          open={showPopup}
          id="dialog-xoa-nhan-vien"
          headerIcon="info"
          maxWidthClass="max-w-[480px]"
          title={XOA_NV_XAC_NHAN}
          message={
            <div className="space-y-1 text-sm text-[#334EAC]">
              <p>
                {selectedNv.Hoten}&nbsp;&nbsp;{selectedNv.Manv}&nbsp;&nbsp;{selectedNv.Trangthai}.
              </p>
              <p>
                {selectedNv.kyLuongCuoi
                  ? `Kỳ lương ${selectedNv.kyLuongCuoi} đã chốt. `
                  : ""}
                Dữ liệu xóa không khôi phục được.
              </p>
            </div>
          }
          cancelLabel="Hủy"
          confirmLabel={deleting ? "Đang xóa..." : "Xác nhận"}
          onConfirm={handleXacNhan}
          onCancel={handleHuy}
          busy={deleting}
        />
      )}

      {/* Banner */}
      {banner && <NotificationBanner type={banner.type} message={banner.message} />}

      {/* Card danh sách */}
      <div className="bg-white rounded-2xl border border-[#94AFD9] p-6">
        {/* Tìm kiếm theo tên hoặc mã */}
        <div className="mb-5">
          <label htmlFor="search-xoa-nv" className="block text-sm font-medium text-[#334EAC] mb-1.5">
            Tìm theo tên hoặc mã
          </label>
          <input
            id="search-xoa-nv"
            type="text"
            placeholder={PLACEHOLDER.timNhanVien}
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="w-full max-w-sm px-4 py-2.5 rounded-lg border border-[#94AFD9] text-sm text-[#334EAC] placeholder:text-[#7096D1] bg-[#F7F2EB] focus:outline-none focus:ring-2 focus:ring-[#334EAC]/40"
          />
        </div>

        {/* Bảng danh sách */}
        {loadingList ? (
          <p className="text-sm text-[#94AFD9] py-6 text-center">Đang tải...</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-[#94AFD9] py-6 text-center">Không có nhân viên</p>
        ) : (
          <>
            <div className="hidden sm:block">
              <table className="w-full text-sm text-[#334EAC]">
                <thead>
                  <tr className="border-b border-[#94AFD9]">
                    <th className="text-left pb-2 pr-4 font-medium">Mã nhân viên</th>
                    <th className="text-left pb-2 pr-4 font-medium">Họ và tên</th>
                    <th className="text-left pb-2 pr-4 font-medium">Tình trạng làm việc</th>
                    <th className="text-left pb-2 pr-4 font-medium">Kỳ lương cuối</th>
                    <th className="text-left pb-2 font-medium">Trạng thái lương</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((nv) => {
                    const isSelected = nv.Manv === selectedManv;
                    return (
                      <tr
                        key={nv.Manv}
                        tabIndex={0}
                        aria-selected={isSelected}
                        onClick={() => handleSelectRow(nv.Manv)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSelectRow(nv.Manv);
                          }
                        }}
                        className={`border-b border-[#E8E0D5] cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#334EAC] ${
                          isSelected ? "bg-[#334EAC] text-white" : "hover:bg-[#EAF0FB]"
                        }`}
                      >
                        <td className="py-2.5 pr-4">{nv.Manv}</td>
                        <td className="py-2.5 pr-4">{nv.Hoten}</td>
                        <td className="py-2.5 pr-4">{nv.Trangthai}</td>
                        <td className="py-2.5 pr-4">{nv.kyLuongCuoi || "—"}</td>
                        <td className="py-2.5">{nv.trangThaiLuong || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="sm:hidden space-y-2">
              {list.map((nv) => {
                const isSelected = nv.Manv === selectedManv;
                return (
                  <button
                    key={nv.Manv}
                    type="button"
                    onClick={() => handleSelectRow(nv.Manv)}
                    className={`w-full text-left min-h-[44px] rounded-xl border p-3 transition-colors ${
                      isSelected
                        ? "bg-[#334EAC] text-white border-[#334EAC]"
                        : "bg-[#FFF9F0] text-[#334EAC] border-[#94AFD9] hover:bg-[#EAF0FB]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-sm font-medium">
                      <span>{nv.Hoten}</span>
                      <span>{nv.Manv}</span>
                    </div>
                    <div className="text-xs opacity-85 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>{nv.Trangthai}</span>
                      <span>Kỳ cuối: {nv.kyLuongCuoi || "—"}</span>
                      <span>{nv.trangThaiLuong || "—"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Phân trang */}
        {totalPages > 1 && (
          <div className="mt-5 flex flex-wrap items-center justify-end gap-1 text-sm text-[#334EAC]">
            <span className="mr-2">Trang {page} / {totalPages}</span>
            <button onClick={() => goPage(page - 1)} disabled={page <= 1} className="min-h-[44px] px-3 py-2 rounded hover:bg-[#EAF0FB] disabled:opacity-40">‹ Trước</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
              <button
                key={pg}
                onClick={() => goPage(pg)}
                className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded ${pg === page ? "bg-[#334EAC] text-white" : "hover:bg-[#EAF0FB]"}`}
              >
                {pg}
              </button>
            ))}
            <button onClick={() => goPage(page + 1)} disabled={page >= totalPages} className="min-h-[44px] px-3 py-2 rounded hover:bg-[#EAF0FB] disabled:opacity-40">Sau ›</button>
          </div>
        )}
      </div>

      {/* Footer: Hủy / Xóa thông tin */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => {
            setSelectedManv(null);
            router.push("/chu-quan");
          }}
          className="min-h-[44px] px-6 py-2.5 rounded-lg border border-[#334EAC] text-[#334EAC] text-sm font-medium hover:bg-[#EAF0FB]"
        >
          Hủy
        </button>
        <button
          onClick={handleXoaClick}
          disabled={!selectedManv}
          className="min-h-[44px] px-6 py-2.5 rounded-lg bg-[#334EAC] text-white text-sm font-medium hover:bg-[#2a3f8f] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Xóa thông tin
        </button>
      </div>
    </div>
  );
}
