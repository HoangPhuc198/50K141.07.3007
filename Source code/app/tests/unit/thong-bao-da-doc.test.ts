import { afterEach, describe, it, expect, vi } from "vitest";
import {
  MAX_READ_NOTIFICATION_KEYS,
  MAX_SHOWN_NOTIFICATION_KEYS,
  THONG_BAO_DA_DOC_STORAGE_PREFIX,
  THONG_BAO_DA_HIEN_STORAGE_PREFIX,
  THONG_BAO_HIEN_THI_TOI_DA,
  THONG_BAO_THONG_TIN_HET_HAN_NGAY,
  THONG_BAO_TOI_DA_TRONG_DANH_SACH,
  buildAggregateNotificationKey,
  countUnreadNotifications,
  deduplicateNotificationsByEvent,
  filterAndCapNotifications,
  formatNotificationBellCount,
  getThongBaoDaDocStorageKey,
  getThongBaoDaHienStorageKey,
  markNotificationKeyAsRead,
  markNotificationKeyAsShown,
  normalizeReadKeysList,
  parseReadKeysJson,
  pruneReadNotificationKeys,
  pruneShownNotificationKeys,
  readReadNotificationKeys,
  readShownNotificationKeys,
  resolveNotificationKey,
  sortNotificationsByReadAndDate,
  writeReadNotificationKeys,
  writeShownNotificationKeys,
  type StorageLike,
  type ThongBaoCoKhoa,
} from "@frontend/lib/thong-bao-da-doc";
import { getThongBaoTheoPhien } from "@backend/services/thong-bao";
import {
  chapNhanThayCa,
  taoYeuCauThayCa,
  tuChoiThayCa,
} from "@backend/services/thay-ca";
import { prisma } from "@database/client";

function createMemoryStorage(): StorageLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

function makeItem(
  overrides: Partial<ThongBaoCoKhoa> & { id: string }
): ThongBaoCoKhoa {
  return {
    tieuDe: `Tiêu đề ${overrides.id}`,
    thoiGian: "15/11",
    chiTiet: "Chi tiết",
    ...overrides,
  };
}

