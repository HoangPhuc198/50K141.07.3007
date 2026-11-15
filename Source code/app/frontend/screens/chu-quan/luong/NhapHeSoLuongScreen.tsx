"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { parseSoThapPhanDuong } from "@frontend/lib/dinh-dang";
import { DatePicker } from "@frontend/components/ui/DatePicker";
import { NotificationBanner } from "@frontend/components/ui/NotificationBanner";
import { PageCard } from "@frontend/components/ui/PageCard";
import { PLACEHOLDER } from "@frontend/config/placeholder";
import {
  HE_SO_LUONG_LOI,
  HE_SO_LUONG_THOI_GIAN_SAI,
  HE_SO_LUONG_DA_XOA,
  HE_SO_LUONG_THANH_CONG,
} from "@frontend/config/thong-bao";

export type HeSoItem = {
  Maheso: string;
  Ngaybatdau: string; // YYYY-MM-DD
  Ngayketthuc: string; // YYYY-MM-DD
  NgaybatdauDisplay: string; // DD/MM/YYYY
  NgayketthucDisplay: string; // DD/MM/YYYY
  Heso: number;
};

export default function NhapHeSoLuongScreen() {
  const router = useRouter();
  const [list, setList] = useState<HeSoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [editingMaheso, setEditingMaheso] = useState<string | null>(null);
  const [ngayBatDau, setNgayBatDau] = useState("");
  const [ngayKetThuc, setNgayKetThuc] = useState("");
  const [heSoStr, setHeSoStr] = useState("2");

  // Thông báo & lỗi trường
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    heSo?: boolean;
    thoiGian?: boolean;
  }>({});

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/he-so");
      const json = await res.json();
      if (res.ok && json.ok && Array.isArray(json.data)) {
        setList(json.data);
      }
    } catch {
      // bỏ qua
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const resetFormFields = () => {
    setEditingMaheso(null);
    setNgayBatDau("");
    setNgayKetThuc("");
    setHeSoStr("2");
    setFieldErrors({});
  };

  // Bắt đầu thêm mới
  const handleAddNew = () => {
    resetFormFields();
    setBanner(null);
  };

  // Chọn dòng để sửa
  const handleEdit = (item: HeSoItem) => {
    setEditingMaheso(item.Maheso);
    setNgayBatDau(item.Ngaybatdau);
    setNgayKetThuc(item.Ngayketthuc);
    setHeSoStr(String(item.Heso));
    setBanner(null);
    setFieldErrors({});
  };

  // Xóa khoảng
  const handleDelete = async (maheso: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/he-so?id=${encodeURIComponent(maheso)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setBanner({ type: "success", message: HE_SO_LUONG_DA_XOA });
        setList((prev) => prev.filter((item) => item.Maheso !== maheso));
        if (editingMaheso === maheso) {
          resetFormFields();
        }
      } else {
        setBanner({ type: "error", message: json.error?.message || "Xóa thất bại" });
      }
    } catch {
      setBanner({ type: "error", message: "Xóa thất bại" });
    } finally {
      setSaving(false);
    }
  };

  // Hủy thao tác
  const handleCancel = () => {
    router.push("/chu-quan");
  };

  // Lưu khoảng hệ số
  const handleSave = async () => {
    setBanner(null);
    setFieldErrors({});

    // 1. Kiểm tra hệ số
    const num = parseSoThapPhanDuong(heSoStr);
    if (num === null || num < 1) {
      setFieldErrors((prev) => ({ ...prev, heSo: true }));
      setBanner({ type: "error", message: HE_SO_LUONG_LOI });
      return;
    }

    // 2. Kiểm tra ngày
    if (!ngayBatDau || !ngayKetThuc) {
      setFieldErrors((prev) => ({ ...prev, thoiGian: true }));
      setBanner({ type: "error", message: HE_SO_LUONG_THOI_GIAN_SAI });
      return;
    }

    if (ngayKetThuc < ngayBatDau) {
      setFieldErrors((prev) => ({ ...prev, thoiGian: true }));
      setBanner({ type: "error", message: HE_SO_LUONG_THOI_GIAN_SAI });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/he-so", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Maheso: editingMaheso || undefined,
          Ngaybatdau: ngayBatDau,
          Ngayketthuc: ngayKetThuc,
          Heso: num,
        }),
      });

      const json = await res.json();
      if (res.ok && json.ok) {
        setBanner({ type: "success", message: HE_SO_LUONG_THANH_CONG });
        await fetchList();
        resetFormFields();
      } else {
        const errorMsg = json.error?.message || "Lưu thất bại";
        if (errorMsg === HE_SO_LUONG_LOI) {
          setFieldErrors((prev) => ({ ...prev, heSo: true }));
        } else if (errorMsg === HE_SO_LUONG_THOI_GIAN_SAI) {
          setFieldErrors((prev) => ({ ...prev, thoiGian: true }));
        }
        setBanner({ type: "error", message: errorMsg });
      }
    } catch {
      setBanner({ type: "error", message: "Lưu thất bại" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Banner thông báo */}
      {banner && (
        <NotificationBanner
          type={banner.type}
          message={banner.message}
          onClose={() => setBanner(null)}
        />
      )}

      {/* Bố cục 2 cột theo Figma UC_8.4_01 */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Cột trái: Khoảng áp dụng đã cấu hình */}
        <PageCard className="flex-[3_3_0%] min-w-0">
          <h2 className="text-xl sm:text-2xl font-semibold text-[#334EAC] mb-4">
            Khoảng áp dụng đã cấu hình
          </h2>

          {loading ? (
            <p className="text-sm text-[#334EAC] text-center py-8">Đang tải...</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-[#7096D1] text-center py-8">Chưa có khoảng áp dụng nào</p>
          ) : (
            <div className="border border-[#7096D1] rounded-[12px] overflow-hidden mb-6">
              {/* Bảng cho Desktop */}
              <div className="hidden sm:block">
                <table className="w-full text-left border-collapse text-sm text-[#334EAC]">
                  <thead>
                    <tr className="bg-[#B7C9EF] font-normal text-[#334EAC]">
                      <th className="py-3 px-4 font-normal">Ngày bắt đầu</th>
                      <th className="py-3 px-4 font-normal">Ngày kết thúc</th>
                      <th className="py-3 px-4 font-normal">Hệ số</th>
                      <th className="py-3 px-4 font-normal text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((item, idx) => {
                      const isEditing = editingMaheso === item.Maheso;
                      const bgRow = isEditing
                        ? "bg-[#EAF0FB]"
                        : idx % 2 === 0
                        ? "bg-[#F7F2EB]"
                        : "bg-[#FFF9F0]";
                      return (
                        <tr
                          key={item.Maheso}
                          className={`border-t border-[#7096D1] ${bgRow} hover:bg-[#EAF0FB] transition-colors`}
                        >
                          <td className="py-3 px-4">{item.NgaybatdauDisplay}</td>
                          <td className="py-3 px-4">{item.NgayketthucDisplay}</td>
                          <td className="py-3 px-4">{item.Heso}</td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleEdit(item)}
                                className="px-4 py-1 rounded-[8px] bg-[#334EAC] text-[#FFF9F0] text-sm font-bold hover:bg-[#2A3F8F] transition-colors min-h-[36px]"
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(item.Maheso)}
                                className="px-4 py-1 rounded-[8px] bg-[#FFF9F0] border border-[#334EAC] text-[#334EAC] text-sm font-medium hover:bg-[#F2ECE1] transition-colors min-h-[36px]"
                              >
                                Xóa
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Danh sách thẻ cho Mobile (< 640px) */}
              <div className="sm:hidden flex flex-col divide-y divide-[#7096D1]">
                {list.map((item) => (
                  <div key={item.Maheso} className="p-4 bg-[#FFF9F0] flex flex-col gap-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[#7096D1]">Bắt đầu:</span>
                      <span className="font-medium text-[#334EAC]">{item.NgaybatdauDisplay}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[#7096D1]">Kết thúc:</span>
                      <span className="font-medium text-[#334EAC]">{item.NgayketthucDisplay}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[#7096D1]">Hệ số:</span>
                      <span className="font-bold text-[#334EAC]">{item.Heso}</span>
                    </div>
                    <div className="flex gap-2 mt-2 pt-2 border-t border-[#7096D1]/30">
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="flex-1 py-2 rounded-lg bg-[#334EAC] text-[#FFF9F0] text-sm font-bold min-h-[44px]"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.Maheso)}
                        className="flex-1 py-2 rounded-lg bg-[#FFF9F0] border border-[#334EAC] text-[#334EAC] text-sm font-medium min-h-[44px]"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nút + Thêm khoảng áp dụng */}
          <div>
            <button
              type="button"
              onClick={handleAddNew}
              className="px-6 py-3 rounded-[9.6px] bg-[#FFF9F0] border-[1.2px] border-[#334EAC] text-[#334EAC] text-sm sm:text-base font-medium hover:bg-[#F2ECE1] transition-colors min-h-[44px]"
            >
              + Thêm khoảng áp dụng
            </button>
          </div>
        </PageCard>

        {/* Cột phải: Chỉnh sửa khoảng áp dụng */}
        <PageCard className="flex-[2_2_0%] min-w-0">
          <h2 className="text-xl sm:text-2xl font-semibold text-[#334EAC] mb-6">
            {editingMaheso ? "Chỉnh sửa khoảng áp dụng" : "Thêm khoảng áp dụng"}
          </h2>

          <div className="flex flex-col gap-5">
            {/* Ngày bắt đầu */}
            <div>
              <label
                htmlFor="input-ngay-bat-dau"
                className="block text-sm sm:text-base font-medium text-[#334EAC] mb-2"
              >
                Ngày bắt đầu *
              </label>
              <DatePicker
                id="input-ngay-bat-dau"
                value={ngayBatDau}
                error={Boolean(fieldErrors.thoiGian)}
                calendarButtonAriaLabel="Mở lịch chọn ngày bắt đầu"
                onChange={(iso) => {
                  setNgayBatDau(iso);
                  setFieldErrors((prev) => ({ ...prev, thoiGian: false }));
                }}
              />
            </div>

            {/* Ngày kết thúc */}
            <div>
              <label
                htmlFor="input-ngay-ket-thuc"
                className="block text-sm sm:text-base font-medium text-[#334EAC] mb-2"
              >
                Ngày kết thúc *
              </label>
              <DatePicker
                id="input-ngay-ket-thuc"
                value={ngayKetThuc}
                error={Boolean(fieldErrors.thoiGian)}
                calendarButtonAriaLabel="Mở lịch chọn ngày kết thúc"
                onChange={(iso) => {
                  setNgayKetThuc(iso);
                  setFieldErrors((prev) => ({ ...prev, thoiGian: false }));
                }}
              />
            </div>

            {/* Hệ số lương */}
            <div>
              <label
                htmlFor="input-he-so-luong"
                className="block text-sm sm:text-base font-medium text-[#334EAC] mb-2"
              >
                Hệ số lương *
              </label>
              <input
                id="input-he-so-luong"
                type="text"
                placeholder={PLACEHOLDER.heSoLuong}
                value={heSoStr}
                onChange={(e) => {
                  setHeSoStr(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, heSo: false }));
                }}
                className={`w-full px-4 py-3 rounded-[9.6px] bg-[#FFF9F0] border-[1.2px] text-[#334EAC] placeholder:text-[#7096D1] text-sm sm:text-base outline-none transition-colors min-h-[44px] ${
                  fieldErrors.heSo
                    ? "border-[#C0392B] focus:border-[#C0392B]"
                    : "border-[#7096D1] focus:border-[#334EAC]"
                }`}
              />
            </div>
          </div>
        </PageCard>
      </div>

      {/* Thanh thao tác dưới cùng (Figma UC_8.4_01: Thanh thao tác) */}
      <div className="border-t-[1.2px] border-[#7096D1] pt-4 flex justify-end gap-4">
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving}
          className="px-8 py-3 rounded-[9.6px] bg-[#FFF9F0] border-[1.2px] border-[#334EAC] text-[#334EAC] text-sm sm:text-base font-medium hover:bg-[#F2ECE1] transition-colors min-h-[44px] min-w-[120px]"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-10 py-3 rounded-[9.6px] bg-[#334EAC] border-[1.2px] border-[#334EAC] text-[#FFF9F0] text-sm sm:text-base font-medium hover:bg-[#2A3F8F] transition-colors min-h-[44px] min-w-[140px] disabled:opacity-60"
        >
          {saving ? "Đang lưu..." : "Lưu"}
        </button>
      </div>
    </div>
  );
}
