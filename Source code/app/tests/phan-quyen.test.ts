import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { signSession, AUTH_COOKIE_NAME, UserPayload } from "@backend/lib/auth";
import { prisma } from "@database/client";

// Auth & chung
import { POST as postLogout } from "@/app/api/auth/logout/route";
import { GET as getAuthMe } from "@/app/api/auth/me/route";
import { GET as getThongBao } from "@/app/api/thong-bao/route";

// Chủ quán routes
import { GET as getCqTongQuan } from "@/app/api/chu-quan/tong-quan/route";
import { GET as getCqNhanVien, POST as postCqNhanVien } from "@/app/api/chu-quan/nhan-vien/route";
import {
  GET as getCqNhanVienId,
  PUT as putCqNhanVienId,
  DELETE as delCqNhanVienId,
} from "@/app/api/chu-quan/nhan-vien/[id]/route";
import { GET as getCqMucLuong, PUT as putCqMucLuong } from "@/app/api/chu-quan/muc-luong/route";
import { GET as getCqLichLam, POST as postCqLichLam } from "@/app/api/chu-quan/lich-lam/route";
import {
  GET as getCqXepCa,
  POST as postCqXepCa,
  PUT as putCqXepCa,
} from "@/app/api/chu-quan/lich-lam/xep-ca/route";
import { GET as getLichLamAlias, POST as postLichLamAlias } from "@/app/api/lich-lam/route";
import {
  GET as getXepCaAlias,
  POST as postXepCaAlias,
  PUT as putXepCaAlias,
} from "@/app/api/lich-lam/xep-ca/route";
import { GET as getBaoCaoChamCong } from "@/app/api/bao-cao/cham-cong/route";
import { GET as getBoSungXuLy, POST as postBoSungXuLy } from "@/app/api/bo-sung-cc/xu-ly/route";
import { GET as getDoiCaXuLy, POST as postDoiCaXuLy } from "@/app/api/doi-ca/xu-ly/route";
import { PUT as putDoiCa } from "@/app/api/doi-ca/route";
import {
  GET as getHeSo,
  POST as postHeSo,
  DELETE as delHeSoQuery,
} from "@/app/api/he-so/route";
import { DELETE as delHeSoId } from "@/app/api/he-so/[id]/route";
import {
  GET as getTienThuong,
  POST as postTienThuong,
  PUT as putTienThuong,
} from "@/app/api/tien-thuong/route";
import { PUT as putBangLuongThuong } from "@/app/api/bang-luong/[id]/thuong/route";
import { PUT as putBangLuongId } from "@/app/api/bang-luong/[id]/route";
import { POST as postPhanHoiKhongSua } from "@/app/api/phan-hoi-luong/[id]/khong-chinh-sua/route";
import { GET as getKyLuong } from "@/app/api/ky-luong/route";
import { GET as getKyLuongHienTai } from "@/app/api/ky-luong/hien-tai/route";
import { POST as postKyLuongTinh } from "@/app/api/ky-luong/[id]/tinh/route";
import { POST as postKyLuongGui } from "@/app/api/ky-luong/[id]/gui/route";
import { POST as postKyLuongChot } from "@/app/api/ky-luong/[id]/chot/route";
import { GET as getKyLuongTongHop } from "@/app/api/ky-luong/[id]/tong-hop/route";
import { GET as getKyLuongSaiSot } from "@/app/api/ky-luong/[id]/sai-sot/route";
import { GET as getKyLuongBangLuong } from "@/app/api/ky-luong/[id]/bang-luong/route";
import { GET as getKyLuongNvChiTiet } from "@/app/api/ky-luong/[id]/nhan-vien/[manv]/chi-tiet/route";

