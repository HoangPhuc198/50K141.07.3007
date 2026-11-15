import { prisma, withDbRetry } from "@database/client";
import { Prisma } from "@prisma/client";
import {
  DangKyLichRanhInput,
  XepLichLamInput,
  XepCaLamInput,
} from "../validators/lich-lam";
import { getTuanHienThiLichRanh, nowVN } from "../lib/time";
import { DANG_KY_LICH_RANH_CHUA_CHON, DANG_KY_LICH_RANH_THANH_CONG } from "@frontend/config/thong-bao";

export class LichLamServiceError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "LichLamServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Sinh mã LichRanh tiếp theo dạng LRxxxxxx (ví dụ LR000001) trong transaction.
 */
export async function generateNextMalichranh(tx: Prisma.TransactionClient): Promise<string> {
  await tx.$executeRawUnsafe('LOCK TABLE "LichRanh" IN EXCLUSIVE MODE');

  const records = await tx.lichRanh.findMany({
    select: { Malichranh: true },
  });

  let maxNum = 0;
  for (const r of records) {
    const trimmed = r.Malichranh.trim();
    if (trimmed.startsWith("LR")) {
      const numPart = parseInt(trimmed.slice(2), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `LR${String(nextNum).padStart(6, "0")}`;
}

/**
 * Sinh mã LichLam tiếp theo dạng LLxxxxxx (ví dụ LL000001) trong transaction.
 */
export async function generateNextMalich(tx: Prisma.TransactionClient): Promise<string> {
  await tx.$executeRawUnsafe('LOCK TABLE "LichLam" IN EXCLUSIVE MODE');

  const records = await tx.lichLam.findMany({
    select: { Malich: true },
  });

  let maxNum = 0;
  for (const r of records) {
    const trimmed = r.Malich.trim();
    if (trimmed.startsWith("LL")) {
      const numPart = parseInt(trimmed.slice(2), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  }

  const nextNum = maxNum + 1;
  return `LL${String(nextNum).padStart(6, "0")}`;
}

/**
 * Kiểm tra Malich có thuộc 45 dòng khởi tạo mẫu ban đầu của seed.sql (LL000001..LL000045) hay không.
 * Khi chủ quán lưu lịch làm (UC_6.1) hoặc xếp ca (UC_6.2), ngày đó sẽ có bản ghi LichLam ngoài tập mẫu ban đầu.
 */
export function isSeedMalich(malich: string): boolean {
  return /^LL0000(0[1-9]|[1-3]\d|4[0-5])$/.test(malich.trim());
}

/**
 * Lấy danh sách ngày (YYYY-MM-DD) trong khoảng [start, end] đã được chủ quán lưu lịch làm.
 */
export async function getNgayDaKhoaTrongTuan(
  db: Prisma.TransactionClient | typeof prisma,
  start: Date,
  end: Date
): Promise<string[]> {
  const lichLams = await db.lichLam.findMany({
    where: {
      Ngaylam: {
        gte: start,
        lte: end,
      },
    },
    select: {
      Malich: true,
      Ngaylam: true,
    },
  });

  const lockedSet = new Set<string>();
  for (const ll of lichLams) {
    if (!isSeedMalich(ll.Malich)) {
      lockedSet.add(ll.Ngaylam.toISOString().split("T")[0]);
    }
  }
  return Array.from(lockedSet).sort();
}

// ============================================================
// UC 2.1: ĐĂNG KÝ LỊCH RẢNH (Nhân viên)
// ============================================================

export async function dangKyLichRanh(manv: string, input: DangKyLichRanhInput) {
  if (!input.danhSach || input.danhSach.length === 0) {
    throw new LichLamServiceError(DANG_KY_LICH_RANH_CHUA_CHON, 400, "EMPTY_SELECTION");
  }

  // Chỉ nhận ngày thuộc tuần hiển thị tại thời điểm gửi theo giờ Việt Nam (không khóa theo giờ)
  const tuanHienThi = getTuanHienThiLichRanh(nowVN());
  const validDates = new Set(tuanHienThi.days.map((d) => d.fullDate));
  if (
    input.startDate !== tuanHienThi.startDate ||
    input.endDate !== tuanHienThi.endDate ||
    input.danhSach.some((item) => !validDates.has(item.ngay))
  ) {
    throw new LichLamServiceError(
      "Ngày đăng ký phải thuộc tuần hiển thị hiện tại",
      400,
      "INVALID_WEEK"
    );
  }

  return await withDbRetry(async (db) => {
    return await db.$transaction(async (tx) => {
      const start = new Date(tuanHienThi.startDate + "T00:00:00Z");
      const end = new Date(tuanHienThi.endDate + "T23:59:59Z");

      // Kiểm tra các ngày đã được chủ quán lưu lịch làm (bị khóa)
      const ngayDaKhoaList = await getNgayDaKhoaTrongTuan(tx, start, end);
      const ngayDaKhoaSet = new Set(ngayDaKhoaList);

      if (input.danhSach.some((item) => ngayDaKhoaSet.has(item.ngay))) {
        throw new LichLamServiceError(
          "Ngày đăng ký đã được chủ quán duyệt lịch làm, không thể chỉnh sửa lịch rảnh",
          409,
          "LOCKED_DATE"
        );
      }

      const lockedDatesDb = ngayDaKhoaList.map((d) => new Date(d + "T00:00:00Z"));

      // 1. Xóa lịch rảnh cũ của nhân viên ở các ngày CHƯA khóa trong tuần đã chọn
      await tx.lichRanh.deleteMany({
        where: {
          Manv: manv,
          Ngayranh: {
            gte: start,
            lte: end,
            ...(lockedDatesDb.length > 0 ? { notIn: lockedDatesDb } : {}),
          },
        },
      });

      // 2. Lấy số thứ tự lớn nhất hiện tại để sinh mã tuần tự
      const records = await tx.lichRanh.findMany({
        select: { Malichranh: true },
      });
      let currentMax = 0;
      for (const r of records) {
        const trimmed = r.Malichranh.trim();
        if (trimmed.startsWith("LR")) {
          const numPart = parseInt(trimmed.slice(2), 10);
          if (!isNaN(numPart) && numPart > currentMax) {
            currentMax = numPart;
          }
        }
      }

      // 3. Tạo mới các bản ghi LichRanh
      // Khử trùng lặp (Ngayranh, Caranh) nếu client gửi trùng
      const uniqueItems = new Map<string, { ngay: string; maCa: string }>();
      for (const item of input.danhSach) {
        const key = `${item.ngay}_${item.maCa}`;
        uniqueItems.set(key, item);
      }

      const created: Array<{ Malichranh: string; Ngayranh: string; Caranh: string }> = [];

      for (const item of Array.from(uniqueItems.values())) {
        currentMax++;
        const nextMa = `LR${String(currentMax).padStart(6, "0")}`;
        const record = await tx.lichRanh.create({
          data: {
            Malichranh: nextMa,
            Manv: manv,
            Ngayranh: new Date(item.ngay + "T00:00:00Z"),
            Caranh: item.maCa,
          },
        });
        created.push({
          Malichranh: record.Malichranh,
          Ngayranh: item.ngay,
          Caranh: record.Caranh,
        });
      }

      return {
        message: DANG_KY_LICH_RANH_THANH_CONG,
        count: created.length,
        items: created,
      };
    });
  });
}

export async function layLichRanhCuaToi(manv: string, startDate: string, endDate: string) {
  return await withDbRetry(async (db) => {
    const start = new Date(startDate + "T00:00:00Z");
    const end = new Date(endDate + "T23:59:59Z");

    const caLams = await db.caLam.findMany({
      orderBy: { Giobatdau: "asc" },
    });

    const lichRanhs = await db.lichRanh.findMany({
      where: {
        Manv: manv,
        Ngayranh: {
          gte: start,
          lte: end,
        },
      },
      include: {
        CaLam: true,
      },
    });

    const items = lichRanhs.map((lr) => ({
      Malichranh: lr.Malichranh.trim(),
      Ngayranh: lr.Ngayranh.toISOString().split("T")[0],
      Caranh: lr.Caranh.trim(),
      Loaica: lr.CaLam.Loaica,
    }));

    const ngayDaKhoa = await getNgayDaKhoaTrongTuan(db, start, end);

    return {
      caLams: caLams.map((c) => ({
        Maca: c.Maca.trim(),
        Loaica: c.Loaica,
        Giobatdau: c.Giobatdau.toISOString().substring(11, 16),
        Gioketthuc: c.Gioketthuc.toISOString().substring(11, 16),
        Sonvquydinh: c.Sonvquydinh,
      })),
      lichRanhs: items,
      ngayDaKhoa,
    };
  });
}

// ============================================================
// UC 6.1: XẾP LỊCH LÀM (Chủ quán)
// ============================================================

export async function layDuLieuXepLich(startDate: string, endDate: string) {
  return await withDbRetry(async (db) => {
    const start = new Date(startDate + "T00:00:00Z");
    const end = new Date(endDate + "T23:59:59Z");

    // 1. Ca làm
    const caLams = await db.caLam.findMany({
      orderBy: { Giobatdau: "asc" },
    });

    // 2. Lịch làm đã tạo trong tuần
    const lichLams = await db.lichLam.findMany({
      where: {
        Ngaylam: {
          gte: start,
          lte: end,
        },
      },
      include: {
        NhanVien_LichLam: {
          include: {
            NhanVien: true,
          },
        },
      },
    });

    // 3. Lịch rảnh của nhân viên trong tuần
    const lichRanhs = await db.lichRanh.findMany({
      where: {
        Ngayranh: {
          gte: start,
          lte: end,
        },
      },
      include: {
        NhanVien: true,
        CaLam: true,
      },
    });

    // 4. Danh sách tất cả nhân viên (loại trừ đã nghỉ việc nếu có)
    const nhanViens = await db.nhanVien.findMany({
      where: {
        Trangthai: { not: "Đã nghỉ việc" },
      },
      orderBy: { Manv: "asc" },
    });

    // Nhóm lịch rảnh theo từng ngày
    // { [ngay: string]: Array<{ manv, hoten, vitri, caranh: string[] }> }
    const ranhTheoNgay: Record<
      string,
      Array<{ Manv: string; Hoten: string; Vitrilamviec: string; CaRanh: string[] }>
    > = {};

    for (const lr of lichRanhs) {
      const dateStr = lr.Ngayranh.toISOString().split("T")[0];
      if (!ranhTheoNgay[dateStr]) {
        ranhTheoNgay[dateStr] = [];
      }
      let nvEntry = ranhTheoNgay[dateStr].find((e) => e.Manv === lr.Manv.trim());
      if (!nvEntry) {
        nvEntry = {
          Manv: lr.Manv.trim(),
          Hoten: lr.NhanVien.Hoten,
          Vitrilamviec: lr.NhanVien.Vitrilamviec,
          CaRanh: [],
        };
        ranhTheoNgay[dateStr].push(nvEntry);
      }
      nvEntry.CaRanh.push(lr.CaLam.Loaica);
    }

    // Nhóm ngày đã tạo lịch làm
    const ngayDaTaoLich = Array.from(
      new Set(lichLams.map((ll) => ll.Ngaylam.toISOString().split("T")[0]))
    );

    return {
      caLams: caLams.map((c) => ({
        Maca: c.Maca.trim(),
        Loaica: c.Loaica,
        Giobatdau: c.Giobatdau.toISOString().substring(11, 16),
        Gioketthuc: c.Gioketthuc.toISOString().substring(11, 16),
        Sonvquydinh: c.Sonvquydinh,
      })),
      ranhTheoNgay,
      ngayDaTaoLich,
      nhanViens: nhanViens.map((nv) => ({
        Manv: nv.Manv.trim(),
        Hoten: nv.Hoten,
        Vitrilamviec: nv.Vitrilamviec,
      })),
    };
  });
}

export async function luuXepLich(input: XepLichLamInput) {
  return await withDbRetry(async (db) => {
    return await db.$transaction(async (tx) => {
      const caLams = await tx.caLam.findMany({
        orderBy: { Giobatdau: "asc" },
      });

      if (caLams.length === 0) {
        throw new LichLamServiceError("Không tìm thấy ca làm trong hệ thống", 500, "NO_SHIFT");
      }

      // Tìm max Malich hiện tại
      const allLich = await tx.lichLam.findMany({
        select: { Malich: true },
      });
      let currentMax = 0;
      for (const r of allLich) {
        const trimmed = r.Malich.trim();
        if (trimmed.startsWith("LL")) {
          const numPart = parseInt(trimmed.slice(2), 10);
          if (!isNaN(numPart) && numPart > currentMax) {
            currentMax = numPart;
          }
        }
      }

      let createdCount = 0;

      for (const ngayStr of input.cacNgay) {
        const ngayDate = new Date(ngayStr + "T00:00:00Z");

        for (const ca of caLams) {
          // Kiểm tra xem đã có LichLam(Ngaylam, Maca) chưa
          const existing = await tx.lichLam.findFirst({
            where: {
              Ngaylam: ngayDate,
              Maca: ca.Maca,
            },
          });

          if (!existing) {
            currentMax++;
            const malich = `LL${String(currentMax).padStart(6, "0")}`;
            await tx.lichLam.create({
              data: {
                Malich: malich,
                Ngaylam: ngayDate,
                Maca: ca.Maca,
              },
            });
            createdCount++;
          }
        }

        // Nếu cả 3 ca của ngày đều có Malich thuộc seed (LL000001..LL000045),
        // nâng cấp 1 ca không có ràng buộc phụ thuộc lên Malich mới (> LL000045) để đánh dấu ngày đã được chủ quán duyệt
        const dayLichs = await tx.lichLam.findMany({
          where: { Ngaylam: ngayDate },
          include: {
            ChamCong: true,
            DonXinDoiCa: true,
            YeuCauBoSungCC: true,
            NhanVien_LichLam: true,
          },
          orderBy: { Maca: "desc" },
        });

        if (dayLichs.length > 0 && dayLichs.every((l) => isSeedMalich(l.Malich))) {
          const targetLich = dayLichs.find(
            (l) =>
              l.ChamCong.length === 0 &&
              l.DonXinDoiCa.length === 0 &&
              l.YeuCauBoSungCC.length === 0
          );
          if (targetLich) {
            currentMax++;
            const newMalich = `LL${String(currentMax).padStart(6, "0")}`;
            const nvIds = targetLich.NhanVien_LichLam.map((x) => x.Manv);
            await tx.nhanVien_LichLam.deleteMany({
              where: { Malich: targetLich.Malich },
            });
            await tx.lichLam.update({
              where: { Malich: targetLich.Malich },
              data: { Malich: newMalich },
            });
            for (const manv of nvIds) {
              await tx.nhanVien_LichLam.create({
                data: {
                  Malich: newMalich,
                  Manv: manv,
                },
              });
            }
          }
        }
      }

      // Nếu chủ quán bỏ một ngày khỏi danh sách ngày lưu trong cùng tuần -> mở khóa lại ngày đó (nếu dữ liệu cho phép)
      if (input.cacNgay.length > 0) {
        const d0 = new Date(input.cacNgay[0] + "T00:00:00Z");
        const dow = d0.getUTCDay();
        const diffToMon = dow === 0 ? -6 : 1 - dow;
        const monDate = new Date(d0);
        monDate.setUTCDate(d0.getUTCDate() + diffToMon);

        const savedSet = new Set(input.cacNgay);
        for (let i = 0; i < 7; i++) {
          const cur = new Date(monDate);
          cur.setUTCDate(monDate.getUTCDate() + i);
          const curIso = cur.toISOString().split("T")[0];
          if (savedSet.has(curIso)) continue;

          const dayLichs = await tx.lichLam.findMany({
            where: { Ngaylam: cur },
            include: {
              ChamCong: true,
              DonXinDoiCa: true,
              YeuCauBoSungCC: true,
              NhanVien_LichLam: true,
            },
            orderBy: { Maca: "asc" },
          });

          if (!dayLichs.some((l) => !isSeedMalich(l.Malich))) continue;

          const seedRows = dayLichs.filter((l) => isSeedMalich(l.Malich));
          if (seedRows.length > 0) {
            // Ngày thuộc tập seed ban đầu: hoàn trả ca đã nâng cấp về mã seed gốc để mở khóa mà không mất dữ liệu mẫu
            const firstSeedNum = parseInt(seedRows[0].Malich.trim().slice(2), 10);
            const baseSeedNum = Math.floor((firstSeedNum - 1) / 3) * 3 + 1;
            for (let idx = 0; idx < dayLichs.length; idx++) {
              const l = dayLichs[idx];
              if (
                !isSeedMalich(l.Malich) &&
                l.ChamCong.length === 0 &&
                l.DonXinDoiCa.length === 0 &&
                l.YeuCauBoSungCC.length === 0
              ) {
                const origSeedMalich = `LL${String(baseSeedNum + idx).padStart(6, "0")}`;
                const existsOrig = await tx.lichLam.findUnique({
                  where: { Malich: origSeedMalich },
                });
                if (!existsOrig) {
                  const nvIds = l.NhanVien_LichLam.map((x) => x.Manv);
                  await tx.nhanVien_LichLam.deleteMany({
                    where: { Malich: l.Malich },
                  });
                  await tx.lichLam.update({
                    where: { Malich: l.Malich },
                    data: { Malich: origSeedMalich },
                  });
                  for (const manv of nvIds) {
                    await tx.nhanVien_LichLam.create({
                      data: {
                        Malich: origSeedMalich,
                        Manv: manv,
                      },
                    });
                  }
                }
              }
            }
          } else {
            // Ngày ngoài tập seed: xóa các LichLam chưa phát sinh dữ liệu phụ thuộc để mở khóa lại
            for (const l of dayLichs) {
              if (
                l.ChamCong.length === 0 &&
                l.DonXinDoiCa.length === 0 &&
                l.YeuCauBoSungCC.length === 0
              ) {
                await tx.nhanVien_LichLam.deleteMany({
                  where: { Malich: l.Malich },
                });
                await tx.lichLam.delete({
                  where: { Malich: l.Malich },
                });
              }
            }
          }
        }
      }

      return {
        message: "Đã lưu lịch thành công",
        createdCount,
      };
    });
  });
}

// ============================================================
// UC 6.2: XẾP CA LÀM (Chủ quán)
// ============================================================

export async function layDuLieuXepCa(ngay: string) {
  return await withDbRetry(async (db) => {
    const ngayDate = new Date(ngay + "T00:00:00Z");

    const caLams = await db.caLam.findMany({
      orderBy: { Giobatdau: "asc" },
    });

    // 1. Lấy các ca LichLam của ngày (nếu đã tạo từ UC_6.1 hoặc đã lưu)
    const lichLams = await db.lichLam.findMany({
      where: {
        Ngaylam: ngayDate,
      },
      include: {
        CaLam: true,
        NhanVien_LichLam: {
          include: {
            NhanVien: true,
          },
        },
      },
      orderBy: { CaLam: { Giobatdau: "asc" } },
    });

    // 2. Lấy lịch rảnh của nhân viên trong ngày này
    const lichRanhs = await db.lichRanh.findMany({
      where: {
        Ngayranh: ngayDate,
      },
      include: {
        NhanVien: true,
      },
    });

    // 3. Danh sách toàn bộ nhân viên hoạt động
    const nhanViens = await db.nhanVien.findMany({
      where: { Trangthai: { not: "Đã nghỉ việc" } },
      orderBy: { Manv: "asc" },
    });

    // Đảm bảo luôn trả về đủ 3 ca quy định (Sáng, Chiều, Tối)
    const caDetails = caLams.map((ca) => {
      const ll = lichLams.find((l) => l.Maca.trim() === ca.Maca.trim());

      // Ai rảnh ca này?
      const ranhTrongCa = lichRanhs
        .filter((lr) => lr.Caranh.trim() === ca.Maca.trim())
        .map((lr) => ({
          Manv: lr.Manv.trim(),
          Hoten: lr.NhanVien.Hoten,
        }));

      const daXep = ll
        ? ll.NhanVien_LichLam.map((nvll) => ({
            Manv: nvll.Manv.trim(),
            Hoten: nvll.NhanVien.Hoten,
            Vitrilamviec: nvll.NhanVien.Vitrilamviec,
          }))
        : [];

      return {
        Malich: ll ? ll.Malich.trim() : "",
        Maca: ca.Maca.trim(),
        Loaica: ca.Loaica,
        Giobatdau: ca.Giobatdau.toISOString().substring(11, 16),
        Gioketthuc: ca.Gioketthuc.toISOString().substring(11, 16),
        Sonvquydinh: ca.Sonvquydinh,
        nhanVienDaXep: daXep,
        nhanVienRanh: ranhTrongCa,
      };
    });

    return {
      ngay,
      caDetails,
      tatCaNhanVien: nhanViens.map((nv) => ({
        Manv: nv.Manv.trim(),
        Hoten: nv.Hoten,
        Vitrilamviec: nv.Vitrilamviec,
      })),
    };
  });
}

export async function luuXepCa(input: XepCaLamInput) {
  return await withDbRetry(async (db) => {
    return await db.$transaction(async (tx) => {
      const ngayDate = new Date(input.ngay + "T00:00:00Z");

      for (const p of input.phanCong) {
        // Tìm LichLam
        let lichLam = await tx.lichLam.findFirst({
          where: {
            Ngaylam: ngayDate,
            Maca: p.maCa,
          },
        });

        if (!lichLam) {
          const maxL = await tx.lichLam.findMany({ select: { Malich: true } });
          let m = 0;
          for (const r of maxL) {
            const trimmed = r.Malich.trim();
            if (trimmed.startsWith("LL")) {
              const n = parseInt(trimmed.slice(2), 10);
              if (!isNaN(n) && n > m) m = n;
            }
          }
          const malich = `LL${String(m + 1).padStart(6, "0")}`;
          lichLam = await tx.lichLam.create({
            data: {
              Malich: malich,
              Ngaylam: ngayDate,
              Maca: p.maCa,
            },
          });
        }

        // Xóa phân công cũ của ca này
        await tx.nhanVien_LichLam.deleteMany({
          where: {
            Malich: lichLam.Malich,
          },
        });

        // Gán phân công mới
        const uniqueNvs = Array.from(new Set(p.nhanVienIds));
        for (const manv of uniqueNvs) {
          await tx.nhanVien_LichLam.create({
            data: {
              Malich: lichLam.Malich,
              Manv: manv,
            },
          });
        }
      }

      return {
        message: "Đã lưu",
      };
    });
  });
}
