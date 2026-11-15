import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import { encrypt } from "@backend/lib/crypto";
import {
  authenticateUser,
  clearRateLimitMemory,
  recordFailedAttempt,
  checkRateLimit,
} from "@backend/services/auth";
import { POST as handleLogin } from "@/app/api/auth/login/route";
import { prisma } from "@database/client";
import {
  REMEMBERED_USERNAMES_KEY,
  readRememberedUsernames,
  saveRememberedUsername,
  removeRememberedUsername,
} from "@frontend/lib/remember-username";

describe("Đăng nhập & Xác thực (tests/unit/login.test.ts)", () => {
  const defaultPassword = "123456";
  let encryptedPassword = "";

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = "f3e30a1389c33496f423af12c42ea726264983b3d28cc449204d69f89fcfcb8e";
    process.env.JWT_SECRET = "00f601564cc95acec5f08bb4a854f96c45d3530ea7c219cbb42e115d7ca501bd";
    encryptedPassword = encrypt(defaultPassword);
  });

  beforeEach(() => {
    clearRateLimitMemory();
    vi.restoreAllMocks();
  });

  describe("Validation để trống (Figma trạng thái 2)", () => {
    it("để trống tên đăng nhập phải trả về lỗi 'Không được để trống'", async () => {
      const req = new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "", password: "123" }),
      });
      const res = await handleLogin(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error.message).toBe("Không được để trống");
    });

    it("để trống mật khẩu phải trả về lỗi 'Không được để trống'", async () => {
      const req = new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "CQ000001", password: "" }),
      });
      const res = await handleLogin(req, { params: Promise.resolve({}) });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error.message).toBe("Không được để trống");
    });
  });

  describe("Khóa tài khoản khi nhập sai 5 lần / 15 phút", () => {
    it("nhập sai 5 lần liên tiếp sẽ bị khóa tạm 15 phút", () => {
      const user = "testuser";
      const ip = "192.168.1.100";

      // Thử 4 lần đầu
      for (let i = 1; i <= 4; i++) {
        const attempt = recordFailedAttempt(user, ip);
        expect(attempt.isLocked).toBe(false);
        expect(attempt.attempts).toBe(i);
      }

      // Lần thứ 5 -> bị khóa
      const attempt5 = recordFailedAttempt(user, ip);
      expect(attempt5.isLocked).toBe(true);

      // Kiểm tra trạng thái khóa
      const check = checkRateLimit(user, ip);
      expect(check.isLocked).toBe(true);
      expect(check.remainingMinutes).toBeGreaterThan(0);
      expect(check.remainingMinutes).toBeLessThanOrEqual(15);
    });
  });

  describe("Đăng nhập Chủ quán & Nhân viên", () => {
    it("đăng nhập Chủ quán với mã CQ000001 thành công", async () => {
      vi.spyOn(prisma.chuQuan, "findFirst").mockResolvedValue({
        Machuquan: "CQ000001",
        Tendangnhap: "chuquan",
        Matkhau: encryptedPassword,
      } as any);

      const result = await authenticateUser("CQ000001", defaultPassword, "127.0.0.1");
      expect(result.user.role).toBe("ChuQuan");
      expect(result.user.userId).toBe("CQ000001");
      expect(result.redirectUrl).toBe("/chu-quan");
      expect(result.token).toBeDefined();
    });

    it("đăng nhập Chủ quán với Tendangnhap 'chuquan' thành công", async () => {
      vi.spyOn(prisma.chuQuan, "findFirst").mockResolvedValue({
        Machuquan: "CQ000001",
        Tendangnhap: "chuquan",
        Matkhau: encryptedPassword,
      } as any);

      const result = await authenticateUser("chuquan", defaultPassword, "127.0.0.1");
      expect(result.user.role).toBe("ChuQuan");
      expect(result.redirectUrl).toBe("/chu-quan");
    });

    it("đăng nhập Nhân viên với mã NV000001 thành công", async () => {
      vi.spyOn(prisma.chuQuan, "findFirst").mockResolvedValue(null);
      vi.spyOn(prisma.nhanVien, "findFirst").mockResolvedValue({
        Manv: "NV000001",
        Tendangnhap: "NV000001",
        Matkhau: encryptedPassword,
        Hoten: "Nguyễn Minh Anh",
        Vitrilamviec: "Pha chế",
      } as any);

      const result = await authenticateUser("NV000001", defaultPassword, "127.0.0.1");
      expect(result.user.role).toBe("NhanVien");
      expect(result.user.userId).toBe("NV000001");
      expect(result.user.name).toBe("Nguyễn Minh Anh");
      expect(result.redirectUrl).toBe("/nhan-vien");
    });

    it("sai mật khẩu phải trả về đúng thông báo Figma và SRS, không lộ tài khoản", async () => {
      vi.spyOn(prisma.chuQuan, "findFirst").mockResolvedValue({
        Machuquan: "CQ000001",
        Tendangnhap: "chuquan",
        Matkhau: encryptedPassword,
      } as any);

      await expect(
        authenticateUser("CQ000001", "matkhausai", "127.0.0.1")
      ).rejects.toThrow("Tên đăng nhập hoặc mật khẩu không đúng");
    });

    it("tài khoản không tồn tại phải trả về đúng thông báo không lộ thông tin", async () => {
      vi.spyOn(prisma.chuQuan, "findFirst").mockResolvedValue(null);
      vi.spyOn(prisma.nhanVien, "findFirst").mockResolvedValue(null);

      await expect(
        authenticateUser("NV999999", "123456", "127.0.0.1")
      ).rejects.toThrow("Tên đăng nhập hoặc mật khẩu không đúng");
    });
  });

  describe("Nhớ tên tài khoản (remember-username helper)", () => {
    it("khử trùng không phân biệt hoa thường, giữ thứ tự mới nhất trước, giới hạn 10, xóa an toàn", () => {
      const store = new Map<string, string>();
      const fakeWindow = {
        localStorage: {
          getItem: (k: string) => store.get(k) ?? null,
          setItem: (k: string, v: string) => {
            store.set(k, v);
          },
          removeItem: (k: string) => {
            store.delete(k);
          },
        },
      };
      vi.stubGlobal("window", fakeWindow);

      try {
        for (let i = 1; i <= 15; i++) {
          saveRememberedUsername(`user${i}`);
        }
        let list = readRememberedUsernames();
        expect(list).toHaveLength(10);
        expect(list[0]).toBe("user15");
        expect(list[9]).toBe("user6");

        // Lưu lại USER10 khác hoa thường -> đưa lên đầu, không trùng
        saveRememberedUsername("USER10");
        list = readRememberedUsernames();
        expect(list).toHaveLength(10);
        expect(list[0]).toBe("USER10");
        expect(list.filter((x) => x.toLowerCase() === "user10")).toHaveLength(1);

        // Xóa theo tên
        list = removeRememberedUsername("user10");
        expect(list).toHaveLength(9);
        expect(list.some((x) => x.toLowerCase() === "user10")).toBe(false);
        expect(store.get(REMEMBERED_USERNAMES_KEY)).toBe(JSON.stringify(list));
      } finally {
        vi.unstubAllGlobals();
      }
    });

    it("không ném lỗi khi localStorage bị khóa hoặc hỏng JSON", () => {
      vi.stubGlobal("window", {
        localStorage: {
          getItem: () => {
            throw new Error("SecurityError");
          },
          setItem: () => {
            throw new Error("QuotaExceededError");
          },
          removeItem: () => {
            throw new Error("SecurityError");
          },
        },
      });
      try {
        expect(readRememberedUsernames()).toEqual([]);
        expect(() => saveRememberedUsername("chuquan")).not.toThrow();
        expect(() => removeRememberedUsername("chuquan")).not.toThrow();
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
});