// Nhân viên routes
import { GET as getNvTongQuan } from "@/app/api/nhan-vien/tong-quan/route";
import { GET as getNvLichRanh, POST as postNvLichRanh, PUT as putNvLichRanh } from "@/app/api/nhan-vien/lich-ranh/route";
import { GET as getLichRanhAlias, POST as postLichRanhAlias, PUT as putLichRanhAlias } from "@/app/api/lich-ranh/route";
import { GET as getChamCongHomNay } from "@/app/api/cham-cong/hom-nay/route";
import { POST as postCheckIn } from "@/app/api/cham-cong/check-in/route";
import { POST as postCheckOut } from "@/app/api/cham-cong/check-out/route";
import { GET as getBoSungCaThieu } from "@/app/api/bo-sung-cc/ca-thieu/route";
import { POST as postBoSungCC } from "@/app/api/bo-sung-cc/route";
import { GET as getDoiCaCaCuaToi } from "@/app/api/doi-ca/ca-cua-toi/route";
import { POST as postDoiCa } from "@/app/api/doi-ca/route";
import { GET as getThayCaCaTrongNgay } from "@/app/api/thay-ca/ca-trong-ngay/route";
import { GET as getThayCaDangMo } from "@/app/api/thay-ca/dang-mo/route";
import { POST as postThayCa } from "@/app/api/thay-ca/route";
import { POST as postThayCaChapNhan } from "@/app/api/thay-ca/[id]/chap-nhan/route";
import { POST as postThayCaTuChoi } from "@/app/api/thay-ca/[id]/tu-choi/route";
import { GET as getBangLuongMoiNhat } from "@/app/api/bang-luong/moi-nhat/route";
import { GET as getPhanHoiLuong, POST as postPhanHoiLuong } from "@/app/api/phan-hoi-luong/route";

// Dual-role routes
import { GET as getDoiCa } from "@/app/api/doi-ca/route";
import { GET as getDoiCaNguoiThay } from "@/app/api/doi-ca/nguoi-thay/route";

type RouteHandler = (
  req: Request,
  ctx: { params: Promise<Record<string, string | string[]>> }
) => Promise<Response>;

interface RouteSpec {
  name: string;
  handler: RouteHandler;
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  role: "ChuQuan" | "NhanVien" | "Auth";
  params?: Record<string, string>;
}

