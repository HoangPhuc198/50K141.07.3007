import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@database/client";
import { signSession, AUTH_COOKIE_NAME } from "@backend/lib/auth";
import { middleware } from "@/middleware";

import { GET as getAuthMe } from "@/app/api/auth/me/route";
import { POST as postLogout } from "@/app/api/auth/logout/route";
import {
  GET as getNhanVienLichRanh,
  POST as postNhanVienLichRanh,
} from "@/app/api/nhan-vien/lich-ranh/route";
import {
  GET as getDoiCa,
  POST as postDoiCa,
  PUT as putDoiCa,
} from "@/app/api/doi-ca/route";
import {
  GET as getDoiCaXuLy,
  POST as postDoiCaXuLy,
} from "@/app/api/doi-ca/xu-ly/route";
import { POST as postThayCa } from "@/app/api/thay-ca/route";
import { GET as getThayCaCaTrongNgay } from "@/app/api/thay-ca/ca-trong-ngay/route";
import { GET as getThayCaDangMo } from "@/app/api/thay-ca/dang-mo/route";
import { POST as postThayCaChapNhan } from "@/app/api/thay-ca/[id]/chap-nhan/route";
import { POST as postThayCaTuChoi } from "@/app/api/thay-ca/[id]/tu-choi/route";
import { GET as getChamCongHomNay } from "@/app/api/cham-cong/hom-nay/route";
import { POST as postCheckIn } from "@/app/api/cham-cong/check-in/route";
import { POST as postCheckOut } from "@/app/api/cham-cong/check-out/route";
import { POST as postBoSungCC } from "@/app/api/bo-sung-cc/route";
import { GET as getBoSungCaThieu } from "@/app/api/bo-sung-cc/ca-thieu/route";
import {
  GET as getBoSungXuLy,
  POST as postBoSungXuLy,
} from "@/app/api/bo-sung-cc/xu-ly/route";
import { GET as getBangLuongMoiNhat } from "@/app/api/bang-luong/moi-nhat/route";
import {
  GET as getPhanHoiLuong,
  POST as postPhanHoiLuong,
} from "@/app/api/phan-hoi-luong/route";
import { POST as postKhongChinhSuaPhanHoi } from "@/app/api/phan-hoi-luong/[id]/khong-chinh-sua/route";
import {
  GET as getNhanVienList,
  POST as postCreateNhanVien,
} from "@/app/api/chu-quan/nhan-vien/route";
import {
  GET as getNhanVienById,
  PUT as putNhanVienById,
  DELETE as deleteNhanVienById,
} from "@/app/api/chu-quan/nhan-vien/[id]/route";
import {
  GET as getXepLich,
  POST as postXepLich,
} from "@/app/api/chu-quan/lich-lam/route";
import {
  GET as getXepCa,
  POST as postXepCa,
} from "@/app/api/chu-quan/lich-lam/xep-ca/route";
import { GET as getBaoCaoChamCong } from "@/app/api/bao-cao/cham-cong/route";
import {
  GET as getMucLuong,
  PUT as putMucLuong,
} from "@/app/api/chu-quan/muc-luong/route";
import { POST as postTinhLuong } from "@/app/api/ky-luong/[id]/tinh/route";
import { POST as postGuiBangLuong } from "@/app/api/ky-luong/[id]/gui/route";
import { GET as getKyLuongList } from "@/app/api/ky-luong/route";
import { GET as getSaiSotKy } from "@/app/api/ky-luong/[id]/sai-sot/route";
import { PUT as putChinhSuaBangLuong } from "@/app/api/bang-luong/[id]/route";
import {
  GET as getHeSo,
  POST as postHeSo,
  DELETE as deleteHeSo,
} from "@/app/api/he-so/route";
import {
  GET as getTienThuong,
  POST as postTienThuong,
} from "@/app/api/tien-thuong/route";
import { GET as getBangLuongChot } from "@/app/api/ky-luong/[id]/bang-luong/route";
import { POST as postChotBangLuong } from "@/app/api/ky-luong/[id]/chot/route";
import { GET as getChuQuanTongQuan } from "@/app/api/chu-quan/tong-quan/route";
import { GET as getNhanVienTongQuan } from "@/app/api/nhan-vien/tong-quan/route";
import { GET as getThongBao } from "@/app/api/thong-bao/route";

const TEST_KY = "KL209510";
const TEST_BL_NV1 = "BL950001";
const TEST_BL_NV2 = "BL950002";
const TEST_CT_NV1 = "CT950001";
const TEST_CT_NV2 = "CT950002";

let cqToken = "";
let nv1Token = "";
let shiftWithoutNv1 = "";

function makeReq(
  url: string,
  options?: { method?: string; token?: string; body?: unknown }
): NextRequest {
  const headers = new Headers();
  if (options?.token) {
    headers.set("cookie", `${AUTH_COOKIE_NAME}=${options.token}`);
  }
  let bodyStr: string | undefined;
  if (options?.body !== undefined) {
    headers.set("content-type", "application/json");
    bodyStr = JSON.stringify(options.body);
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: options?.method ?? "GET",
    headers,
    body: bodyStr,
  });
}

