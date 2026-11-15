"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "@frontend/components/ui/DataTable";
import { PageCard } from "@frontend/components/ui/PageCard";
import { Pagination } from "@frontend/components/ui/Pagination";
import { ThongKeCard } from "@frontend/components/ui/ThongKeCard";
import { BANG_LUONG_CHUA_TONG_HOP, MAU_THONG_BAO } from "@frontend/config/thong-bao";
import { formatGio, formatNgay, formatTien } from "@frontend/lib/dinh-dang";
import type { ChiTietNgayDto } from "@backend/mappers/bang-luong";
import type { BangLuongMoiNhatDto } from "@backend/services/xem-bang-luong";

const SO_DONG_MOI_TRANG = 6;

export function XemBangLuongScreen() {
  const [trang, setTrang] = useState(1);
  const [data, setData] = useState<BangLuongMoiNhatDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const taiDuLieu = useCallback(async (trangCanTai: number) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `/api/bang-luong/moi-nhat?trang=${trangCanTai}&soDong=${SO_DONG_MOI_TRANG}`,
        { credentials: "include", cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setErrorMessage(json?.error?.message ?? "Không thể tải bảng lương");
        return;
      }
      setData(json.data as BangLuongMoiNhatDto);
    } catch {
      setErrorMessage("Không thể kết nối máy chủ để tải bảng lương");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void taiDuLieu(trang);
  }, [taiDuLieu, trang]);

  const columns: DataTableColumn<ChiTietNgayDto>[] = useMemo(
    () => [
      {
        key: "Ngaylam",
        header: "Ngày",
        render: (r) => <span className="font-medium text-[#334EAC]">{formatNgay(r.Ngaylam)}</span>,
      },
      {
        key: "Giolam",
        header: "Giờ thực tế",
        render: (r) => `${formatGio(r.Giolam)} giờ`,
      },
      {
        key: "Mucluong",
        header: "Lương/giờ",
        render: (r) => formatTien(r.Mucluong),
      },
      {
        key: "Heso",
        header: "Hệ số",
        render: (r) => String(r.Heso),
      },
      {
        key: "Thuong",
        header: "Thưởng",
        render: (r) => formatTien(r.Thuong),
      },
      {
        key: "Thanhtien",
        header: "Thành tiền",
        render: (r) => <span className="font-medium text-[#334EAC]">{formatTien(r.Thanhtien)}</span>,
      },
    ],
    []
  );

  return (
    <div data-hydrated="true" className="w-full min-w-0">
      <h1 className="text-xl sm:text-2xl font-bold text-[#334EAC] mb-4">Xem bảng lương</h1>

      {errorMessage && (
        <div
          role="alert"
          className="mb-4 rounded-xl border px-4 py-3 text-sm font-medium"
          style={{
            backgroundColor: MAU_THONG_BAO.loi.nen,
            borderColor: MAU_THONG_BAO.loi.vien,
            color: MAU_THONG_BAO.loi.chu,
          }}
        >
          {errorMessage}
        </div>
      )}

      {loading && !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 rounded-xl border border-[#7096D1]/40 bg-white/80 animate-pulse"
              />
            ))}
          </div>
          <div className="h-72 rounded-xl border border-[#7096D1]/40 bg-white/80 animate-pulse" />
        </div>
      ) : data && !data.coBangLuong ? (
        <div>
          <div className="min-h-[380px] sm:min-h-[440px] flex flex-col items-center justify-center text-center py-8 gap-5">
            <img
              src="/figma/vi-bang-luong.svg"
              alt="Bảng lương chưa được tổng hợp"
              width={116}
              height={122}
              className="w-24 h-24 sm:w-28 sm:h-28 object-contain"
            />
            <p
              data-testid="thong-bao-chua-tong-hop"
              className="text-base sm:text-lg font-medium text-[#334EAC]"
            >
              {BANG_LUONG_CHUA_TONG_HOP}
            </p>
          </div>

          <div className="border-t border-[#7096D1]/50 mt-5 pt-4 flex items-center justify-end">
            <Link
              href="/nhan-vien"
              className="inline-flex items-center justify-center rounded-lg border border-[#7096D1] bg-white px-6 py-2 text-sm font-semibold text-[#334EAC] hover:bg-[#F7F2EB] transition-colors"
            >
              Quay lại
            </Link>
          </div>
        </div>
      ) : data && data.coBangLuong && data.kyLuong && data.bangLuong ? (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <ThongKeCard
              label="Tổng lương dự kiến"
              value={formatTien(data.bangLuong.tongluong)}
              className="bg-white border-[#334EAC]/40"
            />
            <ThongKeCard
              label="Giờ làm thực tế"
              value={`${formatGio(data.bangLuong.tonggiolam)} giờ`}
              className="bg-white border-[#334EAC]/40"
            />
            <ThongKeCard
              label="Tổng tiền thưởng"
              value={formatTien(data.bangLuong.tienthuong)}
              className="bg-white border-[#334EAC]/40"
            />
          </div>

          <PageCard variant="primary" className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-base sm:text-lg font-bold text-[#334EAC]">
                Lương tháng {data.kyLuong.thang}
              </h2>
              <span
                data-testid="trang-thai-bang-luong"
                className="text-base sm:text-lg font-bold text-[#334EAC]"
              >
                {data.kyLuong.trangthai}
              </span>
            </div>

            <DataTable
              columns={columns}
              data={data.chiTiet}
              keyExtractor={(r) => r.Ngaylam}
              mobileCards
              compact
              emptyText="Chưa có dữ liệu ngày làm việc trong kỳ"
              ariaLabel="Chi tiết bảng lương theo ngày"
            />
          </PageCard>

          {data.phanTrang.tongSoTrang > 1 && (
            <div className="mt-3 flex items-center justify-end gap-3 flex-wrap">
              <span className="text-sm text-[#334EAC]" data-testid="phan-trang-nhan">
                Trang {data.phanTrang.trang} / {data.phanTrang.tongSoTrang}
              </span>
              <Pagination
                trang={data.phanTrang.trang}
                tongTrang={data.phanTrang.tongSoTrang}
                onChange={(t) => setTrang(t)}
              />
            </div>
          )}

          <div className="border-t border-[#7096D1]/50 mt-5 pt-4 flex items-center justify-end gap-3 flex-wrap">
            <Link
              href="/nhan-vien"
              className="inline-flex items-center justify-center rounded-lg border border-[#7096D1] bg-white px-6 py-2 text-sm font-semibold text-[#334EAC] hover:bg-[#F7F2EB] transition-colors"
            >
              Đóng
            </Link>
            {data.kyLuong.trangthai === "Dự kiến" && (
              <Link
                href="/nhan-vien/luong/phan-hoi"
                className="inline-flex items-center justify-center rounded-lg bg-[#334EAC] px-5 py-2 text-sm font-semibold text-white hover:bg-[#273d8a] transition-colors"
              >
                Phản hồi sai sót lương
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