const ALL_PROTECTED_ROUTES: RouteSpec[] = [
  // Chung
  { name: "POST /api/auth/logout", handler: postLogout, method: "POST", url: "http://localhost:3000/api/auth/logout", role: "Auth" },
  { name: "GET /api/auth/me", handler: getAuthMe, method: "GET", url: "http://localhost:3000/api/auth/me", role: "Auth" },
  { name: "GET /api/thong-bao", handler: getThongBao, method: "GET", url: "http://localhost:3000/api/thong-bao", role: "Auth" },
  { name: "GET /api/doi-ca", handler: getDoiCa, method: "GET", url: "http://localhost:3000/api/doi-ca", role: "Auth" },
  { name: "GET /api/doi-ca/nguoi-thay", handler: getDoiCaNguoiThay, method: "GET", url: "http://localhost:3000/api/doi-ca/nguoi-thay", role: "Auth" },

  // Chủ quán
  { name: "GET /api/chu-quan/tong-quan", handler: getCqTongQuan, method: "GET", url: "http://localhost:3000/api/chu-quan/tong-quan", role: "ChuQuan" },
  { name: "GET /api/chu-quan/nhan-vien", handler: getCqNhanVien, method: "GET", url: "http://localhost:3000/api/chu-quan/nhan-vien", role: "ChuQuan" },
  { name: "POST /api/chu-quan/nhan-vien", handler: postCqNhanVien, method: "POST", url: "http://localhost:3000/api/chu-quan/nhan-vien", role: "ChuQuan" },
  { name: "GET /api/chu-quan/nhan-vien/[id]", handler: getCqNhanVienId, method: "GET", url: "http://localhost:3000/api/chu-quan/nhan-vien/NV000001", role: "ChuQuan", params: { id: "NV000001" } },
  { name: "PUT /api/chu-quan/nhan-vien/[id]", handler: putCqNhanVienId, method: "PUT", url: "http://localhost:3000/api/chu-quan/nhan-vien/NV000001", role: "ChuQuan", params: { id: "NV000001" } },
  { name: "DELETE /api/chu-quan/nhan-vien/[id]", handler: delCqNhanVienId, method: "DELETE", url: "http://localhost:3000/api/chu-quan/nhan-vien/NV000001", role: "ChuQuan", params: { id: "NV000001" } },
  { name: "GET /api/chu-quan/muc-luong", handler: getCqMucLuong, method: "GET", url: "http://localhost:3000/api/chu-quan/muc-luong", role: "ChuQuan" },
  { name: "PUT /api/chu-quan/muc-luong", handler: putCqMucLuong, method: "PUT", url: "http://localhost:3000/api/chu-quan/muc-luong", role: "ChuQuan" },
  { name: "GET /api/chu-quan/lich-lam", handler: getCqLichLam, method: "GET", url: "http://localhost:3000/api/chu-quan/lich-lam", role: "ChuQuan" },
  { name: "POST /api/chu-quan/lich-lam", handler: postCqLichLam, method: "POST", url: "http://localhost:3000/api/chu-quan/lich-lam", role: "ChuQuan" },
  { name: "GET /api/chu-quan/lich-lam/xep-ca", handler: getCqXepCa, method: "GET", url: "http://localhost:3000/api/chu-quan/lich-lam/xep-ca", role: "ChuQuan" },
  { name: "POST /api/chu-quan/lich-lam/xep-ca", handler: postCqXepCa, method: "POST", url: "http://localhost:3000/api/chu-quan/lich-lam/xep-ca", role: "ChuQuan" },
  { name: "PUT /api/chu-quan/lich-lam/xep-ca", handler: putCqXepCa, method: "PUT", url: "http://localhost:3000/api/chu-quan/lich-lam/xep-ca", role: "ChuQuan" },
  { name: "GET /api/lich-lam", handler: getLichLamAlias, method: "GET", url: "http://localhost:3000/api/lich-lam", role: "ChuQuan" },
  { name: "POST /api/lich-lam", handler: postLichLamAlias, method: "POST", url: "http://localhost:3000/api/lich-lam", role: "ChuQuan" },
  { name: "GET /api/lich-lam/xep-ca", handler: getXepCaAlias, method: "GET", url: "http://localhost:3000/api/lich-lam/xep-ca", role: "ChuQuan" },
  { name: "POST /api/lich-lam/xep-ca", handler: postXepCaAlias, method: "POST", url: "http://localhost:3000/api/lich-lam/xep-ca", role: "ChuQuan" },
  { name: "PUT /api/lich-lam/xep-ca", handler: putXepCaAlias, method: "PUT", url: "http://localhost:3000/api/lich-lam/xep-ca", role: "ChuQuan" },
  { name: "GET /api/bao-cao/cham-cong", handler: getBaoCaoChamCong, method: "GET", url: "http://localhost:3000/api/bao-cao/cham-cong", role: "ChuQuan" },
  { name: "GET /api/bo-sung-cc/xu-ly", handler: getBoSungXuLy, method: "GET", url: "http://localhost:3000/api/bo-sung-cc/xu-ly", role: "ChuQuan" },
  { name: "POST /api/bo-sung-cc/xu-ly", handler: postBoSungXuLy, method: "POST", url: "http://localhost:3000/api/bo-sung-cc/xu-ly", role: "ChuQuan" },
  { name: "GET /api/doi-ca/xu-ly", handler: getDoiCaXuLy, method: "GET", url: "http://localhost:3000/api/doi-ca/xu-ly", role: "ChuQuan" },
  { name: "POST /api/doi-ca/xu-ly", handler: postDoiCaXuLy, method: "POST", url: "http://localhost:3000/api/doi-ca/xu-ly", role: "ChuQuan" },
  { name: "PUT /api/doi-ca", handler: putDoiCa, method: "PUT", url: "http://localhost:3000/api/doi-ca", role: "ChuQuan" },
  { name: "GET /api/he-so", handler: getHeSo, method: "GET", url: "http://localhost:3000/api/he-so", role: "ChuQuan" },
  { name: "POST /api/he-so", handler: postHeSo, method: "POST", url: "http://localhost:3000/api/he-so", role: "ChuQuan" },
  { name: "DELETE /api/he-so", handler: delHeSoQuery, method: "DELETE", url: "http://localhost:3000/api/he-so", role: "ChuQuan" },
  { name: "DELETE /api/he-so/[id]", handler: delHeSoId, method: "DELETE", url: "http://localhost:3000/api/he-so/HS000001", role: "ChuQuan", params: { id: "HS000001" } },
  { name: "GET /api/tien-thuong", handler: getTienThuong, method: "GET", url: "http://localhost:3000/api/tien-thuong", role: "ChuQuan" },
  { name: "POST /api/tien-thuong", handler: postTienThuong, method: "POST", url: "http://localhost:3000/api/tien-thuong", role: "ChuQuan" },
  { name: "PUT /api/tien-thuong", handler: putTienThuong, method: "PUT", url: "http://localhost:3000/api/tien-thuong", role: "ChuQuan" },
  { name: "PUT /api/bang-luong/[id]/thuong", handler: putBangLuongThuong, method: "PUT", url: "http://localhost:3000/api/bang-luong/BL000001/thuong", role: "ChuQuan", params: { id: "BL000001" } },
  { name: "PUT /api/bang-luong/[id]", handler: putBangLuongId, method: "PUT", url: "http://localhost:3000/api/bang-luong/BL000001", role: "ChuQuan", params: { id: "BL000001" } },
  { name: "POST /api/phan-hoi-luong/[id]/khong-chinh-sua", handler: postPhanHoiKhongSua, method: "POST", url: "http://localhost:3000/api/phan-hoi-luong/PH000001/khong-chinh-sua", role: "ChuQuan", params: { id: "PH000001" } },
  { name: "GET /api/ky-luong", handler: getKyLuong, method: "GET", url: "http://localhost:3000/api/ky-luong", role: "ChuQuan" },
  { name: "GET /api/ky-luong/hien-tai", handler: getKyLuongHienTai, method: "GET", url: "http://localhost:3000/api/ky-luong/hien-tai", role: "ChuQuan" },
  { name: "POST /api/ky-luong/[id]/tinh", handler: postKyLuongTinh, method: "POST", url: "http://localhost:3000/api/ky-luong/KL202611/tinh", role: "ChuQuan", params: { id: "KL202611" } },
  { name: "POST /api/ky-luong/[id]/gui", handler: postKyLuongGui, method: "POST", url: "http://localhost:3000/api/ky-luong/KL202611/gui", role: "ChuQuan", params: { id: "KL202611" } },
  { name: "POST /api/ky-luong/[id]/chot", handler: postKyLuongChot, method: "POST", url: "http://localhost:3000/api/ky-luong/KL202611/chot", role: "ChuQuan", params: { id: "KL202611" } },
  { name: "GET /api/ky-luong/[id]/tong-hop", handler: getKyLuongTongHop, method: "GET", url: "http://localhost:3000/api/ky-luong/KL202611/tong-hop", role: "ChuQuan", params: { id: "KL202611" } },
  { name: "GET /api/ky-luong/[id]/sai-sot", handler: getKyLuongSaiSot, method: "GET", url: "http://localhost:3000/api/ky-luong/KL202611/sai-sot", role: "ChuQuan", params: { id: "KL202611" } },
  { name: "GET /api/ky-luong/[id]/bang-luong", handler: getKyLuongBangLuong, method: "GET", url: "http://localhost:3000/api/ky-luong/KL202611/bang-luong", role: "ChuQuan", params: { id: "KL202611" } },
  { name: "GET /api/ky-luong/[id]/nhan-vien/[manv]/chi-tiet", handler: getKyLuongNvChiTiet, method: "GET", url: "http://localhost:3000/api/ky-luong/KL202611/nhan-vien/NV000001/chi-tiet", role: "ChuQuan", params: { id: "KL202611", manv: "NV000001" } },

  // Nhân viên
  { name: "GET /api/nhan-vien/tong-quan", handler: getNvTongQuan, method: "GET", url: "http://localhost:3000/api/nhan-vien/tong-quan", role: "NhanVien" },
  { name: "GET /api/nhan-vien/lich-ranh", handler: getNvLichRanh, method: "GET", url: "http://localhost:3000/api/nhan-vien/lich-ranh", role: "NhanVien" },
  { name: "POST /api/nhan-vien/lich-ranh", handler: postNvLichRanh, method: "POST", url: "http://localhost:3000/api/nhan-vien/lich-ranh", role: "NhanVien" },
  { name: "PUT /api/nhan-vien/lich-ranh", handler: putNvLichRanh, method: "PUT", url: "http://localhost:3000/api/nhan-vien/lich-ranh", role: "NhanVien" },
  { name: "GET /api/lich-ranh", handler: getLichRanhAlias, method: "GET", url: "http://localhost:3000/api/lich-ranh", role: "NhanVien" },
  { name: "POST /api/lich-ranh", handler: postLichRanhAlias, method: "POST", url: "http://localhost:3000/api/lich-ranh", role: "NhanVien" },
  { name: "PUT /api/lich-ranh", handler: putLichRanhAlias, method: "PUT", url: "http://localhost:3000/api/lich-ranh", role: "NhanVien" },
  { name: "GET /api/cham-cong/hom-nay", handler: getChamCongHomNay, method: "GET", url: "http://localhost:3000/api/cham-cong/hom-nay", role: "NhanVien" },
  { name: "POST /api/cham-cong/check-in", handler: postCheckIn, method: "POST", url: "http://localhost:3000/api/cham-cong/check-in", role: "NhanVien" },
  { name: "POST /api/cham-cong/check-out", handler: postCheckOut, method: "POST", url: "http://localhost:3000/api/cham-cong/check-out", role: "NhanVien" },
  { name: "GET /api/bo-sung-cc/ca-thieu", handler: getBoSungCaThieu, method: "GET", url: "http://localhost:3000/api/bo-sung-cc/ca-thieu", role: "NhanVien" },
  { name: "POST /api/bo-sung-cc", handler: postBoSungCC, method: "POST", url: "http://localhost:3000/api/bo-sung-cc", role: "NhanVien" },
  { name: "GET /api/doi-ca/ca-cua-toi", handler: getDoiCaCaCuaToi, method: "GET", url: "http://localhost:3000/api/doi-ca/ca-cua-toi", role: "NhanVien" },
  { name: "POST /api/doi-ca", handler: postDoiCa, method: "POST", url: "http://localhost:3000/api/doi-ca", role: "NhanVien" },
  { name: "GET /api/thay-ca/ca-trong-ngay", handler: getThayCaCaTrongNgay, method: "GET", url: "http://localhost:3000/api/thay-ca/ca-trong-ngay", role: "NhanVien" },
  { name: "GET /api/thay-ca/dang-mo", handler: getThayCaDangMo, method: "GET", url: "http://localhost:3000/api/thay-ca/dang-mo", role: "NhanVien" },
  { name: "POST /api/thay-ca", handler: postThayCa, method: "POST", url: "http://localhost:3000/api/thay-ca", role: "NhanVien" },
  { name: "POST /api/thay-ca/[id]/chap-nhan", handler: postThayCaChapNhan, method: "POST", url: "http://localhost:3000/api/thay-ca/TC000001/chap-nhan", role: "NhanVien", params: { id: "TC000001" } },
  { name: "POST /api/thay-ca/[id]/tu-choi", handler: postThayCaTuChoi, method: "POST", url: "http://localhost:3000/api/thay-ca/TC000001/tu-choi", role: "NhanVien", params: { id: "TC000001" } },
  { name: "GET /api/bang-luong/moi-nhat", handler: getBangLuongMoiNhat, method: "GET", url: "http://localhost:3000/api/bang-luong/moi-nhat", role: "NhanVien" },
  { name: "GET /api/phan-hoi-luong", handler: getPhanHoiLuong, method: "GET", url: "http://localhost:3000/api/phan-hoi-luong", role: "NhanVien" },
  { name: "POST /api/phan-hoi-luong", handler: postPhanHoiLuong, method: "POST", url: "http://localhost:3000/api/phan-hoi-luong", role: "NhanVien" },
];

