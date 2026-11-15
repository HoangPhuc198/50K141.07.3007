"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { DatePicker } from "@frontend/components/ui/DatePicker";
import { NotificationBanner } from "@frontend/components/ui/NotificationBanner";
import { formatDateVN, nowVN } from "@backend/lib/time";
import { MUC_LUONG_KHOI_DIEM, mucLuongKhoiDiemTheoViTri, ViTriLamViec } from "@backend/calc/luong";
import {
  THEM_NV_THANH_CONG,
  THEM_NV_THIEU_TRUONG,
  THEM_NV_TRUNG_SDT,
  THEM_NV_TRANG_THAI_MAC_DINH,
} from "@frontend/config/thong-bao";
import { PLACEHOLDER } from "@frontend/config/placeholder";

// ---- types ----
type VitriType = ViTriLamViec | "";
type HinhthucType = "Part-time" | "Full-time" | "";

export default function ThemNhanVienScreen() {
  const router = useRouter();
  const today = formatDateVN(nowVN());

  const [hoten, setHoten] = useState("");
  const [sdt, setSdt] = useState("");
  const [diachi, setDiachi] = useState("");
  const [truonghoc, setTruonghoc] = useState("");
  const [vitri, setVitri] = useState<VitriType>("");
  const [hinhthuc, setHinhthuc] = useState<HinhthucType>("");
  const [ngayvaolam, setNgayvaolam] = useState(today);
  const [kinhnghiem, setKinhnghiem] = useState("");
  const [mucluong, setMucluong] = useState<number | "">("");

  // Track fields that have error highlight
  const [errorFields, setErrorFields] = useState<Set<string>>(new Set());
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Auto-fill mức lương khi chọn vị trí
  const handleVitriChange = (v: VitriType) => {
    setVitri(v);
    if (v && v in MUC_LUONG_KHOI_DIEM) {
      setMucluong(mucLuongKhoiDiemTheoViTri(v));
    } else {
      setMucluong("");
    }
  };

  const fieldClass = (name: string) =>
    `w-full px-4 py-3 rounded-lg border text-sm bg-[#FFF9F0] focus:outline-none focus:ring-2 ${
      errorFields.has(name)
        ? "border-[#C0392B] text-[#C0392B] placeholder:text-[#C0392B] focus:ring-[#C0392B]/30"
        : "border-[#7096D1] text-[#334EAC] placeholder:text-[#7096D1] focus:ring-[#334EAC]/30"
    }`;

  const handleSubmit = async () => {
    // Kiểm tra trường bắt buộc
    const errors = new Set<string>();
    if (!hoten.trim()) errors.add("hoten");
    if (!sdt.trim()) errors.add("sdt");
    if (!diachi.trim()) errors.add("diachi");
    if (!vitri) errors.add("vitri");
    if (!hinhthuc) errors.add("hinhthuc");
    if (!ngayvaolam.trim()) errors.add("ngayvaolam");
    if (!kinhnghiem.trim()) errors.add("kinhnghiem");

    setErrorFields(errors);

    if (errors.size > 0) {
      setBanner({ type: "error", message: THEM_NV_THIEU_TRUONG });
      return;
    }

    setLoading(true);
    setBanner(null);
    try {
      const res = await fetch("/api/chu-quan/nhan-vien", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Hoten: hoten.trim(),
          Sdt: sdt.trim(),
          Diachi: diachi.trim(),
          Truonghoc: truonghoc.trim() || null,
          Vitrilamviec: vitri,
          Hinhthuclam: hinhthuc,
          Ngayvaolam: ngayvaolam,
          Kinhnghiem: kinhnghiem.trim(),
          Mucluongtheogio: Number(mucluong),
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setBanner({ type: "success", message: THEM_NV_THANH_CONG });
        // Reset form
        setHoten(""); setSdt(""); setDiachi(""); setTruonghoc("");
        setVitri(""); setHinhthuc(""); setNgayvaolam(today);
        setKinhnghiem(""); setMucluong("");
        setErrorFields(new Set());
      } else {
        let msg = json?.error?.message;
        if (json?.error?.code === "PHONE_DUPLICATE" || msg?.includes("Số điện thoại")) {
          msg = THEM_NV_TRUNG_SDT;
        }
        setBanner({ type: "error", message: msg || THEM_NV_THIEU_TRUONG });
      }
    } catch {
      setBanner({ type: "error", message: "Lỗi kết nối máy chủ" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Banner thông báo */}
      {banner && <NotificationBanner type={banner.type} message={banner.message} />}

      {/* Card nội dung */}
      <div className="bg-[#FFF9F0] rounded-xl border border-[#7096D1] p-6 flex-1 shadow-[0px_4px_16px_0px_rgba(0,0,0,0.08)]">
        <h2 className="text-lg font-semibold text-[#334EAC] mb-6">Thông tin nhân viên</h2>

        {/* Grid 2 cột trên md, 1 cột trên mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
          {/* Cột trái */}
          <div className="space-y-5">
            <div>
              <label htmlFor="input-hoten" className="block text-sm font-medium text-[#334EAC] mb-1.5">
                Họ và tên <span>*</span>
              </label>
              <input
                id="input-hoten"
                placeholder={PLACEHOLDER.hoTen}
                className={fieldClass("hoten")}
                value={hoten}
                onChange={(e) => { setHoten(e.target.value); setErrorFields(p => { const s = new Set(p); s.delete("hoten"); return s; }); }}
              />
            </div>

            <div>
              <label htmlFor="input-diachi" className="block text-sm font-medium text-[#334EAC] mb-1.5">
                Địa chỉ <span>*</span>
              </label>
              <input
                id="input-diachi"
                placeholder={PLACEHOLDER.diaChi}
                className={fieldClass("diachi")}
                value={diachi}
                onChange={(e) => { setDiachi(e.target.value); setErrorFields(p => { const s = new Set(p); s.delete("diachi"); return s; }); }}
              />
            </div>

            <div>
              <label htmlFor="select-vitri" className="block text-sm font-medium text-[#334EAC] mb-1.5">
                Vị trí <span>*</span>
              </label>
              <div className="relative">
                <select
                  id="select-vitri"
                  className={`${fieldClass("vitri")} appearance-none pr-10`}
                  value={vitri}
                  onChange={(e) => { handleVitriChange(e.target.value as VitriType); setErrorFields(p => { const s = new Set(p); s.delete("vitri"); return s; }); }}
                >
                  <option value="">-- Chọn vị trí --</option>
                  <option value="Phục vụ">Phục vụ</option>
                  <option value="Pha chế">Pha chế</option>
                </select>
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#334EAC] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <div>
              <label htmlFor="input-ngay-vao-lam" className="block text-sm font-medium text-[#334EAC] mb-1.5">
                Ngày vào làm <span>*</span>
              </label>
              <DatePicker
                id="input-ngay-vao-lam"
                value={ngayvaolam}
                error={errorFields.has("ngayvaolam")}
                calendarButtonAriaLabel="Mở lịch chọn ngày vào làm"
                onChange={(iso) => {
                  setNgayvaolam(iso);
                  setErrorFields((p) => {
                    const s = new Set(p);
                    s.delete("ngayvaolam");
                    return s;
                  });
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#334EAC] mb-1.5">Trạng thái mặc định</label>
              <div className="relative">
                <input
                  readOnly
                  value={THEM_NV_TRANG_THAI_MAC_DINH}
                  className="w-full px-4 py-3 rounded-lg border border-[#7096D1] text-sm bg-[#F7F2EB] text-[#334EAC] cursor-not-allowed pr-10"
                />
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#334EAC]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Cột phải */}
          <div className="space-y-5">
            <div>
              <label htmlFor="input-sdt" className="block text-sm font-medium text-[#334EAC] mb-1.5">
                Số điện thoại <span>*</span>
              </label>
              <input
                id="input-sdt"
                placeholder={PLACEHOLDER.soDienThoai}
                className={fieldClass("sdt")}
                value={sdt}
                maxLength={10}
                onChange={(e) => { setSdt(e.target.value); setErrorFields(p => { const s = new Set(p); s.delete("sdt"); return s; }); }}
              />
            </div>

            <div>
              <label htmlFor="input-truonghoc" className="block text-sm font-medium text-[#334EAC] mb-1.5">Trường học</label>
              <input
                id="input-truonghoc"
                placeholder={PLACEHOLDER.truongHoc}
                className={fieldClass("truonghoc")}
                value={truonghoc}
                onChange={(e) => setTruonghoc(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="select-hinhthuc" className="block text-sm font-medium text-[#334EAC] mb-1.5">
                Hình thức làm việc <span>*</span>
              </label>
              <div className="relative">
                <select
                  id="select-hinhthuc"
                  className={`${fieldClass("hinhthuc")} appearance-none pr-10`}
                  value={hinhthuc}
                  onChange={(e) => { setHinhthuc(e.target.value as HinhthucType); setErrorFields(p => { const s = new Set(p); s.delete("hinhthuc"); return s; }); }}
                >
                  <option value="">-- Chọn hình thức --</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Full-time">Full-time</option>
                </select>
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#334EAC] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <div>
              <label htmlFor="input-kinhnghiem" className="block text-sm font-medium text-[#334EAC] mb-1.5">
                Kinh nghiệm <span>*</span>
              </label>
              <input
                id="input-kinhnghiem"
                placeholder={PLACEHOLDER.kinhNghiem}
                className={fieldClass("kinhnghiem")}
                value={kinhnghiem}
                onChange={(e) => { setKinhnghiem(e.target.value); setErrorFields(p => { const s = new Set(p); s.delete("kinhnghiem"); return s; }); }}
              />
            </div>

            <div>
              <label htmlFor="select-mucluong" className="block text-sm font-medium text-[#334EAC] mb-1.5">
                Mức lương khởi điểm (đ/giờ) <span>*</span>
              </label>
              <div className="relative">
                <select
                  id="select-mucluong"
                  className={`${fieldClass("mucluong")} appearance-none pr-10`}
                  value={mucluong}
                  onChange={() => {
                    setMucluong(vitri && vitri in MUC_LUONG_KHOI_DIEM ? mucLuongKhoiDiemTheoViTri(vitri) : "");
                  }}
                >
                  {vitri && vitri in MUC_LUONG_KHOI_DIEM ? (
                    <option value={mucLuongKhoiDiemTheoViTri(vitri)}>
                      {mucLuongKhoiDiemTheoViTri(vitri)}
                    </option>
                  ) : (
                    <option value=""></option>
                  )}
                </select>
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#334EAC] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer cố định: Hủy + Lưu */}
      <div className="mt-5 pt-4 border-t border-[#7096D1] flex justify-end gap-3 bg-[#FFF9F0] flex-shrink-0">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-8 py-2.5 rounded-lg border border-[#334EAC] bg-[#FFF9F0] text-[#334EAC] text-sm font-medium hover:bg-[#EBF0FA] transition-colors"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="px-8 py-2.5 rounded-lg bg-[#334EAC] text-[#FFF9F0] text-sm font-medium hover:bg-[#2a3f8f] transition-colors disabled:opacity-45"
        >
          {loading ? "Đang lưu..." : "Lưu"}
        </button>
      </div>
    </div>
  );
}