describe("Chuông thông báo - logic thuần đã đọc / chưa đọc", () => {
  it("tính đúng số chưa đọc, hỗ trợ fallback sang id và định dạng > 99 thành 99+", () => {
    const items: ThongBaoCoKhoa[] = [
      makeItem({ id: "YC-DD000001", khoa: "doi-ca:DD000001" }),
      makeItem({ id: "YC-DD000002", khoa: "doi-ca:DD000002" }),
      makeItem({ id: "TC-MO-TC000001" }), // không có khoa -> dùng id
    ];

    expect(countUnreadNotifications(items, [])).toBe(3);
    expect(countUnreadNotifications(items, ["doi-ca:DD000001"])).toBe(2);
    expect(
      countUnreadNotifications(items, [
        "doi-ca:DD000001",
        "TC-MO-TC000001",
        "khong-ton-tai",
      ])
    ).toBe(1);
    expect(countUnreadNotifications([], ["doi-ca:DD000001"])).toBe(0);

    expect(formatNotificationBellCount(-5)).toBe("0");
    expect(formatNotificationBellCount(0)).toBe("0");
    expect(formatNotificationBellCount(1)).toBe("1");
    expect(formatNotificationBellCount(99)).toBe("99");
    expect(formatNotificationBellCount(100)).toBe("99+");
    expect(formatNotificationBellCount(250)).toBe("99+");
  });

  it("đánh dấu đã đọc làm giảm số chưa đọc đi 1, không trùng khóa và giữ dữ liệu tách theo tài khoản", () => {
    const storage = createMemoryStorage();
    const items: ThongBaoCoKhoa[] = [
      makeItem({ id: "YC-DD000001", khoa: "doi-ca:DD000001" }),
      makeItem({ id: "YC-DD000002", khoa: "doi-ca:DD000002" }),
      makeItem({ id: "YC-YC000001", khoa: "bo-sung:YC000001:2026-11-14" }),
    ];

    expect(getThongBaoDaDocStorageKey("cq000001")).toBe(
      `${THONG_BAO_DA_DOC_STORAGE_PREFIX}CQ000001`
    );
    expect(getThongBaoDaDocStorageKey("   ")).toBe("");

    let cqKeys = readReadNotificationKeys("CQ000001", storage);
    cqKeys = markNotificationKeyAsRead(
      cqKeys,
      resolveNotificationKey(items[0]),
      items
    );
    expect(writeReadNotificationKeys("CQ000001", cqKeys, storage)).toBe(true);

    // Tài khoản khác độc lập hoàn toàn
    expect(readReadNotificationKeys("NV000001", storage)).toEqual([]);
    expect(countUnreadNotifications(items, readReadNotificationKeys("CQ000001", storage))).toBe(2);
    expect(countUnreadNotifications(items, readReadNotificationKeys("NV000001", storage))).toBe(3);

    // Đánh dấu lại cùng khóa không tạo bản sao
    const dupKeys = markNotificationKeyAsRead(cqKeys, "doi-ca:DD000001", items);
    expect(dupKeys).toEqual(["doi-ca:DD000001"]);

    // Giá trị lưu trong localStorage chỉ chứa mảng chuỗi khóa, không chứa nội dung hay bí mật
    const rawSaved = storage.store.get(`${THONG_BAO_DA_DOC_STORAGE_PREFIX}CQ000001`);
    expect(rawSaved).toBe(JSON.stringify(["doi-ca:DD000001"]));
    expect(rawSaved).not.toContain("Tiêu đề");
  });

  it("sắp xếp chưa đọc lên trên, đã đọc xuống dưới; trong mỗi nhóm mới nhất trước", () => {
    const items: ThongBaoCoKhoa[] = [
      makeItem({
        id: "YC-YC000001",
        khoa: "bo-sung:YC000001:2026-11-12",
        mocThoiGian: "2026-11-12T08:00:00",
      }),
      makeItem({
        id: "YC-DD000002",
        khoa: "doi-ca:DD000002",
        mocThoiGian: "2026-11-16T08:00:00",
      }),
      makeItem({
        id: "YC-PH000001",
        khoa: "phan-hoi:PH000001:2026-11-15",
        mocThoiGian: "2026-11-15T00:00:00",
      }),
      makeItem({
        id: "YC-DD000001",
        khoa: "doi-ca:DD000001",
        mocThoiGian: "2026-11-16T08:00:00",
      }),
    ];

    // Đọc YC-DD000002 (mới nhất) và YC-YC000001 (cũ hơn) -> cả hai xuống nhóm đã đọc theo thứ tự mới nhất trước
    const sorted = sortNotificationsByReadAndDate(items, [
      "doi-ca:DD000002",
      "bo-sung:YC000001:2026-11-12",
    ]);

    expect(
      sorted.map((s) => ({ id: s.item.id, isRead: s.isRead }))
    ).toEqual([
      { id: "YC-DD000001", isRead: false },
      { id: "YC-PH000001", isRead: false },
      { id: "YC-DD000002", isRead: true },
      { id: "YC-YC000001", isRead: true },
    ]);
  });

  it("khóa tổng hợp ổn định theo tập mã và tự đổi khi có yêu cầu mới (trở lại chưa đọc)", () => {
    const keyInitialA = buildAggregateNotificationKey("tong-hop-yeu-cau", [
      "DD000002",
      "DD000001",
    ]);
    const keyInitialB = buildAggregateNotificationKey("tong-hop-yeu-cau", [
      "DD000001",
      "DD000002",
      "DD000001",
    ]);
    expect(keyInitialA).toBe("tong-hop-yeu-cau:DD000001,DD000002");
    expect(keyInitialB).toBe(keyInitialA);

    const readKeys = [keyInitialA];
    const aggItemOld = makeItem({ id: "AGG-YC", khoa: keyInitialA });
    expect(countUnreadNotifications([aggItemOld], readKeys)).toBe(0);

    // Khi có yêu cầu mới DD000003 -> khóa tổng hợp đổi -> trở lại chưa đọc
    const keyWithNew = buildAggregateNotificationKey("tong-hop-yeu-cau", [
      "DD000001",
      "DD000002",
      "DD000003",
    ]);
    expect(keyWithNew).not.toBe(keyInitialA);
    const aggItemNew = makeItem({ id: "AGG-YC", khoa: keyWithNew });
    expect(countUnreadNotifications([aggItemNew], readKeys)).toBe(1);
  });

  it("dọn khóa thừa khi thông báo gốc không còn và giữ giới hạn tối đa 500 khóa", () => {
    const activeItems: ThongBaoCoKhoa[] = [
      makeItem({ id: "YC-DD000002", khoa: "doi-ca:DD000002" }),
      makeItem({ id: "BL-KL202611", khoa: "luong:KL202611:Dự kiến" }),
    ];

    const pruned = pruneReadNotificationKeys(
      [
        "doi-ca:DD000001", // đã xử lý xong, không còn trong activeItems
        "doi-ca:DD000002",
        "bo-sung:YC000009:2026-11-10", // đã mất
        "luong:KL202611:Đã chốt", // trạng thái đổi nên khóa cũ bị dọn
      ],
      activeItems
    );
    expect(pruned).toEqual(["doi-ca:DD000002"]);

    // Giới hạn 500 khóa: giữ 500 khóa mới đọc nhất
    const sixHundredKeys = Array.from({ length: 600 }, (_, idx) => `k-${idx}`);
    const capped = normalizeReadKeysList(sixHundredKeys);
    expect(capped).toHaveLength(MAX_READ_NOTIFICATION_KEYS);
    expect(capped[0]).toBe("k-100");
    expect(capped[capped.length - 1]).toBe("k-599");

    const afterMark501 = markNotificationKeyAsRead(capped, "k-600");
    expect(afterMark501).toHaveLength(MAX_READ_NOTIFICATION_KEYS);
    expect(afterMark501[0]).toBe("k-101");
    expect(afterMark501[afterMark501.length - 1]).toBe("k-600");
  });

  it("xử lý an toàn khi JSON hỏng hoặc localStorage bị chặn / không dùng được", () => {
    expect(parseReadKeysJson("{broken json")).toEqual([]);
    expect(parseReadKeysJson("null")).toEqual([]);
    expect(parseReadKeysJson("12345")).toEqual([]);
    expect(
      parseReadKeysJson(JSON.stringify([123, null, "  ", "doi-ca:DD000002"]))
    ).toEqual(["doi-ca:DD000002"]);

    const blockedStorage: StorageLike = {
      getItem() {
        throw new Error("SecurityError: storage blocked");
      },
      setItem() {
        throw new Error("QuotaExceededError: storage blocked");
      },
    };

    expect(readReadNotificationKeys("CQ000001", blockedStorage)).toEqual([]);
    expect(
      writeReadNotificationKeys("CQ000001", ["doi-ca:DD000002"], blockedStorage)
    ).toBe(false);
    expect(readReadNotificationKeys("CQ000001", null)).toEqual([]);
    expect(writeReadNotificationKeys("CQ000001", ["doi-ca:DD000002"], null)).toBe(false);

    const corruptStorage = createMemoryStorage();
    corruptStorage.setItem(`${THONG_BAO_DA_DOC_STORAGE_PREFIX}NV000001`, "{invalid-json");
    const keys = readReadNotificationKeys("NV000001", corruptStorage);
    expect(keys).toEqual([]);
    const items = [makeItem({ id: "BL-KL202611", khoa: "luong:KL202611:Dự kiến" })];
    expect(countUnreadNotifications(items, keys)).toBe(1);
  });

  it("khóa từ backend ổn định tuyệt đối giữa hai lần gọi liên tiếp cho Chủ quán và Nhân viên", async () => {
    const [cq1, cq2, nv1, nv2] = await Promise.all([
      getThongBaoTheoPhien({
        userId: "CQ000001",
        username: "chuquan",
        role: "ChuQuan",
        name: "Chủ quán",
      }),
      getThongBaoTheoPhien({
        userId: "CQ000001",
        username: "chuquan",
        role: "ChuQuan",
        name: "Chủ quán",
      }),
      getThongBaoTheoPhien({
        userId: "NV000001",
        username: "NV000001",
        role: "NhanVien",
        name: "Nhân viên 1",
      }),
      getThongBaoTheoPhien({
        userId: "NV000001",
        username: "NV000001",
        role: "NhanVien",
        name: "Nhân viên 1",
      }),
    ]);

    const cqKeys1 = cq1.items.map((item) => item.khoa);
    const cqKeys2 = cq2.items.map((item) => item.khoa);
    expect(cqKeys1.every((k) => typeof k === "string" && k.trim().length > 0)).toBe(true);
    expect(cqKeys2).toEqual(cqKeys1);

    const nvKeys1 = nv1.items.map((item) => item.khoa);
    const nvKeys2 = nv2.items.map((item) => item.khoa);
    expect(nvKeys1.every((k) => typeof k === "string" && k.trim().length > 0)).toBe(true);
    expect(nvKeys2).toEqual(nvKeys1);
  });
});

