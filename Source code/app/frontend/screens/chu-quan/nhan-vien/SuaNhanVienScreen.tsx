"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DatePicker } from "@frontend/components/ui/DatePicker";
import { NotificationBanner } from "@frontend/components/ui/NotificationBanner";
import { extractIsoDateParts, toIsoDate } from "@frontend/lib/dinh-dang";
import {
  SUA_NV_THANH_CONG,
  SUA_NV_THIEU_TRUONG,
  SUA_NV_TRUNG_SDT,
} from "@frontend/config/thong-bao";
import { PLACEHOLDER } from "@frontend/config/placeholder";

type NhanVienItem = {
  Manv: string;
  Hoten: string;
};

type NhanVienDetail = {
  Manv: string;
  Tendangnhap: string;
  Hoten: string;
  Sdt: string;
  Diachi: string;
  Truonghoc: string | null;
  Vitrilamviec: string;
  Hinhthuclam: string;
  Ngayvaolam: string;
  Kinhnghiem: string;
  Trangthai: string;
  Mucluongtheogio: number;
  matKhauGiaiMa?: string;
};

const VALID_VITRI = ["Phục vụ", "Pha chế"];
const VALID_HINHTHUC = ["Part-time", "Full-time"];
const VALID_TRANGTHAI = ["Thử việc", "Chính thức"];

