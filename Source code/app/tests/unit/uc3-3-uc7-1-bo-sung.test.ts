import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import fs from "node:fs";
import path from "node:path";
import { signSession, AUTH_COOKIE_NAME } from "@backend/lib/auth";
import { GET as getCaThieu } from "@/app/api/bo-sung-cc/ca-thieu/route";
import { POST as postBoSung } from "@/app/api/bo-sung-cc/route";
import {
  GET as getXuLyList,
  POST as postXuLy,
} from "@/app/api/bo-sung-cc/xu-ly/route";
import * as thongBao from "@frontend/config/thong-bao";
import { prisma } from "@database/client";

describe("UC_3.3 & UC_7.1 - Bổ sung chấm công (P5A & P5B)", () => {
  const signChuQuan = () =>
    signSession({
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Thanh Hà",
    });

  const signNv = (manv: string, name: string) =>
    signSession({
      userId: manv,
      username: manv,
      role: "NhanVien",
      name,
    });

  const testDateStr = "2099-07-10";
  const testDateObj = new Date("2099-07-10T00:00:00Z");
  const testMalichSang = "LL970001";
  const testMalichChieu = "LL970002";
  const testMalichKhac = "LL970003";

  beforeAll(async () => {
    process.env.JWT_SECRET =
      "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";

    await prisma.yeuCauBoSungCC.deleteMany({
      where: {
        Malich: { in: [testMalichSang, testMalichChieu, testMalichKhac] },
      },
    });
    await prisma.chamCong.deleteMany({
      where: {
        Malich: { in: [testMalichSang, testMalichChieu, testMalichKhac] },
      },
    });
    await prisma.nhanVien_LichLam.deleteMany({
      where: {
        Malich: { in: [testMalichSang, testMalichChieu, testMalichKhac] },
      },
    });
    await prisma.lichLam.deleteMany({
      where: {
        Malich: { in: [testMalichSang, testMalichChieu, testMalichKhac] },
      },
    });

    await prisma.lichLam.createMany({
      data: [
        { Malich: testMalichSang, Ngaylam: testDateObj, Maca: "CA000001" },
        { Malich: testMalichChieu, Ngaylam: testDateObj, Maca: "CA000002" },
        { Malich: testMalichKhac, Ngaylam: testDateObj, Maca: "CA000003" },
      ],
    });

    // NV000001: Ca Sáng (quên check-out) & Ca Chiều (quên check-in)
    // NV000002: Ca Tối (ca của người khác)
    await prisma.nhanVien_LichLam.createMany({
      data: [
        { Manv: "NV000001", Malich: testMalichSang },
        { Manv: "NV000001", Malich: testMalichChieu },
        { Manv: "NV000002", Malich: testMalichKhac },
      ],
    });
  });

  afterAll(async () => {
    vi.useRealTimers();
    await prisma.yeuCauBoSungCC.deleteMany({
      where: {
        Malich: { in: [testMalichSang, testMalichChieu, testMalichKhac] },
      },
    });
    await prisma.chamCong.deleteMany({
      where: {
        Malich: { in: [testMalichSang, testMalichChieu, testMalichKhac] },
      },
    });
    await prisma.nhanVien_LichLam.deleteMany({
      where: {
        Malich: { in: [testMalichSang, testMalichChieu, testMalichKhac] },
      },
    });
    await prisma.lichLam.deleteMany({
      where: {
        Malich: { in: [testMalichSang, testMalichChieu, testMalichKhac] },
      },
    });
  });

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    // Giả lập thời điểm 2099-07-10 23:00 (cả 3 ca trong ngày đã kết thúc + quá 60 phút)
    vi.setSystemTime(new Date(`${testDateStr}T23:00:00+07:00`));

    await prisma.yeuCauBoSungCC.deleteMany({
      where: {
        Malich: { in: [testMalichSang, testMalichChieu, testMalichKhac] },
      },
    });
    await prisma.chamCong.deleteMany({
      where: {
        Malich: { in: [testMalichSang, testMalichChieu, testMalichKhac] },
      },
    });

    // Ca Sáng của NV000001 đã check-in lúc 06:00, quên check-out
    await prisma.chamCong.create({
      data: {
        Machamcong: "CC970001",
        Manv: "NV000001",
        Malich: testMalichSang,
        Thoigiancheckin: new Date(`${testDateStr}T06:00:00.000Z`),
        Thoigiancheckout: null,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Thông báo UC_3.3 & UC_7.1 khớp từng ký tự với 08-THONG-BAO.md và màu chuẩn", () => {
    const mdPath = path.resolve(
      __dirname,
      "../../../docs/ke-hoach/08-THONG-BAO.md"
    );
    const md = fs.readFileSync(mdPath, "utf-8");

    expect(thongBao.BO_SUNG_CC_THIEU_TRUONG).toBe("Vui lòng nhập đầy đủ");
    expect(thongBao.BO_SUNG_CC_GUI_THANH_CONG).toBe("Gửi yêu cầu thành công");
    expect(thongBao.BO_SUNG_CC_THANH_CONG).toBe("Bổ sung chấm công thành công");

    expect(md).toContain(thongBao.BO_SUNG_CC_THIEU_TRUONG);
    expect(md).toContain(thongBao.BO_SUNG_CC_GUI_THANH_CONG);
    expect(md).toContain(thongBao.BO_SUNG_CC_THANH_CONG);

    expect(thongBao.MAU_THONG_BAO.loi.chu).toBe("#C0392B");
    expect(thongBao.MAU_THONG_BAO.loi.nen).toBe("#F7ECEA");
    expect(thongBao.MAU_THONG_BAO["thanh-cong"].chu).toBe("#587554");
  });

  it("401/403 phân quyền cho GET/POST /api/bo-sung-cc/* và NV không gửi được cho ca người khác", async () => {
    const cqToken = await signChuQuan();
    const nv1Token = await signNv("NV000001", "Nguyễn Minh Anh");

    // 1. Chưa đăng nhập -> 401
    expect(
      (
        await getCaThieu(
          new Request("http://localhost:3000/api/bo-sung-cc/ca-thieu"),
          { params: Promise.resolve({}) }
        )
      ).status
    ).toBe(401);

    expect(
      (
        await postBoSung(
          new Request("http://localhost:3000/api/bo-sung-cc", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              malich: testMalichSang,
              giorabosung: "11:30",
              lydo: "Quên",
            }),
          }),
          { params: Promise.resolve({}) }
        )
      ).status
    ).toBe(401);

    expect(
      (
        await getXuLyList(
          new Request("http://localhost:3000/api/bo-sung-cc/xu-ly"),
          { params: Promise.resolve({}) }
        )
      ).status
    ).toBe(401);

    expect(
      (
        await postXuLy(
          new Request("http://localhost:3000/api/bo-sung-cc/xu-ly", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              mayeucau: "YC000001",
              giorabosung: "11:30",
            }),
          }),
          { params: Promise.resolve({}) }
        )
      ).status
    ).toBe(401);

    // 2. Sai vai trò -> 403
    expect(
      (
        await getCaThieu(
          new Request("http://localhost:3000/api/bo-sung-cc/ca-thieu", {
            headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` },
          }),
          { params: Promise.resolve({}) }
        )
      ).status
    ).toBe(403);

    expect(
      (
        await postBoSung(
          new Request("http://localhost:3000/api/bo-sung-cc", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              cookie: `${AUTH_COOKIE_NAME}=${cqToken}`,
            },
            body: JSON.stringify({
              malich: testMalichSang,
              giorabosung: "11:30",
              lydo: "Quên",
            }),
          }),
          { params: Promise.resolve({}) }
        )
      ).status
    ).toBe(403);

    expect(
      (
        await getXuLyList(
          new Request("http://localhost:3000/api/bo-sung-cc/xu-ly", {
            headers: { cookie: `${AUTH_COOKIE_NAME}=${nv1Token}` },
          }),
          { params: Promise.resolve({}) }
        )
      ).status
    ).toBe(403);

    expect(
      (
        await postXuLy(
          new Request("http://localhost:3000/api/bo-sung-cc/xu-ly", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
            },
            body: JSON.stringify({
              mayeucau: "YC000001",
              giorabosung: "11:30",
            }),
          }),
          { params: Promise.resolve({}) }
        )
      ).status
    ).toBe(403);

    // 3. NV000001 cố gửi bổ sung cho ca của NV000002 -> 403
    const resOther = await postBoSung(
      new Request("http://localhost:3000/api/bo-sung-cc", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
        },
        body: JSON.stringify({
          malich: testMalichKhac,
          giovaobosung: "17:00",
          giorabosung: "22:00",
          lydo: "Gửi nhầm ca người khác",
        }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(resOther.status).toBe(403);
  });

  it("UC_3.3 validation: thiếu lý do, thiếu giờ, hoặc giờ ra <= giờ vào đều báo lỗi đúng chữ", async () => {
    const nv1Token = await signNv("NV000001", "Nguyễn Minh Anh");

    // Thiếu lý do
    const resNoReason = await postBoSung(
      new Request("http://localhost:3000/api/bo-sung-cc", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
        },
        body: JSON.stringify({
          malich: testMalichSang,
          giorabosung: "11:30",
          lydo: "   ",
        }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(resNoReason.status).toBe(400);
    const jsonNoReason = await resNoReason.json();
    expect(jsonNoReason.error.message).toBe(thongBao.BO_SUNG_CC_THIEU_TRUONG);

    // Thiếu giờ kết thúc
    const resNoOut = await postBoSung(
      new Request("http://localhost:3000/api/bo-sung-cc", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
        },
        body: JSON.stringify({
          malich: testMalichSang,
          giorabosung: "",
          lydo: "Quên check-out",
        }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(resNoOut.status).toBe(400);
    const jsonNoOut = await resNoOut.json();
    expect(jsonNoOut.error.message).toBe(thongBao.BO_SUNG_CC_THIEU_TRUONG);

    // Quên check-in nhưng thiếu giờ vào
    const resNoIn = await postBoSung(
      new Request("http://localhost:3000/api/bo-sung-cc", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
        },
        body: JSON.stringify({
          malich: testMalichChieu,
          loaiYeuCau: "Quên check-in",
          giovaobosung: "",
          giorabosung: "17:00",
          lydo: "Quên check-in",
        }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(resNoIn.status).toBe(400);
    const jsonNoIn = await resNoIn.json();
    expect(jsonNoIn.error.message).toBe(thongBao.BO_SUNG_CC_THIEU_TRUONG);

    // Giờ ra <= giờ vào
    const resBadOrder = await postBoSung(
      new Request("http://localhost:3000/api/bo-sung-cc", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
        },
        body: JSON.stringify({
          malich: testMalichChieu,
          loaiYeuCau: "Quên check-in",
          giovaobosung: "17:00",
          giorabosung: "11:30",
          lydo: "Nhập ngược giờ",
        }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(resBadOrder.status).toBe(400);
    const jsonBadOrder = await resBadOrder.json();
    expect(jsonBadOrder.error.message).toBe(
      "Giờ kết thúc ca phải sau giờ vào ca"
    );
  });

  it("Khứ hồi UC_3.3 -> UC_7.1 cho cả hai nhánh (Quên check-out & Quên check-in) và kiểm tra giờ ra > giờ vào", async () => {
    const nv1Token = await signNv("NV000001", "Nguyễn Minh Anh");
    const cqToken = await signChuQuan();

    // 1. NV000001 lấy danh sách ca thiếu của chính mình (không lẫn testMalichKhac của NV000002)
    const caThieuRes = await getCaThieu(
      new Request("http://localhost:3000/api/bo-sung-cc/ca-thieu", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${nv1Token}` },
      }),
      { params: Promise.resolve({}) }
    );
    expect(caThieuRes.status).toBe(200);
    const caThieuJson = await caThieuRes.json();
    const items = caThieuJson.data.items as Array<{
      malich: string;
      loaiThieu: string;
    }>;
    expect(items.some((i) => i.malich === testMalichSang && i.loaiThieu === "Quên check-out")).toBe(true);
    expect(items.some((i) => i.malich === testMalichChieu && i.loaiThieu === "Quên check-in")).toBe(true);
    expect(items.some((i) => i.malich === testMalichKhac)).toBe(false);

    // 2. NV000001 gửi yêu cầu Quên check-out cho testMalichSang
    const postOutRes = await postBoSung(
      new Request("http://localhost:3000/api/bo-sung-cc", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
        },
        body: JSON.stringify({
          malich: testMalichSang,
          loaiYeuCau: "Quên check-out",
          giorabosung: "11:30",
          lydo: "Em quên check-out ca sáng",
        }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(postOutRes.status).toBe(201);
    const postOutJson = await postOutRes.json();
    const ycOutId = postOutJson.data.mayeucau as string;
    expect(ycOutId).toMatch(/^YC\d{6}$/);
    expect(postOutJson.data.giovaobosung).toBeNull();
    expect(postOutJson.data.giorabosung).toBe("11:30");
    expect(postOutJson.data.trangthai).toBe("Chưa xử lý");
    expect(postOutJson.data.message).toBe(thongBao.BO_SUNG_CC_GUI_THANH_CONG);

    // 3. NV000001 gửi yêu cầu Quên check-in cho testMalichChieu
    const postInRes = await postBoSung(
      new Request("http://localhost:3000/api/bo-sung-cc", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${nv1Token}`,
        },
        body: JSON.stringify({
          malich: testMalichChieu,
          loaiYeuCau: "Quên check-in",
          giovaobosung: "11:45",
          giorabosung: "17:00",
          lydo: "Em quên check-in ca chiều",
        }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(postInRes.status).toBe(201);
    const postInJson = await postInRes.json();
    const ycInId = postInJson.data.mayeucau as string;
    expect(postInJson.data.giovaobosung).toBe("11:45");
    expect(postInJson.data.giorabosung).toBe("17:00");
    expect(postInJson.data.trangthai).toBe("Chưa xử lý");

    // 4. Khứ hồi: CQ đọc danh sách chưa xử lý -> so khớp từng trường
    const xuLyGetRes = await getXuLyList(
      new Request("http://localhost:3000/api/bo-sung-cc/xu-ly", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` },
      }),
      { params: Promise.resolve({}) }
    );
    expect(xuLyGetRes.status).toBe(200);
    const xuLyList = (await xuLyGetRes.json()).data.items as Array<{
      mayeucau: string;
      manv: string;
      tenNhanVien: string;
      malich: string;
      ngayLam: string;
      caLam: string;
      loaiYeuCau: string;
      giovaobosung: string | null;
      giorabosung: string;
      lydo: string;
      trangthai: string;
    }>;

    const itemOut = xuLyList.find((x) => x.mayeucau === ycOutId);
    expect(itemOut).toBeDefined();
    expect(itemOut?.manv).toBe("NV000001");
    expect(itemOut?.tenNhanVien).toBe("Nguyễn Minh Anh");
    expect(itemOut?.malich).toBe(testMalichSang);
    expect(itemOut?.ngayLam).toBe(testDateStr);
    expect(itemOut?.loaiYeuCau).toBe("Quên check-out");
    expect(itemOut?.giovaobosung).toBeNull();
    expect(itemOut?.giorabosung).toBe("11:30");
    expect(itemOut?.lydo).toBe("Em quên check-out ca sáng");
    expect(itemOut?.trangthai).toBe("Chưa xử lý");

    const itemIn = xuLyList.find((x) => x.mayeucau === ycInId);
    expect(itemIn).toBeDefined();
    expect(itemIn?.loaiYeuCau).toBe("Quên check-in");
    expect(itemIn?.giovaobosung).toBe("11:45");
    expect(itemIn?.giorabosung).toBe("17:00");
    expect(itemIn?.lydo).toBe("Em quên check-in ca chiều");

    // 5. CQ cố lưu giờ ra <= giờ vào -> 400
    const badXuLy = await postXuLy(
      new Request("http://localhost:3000/api/bo-sung-cc/xu-ly", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${cqToken}`,
        },
        body: JSON.stringify({
          mayeucau: ycInId,
          giovaobosung: "17:00",
          giorabosung: "11:30",
        }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(badXuLy.status).toBe(400);

    // 6. CQ chỉnh giờ rồi lưu cho Quên check-out (11:30 -> 11:15)
    const okOutRes = await postXuLy(
      new Request("http://localhost:3000/api/bo-sung-cc/xu-ly", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${cqToken}`,
        },
        body: JSON.stringify({
          mayeucau: ycOutId,
          giorabosung: "11:15",
        }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(okOutRes.status).toBe(200);
    const okOutJson = await okOutRes.json();
    expect(okOutJson.data.trangthai).toBe("Đã xử lý");
    expect(okOutJson.data.message).toBe(thongBao.BO_SUNG_CC_THANH_CONG);

    const dbCcOut = await prisma.chamCong.findUnique({
      where: {
        Manv_Malich: { Manv: "NV000001", Malich: testMalichSang },
      },
    });
    expect(dbCcOut?.Thoigiancheckin?.toISOString()).toBe(
      `${testDateStr}T06:00:00.000Z`
    );
    expect(dbCcOut?.Thoigiancheckout?.toISOString()).toBe(
      `${testDateStr}T11:15:00.000Z`
    );

    // 7. CQ chỉnh giờ rồi lưu cho Quên check-in (11:30 -> 17:10)
    const okInRes = await postXuLy(
      new Request("http://localhost:3000/api/bo-sung-cc/xu-ly", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${AUTH_COOKIE_NAME}=${cqToken}`,
        },
        body: JSON.stringify({
          mayeucau: ycInId,
          giovaobosung: "11:30",
          giorabosung: "17:10",
        }),
      }),
      { params: Promise.resolve({}) }
    );
    expect(okInRes.status).toBe(200);
    const okInJson = await okInRes.json();
    expect(okInJson.data.trangthai).toBe("Đã xử lý");
    expect(okInJson.data.message).toBe(thongBao.BO_SUNG_CC_THANH_CONG);

    const dbCcIn = await prisma.chamCong.findUnique({
      where: {
        Manv_Malich: { Manv: "NV000001", Malich: testMalichChieu },
      },
    });
    expect(dbCcIn?.Thoigiancheckin?.toISOString()).toBe(
      `${testDateStr}T11:30:00.000Z`
    );
    expect(dbCcIn?.Thoigiancheckout?.toISOString()).toBe(
      `${testDateStr}T17:10:00.000Z`
    );

    // 8. Sau khi xử lý, cả 2 yêu cầu đã chuyển trạng thái "Đã xử lý" và không còn trong danh sách chưa xử lý
    const afterListRes = await getXuLyList(
      new Request("http://localhost:3000/api/bo-sung-cc/xu-ly", {
        headers: { cookie: `${AUTH_COOKIE_NAME}=${cqToken}` },
      }),
      { params: Promise.resolve({}) }
    );
    const afterItems = (await afterListRes.json()).data.items as Array<{
      mayeucau: string;
    }>;
    expect(afterItems.some((x) => x.mayeucau === ycOutId)).toBe(false);
    expect(afterItems.some((x) => x.mayeucau === ycInId)).toBe(false);
  });

  it("Chống quay lại lỗi thật: Nhân viên Bùi Kiều Linh (Phục vụ) gửi bổ sung ca Sáng 15/11 Quên check-in dưới múi giờ UTC và khi cookie chung bị tab khác ghi đè", async () => {
    const nvLinh = "NV000003"; // Nhân viên Phục vụ
    const malich1511 = "LL971511";
    const date1511 = new Date("2099-11-15T00:00:00Z");

    // Giả lập máy chủ chạy UTC lúc 2099-11-15 06:00:00Z (tức 13:00 giờ VN, đã qua ca Sáng 06:00-11:30 + 60 phút)
    vi.setSystemTime(new Date("2099-11-15T06:00:00.000Z"));
    const linhToken = await signNv(nvLinh, "Bùi Kiều Linh");
    const cqToken = await signChuQuan();

    await prisma.yeuCauBoSungCC.deleteMany({ where: { Malich: malich1511 } });
    await prisma.chamCong.deleteMany({ where: { Malich: malich1511 } });
    await prisma.donXinDoiCa.deleteMany({ where: { Malich: malich1511 } });
    await prisma.nhanVien_LichLam.deleteMany({ where: { Malich: malich1511 } });
    await prisma.lichLam.deleteMany({ where: { Malich: malich1511 } });

    try {
      await prisma.lichLam.create({
        data: {
          Malich: malich1511,
          Ngaylam: date1511,
          Maca: "CA000001",
        },
      });
      await prisma.nhanVien_LichLam.create({
        data: {
          Manv: nvLinh,
          Malich: malich1511,
        },
      });

      // 1. Gửi bằng x-tab-token của Bùi Kiều Linh ngay cả khi cookie thanhha_token bị tab Chủ quán ghi đè
      const res = await postBoSung(
        new Request("http://localhost:3000/api/bo-sung-cc", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: `${AUTH_COOKIE_NAME}=${cqToken}`,
            "x-tab-token": linhToken,
          },
          body: JSON.stringify({
            malich: malich1511,
            loaiYeuCau: "Quên check-in",
            giovaobosung: "06:00",
            giorabosung: "11:30",
            lydo: "Em quên bấm check-in ca sáng 15/11",
          }),
        }),
        { params: Promise.resolve({}) }
      );
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.message).toBe(thongBao.BO_SUNG_CC_GUI_THANH_CONG);
      expect(json.data.giovaobosung).toBe("06:00");
      expect(json.data.giorabosung).toBe("11:30");
    } finally {
      await prisma.yeuCauBoSungCC.deleteMany({ where: { Malich: malich1511 } });
      await prisma.chamCong.deleteMany({ where: { Malich: malich1511 } });
      await prisma.donXinDoiCa.deleteMany({ where: { Malich: malich1511 } });
      await prisma.nhanVien_LichLam.deleteMany({ where: { Malich: malich1511 } });
      await prisma.lichLam.deleteMany({ where: { Malich: malich1511 } });
    }
  });
});