async function cleanupFixtures() {
  await prisma.chiTietBangLuong.deleteMany({
    where: { MaCTBL: { in: [TEST_CT_NV1, TEST_CT_NV2] } },
  });
  await prisma.bangLuong.deleteMany({
    where: { Mabangluong: { in: [TEST_BL_NV1, TEST_BL_NV2] } },
  });
  await prisma.kyLuong.deleteMany({ where: { Makyluong: TEST_KY } });
}

describe("BƯỚC 2 - Ưu tiên 1: Phân quyền (401, 403, cô lập dữ liệu NV A / NV B)", () => {
  beforeAll(async () => {
    try {
      process.loadEnvFile();
    } catch {
      // ignore if already loaded
    }

    cqToken = await signSession({
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Thanh Hà",
    });
    nv1Token = await signSession({
      userId: "NV000001",
      username: "NV000001",
      role: "NhanVien",
      name: "Nguyễn Minh Anh",
    });

    await cleanupFixtures();

    await prisma.kyLuong.create({
      data: {
        Makyluong: TEST_KY,
        Thang: 10,
        Nam: 2095,
        Trangthai: "Dự kiến",
        Ngaychot: null,
      },
    });
    await prisma.bangLuong.createMany({
      data: [
        {
          Mabangluong: TEST_BL_NV1,
          Manv: "NV000001",
          Makyluong: TEST_KY,
          Tienthuong: 100000,
          Lydothuong: "Thưởng chuyên cần",
        },
        {
          Mabangluong: TEST_BL_NV2,
          Manv: "NV000002",
          Makyluong: TEST_KY,
          Tienthuong: 50000,
          Lydothuong: "Thưởng hỗ trợ",
        },
      ],
    });
    await prisma.chiTietBangLuong.createMany({
      data: [
        {
          MaCTBL: TEST_CT_NV1,
          Mabangluong: TEST_BL_NV1,
          Ngaylam: new Date("2095-10-15T00:00:00.000Z"),
          Giolam: 5.5,
          Mucluong: 24000,
          Maheso: null,
        },
        {
          MaCTBL: TEST_CT_NV2,
          Mabangluong: TEST_BL_NV2,
          Ngaylam: new Date("2095-10-15T00:00:00.000Z"),
          Giolam: 5.5,
          Mucluong: 22000,
          Maheso: null,
        },
      ],
    });

    const otherShift = await prisma.lichLam.findFirst({
      where: {
        NhanVien_LichLam: { none: { Manv: "NV000001" } },
      },
      select: { Malich: true },
    });
    shiftWithoutNv1 = otherShift?.Malich.trim() || "LL000002";
  });

  afterAll(async () => {
    await cleanupFixtures();
  });

  it("TC_1_12: Chưa đăng nhập gõ trực tiếp URL nội bộ (/chu-quan/nhan-vien/xem) bị chuyển về /dang-nhap; API trả 401", async () => {
    const mwCq = await middleware(
      makeReq("http://localhost:3000/chu-quan/nhan-vien/xem")
    );
    expect(mwCq.status).toBe(307);
    expect(mwCq.headers.get("location")).toContain("/dang-nhap");

    const meRes = await getAuthMe(
      makeReq("http://localhost:3000/api/auth/me"),
      { params: Promise.resolve({}) }
    );
    expect(meRes.status).toBe(401);
  });

  it("TC_1_13: Nhân viên gõ địa chỉ trang của chủ quán (/chu-quan/luong/tinh-luong) bị chặn chuyển về /nhan-vien", async () => {
    const mwNvToCq = await middleware(
      makeReq("http://localhost:3000/chu-quan/luong/tinh-luong", {
        token: nv1Token,
      })
    );
    expect(mwNvToCq.status).toBe(307);
    expect(new URL(mwNvToCq.headers.get("location")!).pathname).toBe(
      "/nhan-vien"
    );
  });

  it("TC_1.1_02: Sau khi đăng xuất, cookie phiên bị xóa và truy cập lại trang trong hệ thống bị chuyển về /dang-nhap", async () => {
    const logoutRes = await postLogout(
      makeReq("http://localhost:3000/api/auth/logout", {
        method: "POST",
        token: cqToken,
      }),
      { params: Promise.resolve({}) }
    );
    expect(logoutRes.status).toBe(200);
    const setCookie = logoutRes.headers.get("set-cookie") || "";
    expect(setCookie).toContain(`${AUTH_COOKIE_NAME}=`);
    expect(setCookie).toMatch(/Max-Age=0/i);

    const mwAfterLogout = await middleware(
      makeReq("http://localhost:3000/chu-quan/nhan-vien/xem")
    );
    expect(mwAfterLogout.status).toBe(307);
    expect(mwAfterLogout.headers.get("location")).toContain("/dang-nhap");
  });

  it("TC_2.1_11: Chủ quán gõ /nhan-vien/ca-lam/lich-ranh hoặc gọi API lịch rảnh nhân viên bị chặn (307 / 403)", async () => {
    const mwCqToNv = await middleware(
      makeReq("http://localhost:3000/nhan-vien/ca-lam/lich-ranh", {
        token: cqToken,
      })
    );
    expect(mwCqToNv.status).toBe(307);
    expect(new URL(mwCqToNv.headers.get("location")!).pathname).toBe(
      "/chu-quan"
    );

    const unauthGet = await getNhanVienLichRanh(
      makeReq("http://localhost:3000/api/nhan-vien/lich-ranh"),
      { params: Promise.resolve({}) }
    );
    expect(unauthGet.status).toBe(401);

    const cqGet = await getNhanVienLichRanh(
      makeReq("http://localhost:3000/api/nhan-vien/lich-ranh", {
        token: cqToken,
      }),
      { params: Promise.resolve({}) }
    );
    expect(cqGet.status).toBe(403);

    const cqPost = await postNhanVienLichRanh(
      makeReq("http://localhost:3000/api/nhan-vien/lich-ranh", {
        method: "POST",
        token: cqToken,
        body: { startDate: "2026-11-09", endDate: "2026-11-15", danhSach: [] },
      }),
      { params: Promise.resolve({}) }
    );
    expect(cqPost.status).toBe(403);
  });

  it("TC_2.2_07: Chưa đăng nhập gửi yêu cầu POST tới API đổi ca trả 401", async () => {
    const unauth = await postDoiCa(
      makeReq("http://localhost:3000/api/doi-ca", {
        method: "POST",
        body: { Malich: shiftWithoutNv1, khongCoNguoiThay: true },
      }),
      { params: Promise.resolve({}) }
    );
    expect(unauth.status).toBe(401);
  });

  it("TC_2.2_08: Chủ quán gọi API đổi ca của nhân viên trả 403; nhân viên gửi đổi ca không thuộc mình trả 400", async () => {
    const cq = await postDoiCa(
      makeReq("http://localhost:3000/api/doi-ca", {
        method: "POST",
        token: cqToken,
        body: { Malich: shiftWithoutNv1, khongCoNguoiThay: true },
      }),
      { params: Promise.resolve({}) }
    );
    expect(cq.status).toBe(403);

    const wrongShift = await postDoiCa(
      makeReq("http://localhost:3000/api/doi-ca", {
        method: "POST",
        token: nv1Token,
        body: { Malich: shiftWithoutNv1, khongCoNguoiThay: true },
      }),
      { params: Promise.resolve({}) }
    );
    expect(wrongShift.status).toBe(400);
  });

  it("TC_3.1_07: Nhân viên A không có ca nhưng thử check-in cho ca của B qua API bị từ chối", async () => {
    const res = await postCheckIn(
      makeReq("http://localhost:3000/api/cham-cong/check-in", {
        method: "POST",
        token: nv1Token,
        body: { malich: shiftWithoutNv1 },
      }),
      { params: Promise.resolve({}) }
    );
    expect([400, 403]).toContain(res.status);
  });

  it("TC_3.1_11: Chủ quán gõ /nhan-vien/cham-cong/check-in hoặc gọi API check-in bị chặn (307 / 403)", async () => {
    const mw = await middleware(
      makeReq("http://localhost:3000/nhan-vien/cham-cong/check-in", {
        token: cqToken,
      })
    );
    expect(mw.status).toBe(307);

    const unauth = await postCheckIn(
      makeReq("http://localhost:3000/api/cham-cong/check-in", {
        method: "POST",
        body: {},
      }),
      { params: Promise.resolve({}) }
    );
    expect(unauth.status).toBe(401);

    const cq = await postCheckIn(
      makeReq("http://localhost:3000/api/cham-cong/check-in", {
        method: "POST",
        token: cqToken,
        body: {},
      }),
      { params: Promise.resolve({}) }
    );
    expect(cq.status).toBe(403);
  });

  it("TC_3.2_08: Chưa đăng nhập gọi API check-out trả 401; Chủ quán gọi trả 403", async () => {
    const unauth = await postCheckOut(
      makeReq("http://localhost:3000/api/cham-cong/check-out", {
        method: "POST",
        body: { tangCa: false },
      }),
      { params: Promise.resolve({}) }
    );
    expect(unauth.status).toBe(401);

    const cq = await postCheckOut(
      makeReq("http://localhost:3000/api/cham-cong/check-out", {
        method: "POST",
        token: cqToken,
        body: { tangCa: false },
      }),
      { params: Promise.resolve({}) }
    );
    expect(cq.status).toBe(403);
  });

  it("TC_3.3_07: Nhân viên A chọn ca của nhân viên B qua API bổ sung chấm công bị từ chối 403", async () => {
    const res = await postBoSungCC(
      makeReq("http://localhost:3000/api/bo-sung-cc", {
        method: "POST",
        token: nv1Token,
        body: {
          malich: shiftWithoutNv1,
          giovaobosung: "06:00",
          giorabosung: "11:30",
          lydo: "Test gửi hộ ca người khác",
        },
      }),
      { params: Promise.resolve({}) }
    );
    expect(res.status).toBe(403);
  });

  it("TC_3.3_08: Chủ quán gõ /nhan-vien/cham-cong/bo-sung hoặc gọi API bổ sung chấm công bị chặn (307 / 403)", async () => {
    const mw = await middleware(
      makeReq("http://localhost:3000/nhan-vien/cham-cong/bo-sung", {
        token: cqToken,
      })
    );
    expect(mw.status).toBe(307);

    const unauth = await postBoSungCC(
      makeReq("http://localhost:3000/api/bo-sung-cc", {
        method: "POST",
        body: { malich: shiftWithoutNv1, giorabosung: "11:30", lydo: "Quên" },
      }),
      { params: Promise.resolve({}) }
    );
    expect(unauth.status).toBe(401);

    const cq = await postBoSungCC(
      makeReq("http://localhost:3000/api/bo-sung-cc", {
        method: "POST",
        token: cqToken,
        body: { malich: shiftWithoutNv1, giorabosung: "11:30", lydo: "Quên" },
      }),
      { params: Promise.resolve({}) }
    );
    expect(cq.status).toBe(403);
  });

  it("TC_4.1_06: Nhân viên gọi API xem bảng lương với tham số kỳ cũ hơn (?thang=9) bị từ chối 400", async () => {
    const res = await getBangLuongMoiNhat(
      makeReq("http://localhost:3000/api/bang-luong/moi-nhat?thang=9", {
        token: nv1Token,
      }),
      { params: Promise.resolve({}) }
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("FORBIDDEN_PERIOD");
  });

  it("TC_4.1_07: Nhân viên A gọi API xem bảng lương kèm mã của B chỉ thấy dữ liệu của A, không lộ B", async () => {
    const res = await getBangLuongMoiNhat(
      makeReq("http://localhost:3000/api/bang-luong/moi-nhat?manv=NV000002", {
        token: nv1Token,
      }),
      { params: Promise.resolve({}) }
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.coBangLuong).toBe(true);
    expect(json.data.bangLuong.manv).toBe("NV000001");
    expect(json.data.bangLuong.manv).not.toBe("NV000002");
  });

  it("TC_4.1_11: Chưa đăng nhập gọi API xem bảng lương (/api/bang-luong/moi-nhat) trả 401", async () => {
    const unauth = await getBangLuongMoiNhat(
      makeReq("http://localhost:3000/api/bang-luong/moi-nhat"),
      { params: Promise.resolve({}) }
    );
    expect(unauth.status).toBe(401);
  });

  it("TC_4.1_12: Chủ quán gọi API xem bảng lương của nhân viên (/api/bang-luong/moi-nhat) trả 403", async () => {
    const cq = await getBangLuongMoiNhat(
      makeReq("http://localhost:3000/api/bang-luong/moi-nhat", {
        token: cqToken,
      }),
      { params: Promise.resolve({}) }
    );
    expect(cq.status).toBe(403);
  });

  it("TC_4.2_06: Nhân viên A gửi phản hồi cho bảng lương của nhân viên B qua API bị từ chối 403", async () => {
    const crossEmployee = await postPhanHoiLuong(
      makeReq("http://localhost:3000/api/phan-hoi-luong", {
        method: "POST",
        token: nv1Token,
        body: {
          mabangluong: TEST_BL_NV2,
          noidung: "Gửi phản hồi vào bảng lương của NV2",
        },
      }),
      { params: Promise.resolve({}) }
    );
    expect(crossEmployee.status).toBe(403);
  });

  it("TC_5.1_15: Nhân viên gõ /chu-quan/nhan-vien/them hoặc gọi API thêm nhân viên bị chặn (307 / 403)", async () => {
    const mw = await middleware(
      makeReq("http://localhost:3000/chu-quan/nhan-vien/them", {
        token: nv1Token,
      })
    );
    expect(mw.status).toBe(307);

    const body = {
      Hoten: "Test Phân Quyền",
      Sdt: "0988776655",
      Diachi: "Đà Nẵng",
      Vitrilamviec: "Phục vụ",
      Hinhthuclam: "Part-time",
      Ngayvaolam: "2026-11-10",
      Kinhnghiem: "1 năm",
    };
    const unauth = await postCreateNhanVien(
      makeReq("http://localhost:3000/api/chu-quan/nhan-vien", {
        method: "POST",
        body,
      }),
      { params: Promise.resolve({}) }
    );
    expect(unauth.status).toBe(401);

    const nv = await postCreateNhanVien(
      makeReq("http://localhost:3000/api/chu-quan/nhan-vien", {
        method: "POST",
        token: nv1Token,
        body,
      }),
      { params: Promise.resolve({}) }
    );
    expect(nv.status).toBe(403);
  });

  it("TC_5.2_09: Nhân viên gọi API sửa nhân viên trả 403; chưa đăng nhập trả 401", async () => {
    const body = {
      Hoten: "Nguyễn Minh Anh",
      Sdt: "0905000001",
      Diachi: "Đà Nẵng",
      Vitrilamviec: "Pha chế",
      Hinhthuclam: "Full-time",
      Ngayvaolam: "2023-03-01",
      Kinhnghiem: "3 năm",
    };
    const unauth = await putNhanVienById(
      makeReq("http://localhost:3000/api/chu-quan/nhan-vien/NV000001", {
        method: "PUT",
        body,
      }),
      { params: Promise.resolve({ id: "NV000001" }) }
    );
    expect(unauth.status).toBe(401);

    const nv = await putNhanVienById(
      makeReq("http://localhost:3000/api/chu-quan/nhan-vien/NV000001", {
        method: "PUT",
        token: nv1Token,
        body,
      }),
      { params: Promise.resolve({ id: "NV000001" }) }
    );
    expect(nv.status).toBe(403);
  });

  it("TC_5.3_07: Nhân viên gọi API xóa nhân viên trả 403; chưa đăng nhập trả 401", async () => {
    const unauth = await deleteNhanVienById(
      makeReq("http://localhost:3000/api/chu-quan/nhan-vien/NV000006", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "NV000006" }) }
    );
    expect(unauth.status).toBe(401);

    const nv = await deleteNhanVienById(
      makeReq("http://localhost:3000/api/chu-quan/nhan-vien/NV000006", {
        method: "DELETE",
        token: nv1Token,
      }),
      { params: Promise.resolve({ id: "NV000006" }) }
    );
    expect(nv.status).toBe(403);
  });

  it("TC_5.4_05: Nhân viên gõ /chu-quan/nhan-vien/xem hoặc gọi API danh sách/chi tiết nhân viên bị chặn (307 / 403)", async () => {
    const mw = await middleware(
      makeReq("http://localhost:3000/chu-quan/nhan-vien/xem", {
        token: nv1Token,
      })
    );
    expect(mw.status).toBe(307);

    const unauthList = await getNhanVienList(
      makeReq("http://localhost:3000/api/chu-quan/nhan-vien"),
      { params: Promise.resolve({}) }
    );
    expect(unauthList.status).toBe(401);

    const nvList = await getNhanVienList(
      makeReq("http://localhost:3000/api/chu-quan/nhan-vien", {
        token: nv1Token,
      }),
      { params: Promise.resolve({}) }
    );
    expect(nvList.status).toBe(403);

    const nvDetail = await getNhanVienById(
      makeReq("http://localhost:3000/api/chu-quan/nhan-vien/NV000001", {
        token: nv1Token,
      }),
      { params: Promise.resolve({ id: "NV000001" }) }
    );
    expect(nvDetail.status).toBe(403);
  });

  it("TC_6.1_05: Nhân viên gọi API xếp lịch làm trả 403; chưa đăng nhập trả 401", async () => {
    const unauth = await getXepLich(
      makeReq("http://localhost:3000/api/chu-quan/lich-lam"),
      { params: Promise.resolve({}) }
    );
    expect(unauth.status).toBe(401);

    const nvGet = await getXepLich(
      makeReq("http://localhost:3000/api/chu-quan/lich-lam", {
        token: nv1Token,
      }),
      { params: Promise.resolve({}) }
    );
    expect(nvGet.status).toBe(403);

    const nvPost = await postXepLich(
      makeReq("http://localhost:3000/api/chu-quan/lich-lam", {
        method: "POST",
        token: nv1Token,
        body: { cacNgay: ["2026-11-09"] },
      }),
      { params: Promise.resolve({}) }
    );
    expect(nvPost.status).toBe(403);
  });

  it("TC_6.2_10: Nhân viên gọi API xếp ca làm trả 403; chưa đăng nhập trả 401", async () => {
    const unauth = await getXepCa(
      makeReq("http://localhost:3000/api/chu-quan/lich-lam/xep-ca?ngay=2026-11-06"),
      { params: Promise.resolve({}) }
    );
    expect(unauth.status).toBe(401);

    const nvGet = await getXepCa(
      makeReq("http://localhost:3000/api/chu-quan/lich-lam/xep-ca?ngay=2026-11-06", {
        token: nv1Token,
      }),
      { params: Promise.resolve({}) }
    );
    expect(nvGet.status).toBe(403);

    const nvPost = await postXepCa(
      makeReq("http://localhost:3000/api/chu-quan/lich-lam/xep-ca", {
        method: "POST",
        token: nv1Token,
        body: { ngay: "2026-11-06", phanCong: [] },
      }),
      { params: Promise.resolve({}) }
    );
    expect(nvPost.status).toBe(403);
  });

  it("TC_6.3_12: Nhân viên gọi API xử lý đổi ca trả 403; chưa đăng nhập trả 401", async () => {
    const unauth = await postDoiCaXuLy(
      makeReq("http://localhost:3000/api/doi-ca/xu-ly", {
        method: "POST",
        body: { Madon: "DD000001", Manvnhanthay: "NV000002" },
      }),
      { params: Promise.resolve({}) }
    );
    expect(unauth.status).toBe(401);

    const nv = await postDoiCaXuLy(
      makeReq("http://localhost:3000/api/doi-ca/xu-ly", {
        method: "POST",
        token: nv1Token,
        body: { Madon: "DD000001", Manvnhanthay: "NV000002" },
      }),
      { params: Promise.resolve({}) }
    );
    expect(nv.status).toBe(403);

    const nvPut = await putDoiCa(
      makeReq("http://localhost:3000/api/doi-ca", {
        method: "PUT",
        token: nv1Token,
        body: { Madon: "DD000001", Manvnhanthay: "NV000002" },
      }),
      { params: Promise.resolve({}) }
    );
    expect(nvPut.status).toBe(403);
  });

  it("TC_7.1_07: Nhân viên gọi API xử lý bổ sung chấm công trả 403; chưa đăng nhập trả 401", async () => {
    const unauth = await getBoSungXuLy(
      makeReq("http://localhost:3000/api/bo-sung-cc/xu-ly"),
      { params: Promise.resolve({}) }
    );
    expect(unauth.status).toBe(401);

    const nvGet = await getBoSungXuLy(
      makeReq("http://localhost:3000/api/bo-sung-cc/xu-ly", {
        token: nv1Token,
      }),
      { params: Promise.resolve({}) }
    );
    expect(nvGet.status).toBe(403);

    const nvPost = await postBoSungXuLy(
      makeReq("http://localhost:3000/api/bo-sung-cc/xu-ly", {
        method: "POST",
        token: nv1Token,
        body: { mayeucau: "YC000001", giorabosung: "11:30" },
      }),
      { params: Promise.resolve({}) }
    );
    expect(nvPost.status).toBe(403);
  });

  it("TC_7.2_07: Nhân viên gọi API báo cáo chấm công trả 403; chưa đăng nhập trả 401", async () => {
    const unauth = await getBaoCaoChamCong(
      makeReq("http://localhost:3000/api/bao-cao/cham-cong?ngay=2026-11-06"),
      { params: Promise.resolve({}) }
    );
    expect(unauth.status).toBe(401);

    const nv = await getBaoCaoChamCong(
      makeReq("http://localhost:3000/api/bao-cao/cham-cong?ngay=2026-11-06", {
        token: nv1Token,
      }),
      { params: Promise.resolve({}) }
    );
    expect(nv.status).toBe(403);
  });

  it("TC_8.1_08: Nhân viên gọi API cập nhật mức lương trả 403; chưa đăng nhập trả 401", async () => {
    const unauth = await putMucLuong(
      makeReq("http://localhost:3000/api/chu-quan/muc-luong", {
        method: "PUT",
        body: { Manv: "NV000001", Mucluongtheogio: 30000 },
      }),
      { params: Promise.resolve({}) }
    );
    expect(unauth.status).toBe(401);

    const nvGet = await getMucLuong(
      makeReq("http://localhost:3000/api/chu-quan/muc-luong", {
        token: nv1Token,
      }),
      { params: Promise.resolve({}) }
    );
    expect(nvGet.status).toBe(403);

    const nvPut = await putMucLuong(
      makeReq("http://localhost:3000/api/chu-quan/muc-luong", {
        method: "PUT",
        token: nv1Token,
        body: { Manv: "NV000001", Mucluongtheogio: 30000 },
      }),
      { params: Promise.resolve({}) }
    );
    expect(nvPut.status).toBe(403);
  });

  it("TC_8.2_13: Nhân viên gọi API tính lương / gửi trả 403; chưa đăng nhập trả 401", async () => {
    const unauthTinh = await postTinhLuong(
      makeReq(`http://localhost:3000/api/ky-luong/${TEST_KY}/tinh`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: TEST_KY }) }
    );
    expect(unauthTinh.status).toBe(401);

    const nvTinh = await postTinhLuong(
      makeReq(`http://localhost:3000/api/ky-luong/${TEST_KY}/tinh`, {
        method: "POST",
        token: nv1Token,
      }),
      { params: Promise.resolve({ id: TEST_KY }) }
    );
    expect(nvTinh.status).toBe(403);

    const nvGui = await postGuiBangLuong(
      makeReq(`http://localhost:3000/api/ky-luong/${TEST_KY}/gui`, {
        method: "POST",
        token: nv1Token,
      }),
      { params: Promise.resolve({ id: TEST_KY }) }
    );
    expect(nvGui.status).toBe(403);
  });

  it("TC_8.3_11: Nhân viên gọi API chỉnh sửa bảng lương trả 403; chưa đăng nhập trả 401", async () => {
    const unauth = await putChinhSuaBangLuong(
      makeReq(`http://localhost:3000/api/bang-luong/${TEST_BL_NV1}`, {
        method: "PUT",
        body: {},
      }),
      { params: Promise.resolve({ id: TEST_BL_NV1 }) }
    );
    expect(unauth.status).toBe(401);

    const nvPut = await putChinhSuaBangLuong(
      makeReq(`http://localhost:3000/api/bang-luong/${TEST_BL_NV1}`, {
        method: "PUT",
        token: nv1Token,
        body: {},
      }),
      { params: Promise.resolve({ id: TEST_BL_NV1 }) }
    );
    expect(nvPut.status).toBe(403);

    const nvKhongSua = await postKhongChinhSuaPhanHoi(
      makeReq("http://localhost:3000/api/phan-hoi-luong/PH000001/khong-chinh-sua", {
        method: "POST",
        token: nv1Token,
      }),
      { params: Promise.resolve({ id: "PH000001" }) }
    );
    expect(nvKhongSua.status).toBe(403);
  });

  it("TC_8.4_11: Nhân viên gọi API hệ số lương trả 403; chưa đăng nhập trả 401", async () => {
    const unauth = await getHeSo(
      makeReq("http://localhost:3000/api/he-so"),
      { params: Promise.resolve({}) }
    );
    expect(unauth.status).toBe(401);

    const nvGet = await getHeSo(
      makeReq("http://localhost:3000/api/he-so", { token: nv1Token }),
      { params: Promise.resolve({}) }
    );
    expect(nvGet.status).toBe(403);

    const nvPost = await postHeSo(
      makeReq("http://localhost:3000/api/he-so", {
        method: "POST",
        token: nv1Token,
        body: { Ngaybatdau: "2026-12-01", Ngayketthuc: "2026-12-02", Heso: 2 },
      }),
      { params: Promise.resolve({}) }
    );
    expect(nvPost.status).toBe(403);

    const nvDel = await deleteHeSo(
      makeReq("http://localhost:3000/api/he-so?id=HS000001", {
        method: "DELETE",
        token: nv1Token,
      }),
      { params: Promise.resolve({}) }
    );
    expect(nvDel.status).toBe(403);
  });

  it("TC_8.5_08: Nhân viên gọi API nhập thưởng trả 403; chưa đăng nhập trả 401", async () => {
    const unauth = await getTienThuong(
      makeReq("http://localhost:3000/api/tien-thuong"),
      { params: Promise.resolve({}) }
    );
    expect(unauth.status).toBe(401);

    const nvGet = await getTienThuong(
      makeReq("http://localhost:3000/api/tien-thuong", { token: nv1Token }),
      { params: Promise.resolve({}) }
    );
    expect(nvGet.status).toBe(403);

    const nvPost = await postTienThuong(
      makeReq("http://localhost:3000/api/tien-thuong", {
        method: "POST",
        token: nv1Token,
        body: {
          Makyluong: TEST_KY,
          Manv: "NV000001",
          Tienthuong: 100000,
          Lydothuong: "Test",
        },
      }),
      { params: Promise.resolve({}) }
    );
    expect(nvPost.status).toBe(403);
  });

  it("TC_8.6_08: Nhân viên gọi API chốt bảng lương trả 403", async () => {
    const nvGet = await getBangLuongChot(
      makeReq(`http://localhost:3000/api/ky-luong/${TEST_KY}/bang-luong`, {
        token: nv1Token,
      }),
      { params: Promise.resolve({ id: TEST_KY }) }
    );
    expect(nvGet.status).toBe(403);

    const nvPost = await postChotBangLuong(
      makeReq(`http://localhost:3000/api/ky-luong/${TEST_KY}/chot`, {
        method: "POST",
        token: nv1Token,
      }),
      { params: Promise.resolve({ id: TEST_KY }) }
    );
    expect(nvPost.status).toBe(403);
  });

  it("TC_8.6_09: Chưa đăng nhập gọi API chốt bảng lương trả 401", async () => {
    const unauthGet = await getBangLuongChot(
      makeReq(`http://localhost:3000/api/ky-luong/${TEST_KY}/bang-luong`),
      { params: Promise.resolve({ id: TEST_KY }) }
    );
    expect(unauthGet.status).toBe(401);

    const unauthPost = await postChotBangLuong(
      makeReq(`http://localhost:3000/api/ky-luong/${TEST_KY}/chot`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: TEST_KY }) }
    );
    expect(unauthPost.status).toBe(401);
  });

  it("TC_MHC_05: Nhân viên A xem màn hình chính (/api/nhan-vien/tong-quan) chỉ thấy dữ liệu của A, không thấy của B; sai vai trò 403", async () => {
    const nvOverview = await getNhanVienTongQuan(
      makeReq("http://localhost:3000/api/nhan-vien/tong-quan?manv=NV000002", {
        token: nv1Token,
      }),
      { params: Promise.resolve({}) }
    );
    expect(nvOverview.status).toBe(200);
    const nvData = (await nvOverview.json()).data;
    expect(nvData.nhanVien.manv).toBe("NV000001");

    const nvCallCq = await getChuQuanTongQuan(
      makeReq("http://localhost:3000/api/chu-quan/tong-quan", {
        token: nv1Token,
      }),
      { params: Promise.resolve({}) }
    );
    expect(nvCallCq.status).toBe(403);

    const cqCallNv = await getNhanVienTongQuan(
      makeReq("http://localhost:3000/api/nhan-vien/tong-quan", {
        token: cqToken,
      }),
      { params: Promise.resolve({}) }
    );
    expect(cqCallNv.status).toBe(403);
  });

  it("TC_CHUNG_10: Kiểm tra đồng loạt 401 (chưa đăng nhập) và 403 (sai vai trò) trên toàn bộ API còn lại", async () => {
    const emptyCtx = { params: Promise.resolve({}) };
    const idCtx = { params: Promise.resolve({ id: TEST_KY }) };

    const checks = await Promise.all([
      getChamCongHomNay(makeReq("http://localhost:3000/api/cham-cong/hom-nay"), emptyCtx),
      getChamCongHomNay(makeReq("http://localhost:3000/api/cham-cong/hom-nay", { token: cqToken }), emptyCtx),
      getBoSungCaThieu(makeReq("http://localhost:3000/api/bo-sung-cc/ca-thieu"), emptyCtx),
      getBoSungCaThieu(makeReq("http://localhost:3000/api/bo-sung-cc/ca-thieu", { token: cqToken }), emptyCtx),
      getPhanHoiLuong(makeReq("http://localhost:3000/api/phan-hoi-luong"), emptyCtx),
      getPhanHoiLuong(makeReq("http://localhost:3000/api/phan-hoi-luong", { token: cqToken }), emptyCtx),
      getThayCaCaTrongNgay(makeReq("http://localhost:3000/api/thay-ca/ca-trong-ngay"), emptyCtx),
      getThayCaCaTrongNgay(makeReq("http://localhost:3000/api/thay-ca/ca-trong-ngay", { token: cqToken }), emptyCtx),
      getThayCaDangMo(makeReq("http://localhost:3000/api/thay-ca/dang-mo"), emptyCtx),
      getThayCaDangMo(makeReq("http://localhost:3000/api/thay-ca/dang-mo", { token: cqToken }), emptyCtx),
      postThayCa(makeReq("http://localhost:3000/api/thay-ca", { method: "POST", body: { malich: "LL000001" } }), emptyCtx),
      postThayCa(makeReq("http://localhost:3000/api/thay-ca", { method: "POST", token: cqToken, body: { malich: "LL000001" } }), emptyCtx),
      postThayCaChapNhan(makeReq("http://localhost:3000/api/thay-ca/TC000001/chap-nhan", { method: "POST" }), { params: Promise.resolve({ id: "TC000001" }) }),
      postThayCaChapNhan(makeReq("http://localhost:3000/api/thay-ca/TC000001/chap-nhan", { method: "POST", token: cqToken }), { params: Promise.resolve({ id: "TC000001" }) }),
      postThayCaTuChoi(makeReq("http://localhost:3000/api/thay-ca/TC000001/tu-choi", { method: "POST" }), { params: Promise.resolve({ id: "TC000001" }) }),
      postThayCaTuChoi(makeReq("http://localhost:3000/api/thay-ca/TC000001/tu-choi", { method: "POST", token: cqToken }), { params: Promise.resolve({ id: "TC000001" }) }),
      getKyLuongList(makeReq("http://localhost:3000/api/ky-luong"), emptyCtx),
      getKyLuongList(makeReq("http://localhost:3000/api/ky-luong", { token: nv1Token }), emptyCtx),
      getSaiSotKy(makeReq(`http://localhost:3000/api/ky-luong/${TEST_KY}/sai-sot`), idCtx),
      getSaiSotKy(makeReq(`http://localhost:3000/api/ky-luong/${TEST_KY}/sai-sot`, { token: nv1Token }), idCtx),
      getDoiCa(makeReq("http://localhost:3000/api/doi-ca"), emptyCtx),
      getDoiCaXuLy(makeReq("http://localhost:3000/api/doi-ca/xu-ly", { token: nv1Token }), emptyCtx),
      getThongBao(makeReq("http://localhost:3000/api/thong-bao"), emptyCtx),
    ]);

    const expectedStatuses = [
      401, 403, // cham-cong/hom-nay
      401, 403, // bo-sung-cc/ca-thieu
      401, 403, // phan-hoi-luong
      401, 403, // thay-ca/ca-trong-ngay
      401, 403, // thay-ca/dang-mo
      401, 403, // post thay-ca
      401, 403, // thay-ca chap-nhan
      401, 403, // thay-ca tu-choi
      401, 403, // ky-luong
      401, 403, // sai-sot
      401, 403, // doi-ca unauth & doi-ca/xu-ly nv
      401,      // thong-bao unauth
    ];

    expect(checks.map((r) => r.status)).toEqual(expectedStatuses);
  });
});