export default function SuaNhanVienScreen() {
  const router = useRouter();

  const [searchQ, setSearchQ] = useState("");
  const [list, setList] = useState<NhanVienItem[]>([]);
  const [selectedManv, setSelectedManv] = useState<string | null>(null);
  const [detail, setDetail] = useState<NhanVienDetail | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form fields
  const [hoten, setHoten] = useState("");
  const [sdt, setSdt] = useState("");
  const [diachi, setDiachi] = useState("");
  const [truonghoc, setTruonghoc] = useState("");
  const [vitri, setVitri] = useState("");
  const [hinhthuc, setHinhthuc] = useState("");
  const [ngayvaolam, setNgayvaolam] = useState("");
  const [kinhnghiem, setKinhnghiem] = useState("");
  const [trangthai, setTrangthai] = useState("");
  const [matkhau, setMatkhau] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [errorFields, setErrorFields] = useState<Set<string>>(new Set());
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Tải danh sách nhân viên
  const fetchList = useCallback(async (q: string) => {
    setLoadingList(true);
    try {
      const res = await fetch(`/api/chu-quan/nhan-vien?q=${encodeURIComponent(q)}&limit=50`);
      const json = await res.json();
      if (res.ok && json.ok) {
        setList(json.data.items);
      }
    } catch {
      // bỏ qua
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchList("");
  }, [fetchList]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => fetchList(searchQ), 300);
    return () => clearTimeout(timer);
  }, [searchQ, fetchList]);

  // Tải chi tiết khi chọn nhân viên
  const fetchDetail = async (manv: string, keepBanner = false) => {
    setLoadingDetail(true);
    setDetail(null);
    if (!keepBanner) setBanner(null);
    setErrorFields(new Set());
    try {
      const res = await fetch(`/api/chu-quan/nhan-vien/${manv}`);
      const json = await res.json();
      if (res.ok && json.ok) {
        const d: NhanVienDetail = json.data;
        setDetail(d);
        setHoten(d.Hoten || "");
        setSdt(d.Sdt || "");
        setDiachi(d.Diachi || "");
        setTruonghoc(d.Truonghoc || "");
        setVitri(d.Vitrilamviec || "");
        setHinhthuc(d.Hinhthuclam || "");
        const ngayParts = extractIsoDateParts(d.Ngayvaolam);
        setNgayvaolam(ngayParts ? toIsoDate(ngayParts.year, ngayParts.month, ngayParts.day) : "");
        setKinhnghiem(d.Kinhnghiem || "");
        setTrangthai(d.Trangthai || "");
        setMatkhau(d.matKhauGiaiMa || "");
        setShowPassword(false);

        // Kiểm tra dữ liệu không khớp
        const invalidFields: string[] = [];
        if (d.Vitrilamviec && !VALID_VITRI.includes(d.Vitrilamviec)) invalidFields.push("Vị trí");
        if (d.Hinhthuclam && !VALID_HINHTHUC.includes(d.Hinhthuclam)) invalidFields.push("Hình thức làm việc");
        if (d.Trangthai && !VALID_TRANGTHAI.includes(d.Trangthai)) invalidFields.push("Trạng thái");

        if (invalidFields.length > 0) {
          setBanner({
            type: "error",
            message: `Lỗi dữ liệu: Trường ${invalidFields.join(", ")} không khớp danh sách cho phép`,
          });
        }
      }
    } catch {
      // bỏ qua
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSelectNv = (manv: string) => {
    setSelectedManv(manv);
    fetchDetail(manv);
  };

  const fieldClass = (name: string) =>
    `w-full px-4 py-3 rounded-lg border text-sm bg-[#FFF9F0] focus:outline-none focus:ring-2 ${
      errorFields.has(name)
        ? "border-[#C0392B] text-[#C0392B] placeholder:text-[#C0392B] focus:ring-[#C0392B]/30"
        : "border-[#7096D1] text-[#334EAC] placeholder:text-[#7096D1] focus:ring-[#334EAC]/30"
    }`;

  const handleSave = async () => {
    if (!selectedManv || !detail) return;

    const errors = new Set<string>();
    if (!hoten.trim()) errors.add("hoten");
    if (!sdt.trim()) errors.add("sdt");
    if (!diachi.trim()) errors.add("diachi");
    if (!vitri) errors.add("vitri");
    if (!hinhthuc) errors.add("hinhthuc");
    if (!ngayvaolam.trim()) errors.add("ngayvaolam");
    if (!kinhnghiem.trim()) errors.add("kinhnghiem");
    if (!trangthai) errors.add("trangthai");

    setErrorFields(errors);
    if (errors.size > 0) {
      setBanner({ type: "error", message: SUA_NV_THIEU_TRUONG });
      return;
    }

    setLoading(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/chu-quan/nhan-vien/${selectedManv}`, {
        method: "PUT",
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
          Trangthai: trangthai,
          Matkhau: matkhau || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setBanner({ type: "success", message: SUA_NV_THANH_CONG });
        // Reload detail
        fetchDetail(selectedManv, true);
        // Reload list
        fetchList(searchQ);
      } else {
        let msg = json?.error?.message;
        if (json?.error?.code === "PHONE_DUPLICATE" || msg?.includes("Số điện thoại")) {
          msg = SUA_NV_TRUNG_SDT;
        }
        setBanner({ type: "error", message: msg || SUA_NV_THIEU_TRUONG });
      }
    } catch {
      setBanner({ type: "error", message: "Lỗi kết nối máy chủ" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Banner */}
      {banner && <NotificationBanner type={banner.type} message={banner.message} />}

      {/* Body: 2 panel (giữ kích thước gốc, màu sắc theo Figma) */}
      <div className="flex flex-col lg:flex-row gap-5 flex-1 min-h-0">
        {/* Panel trái: Chọn nhân viên */}
        <div className="lg:w-[340px] flex-shrink-0 bg-[#FFF9F0] rounded-xl border border-[#7096D1] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.08)] p-5 flex flex-col min-h-0">
          <h2 className="text-base font-semibold text-[#334EAC] mb-4">Chọn nhân viên</h2>

          <label htmlFor="search-sua-nv" className="block text-sm font-medium text-[#334EAC] mb-1.5">Tìm theo tên hoặc mã</label>
          <input
            id="search-sua-nv"
            placeholder={PLACEHOLDER.timNhanVien}
            className="w-full px-4 py-3 rounded-lg border border-[#7096D1] text-sm bg-[#FFF9F0] text-[#334EAC] placeholder:text-[#7096D1] focus:outline-none focus:ring-2 focus:ring-[#334EAC]/30 mb-4"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />

          {/* Table */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {loadingList ? (
              <p className="text-sm text-[#7096D1] text-center py-4">Đang tải...</p>
            ) : list.length === 0 ? (
              <p className="text-sm text-[#7096D1] text-center py-4">Không tìm thấy</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F7F2EB] border-b border-[#7096D1]">
                    <th className="text-left py-2 px-2 text-[#334EAC] font-medium">Mã</th>
                    <th className="text-left py-2 px-2 text-[#334EAC] font-medium">Họ và tên</th>
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
                        onClick={() => handleSelectNv(nv.Manv)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSelectNv(nv.Manv);
                          }
                        }}
                        className={`cursor-pointer border-b border-[#7096D1]/30 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#334EAC] ${
                          isSelected
                            ? "bg-[#7096D1] text-[#334EAC]"
                            : "bg-[#FFF9F0] text-[#334EAC] hover:bg-[#EBF0FA]"
                        }`}
                      >
                        <td className="py-2.5 px-2 font-medium text-[#334EAC]">
                          {nv.Manv}
                        </td>
                        <td className="py-2.5 px-2 text-[#334EAC]">
                          {nv.Hoten}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Panel phải: Form sửa */}
        <div className="flex-1 bg-[#FFF9F0] rounded-xl border border-[#7096D1] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.08)] p-5 min-h-0 overflow-y-auto">
          {!selectedManv ? (
            <div className="flex items-center justify-center h-full text-[#7096D1] text-sm">
              Chọn nhân viên để xem và chỉnh sửa hồ sơ
            </div>
          ) : loadingDetail ? (
            <div className="flex items-center justify-center h-full text-[#7096D1] text-sm">
              Đang tải...
            </div>
          ) : detail ? (
            <>
              {/* Tiêu đề: chỉ có tên (đậm), mã ngay sau trong chip nhỏ có viền, không dấu · (NGOAI-LE-FIGMA) */}
              <div className="flex items-center gap-2.5 mb-5">
                <h2 className="text-base font-semibold text-[#334EAC]">
                  {detail.Hoten}
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded border border-[#7096D1] text-xs font-medium text-[#334EAC] bg-[#F7F2EB]">
                  {detail.Manv}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {/* Cột trái */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#334EAC] mb-1.5">Họ và tên <span>*</span></label>
                    <input placeholder={PLACEHOLDER.hoTen} className={fieldClass("hoten")} value={hoten} onChange={(e) => setHoten(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#334EAC] mb-1.5">Địa chỉ <span>*</span></label>
                    <input placeholder={PLACEHOLDER.diaChi} className={fieldClass("diachi")} value={diachi} onChange={(e) => setDiachi(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#334EAC] mb-1.5">Vị trí <span>*</span></label>
                    <div className="relative">
                      <select
                        className={`${fieldClass("vitri")} appearance-none pr-10`}
                        value={vitri}
                        onChange={(e) => {
                          setVitri(e.target.value);
                          setErrorFields((p) => {
                            const s = new Set(p);
                            s.delete("vitri");
                            return s;
                          });
                        }}
                      >
                        {!VALID_VITRI.includes(vitri) && (
                          <option value={vitri} disabled>
                            {vitri ? `${vitri} (Dữ liệu không hợp lệ)` : "-- Chọn vị trí --"}
                          </option>
                        )}
                        <option value="Phục vụ">Phục vụ</option>
                        <option value="Pha chế">Pha chế</option>
                      </select>
                      <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#334EAC] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="input-ngay-vao-lam-sua" className="block text-sm font-medium text-[#334EAC] mb-1.5">Ngày vào làm <span>*</span></label>
                    <DatePicker
                      id="input-ngay-vao-lam-sua"
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
                    <label className="block text-sm font-medium text-[#334EAC] mb-1.5">Trạng thái <span>*</span></label>
                    <div className="relative">
                      <select
                        className={`${fieldClass("trangthai")} appearance-none pr-10`}
                        value={trangthai}
                        onChange={(e) => {
                          setTrangthai(e.target.value);
                          setErrorFields((p) => {
                            const s = new Set(p);
                            s.delete("trangthai");
                            return s;
                          });
                        }}
                      >
                        {!VALID_TRANGTHAI.includes(trangthai) && (
                          <option value={trangthai} disabled>
                            {trangthai ? `${trangthai} (Dữ liệu không hợp lệ)` : "-- Chọn trạng thái --"}
                          </option>
                        )}
                        <option value="Thử việc">Thử việc</option>
                        <option value="Chính thức">Chính thức</option>
                        <option value="Nghỉ việc">Nghỉ việc</option>
                      </select>
                      <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#334EAC] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>

                {/* Cột phải */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#334EAC] mb-1.5">Số điện thoại <span>*</span></label>
                    <input placeholder={PLACEHOLDER.soDienThoai} className={fieldClass("sdt")} value={sdt} maxLength={10} onChange={(e) => setSdt(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#334EAC] mb-1.5">Trường học</label>
                    <input placeholder={PLACEHOLDER.truongHoc} className={fieldClass("truonghoc")} value={truonghoc} onChange={(e) => setTruonghoc(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#334EAC] mb-1.5">Hình thức làm việc <span>*</span></label>
                    <div className="relative">
                      <select
                        className={`${fieldClass("hinhthuc")} appearance-none pr-10`}
                        value={hinhthuc}
                        onChange={(e) => {
                          setHinhthuc(e.target.value);
                          setErrorFields((p) => {
                            const s = new Set(p);
                            s.delete("hinhthuc");
                            return s;
                          });
                        }}
                      >
                        {!VALID_HINHTHUC.includes(hinhthuc) && (
                          <option value={hinhthuc} disabled>
                            {hinhthuc ? `${hinhthuc} (Dữ liệu không hợp lệ)` : "-- Chọn hình thức --"}
                          </option>
                        )}
                        <option value="Part-time">Part-time</option>
                        <option value="Full-time">Full-time</option>
                      </select>
                      <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#334EAC] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#334EAC] mb-1.5">Kinh nghiệm <span>*</span></label>
                    <input placeholder={PLACEHOLDER.kinhNghiem} className={fieldClass("kinhnghiem")} value={kinhnghiem} onChange={(e) => setKinhnghiem(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#334EAC] mb-1.5">Mật khẩu tài khoản <span>*</span></label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder={PLACEHOLDER.matKhau}
                        className={`${fieldClass("matkhau")} pr-10`}
                        value={matkhau}
                        onChange={(e) => setMatkhau(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#334EAC] hover:text-[#283E8C]"
                      >
                        {showPassword ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Footer */}
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
          onClick={handleSave}
          disabled={loading || !selectedManv}
          className="px-8 py-2.5 rounded-lg bg-[#334EAC] text-[#FFF9F0] text-sm font-medium hover:bg-[#2a3f8f] transition-colors disabled:opacity-45"
        >
          {loading ? "Đang lưu..." : "Lưu"}
        </button>
      </div>
    </div>
  );
}
