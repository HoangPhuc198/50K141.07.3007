"use client";

import React, { useState, useEffect, useCallback } from "react";
import { formatNgay, formatTien } from "@frontend/lib/dinh-dang";
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

// Field readonly với icon ổ khóa (giữ kích thước gốc, màu sắc theo Figma MCP)
function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#334EAC] mb-1.5">{label}</label>
      <div className="relative">
        <input
          readOnly
          value={value}
          className="w-full px-4 py-3 rounded-lg border border-[#7096D1] text-sm bg-[#F7F2EB] text-[#334EAC] cursor-not-allowed pr-10"
        />
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#334EAC]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
    </div>
  );
}

export default function XemNhanVienScreen() {
  const [searchQ, setSearchQ] = useState("");
  const [list, setList] = useState<NhanVienItem[]>([]);
  const [selectedManv, setSelectedManv] = useState<string | null>(null);
  const [detail, setDetail] = useState<NhanVienDetail | null>(null);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  useEffect(() => {
    const timer = setTimeout(() => fetchList(searchQ), 300);
    return () => clearTimeout(timer);
  }, [searchQ, fetchList]);

  const fetchDetail = async (manv: string) => {
    setLoadingDetail(true);
    setDetail(null);
    setShowPassword(false);
    try {
      const res = await fetch(`/api/chu-quan/nhan-vien/${manv}`);
      const json = await res.json();
      if (res.ok && json.ok) {
        setDetail(json.data);
      }
    } catch {
      // bỏ qua
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSelect = (manv: string) => {
    setSelectedManv(manv);
    fetchDetail(manv);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Detail area */}
      {!selectedManv ? (
        <p className="text-sm text-[#7096D1] text-center py-6">Chọn nhân viên bên dưới để xem thông tin chi tiết</p>
      ) : loadingDetail ? (
        <p className="text-sm text-[#7096D1] text-center py-6">Đang tải...</p>
      ) : detail ? (
        <>
          {/* Tiêu đề: chỉ có tên (đậm), mã ngay sau trong chip nhỏ có viền, không dấu · (NGOAI-LE-FIGMA) */}
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold text-[#334EAC]">
              {detail.Hoten}
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded border border-[#7096D1] text-xs font-medium text-[#334EAC] bg-[#F7F2EB]">
              {detail.Manv}
            </span>
          </div>

          <div className="flex flex-col lg:flex-row gap-5">
            {/* Card thông tin cá nhân */}
            <div className="flex-1 bg-[#FFF9F0] rounded-xl border border-[#7096D1] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.08)] p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <ReadonlyField label="Họ và tên" value={detail.Hoten} />
                <ReadonlyField label="Số điện thoại" value={detail.Sdt} />
                <ReadonlyField label="Địa chỉ" value={detail.Diachi} />
                <ReadonlyField label="Trường học" value={detail.Truonghoc || ""} />
                <ReadonlyField label="Vị trí" value={detail.Vitrilamviec} />
                <ReadonlyField label="Hình thức làm việc" value={detail.Hinhthuclam} />
                <ReadonlyField label="Ngày vào làm" value={formatNgay(detail.Ngayvaolam)} />
                <ReadonlyField label="Kinh nghiệm" value={detail.Kinhnghiem} />
                <ReadonlyField label="Trạng thái" value={detail.Trangthai} />
                <ReadonlyField label="Mức lương theo giờ" value={`${formatTien(detail.Mucluongtheogio)}/giờ`} />
              </div>
            </div>

            {/* Card thông tin tài khoản (Figma 45:35845: bg #F7F2EB) */}
            <div className="lg:w-[320px] flex-shrink-0 bg-[#F7F2EB] rounded-xl border border-[#7096D1] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.08)] p-5 flex flex-col gap-4 self-start w-full">
              <h3 className="text-base font-semibold text-[#334EAC]">Thông tin tài khoản</h3>

              <ReadonlyField label="Tên đăng nhập" value={detail.Tendangnhap || detail.Manv} />

              <div>
                <label className="block text-sm font-medium text-[#334EAC] mb-1.5">Mật khẩu</label>
                <div className="relative">
                  <input
                    readOnly
                    type={showPassword ? "text" : "password"}
                    value={detail.matKhauGiaiMa || ""}
                    className="w-full px-4 py-3 rounded-lg border border-[#7096D1] text-sm bg-[#F7F2EB] text-[#334EAC] cursor-not-allowed pr-10"
                  />
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#334EAC]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="w-full py-2.5 rounded-lg border border-[#334EAC] bg-[#FFF9F0] text-[#334EAC] text-sm font-medium hover:bg-[#EBF0FA] transition-colors"
              >
                {showPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {/* Danh sách nhân viên — ô tìm kiếm + bảng */}
      <div className="bg-[#FFF9F0] rounded-xl border border-[#7096D1] shadow-[0px_4px_16px_0px_rgba(0,0,0,0.08)] p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <h2 className="text-base font-semibold text-[#334EAC] flex-shrink-0">Danh sách nhân viên</h2>
          <input
            id="search-xem-nv"
            aria-label="Tìm theo tên hoặc mã"
            placeholder={PLACEHOLDER.timNhanVien}
            className="flex-1 px-4 py-2.5 rounded-lg border border-[#7096D1] text-sm bg-[#FFF9F0] text-[#334EAC] placeholder:text-[#7096D1] focus:outline-none focus:ring-2 focus:ring-[#334EAC]/30"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
        </div>

        {loadingList ? (
          <p className="text-sm text-[#7096D1] text-center py-6">Đang tải...</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-[#7096D1] text-center py-6">Không tìm thấy nhân viên nào</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F7F2EB] border-b border-[#7096D1]">
                    <th className="text-left py-2.5 px-3 text-[#334EAC] font-semibold">Mã NV</th>
                    <th className="text-left py-2.5 px-3 text-[#334EAC] font-semibold">Họ và tên</th>
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
                        onClick={() => handleSelect(nv.Manv)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSelect(nv.Manv);
                          }
                        }}
                        className={`cursor-pointer border-b border-[#7096D1]/30 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#334EAC] ${
                          isSelected ? "bg-[#7096D1] text-[#334EAC]" : "bg-[#FFF9F0] text-[#334EAC] hover:bg-[#EBF0FA]"
                        }`}
                      >
                        <td className="py-2.5 px-3 font-medium text-[#334EAC]">
                          {nv.Manv}
                        </td>
                        <td className="py-2.5 px-3 text-[#334EAC]">
                          {nv.Hoten}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden flex flex-col gap-2">
              {list.map((nv) => {
                const isSelected = nv.Manv === selectedManv;
                return (
                  <button
                    key={nv.Manv}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleSelect(nv.Manv)}
                    className={`w-full min-h-[44px] text-left rounded-lg px-4 py-3 border transition-colors ${
                      isSelected
                        ? "bg-[#7096D1] text-[#334EAC] border-[#7096D1]"
                        : "bg-[#F7F2EB] text-[#334EAC] border-[#7096D1]"
                    }`}
                  >
                    <p className="font-semibold text-sm">{nv.Hoten}</p>
                    <p className="text-xs mt-0.5 text-[#334EAC]/80">
                      {nv.Manv}
                    </p>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
