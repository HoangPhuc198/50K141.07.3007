import { describe, it, expect } from "vitest";
import {
  tinhTrangThaiNhanVien,
  withTrangThaiDerived,
  withListTrangThaiDerived,
} from "@backend/calc/trangthai";

describe("backend/calc/trangthai.ts: Tự động lên Chính thức sau 3 ngày", () => {
  it("nếu đã là 'Chính thức' thì giữ nguyên 'Chính thức'", () => {
    const res = tinhTrangThaiNhanVien("Chính thức", "2026-11-01", new Date("2026-11-02"));
    expect(res).toBe("Chính thức");
  });

  it("thử việc ngày 0 (cùng ngày vào làm): vẫn là 'Thử việc'", () => {
    const res = tinhTrangThaiNhanVien("Thử việc", "2026-11-01", new Date("2026-11-01"));
    expect(res).toBe("Thử việc");
  });

  it("thử việc ngày 1 (sau 1 ngày): vẫn là 'Thử việc'", () => {
    const res = tinhTrangThaiNhanVien("Thử việc", "2026-11-01", new Date("2026-11-02"));
    expect(res).toBe("Thử việc");
  });

  it("thử việc ngày 2 (sau 2 ngày): vẫn là 'Thử việc'", () => {
    const res = tinhTrangThaiNhanVien("Thử việc", "2026-11-01", new Date("2026-11-03"));
    expect(res).toBe("Thử việc");
  });

  it("thử việc sau 3 ngày (từ ngày thứ 4 trở đi): tự chuyển sang 'Chính thức'", () => {
    const res = tinhTrangThaiNhanVien("Thử việc", "2026-11-01", new Date("2026-11-04"));
    expect(res).toBe("Chính thức");
  });

  it("thử việc sau nhiều ngày: tự chuyển sang 'Chính thức'", () => {
    const res = tinhTrangThaiNhanVien("Thử việc", "2026-10-01", new Date("2026-11-11"));
    expect(res).toBe("Chính thức");
  });

  it("withTrangThaiDerived cập nhật thuộc tính Trangthai của nhân viên", () => {
    const nv = {
      Manv: "NV000007",
      Hoten: "Hoàng Gia Huy",
      Ngayvaolam: new Date("2026-11-01"),
      Trangthai: "Thử việc",
    };
    const updated = withTrangThaiDerived(nv, new Date("2026-11-05"));
    expect(updated.Trangthai).toBe("Chính thức");
  });

  it("withListTrangThaiDerived cập nhật cho cả danh sách", () => {
    const list = [
      {
        Manv: "NV000001",
        Ngayvaolam: new Date("2026-11-01"),
        Trangthai: "Thử việc",
      },
      {
        Manv: "NV000002",
        Ngayvaolam: new Date("2026-11-09"),
        Trangthai: "Thử việc",
      },
    ];
    const updatedList = withListTrangThaiDerived(list, new Date("2026-11-10"));
    expect(updatedList[0].Trangthai).toBe("Chính thức");
    expect(updatedList[1].Trangthai).toBe("Thử việc");
  });
});