describe("Chống lặp, hết hạn 7 ngày, giới hạn 50 và chống bật lại hộp thoại", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hằng số dùng chung đúng quy định và gộp trùng 1 sự kiện = 1 dòng", () => {
    expect(THONG_BAO_THONG_TIN_HET_HAN_NGAY).toBe(7);
    expect(THONG_BAO_TOI_DA_TRONG_DANH_SACH).toBe(50);
    expect(THONG_BAO_HIEN_THI_TOI_DA).toBe(99);
    expect(formatNotificationBellCount(99)).toBe("99");
    expect(formatNotificationBellCount(100)).toBe("99+");

    const duplicateEventItems: ThongBaoCoKhoa[] = [
      makeItem({
        id: "TC-YC-TC000001",
        khoa: "thay-ca-yc:TC000001:2095-05-15:dang-mo",
        suKien: "thay-ca:TC000001",
        nhom: "thong-tin",
        mocThoiGian: "2095-05-15T10:00:00",
      }),
      makeItem({
        id: "TC-DN-TC000001",
        khoa: "thay-ca-da-nhan:TC000001:NV000002:2095-05-15",
        suKien: "thay-ca:TC000001",
        nhom: "thong-tin",
        mocThoiGian: "2095-05-15T10:05:00",
      }),
    ];

    const deduped = deduplicateNotificationsByEvent(duplicateEventItems);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].id).toBe("TC-DN-TC000001");
  });

  it("hết hạn thông báo thông tin sau 7 ngày theo nowVN(); không hết hạn cần hành động và kỳ lương mới nhất", () => {
    vi.useFakeTimers();
    // 2095-05-15T07:00:00Z = 14:00:00 giờ VN (GMT+7) ngày 15/05/2095
    vi.setSystemTime(new Date("2095-05-15T07:00:00Z"));
    const now = new Date(2095, 4, 15, 14, 0, 0);

    const items: ThongBaoCoKhoa[] = [
      makeItem({
        id: "DC-DD000001",
        khoa: "doi-ca-kq:DD000001:NV000002",
        nhom: "thong-tin",
        mocThoiGian: "2095-05-08T13:59:59", // > 7 ngày đúng 1 giây -> hết hạn
      }),
      makeItem({
        id: "DC-DD000002",
        khoa: "doi-ca-kq:DD000002:NV000002",
        nhom: "thong-tin",
        mocThoiGian: "2095-05-08T14:00:00", // đúng tròn 7 ngày -> còn hạn
      }),
      makeItem({
        id: "BS-YC000001",
        khoa: "bo-sung-kq:YC000001:2095-05-06",
        nhom: "thong-tin",
        mocThoiGian: "2095-05-06T09:00:00", // > 7 ngày -> hết hạn
      }),
      makeItem({
        id: "YC-YC000002",
        khoa: "bo-sung:YC000002:2095-01-01",
        nhom: "can-hanh-dong",
        mocThoiGian: "2095-01-01T08:00:00", // cần hành động > 4 tháng vẫn giữ nguyên
      }),
      makeItem({
        id: "QCC-NV000001-LL000001",
        khoa: "quen-cc:NV000001:LL000001:Quên check-in:2095-01-02",
        nhom: "can-hanh-dong",
        mocThoiGian: "2095-01-02T08:00:00", // quên chấm công cũ vẫn giữ nguyên
      }),
      makeItem({
        id: "BL-KL209504",
        khoa: "luong:KL209504:Đã chốt",
        nhom: "bang-luong",
        mocThoiGian: "2095-04-01T00:00:00", // kỳ lương mới nhất > 7 ngày vẫn giữ nguyên
      }),
    ];

    const keptIds = filterAndCapNotifications(items, [], now).map((e) => e.item.id);
    expect(keptIds).not.toContain("DC-DD000001");
    expect(keptIds).not.toContain("BS-YC000001");
    expect(keptIds).toContain("DC-DD000002");
    expect(keptIds).toContain("YC-YC000002");
    expect(keptIds).toContain("QCC-NV000001-LL000001");
    expect(keptIds).toContain("BL-KL209504");
  });

  it("120 thông tin + 5 cần hành động -> tổng <= 50, giữ đủ 5 cần hành động, cắt thông tin cũ đã đọc trước chưa đọc", () => {
    const now = new Date(2095, 4, 15, 14, 0, 0);
    const items: ThongBaoCoKhoa[] = [];
    const readKeys: string[] = [];

    for (let i = 1; i <= 5; i += 1) {
      items.push(
        makeItem({
          id: `YC-YC90000${i}`,
          khoa: `bo-sung:YC90000${i}:2095-05-14`,
          nhom: "can-hanh-dong",
          mocThoiGian: `2095-05-10T08:0${i}:00`,
        })
      );
    }

    // 120 thông báo thông tin trong 7 ngày: 1..60 đã đọc, 61..120 chưa đọc (mới hơn ở số lớn)
    for (let i = 1; i <= 120; i += 1) {
      const day = 10 + Math.floor((i - 1) / 24);
      const hour = String((i - 1) % 24).padStart(2, "0");
      const key = `doi-ca-kq:DD90${String(i).padStart(4, "0")}:NV000002`;
      items.push(
        makeItem({
          id: `DC-DD90${String(i).padStart(4, "0")}`,
          khoa: key,
          nhom: "thong-tin",
          mocThoiGian: `2095-05-${String(day).padStart(2, "0")}T${hour}:00:00`,
        })
      );
      if (i <= 60) {
        readKeys.push(key);
      }
    }

    const result = filterAndCapNotifications(items, readKeys, now);
    expect(result).toHaveLength(THONG_BAO_TOI_DA_TRONG_DANH_SACH);

    const resultIds = result.map((e) => e.item.id);
    for (let i = 1; i <= 5; i += 1) {
      expect(resultIds).toContain(`YC-YC90000${i}`);
    }

    // Vì có 60 thông tin chưa đọc > 45 chỗ còn lại: toàn bộ 60 đã đọc bị cắt, chỉ còn 45 chưa đọc mới nhất (76..120)
    expect(result.every((e) => !e.isRead)).toBe(true);
    expect(resultIds).not.toContain("DC-DD900075");
    expect(resultIds).toContain("DC-DD900076");
    expect(resultIds).toContain("DC-DD900120");

    // Khi chỉ có 10 thông tin chưa đọc (1..10, cũ) và 110 đã đọc (11..120, mới hơn):
    // Ưu tiên cắt ĐÃ ĐỌC cũ nhất trước, GIỮ LẠI toàn bộ 10 CHƯA ĐỌC cũ + 35 ĐÃ ĐỌC mới nhất (86..120)
    const readNewerKeys: string[] = [];
    for (let i = 11; i <= 120; i += 1) {
      readNewerKeys.push(`doi-ca-kq:DD90${String(i).padStart(4, "0")}:NV000002`);
    }
    const mixedResult = filterAndCapNotifications(items, readNewerKeys, now);
    expect(mixedResult).toHaveLength(50);
    const mixedIds = mixedResult.map((e) => e.item.id);
    // 5 cần hành động + 10 thông tin chưa đọc = 15 mục chưa đọc nằm TRÊN
    const unreadMixed = mixedResult.filter((e) => !e.isRead);
    const readMixed = mixedResult.filter((e) => e.isRead);
    expect(unreadMixed).toHaveLength(15);
    expect(readMixed).toHaveLength(35);
    for (let i = 1; i <= 10; i += 1) {
      expect(mixedIds).toContain(`DC-DD90${String(i).padStart(4, "0")}`);
    }
    expect(mixedIds).not.toContain("DC-DD900085");
    expect(mixedIds).toContain("DC-DD900086");
    expect(mixedIds).toContain("DC-DD900120");
    // Nhóm chưa đọc đứng trước nhóm đã đọc
    expect(mixedResult.slice(0, 15).every((e) => !e.isRead)).toBe(true);
    expect(mixedResult.slice(15).every((e) => e.isRead)).toBe(true);

    // Dọn khóa đã đọc tương ứng với những thông báo bị cắt
    const pruned = pruneReadNotificationKeys(
      readNewerKeys,
      mixedResult.map((e) => e.item)
    );
    expect(pruned).toHaveLength(35);
    expect(pruned).not.toContain("doi-ca-kq:DD900011:NV000002");
  });

  it("120 cần hành động chưa đọc -> KHÔNG bị cắt bớt, số đếm = 120 và chuông hiện '99+'", () => {
    const now = new Date(2095, 4, 15, 14, 0, 0);
    const actionItems: ThongBaoCoKhoa[] = [];
    for (let i = 1; i <= 120; i += 1) {
      actionItems.push(
        makeItem({
          id: `QCC-NV000001-LL90${String(i).padStart(4, "0")}`,
          khoa: `quen-cc:NV000001:LL90${String(i).padStart(4, "0")}:Quên check-in:2095-05-14`,
          nhom: "can-hanh-dong",
          mocThoiGian: "2095-05-14T08:00:00",
        })
      );
    }

    const res = filterAndCapNotifications(actionItems, [], now);
    expect(res).toHaveLength(120);
    const unread = countUnreadNotifications(
      res.map((e) => e.item),
      []
    );
    expect(unread).toBe(120);
    expect(formatNotificationBellCount(unread)).toBe("99+");
  });

  it("lưu trạng thái đã hiện hộp thoại/banner theo tài khoản an toàn khi lỗi storage và tự dọn <= 500 khóa", () => {
    const storage = createMemoryStorage();
    expect(getThongBaoDaHienStorageKey("nv000002")).toBe(
      `${THONG_BAO_DA_HIEN_STORAGE_PREFIX}NV000002`
    );

    let keys = markNotificationKeyAsShown([], "popup:thay-ca:TC000001");
    keys = markNotificationKeyAsShown(keys, "banner:thay-ca-cb:TC000009:sat-gio");
    expect(writeShownNotificationKeys("NV000002", keys, storage)).toBe(true);
    expect(readShownNotificationKeys("NV000002", storage)).toEqual([
      "popup:thay-ca:TC000001",
      "banner:thay-ca-cb:TC000009:sat-gio",
    ]);
    // Tài khoản khác độc lập
    expect(readShownNotificationKeys("NV000003", storage)).toEqual([]);

    // Dọn khóa đã hết hiệu lực
    const pruned = pruneShownNotificationKeys(
      keys,
      new Set(["banner:thay-ca-cb:TC000009:sat-gio"])
    );
    expect(pruned).toEqual(["banner:thay-ca-cb:TC000009:sat-gio"]);

    // Cap 500 khóa
    const many = Array.from({ length: 550 }, (_, idx) => `popup:thay-ca:TC${idx}`);
    writeShownNotificationKeys("NV000002", many, storage);
    expect(readShownNotificationKeys("NV000002", storage)).toHaveLength(
      MAX_SHOWN_NOTIFICATION_KEYS
    );

    // JSON hỏng / storage bị chặn
    const broken = createMemoryStorage();
    broken.setItem(`${THONG_BAO_DA_HIEN_STORAGE_PREFIX}NV000002`, "{bad-json");
    expect(readShownNotificationKeys("NV000002", broken)).toEqual([]);
    const throwingStorage: StorageLike = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    };
    expect(readShownNotificationKeys("NV000002", throwingStorage)).toEqual([]);
    expect(
      writeShownNotificationKeys("NV000002", ["k"], throwingStorage)
    ).toBe(false);
  });

  it("CSDL thật: từ chối thay ca KHÔNG làm đổi khóa người gửi; chấp nhận gộp thành 1 dòng; đơn xử lý > 7 ngày bị loại bỏ", async () => {
    const baseNowUtc = new Date("2095-06-15T06:00:00Z"); // 13:00 VN ngày 2095-06-15
    vi.useFakeTimers();
    vi.setSystemTime(baseNowUtc);

    const nvSender = "NV950001";
    const nvDecliner = "NV950002";
    const nvAccepter = "NV950003";
    const testCa = "CA950001";
    const llToday = "LL950001";
    const llRecent = "LL950002";
    const llExpired = "LL950003";
    const lr1 = "LR950001";
    const lr2 = "LR950002";
    const ddRecent = "DD950001";
    const ddOld = "DD950002";
    const ycRecent = "YC950001";
    const ycOld = "YC950002";

    async function cleanup95() {
      await prisma.chamCong.deleteMany({
        where: { Malich: { in: [llToday, llRecent, llExpired] } },
      });
      await prisma.donXinDoiCa.deleteMany({
        where: {
          OR: [
            { Malich: { in: [llToday, llRecent, llExpired] } },
            { Madon: { in: [ddRecent, ddOld] } },
          ],
        },
      });
      await prisma.yeuCauBoSungCC.deleteMany({
        where: {
          OR: [
            { Malich: { in: [llToday, llRecent, llExpired] } },
            { Mayeucau: { in: [ycRecent, ycOld] } },
          ],
        },
      });
      await prisma.nhanVien_LichLam.deleteMany({
        where: { Malich: { in: [llToday, llRecent, llExpired] } },
      });
      await prisma.lichLam.deleteMany({
        where: { Malich: { in: [llToday, llRecent, llExpired] } },
      });
      await prisma.lichRanh.deleteMany({ where: { Malichranh: { in: [lr1, lr2] } } });
      await prisma.caLam.deleteMany({ where: { Maca: testCa } });
      await prisma.nhanVien.deleteMany({
        where: { Manv: { in: [nvSender, nvDecliner, nvAccepter] } },
      });
    }

    try {
      await cleanup95();
      await prisma.nhanVien.createMany({
        data: [
          {
            Manv: nvSender,
            Tendangnhap: nvSender,
            Matkhau: "hash",
            Hoten: "NV Gửi 95",
            Sdt: "0950000001",
            Diachi: "HN",
            Vitrilamviec: "Pha chế",
            Hinhthuclam: "Full-time",
            Ngayvaolam: new Date("2095-01-01T00:00:00Z"),
            Kinhnghiem: "Chưa có",
            Trangthai: "Chính thức",
            Mucluongtheogio: 20000,
          },
          {
            Manv: nvDecliner,
            Tendangnhap: nvDecliner,
            Matkhau: "hash",
            Hoten: "NV Từ chối 95",
            Sdt: "0950000002",
            Diachi: "HN",
            Vitrilamviec: "Pha chế",
            Hinhthuclam: "Part-time",
            Ngayvaolam: new Date("2095-01-01T00:00:00Z"),
            Kinhnghiem: "Chưa có",
            Trangthai: "Chính thức",
            Mucluongtheogio: 20000,
          },
          {
            Manv: nvAccepter,
            Tendangnhap: nvAccepter,
            Matkhau: "hash",
            Hoten: "NV Nhận 95",
            Sdt: "0950000003",
            Diachi: "HN",
            Vitrilamviec: "Pha chế",
            Hinhthuclam: "Part-time",
            Ngayvaolam: new Date("2095-01-01T00:00:00Z"),
            Kinhnghiem: "Chưa có",
            Trangthai: "Chính thức",
            Mucluongtheogio: 20000,
          },
        ],
      });
      await prisma.caLam.create({
        data: {
          Maca: testCa,
          Loaica: "Thử nghiệm 95",
          Giobatdau: new Date("1970-01-01T17:00:00.000Z"),
          Gioketthuc: new Date("1970-01-01T22:00:00.000Z"),
          Sonvquydinh: 1,
        },
      });
      await prisma.lichLam.createMany({
        data: [
          { Malich: llToday, Ngaylam: new Date("2095-06-15T00:00:00Z"), Maca: testCa },
          { Malich: llRecent, Ngaylam: new Date("2095-06-12T00:00:00Z"), Maca: testCa },
          { Malich: llExpired, Ngaylam: new Date("2095-06-05T00:00:00Z"), Maca: testCa },
        ],
      });
      await prisma.nhanVien_LichLam.createMany({
        data: [
          { Manv: nvSender, Malich: llToday },
          { Manv: nvSender, Malich: llRecent },
          { Manv: nvSender, Malich: llExpired },
        ],
      });
      await prisma.lichRanh.createMany({
        data: [
          {
            Malichranh: lr1,
            Manv: nvDecliner,
            Ngayranh: new Date("2095-06-15T00:00:00Z"),
            Caranh: testCa,
          },
          {
            Malichranh: lr2,
            Manv: nvAccepter,
            Ngayranh: new Date("2095-06-15T00:00:00Z"),
            Caranh: testCa,
          },
        ],
      });
      // Thêm 2 cặp kết quả xử lý: 1 trong hạn 3 ngày (2095-06-12), 1 quá hạn 10 ngày (2095-06-05)
      await prisma.donXinDoiCa.createMany({
        data: [
          {
            Madon: ddRecent,
            Trangthaixuly: "Đã xử lý",
            Manv: nvSender,
            Malich: llRecent,
            Manvnhanthay: nvAccepter,
          },
          {
            Madon: ddOld,
            Trangthaixuly: "Đã xử lý",
            Manv: nvSender,
            Malich: llExpired,
            Manvnhanthay: nvAccepter,
          },
        ],
      });
      await prisma.yeuCauBoSungCC.createMany({
        data: [
          {
            Mayeucau: ycRecent,
            Giovaobosung: new Date("1970-01-01T17:00:00.000Z"),
            Giorabosung: new Date("1970-01-01T22:00:00.000Z"),
            Lydo: "Trong 7 ngày",
            Trangthai: "Đã xử lý",
            Manv: nvSender,
            Malich: llRecent,
          },
          {
            Mayeucau: ycOld,
            Giovaobosung: new Date("1970-01-01T17:00:00.000Z"),
            Giorabosung: new Date("1970-01-01T22:00:00.000Z"),
            Lydo: "Quá 7 ngày",
            Trangthai: "Đã xử lý",
            Manv: nvSender,
            Malich: llExpired,
          },
        ],
      });

      // Tạo yêu cầu thay ca gấp
      const created = await taoYeuCauThayCa(nvSender, {
        malich: llToday,
        lyDo: "Kiểm thử khóa ổn định",
      });
      const tcId = created.yeuCau.id;

      const senderUser = {
        userId: nvSender,
        username: nvSender,
        role: "NhanVien" as const,
        name: "NV Gửi 95",
      };

      const tbBeforeDecline = await getThongBaoTheoPhien(senderUser);
      const tcYcBefore = tbBeforeDecline.items.find((i) => i.id === `TC-YC-${tcId}`);
      expect(tcYcBefore).toBeDefined();

      // Kiểm tra hết hạn 7 ngày trên CSDL thật: bản ghi <= 3 ngày có mặt, > 7 ngày bị loại
      const idsBefore = tbBeforeDecline.items.map((i) => i.id);
      expect(idsBefore).toContain(`DC-${ddRecent}`);
      expect(idsBefore).toContain(`BS-${ycRecent}`);
      expect(idsBefore).not.toContain(`DC-${ddOld}`);
      expect(idsBefore).not.toContain(`BS-${ycOld}`);

      // nvDecliner từ chối -> khóa TC-YC-${tcId} của người gửi TUYỆT ĐỐI không đổi
      await tuChoiThayCa(tcId, nvDecliner);
      const tbAfterDecline = await getThongBaoTheoPhien(senderUser);
      const tcYcAfter = tbAfterDecline.items.find((i) => i.id === `TC-YC-${tcId}`);
      expect(tcYcAfter).toBeDefined();
      expect(tcYcAfter?.khoa).toBe(tcYcBefore?.khoa);

      // nvAccepter chấp nhận -> chỉ còn 1 dòng TC-DN-${tcId}, không cộng dồn TC-YC-${tcId}
      await chapNhanThayCa(tcId, nvAccepter);
      const tbAfterAccept = await getThongBaoTheoPhien(senderUser);
      const tcRelated = tbAfterAccept.items.filter((i) => i.id.includes(tcId));
      expect(tcRelated).toHaveLength(1);
      expect(tcRelated[0].id).toBe(`TC-DN-${tcId}`);
      expect(tcRelated[0].khoa).not.toBe(tcYcBefore?.khoa);
    } finally {
      await cleanup95();
    }
  });
});