describe("Phân quyền toàn hệ thống (tests/phan-quyen.test.ts)", () => {
  let chuQuanToken: string;
  let nhanVienAToken: string;
  let nhanVienBToken: string;

  const LOCKED_KL = "KL209701";
  const LOCKED_BL = "BL209701";
  const LOCKED_CT = "CT209701";
  const LOCKED_HS = "HS209701";
  const LOCKED_PH = "PH209701";
  const LOCKED_LL = "LL209701";
  const LOCKED_YC = "YC209701";
  const LOCKED_NV_MALICH = "LL209702";

  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ||
      "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";

    const chuQuanPayload: UserPayload = {
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Thanh Hà",
    };
    const nvAPayload: UserPayload = {
      userId: "NV000001",
      username: "NV000001",
      role: "NhanVien",
      name: "Nguyễn Minh Anh",
    };
    const nvBPayload: UserPayload = {
      userId: "NV000002",
      username: "NV000002",
      role: "NhanVien",
      name: "Trần Quốc Bảo",
    };

    chuQuanToken = await signSession(chuQuanPayload);
    nhanVienAToken = await signSession(nvAPayload);
    nhanVienBToken = await signSession(nvBPayload);

    // Dọn nếu sót từ lần chạy trước
    await prisma.phanHoiLuong.deleteMany({ where: { Maphanhoi: LOCKED_PH } });
    await prisma.chiTietBangLuong.deleteMany({ where: { MaCTBL: LOCKED_CT } });
    await prisma.bangLuong.deleteMany({ where: { Mabangluong: LOCKED_BL } });
    await prisma.yeuCauBoSungCC.deleteMany({ where: { Mayeucau: LOCKED_YC } });
    await prisma.nhanVien_LichLam.deleteMany({ where: { Malich: { in: [LOCKED_LL, LOCKED_NV_MALICH] } } });
    await prisma.lichLam.deleteMany({ where: { Malich: { in: [LOCKED_LL, LOCKED_NV_MALICH] } } });
    await prisma.heSoLuong.deleteMany({ where: { Maheso: LOCKED_HS } });
    await prisma.kyLuong.deleteMany({ where: { Makyluong: LOCKED_KL } });

    // Tạo kỳ lương ĐÃ CHỐT cô lập (tháng 01/2097) để kiểm tra từ chối mọi sửa đổi sau chốt
    await prisma.kyLuong.create({
      data: {
        Makyluong: LOCKED_KL,
        Thang: 1,
        Nam: 2097,
        Trangthai: "Đã chốt",
        Ngaychot: new Date("2097-02-02T00:00:00.000Z"),
      },
    });
    await prisma.heSoLuong.create({
      data: {
        Maheso: LOCKED_HS,
        Ngaybatdau: new Date("2097-01-10T00:00:00.000Z"),
        Ngayketthuc: new Date("2097-01-10T00:00:00.000Z"),
        Heso: 2,
      },
    });
    await prisma.bangLuong.create({
      data: {
        Mabangluong: LOCKED_BL,
        Manv: "NV000001",
        Makyluong: LOCKED_KL,
        Tienthuong: 0,
      },
    });
    await prisma.chiTietBangLuong.create({
      data: {
        MaCTBL: LOCKED_CT,
        Ngaylam: new Date("2097-01-10T00:00:00.000Z"),
        Giolam: 5.5,
        Mucluong: 17000,
        Mabangluong: LOCKED_BL,
        Maheso: LOCKED_HS,
      },
    });
    await prisma.phanHoiLuong.create({
      data: {
        Maphanhoi: LOCKED_PH,
        Noidung: "Test phản hồi kỳ đã chốt",
        Trangthai: "Chưa xử lý",
        Mabangluong: LOCKED_BL,
      },
    });
    await prisma.lichLam.create({
      data: {
        Malich: LOCKED_LL,
        Ngaylam: new Date("2097-01-15T00:00:00.000Z"),
        Maca: "CA000001",
      },
    });
    await prisma.nhanVien_LichLam.create({
      data: {
        Manv: "NV000001",
        Malich: LOCKED_LL,
      },
    });
    await prisma.yeuCauBoSungCC.create({
      data: {
        Mayeucau: LOCKED_YC,
        Giovaobosung: new Date("1970-01-01T06:00:00.000Z"),
        Giorabosung: new Date("1970-01-01T11:30:00.000Z"),
        Lydo: "Quên chấm công test khóa",
        Trangthai: "Chưa xử lý",
        Manv: "NV000001",
        Malich: LOCKED_LL,
      },
    });
    // Ca riêng của NV000002 (NV A không được check-in/check-out ca của NV B)
    await prisma.lichLam.create({
      data: {
        Malich: LOCKED_NV_MALICH,
        Ngaylam: new Date("2097-01-20T00:00:00.000Z"),
        Maca: "CA000002",
      },
    });
    await prisma.nhanVien_LichLam.create({
      data: {
        Manv: "NV000002",
        Malich: LOCKED_NV_MALICH,
      },
    });
  });

  afterAll(async () => {
    await prisma.phanHoiLuong.deleteMany({ where: { Maphanhoi: LOCKED_PH } });
    await prisma.chiTietBangLuong.deleteMany({ where: { MaCTBL: LOCKED_CT } });
    await prisma.bangLuong.deleteMany({ where: { Mabangluong: LOCKED_BL } });
    await prisma.yeuCauBoSungCC.deleteMany({ where: { Mayeucau: LOCKED_YC } });
    await prisma.nhanVien_LichLam.deleteMany({ where: { Malich: { in: [LOCKED_LL, LOCKED_NV_MALICH] } } });
    await prisma.lichLam.deleteMany({ where: { Malich: { in: [LOCKED_LL, LOCKED_NV_MALICH] } } });
    await prisma.heSoLuong.deleteMany({ where: { Maheso: LOCKED_HS } });
    await prisma.kyLuong.deleteMany({ where: { Makyluong: LOCKED_KL } });
  });

  describe("1. Kiểm tra 401 (chưa đăng nhập) và 403 (sai vai trò) trên toàn bộ routes", () => {
    for (const r of ALL_PROTECTED_ROUTES) {
      it(`${r.name} -> chưa đăng nhập phải trả về 401`, async () => {
        const req = new Request(r.url, { method: r.method });
        const res = await r.handler(req, { params: Promise.resolve(r.params ?? {}) });
        expect(res.status).toBe(401);
        const json = await res.json();
        expect(json.ok).toBe(false);
        expect(json.error.code).toBe("UNAUTHORIZED");
      });

      if (r.role === "ChuQuan") {
        it(`${r.name} -> Nhân viên truy cập phải trả về 403`, async () => {
          const req = new Request(r.url, {
            method: r.method,
            headers: { cookie: `${AUTH_COOKIE_NAME}=${nhanVienAToken}` },
          });
          const res = await r.handler(req, { params: Promise.resolve(r.params ?? {}) });
          expect(res.status).toBe(403);
          const json = await res.json();
          expect(json.ok).toBe(false);
          expect(json.error.code).toBe("FORBIDDEN");
        });
      } else if (r.role === "NhanVien") {
        it(`${r.name} -> Chủ quán truy cập phải trả về 403`, async () => {
          const req = new Request(r.url, {
            method: r.method,
            headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
          });
          const res = await r.handler(req, { params: Promise.resolve(r.params ?? {}) });
          expect(res.status).toBe(403);
          const json = await res.json();
          expect(json.ok).toBe(false);
          expect(json.error.code).toBe("FORBIDDEN");
        });
      }
    }
  });

  describe("2. Kiểm tra mã nhân viên lấy từ phiên & NV A không đụng được dữ liệu NV B", () => {
    it("NV000001 không thể check-in hộ ca của NV000002", async () => {
      const req = new Request("http://localhost:3000/api/cham-cong/check-in", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${nhanVienAToken}`,
        },
        body: JSON.stringify({ malich: LOCKED_NV_MALICH }),
      });
      const res = await postCheckIn(req, { params: Promise.resolve({}) });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("NV000001 không thể gửi yêu cầu bổ sung CC cho ca của NV000002", async () => {
      const req = new Request("http://localhost:3000/api/bo-sung-cc", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${nhanVienAToken}`,
        },
        body: JSON.stringify({
          malich: LOCKED_NV_MALICH,
          giovaobosung: "11:30",
          lydo: "Test không phải ca của mình",
        }),
      });
      const res = await postBoSungCC(req, { params: Promise.resolve({}) });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("NV000001 không thể tạo đơn đổi ca cho ca của NV000002", async () => {
      const req = new Request("http://localhost:3000/api/doi-ca", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${nhanVienAToken}`,
        },
        body: JSON.stringify({
          malich: LOCKED_NV_MALICH,
          manvnhanthay: "NV000003",
        }),
      });
      const res = await postDoiCa(req, { params: Promise.resolve({}) });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });

    it("NV000002 xem GET /api/bang-luong/moi-nhat chỉ nhận dữ liệu của chính NV000002 (kể cả khi truyền ?manv=NV000001)", async () => {
      const req = new Request("http://localhost:3000/api/bang-luong/moi-nhat?manv=NV000001", {
        method: "GET",
        headers: { cookie: `${AUTH_COOKIE_NAME}=${nhanVienBToken}` },
      });
      const res = await getBangLuongMoiNhat(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      if (json.data?.bangLuong) {
        expect(json.data.bangLuong.manv).toBe("NV000002");
      }
    });

    it("NV000001 không thể nhận/từ chối đơn thay ca không tồn tại hoặc không thuộc quyền", async () => {
      const req = new Request("http://localhost:3000/api/thay-ca/TC999999/chap-nhan", {
        method: "POST",
        headers: { cookie: `${AUTH_COOKIE_NAME}=${nhanVienAToken}` },
      });
      const res = await postThayCaChapNhan(req, { params: Promise.resolve({ id: "TC999999" }) });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  describe("3. Mật khẩu chỉ giải mã ở API của Chủ quán", () => {
    it("GET /api/chu-quan/nhan-vien trả về matKhauGiaiMa dạng plaintext cho Chủ quán", async () => {
      const req = new Request("http://localhost:3000/api/chu-quan/nhan-vien", {
        method: "GET",
        headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
      });
      const res = await getCqNhanVien(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      if (Array.isArray(json.data?.items) && json.data.items.length > 0) {
        expect(typeof json.data.items[0].matKhauGiaiMa).toBe("string");
        expect(json.data.items[0].Matkhau).toBeUndefined();
      }
    });

    it("GET /api/auth/me không bao giờ trả về Matkhau hay matKhauGiaiMa", async () => {
      const req = new Request("http://localhost:3000/api/auth/me", {
        method: "GET",
        headers: { cookie: `${AUTH_COOKIE_NAME}=${nhanVienAToken}` },
      });
      const res = await getAuthMe(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.user.Matkhau).toBeUndefined();
      expect(json.data.user.matKhauGiaiMa).toBeUndefined();
    });
  });

  describe("4. Sau khi chốt kỳ lương (Đã chốt), mọi API sửa đều bị từ chối", () => {
    it("POST /api/ky-luong/:id/tinh bị từ chối (409)", async () => {
      const req = new Request(`http://localhost:3000/api/ky-luong/${LOCKED_KL}/tinh`, {
        method: "POST",
        headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
      });
      const res = await postKyLuongTinh(req, { params: Promise.resolve({ id: LOCKED_KL }) });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("POST /api/ky-luong/:id/gui bị từ chối (409)", async () => {
      const req = new Request(`http://localhost:3000/api/ky-luong/${LOCKED_KL}/gui`, {
        method: "POST",
        headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
      });
      const res = await postKyLuongGui(req, { params: Promise.resolve({ id: LOCKED_KL }) });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("POST /api/ky-luong/:id/chot bị từ chối khi đã chốt", async () => {
      const req = new Request(`http://localhost:3000/api/ky-luong/${LOCKED_KL}/chot`, {
        method: "POST",
        headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
      });
      const res = await postKyLuongChot(req, { params: Promise.resolve({ id: LOCKED_KL }) });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("POST /api/he-so trong kỳ đã chốt bị từ chối", async () => {
      const req = new Request("http://localhost:3000/api/he-so", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
        },
        body: JSON.stringify({
          Ngaybatdau: "2097-01-12",
          Ngayketthuc: "2097-01-12",
          Heso: 2,
        }),
      });
      const res = await postHeSo(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
    });

    it("DELETE /api/he-so/:id đang dùng trong kỳ đã chốt bị từ chối", async () => {
      const req = new Request(`http://localhost:3000/api/he-so/${LOCKED_HS}`, {
        method: "DELETE",
        headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
      });
      const res = await delHeSoId(req, { params: Promise.resolve({ id: LOCKED_HS }) });
      expect(res.status).toBe(400);
    });

    it("POST /api/tien-thuong trên kỳ đã chốt bị từ chối", async () => {
      const req = new Request("http://localhost:3000/api/tien-thuong", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
        },
        body: JSON.stringify({
          Makyluong: LOCKED_KL,
          Manv: "NV000001",
          Tienthuong: 100000,
          Lydothuong: "Test",
        }),
      });
      const res = await postTienThuong(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
    });

    it("PUT /api/bang-luong/:id/thuong trên kỳ đã chốt bị từ chối", async () => {
      const req = new Request(`http://localhost:3000/api/bang-luong/${LOCKED_BL}/thuong`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
        },
        body: JSON.stringify({ Tienthuong: 50000, Lydothuong: "Test" }),
      });
      const res = await putBangLuongThuong(req, { params: Promise.resolve({ id: LOCKED_BL }) });
      expect(res.status).toBe(400);
    });

    it("PUT /api/bang-luong/:id trên kỳ đã chốt bị từ chối", async () => {
      const req = new Request(`http://localhost:3000/api/bang-luong/${LOCKED_BL}`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
        },
        body: JSON.stringify({
          maphanhoi: LOCKED_PH,
          ngaylam: "2097-01-10",
          giovao: "06:00",
          giora: "11:30",
          heso: 2,
          tienthuong: 50000,
          lydothuong: "Sửa thử",
        }),
      });
      const res = await putBangLuongId(req, { params: Promise.resolve({ id: LOCKED_BL }) });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("POST /api/phan-hoi-luong/:id/khong-chinh-sua trên kỳ đã chốt bị từ chối", async () => {
      const req = new Request(
        `http://localhost:3000/api/phan-hoi-luong/${LOCKED_PH}/khong-chinh-sua`,
        {
          method: "POST",
          headers: { cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
        }
      );
      const res = await postPhanHoiKhongSua(req, { params: Promise.resolve({ id: LOCKED_PH }) });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it("POST /api/bo-sung-cc/xu-ly trên kỳ đã chốt bị từ chối", async () => {
      const req = new Request("http://localhost:3000/api/bo-sung-cc/xu-ly", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
        },
        body: JSON.stringify({ mayeucau: LOCKED_YC, quyetdinh: "Duyệt" }),
      });
      const res = await postBoSungXuLy(req, { params: Promise.resolve({}) });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });
});
