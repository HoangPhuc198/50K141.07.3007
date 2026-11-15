import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { signSession, AUTH_COOKIE_NAME, UserPayload } from "@backend/lib/auth";
import { POST as handleCreateNhanVien, GET as handleGetList } from "@/app/api/chu-quan/nhan-vien/route";
import { GET as handleGetDetail, PUT as handleUpdateNhanVien } from "@/app/api/chu-quan/nhan-vien/[id]/route";
import { prisma } from "@database/client";
import { getYeuCauCanXuLyList } from "@backend/services/yeu-cau-can-xu-ly";
import { formatDateVN, nowVN } from "@backend/lib/time";

describe("Test khứ hồi 12 trường Nhân viên & Đếm yêu cầu cần xử lý", () => {
  let chuQuanToken: string;
  let testManv = "";
  const testPhone = "0987654321";
  const testPhoneUpdated = "0987654322";

  beforeAll(async () => {
    process.env.JWT_SECRET = "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";
    process.env.DEFAULT_PASSWORD = "123456";

    const payload: UserPayload = {
      userId: "CQ000001",
      username: "chuquan",
      role: "ChuQuan",
      name: "Thanh Hà",
    };
    chuQuanToken = await signSession(payload);

    // Dọn dẹp dữ liệu cũ nếu còn sót
    await prisma.nhanVien.deleteMany({
      where: {
        OR: [{ Sdt: testPhone }, { Sdt: testPhoneUpdated }],
      },
    });
  });

  afterAll(async () => {
    if (testManv) {
      await prisma.nhanVien.deleteMany({ where: { Manv: testManv } });
    }
    await prisma.nhanVien.deleteMany({
      where: {
        OR: [{ Sdt: testPhone }, { Sdt: testPhoneUpdated }],
      },
    });
  });

  it("Khứ hồi 12 trường: Tạo nhân viên qua API -> Đọc lại ở danh sách, xem, sửa", async () => {
    const inputData = {
      Hoten: "Trần Thị Khứ Hồi",
      Sdt: testPhone,
      Diachi: "123 Đường Test, Quận 1, TP Đà Nẵng",
      Truonghoc: "Đại học Bách Khoa",
      Vitrilamviec: "Pha chế",
      Hinhthuclam: "Part-time",
      Ngayvaolam: formatDateVN(nowVN()),
      Kinhnghiem: "Đã có kinh nghiệm pha chế 2 năm",
      Trangthai: "Thử việc",
      Mucluongtheogio: 20000,
    };

    // 1. TẠO qua POST /api/chu-quan/nhan-vien
    const createReq = new Request("http://localhost:3000/api/chu-quan/nhan-vien", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
      },
      body: JSON.stringify(inputData),
    });
    const createRes = await handleCreateNhanVien(createReq, { params: Promise.resolve({}) });
    expect(createRes.status).toBe(201);
    const createJson = await createRes.json();
    expect(createJson.ok).toBe(true);

    const created = createJson.data;
    testManv = created.Manv;
    expect(testManv).toMatch(/^NV\d{6}$/);

    // Kiểm tra 12 trường ở kết quả tạo
    expect(created.Manv).toBe(testManv);
    expect(created.Tendangnhap).toBe(testManv);
    expect(created.Hoten).toBe(inputData.Hoten);
    expect(created.Sdt).toBe(inputData.Sdt);
    expect(created.Diachi).toBe(inputData.Diachi);
    expect(created.Truonghoc).toBe(inputData.Truonghoc);
    expect(created.Vitrilamviec).toBe(inputData.Vitrilamviec);
    expect(created.Hinhthuclam).toBe(inputData.Hinhthuclam);
    expect(created.Ngayvaolam).toContain(inputData.Ngayvaolam);
    expect(created.Kinhnghiem).toBe(inputData.Kinhnghiem);
    expect(created.Trangthai).toBe(inputData.Trangthai);
    expect(created.Mucluongtheogio).toBe(inputData.Mucluongtheogio);
    expect(created.matKhauGiaiMa).toBe("123456");

    // 2. ĐỌC LẠI Ở DANH SÁCH qua GET /api/chu-quan/nhan-vien?q=<manv>
    const listReq = new Request(`http://localhost:3000/api/chu-quan/nhan-vien?q=${testManv}`, {
      method: "GET",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
    });
    const listRes = await handleGetList(listReq, { params: Promise.resolve({}) });
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    expect(listJson.ok).toBe(true);

    const foundInList = listJson.data.items.find((item: any) => item.Manv === testManv);
    expect(foundInList).toBeDefined();

    // So khớp đủ 12 trường ở danh sách
    expect(foundInList.Manv).toBe(created.Manv);
    expect(foundInList.Tendangnhap).toBe(created.Tendangnhap);
    expect(foundInList.Hoten).toBe(created.Hoten);
    expect(foundInList.Sdt).toBe(created.Sdt);
    expect(foundInList.Diachi).toBe(created.Diachi);
    expect(foundInList.Truonghoc).toBe(created.Truonghoc);
    expect(foundInList.Vitrilamviec).toBe(created.Vitrilamviec);
    expect(foundInList.Hinhthuclam).toBe(created.Hinhthuclam);
    expect(foundInList.Ngayvaolam).toBe(created.Ngayvaolam);
    expect(foundInList.Kinhnghiem).toBe(created.Kinhnghiem);
    expect(foundInList.Trangthai).toBe(created.Trangthai);
    expect(foundInList.Mucluongtheogio).toBe(created.Mucluongtheogio);

    // 3. ĐỌC LẠI Ở XEM CHI TIẾT qua GET /api/chu-quan/nhan-vien/[id]
    const detailReq = new Request(`http://localhost:3000/api/chu-quan/nhan-vien/${testManv}`, {
      method: "GET",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
    });
    const detailRes = await handleGetDetail(detailReq, { params: Promise.resolve({ id: testManv }) });
    expect(detailRes.status).toBe(200);
    const detailJson = await detailRes.json();
    expect(detailJson.ok).toBe(true);
    const detailData = detailJson.data;

    // So khớp đủ 12 trường ở chi tiết + mật khẩu giải mã
    expect(detailData.Manv).toBe(created.Manv);
    expect(detailData.Tendangnhap).toBe(created.Tendangnhap);
    expect(detailData.Hoten).toBe(created.Hoten);
    expect(detailData.Sdt).toBe(created.Sdt);
    expect(detailData.Diachi).toBe(created.Diachi);
    expect(detailData.Truonghoc).toBe(created.Truonghoc);
    expect(detailData.Vitrilamviec).toBe(created.Vitrilamviec);
    expect(detailData.Hinhthuclam).toBe(created.Hinhthuclam);
    expect(detailData.Ngayvaolam).toBe(created.Ngayvaolam);
    expect(detailData.Kinhnghiem).toBe(created.Kinhnghiem);
    expect(detailData.Trangthai).toBe(created.Trangthai);
    expect(detailData.Mucluongtheogio).toBe(created.Mucluongtheogio);
    expect(detailData.matKhauGiaiMa).toBe("123456");

    // 4. SỬA THÔNG TIN qua PUT /api/chu-quan/nhan-vien/[id]
    const updateInput = {
      Hoten: "Trần Thị Khứ Hồi Cập Nhật",
      Sdt: testPhoneUpdated,
      Diachi: "456 Đường Sửa Mới, Quận Cẩm Lệ",
      Truonghoc: "Đại học Kinh Tế",
      Vitrilamviec: "Phục vụ",
      Hinhthuclam: "Full-time",
      Ngayvaolam: "2026-11-01",
      Kinhnghiem: "Kinh nghiệm 3 năm",
      Trangthai: "Chính thức",
      Matkhau: "654321",
    };

    const updateReq = new Request(`http://localhost:3000/api/chu-quan/nhan-vien/${testManv}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}`,
      },
      body: JSON.stringify(updateInput),
    });
    const updateRes = await handleUpdateNhanVien(updateReq, { params: Promise.resolve({ id: testManv }) });
    expect(updateRes.status).toBe(200);
    const updateJson = await updateRes.json();
    expect(updateJson.ok).toBe(true);

    const updatedData = updateJson.data;

    // So khớp 12 trường sau khi sửa
    expect(updatedData.Manv).toBe(testManv);
    expect(updatedData.Tendangnhap).toBe(testManv);
    expect(updatedData.Hoten).toBe(updateInput.Hoten);
    expect(updatedData.Sdt).toBe(updateInput.Sdt);
    expect(updatedData.Diachi).toBe(updateInput.Diachi);
    expect(updatedData.Truonghoc).toBe(updateInput.Truonghoc);
    expect(updatedData.Vitrilamviec).toBe(updateInput.Vitrilamviec);
    expect(updatedData.Hinhthuclam).toBe(updateInput.Hinhthuclam);
    expect(updatedData.Ngayvaolam).toContain(updateInput.Ngayvaolam);
    expect(updatedData.Kinhnghiem).toBe(updateInput.Kinhnghiem);
    expect(updatedData.Trangthai).toBe(updateInput.Trangthai);
    expect(updatedData.Mucluongtheogio).toBe(created.Mucluongtheogio); // Mức lương không đổi
    expect(updatedData.matKhauGiaiMa).toBe(updateInput.Matkhau);
  });

  it("Test tìm kiếm theo mã đầy đủ hoặc một phần", async () => {
    // Tìm theo mã đầy đủ
    const req1 = new Request(`http://localhost:3000/api/chu-quan/nhan-vien?q=NV000008`, {
      method: "GET",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
    });
    const res1 = await handleGetList(req1, { params: Promise.resolve({}) });
    const json1 = await res1.json();
    expect(json1.ok).toBe(true);
    expect(json1.data.items.some((i: any) => i.Manv === "NV000008")).toBe(true);

    // Tìm theo mã rút gọn "NV008"
    const req2 = new Request(`http://localhost:3000/api/chu-quan/nhan-vien?q=NV008`, {
      method: "GET",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
    });
    const res2 = await handleGetList(req2, { params: Promise.resolve({}) });
    const json2 = await res2.json();
    expect(json2.ok).toBe(true);
    expect(json2.data.items.some((i: any) => i.Manv === "NV000008")).toBe(true);

    // Tìm theo số "008"
    const req3 = new Request(`http://localhost:3000/api/chu-quan/nhan-vien?q=008`, {
      method: "GET",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${chuQuanToken}` },
    });
    const res3 = await handleGetList(req3, { params: Promise.resolve({}) });
    const json3 = await res3.json();
    expect(json3.ok).toBe(true);
    expect(json3.data.items.some((i: any) => i.Manv === "NV000008")).toBe(true);
  });

  it("Test đếm yêu cầu cần xử lý: 2 đơn đổi ca mẫu, 1 bổ sung chấm công, 2 phản hồi lương -> tổng 5, nhãn khớp, lương 2; không có phản hồi lương thì nhãn Lương là 0", async () => {
    // Trạng thái ban đầu: CSDL mẫu có 2 đơn đổi ca (DD000001, DD000002), 1 bổ sung chấm công, 0 phản hồi lương
    const initialList = await getYeuCauCanXuLyList();
    const initTotal = initialList.length;
    const initDoiCa = initialList.filter((y) => y.loaiYeuCau === "Đổi ca").length;
    const initBoSung = initialList.filter((y) => y.loaiYeuCau === "Chấm công").length;
    const initLuong = initialList.filter((y) => y.loaiYeuCau === "Lương").length;

    expect(initDoiCa).toBe(2);
    expect(initBoSung).toBe(1);
    expect(initLuong).toBe(0); // Chưa có phản hồi lương -> nhãn Lương là 0
    expect(initTotal).toBe(3);

    // Lấy hoặc tạo bảng lương mẫu để liên kết khóa ngoại PhanHoiLuong
    let createdBL = false;
    let bangLuongId = "BL999999";
    const existingBL = await prisma.bangLuong.findFirst();
    if (existingBL) {
      bangLuongId = existingBL.Mabangluong;
    } else {
      const existingKL = await prisma.kyLuong.findFirst();
      const makyluong = existingKL ? existingKL.Makyluong : "KL202611";
      if (!existingKL) {
        await prisma.kyLuong.create({
          data: {
            Makyluong: makyluong,
            Thang: 1,
            Nam: 2099,
            Trangthai: "Dự kiến",
          },
        });
      }
      await prisma.bangLuong.create({
        data: {
          Mabangluong: bangLuongId,
          Manv: "NV000001",
          Makyluong: makyluong,
        },
      });
      createdBL = true;
    }

    const testPhanHoiIds = ["PH999991", "PH999992"];

    try {
      // Chèn 2 phản hồi lương chưa xử lý
      await prisma.phanHoiLuong.createMany({
        data: [
          {
            Maphanhoi: testPhanHoiIds[0],
            Mabangluong: bangLuongId,
            Noidung: "Phản hồi lương test 1",
            Trangthai: "Chưa xử lý",
          },
          {
            Maphanhoi: testPhanHoiIds[1],
            Mabangluong: bangLuongId,
            Noidung: "Phản hồi lương test 2",
            Trangthai: "Chưa xử lý",
          },
        ],
      });

      // Lấy lại danh sách yêu cầu
      const listWith4 = await getYeuCauCanXuLyList();
      const countTotal = listWith4.length;
      const countDoiCa = listWith4.filter((y) => y.loaiYeuCau === "Đổi ca").length;
      const countBoSung = listWith4.filter((y) => y.loaiYeuCau === "Chấm công").length;
      const countLuong = listWith4.filter((y) => y.loaiYeuCau === "Lương").length;

      // Kỳ vọng: 2 đổi ca + 1 bổ sung + 2 lương = tổng 5
      expect(countDoiCa).toBe(2);
      expect(countBoSung).toBe(1);
      expect(countLuong).toBe(2);
      expect(countTotal).toBe(5);
      expect(listWith4).toHaveLength(5);
    } finally {
      // Dọn dẹp 2 phản hồi lương
      await prisma.phanHoiLuong.deleteMany({
        where: { Maphanhoi: { in: testPhanHoiIds } },
      });
      if (createdBL) {
        await prisma.bangLuong.deleteMany({ where: { Mabangluong: bangLuongId } });
        await prisma.kyLuong.deleteMany({ where: { Makyluong: "KL999999" } });
      }
    }

    // Sau khi dọn dẹp: kiểm tra lại nhãn Lương quay về 0
    const listCleaned = await getYeuCauCanXuLyList();
    const cleanedLuong = listCleaned.filter((y) => y.loaiYeuCau === "Lương").length;
    expect(cleanedLuong).toBe(0);
    expect(listCleaned.length).toBe(3);
  });
});
