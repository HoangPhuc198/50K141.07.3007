import { nowVN } from "@backend/lib/time";

export const THONG_BAO_THONG_TIN_HET_HAN_NGAY = 7;
export const THONG_BAO_TOI_DA_TRONG_DANH_SACH = 50;
export const THONG_BAO_HIEN_THI_TOI_DA = 99;

export const THONG_BAO_DA_DOC_STORAGE_PREFIX = "thanhha:tb-da-doc:";
export const THONG_BAO_DA_HIEN_STORAGE_PREFIX = "thanhha:tb-da-hien:";
export const MAX_READ_NOTIFICATION_KEYS = 500;
export const MAX_SHOWN_NOTIFICATION_KEYS = 500;

export type LoaiNhomThongBao = "can-hanh-dong" | "bang-luong" | "thong-tin";

export interface ThongBaoCoKhoa {
  id: string;
  khoa?: string;
  suKien?: string;
  nhom?: LoaiNhomThongBao;
  mocThoiGian?: string;
  tieuDe: string;
  thoiGian: string;
  chiTiet: string;
  link?: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SortedNotificationEntry<
  T extends Pick<ThongBaoCoKhoa, "id" | "khoa" | "mocThoiGian">,
> {
  item: T;
  key: string;
  isRead: boolean;
}

function getDefaultStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function buildAccountStorageKey(prefix: string, userId: string): string {
  const cleanUserId = typeof userId === "string" ? userId.trim().toUpperCase() : "";
  if (!cleanUserId) return "";
  return `${prefix}${cleanUserId}`;
}

export function getThongBaoDaDocStorageKey(userId: string): string {
  return buildAccountStorageKey(THONG_BAO_DA_DOC_STORAGE_PREFIX, userId);
}

export function getThongBaoDaHienStorageKey(userId: string): string {
  return buildAccountStorageKey(THONG_BAO_DA_HIEN_STORAGE_PREFIX, userId);
}

export function resolveNotificationKey(
  item: Pick<ThongBaoCoKhoa, "id" | "khoa">
): string {
  const khoa = typeof item.khoa === "string" ? item.khoa.trim() : "";
  if (khoa) return khoa;
  return typeof item.id === "string" ? item.id.trim() : "";
}

/**
 * Tạo khóa ổn định cho thông báo tổng hợp từ tập mã đối tượng thành phần.
 * Sắp xếp + khử trùng lặp để khóa chỉ thay đổi khi tập mã đổi.
 */
export function buildAggregateNotificationKey(
  prefix: string,
  memberIds: ReadonlyArray<string>,
  extra?: string
): string {
  const cleanPrefix = prefix.trim();
  const normalizedIds = Array.from(
    new Set(
      memberIds
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));

  const base = `${cleanPrefix}:${normalizedIds.join(",")}`;
  const cleanExtra = typeof extra === "string" ? extra.trim() : "";
  return cleanExtra ? `${base}:${cleanExtra}` : base;
}

/**
 * Chuẩn hóa danh sách khóa đã đọc: khử trùng lặp (giữ bản mới nhất ở cuối) và giới hạn tối đa.
 */
export function normalizeReadKeysList(
  raw: unknown,
  maxKeys: number = MAX_READ_NOTIFICATION_KEYS
): string[] {
  if (!Array.isArray(raw)) return [];
  const cap = Number.isFinite(maxKeys) && maxKeys > 0 ? Math.floor(maxKeys) : MAX_READ_NOTIFICATION_KEYS;
  const dedupedReversed: string[] = [];
  const seen = new Set<string>();

  for (let i = raw.length - 1; i >= 0; i -= 1) {
    const val = raw[i];
    if (typeof val !== "string") continue;
    const trimmed = val.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    dedupedReversed.push(trimmed);
    if (dedupedReversed.length >= cap) break;
  }

  return dedupedReversed.reverse();
}

export function parseReadKeysJson(
  rawJson: string | null | undefined,
  maxKeys: number = MAX_READ_NOTIFICATION_KEYS
): string[] {
  if (typeof rawJson !== "string" || !rawJson.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(rawJson);
    return normalizeReadKeysList(parsed, maxKeys);
  } catch {
    return [];
  }
}

function readKeysFromAccountStorage(
  storageKey: string,
  storage?: StorageLike | null,
  maxKeys: number = MAX_READ_NOTIFICATION_KEYS
): string[] {
  if (!storageKey) return [];
  const targetStorage = storage === undefined ? getDefaultStorage() : storage;
  if (!targetStorage) return [];

  try {
    const raw = targetStorage.getItem(storageKey);
    return parseReadKeysJson(raw, maxKeys);
  } catch {
    return [];
  }
}

function writeKeysToAccountStorage(
  storageKey: string,
  keys: Iterable<string>,
  storage?: StorageLike | null,
  maxKeys: number = MAX_READ_NOTIFICATION_KEYS
): boolean {
  if (!storageKey) return false;
  const targetStorage = storage === undefined ? getDefaultStorage() : storage;
  if (!targetStorage) return false;

  try {
    const normalized = normalizeReadKeysList(Array.from(keys), maxKeys);
    targetStorage.setItem(storageKey, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function readReadNotificationKeys(
  userId: string,
  storage?: StorageLike | null,
  maxKeys: number = MAX_READ_NOTIFICATION_KEYS
): string[] {
  return readKeysFromAccountStorage(
    getThongBaoDaDocStorageKey(userId),
    storage,
    maxKeys
  );
}

export function writeReadNotificationKeys(
  userId: string,
  keys: Iterable<string>,
  storage?: StorageLike | null,
  maxKeys: number = MAX_READ_NOTIFICATION_KEYS
): boolean {
  return writeKeysToAccountStorage(
    getThongBaoDaDocStorageKey(userId),
    keys,
    storage,
    maxKeys
  );
}

export function readShownNotificationKeys(
  userId: string,
  storage?: StorageLike | null,
  maxKeys: number = MAX_SHOWN_NOTIFICATION_KEYS
): string[] {
  return readKeysFromAccountStorage(
    getThongBaoDaHienStorageKey(userId),
    storage,
    maxKeys
  );
}

export function writeShownNotificationKeys(
  userId: string,
  keys: Iterable<string>,
  storage?: StorageLike | null,
  maxKeys: number = MAX_SHOWN_NOTIFICATION_KEYS
): boolean {
  return writeKeysToAccountStorage(
    getThongBaoDaHienStorageKey(userId),
    keys,
    storage,
    maxKeys
  );
}

export function pruneKeysAgainstSet(
  storedKeys: Iterable<string>,
  activeKeySet: ReadonlySet<string>,
  maxKeys: number = MAX_READ_NOTIFICATION_KEYS
): string[] {
  const filtered: string[] = [];
  for (const key of storedKeys) {
    if (typeof key !== "string") continue;
    const trimmed = key.trim();
    if (trimmed && activeKeySet.has(trimmed)) {
      filtered.push(trimmed);
    }
  }
  return normalizeReadKeysList(filtered, maxKeys);
}

export function pruneReadNotificationKeys(
  readKeys: Iterable<string>,
  activeItems: ReadonlyArray<Pick<ThongBaoCoKhoa, "id" | "khoa">>,
  maxKeys: number = MAX_READ_NOTIFICATION_KEYS
): string[] {
  const activeKeySet = new Set(
    activeItems.map((item) => resolveNotificationKey(item)).filter(Boolean)
  );
  return pruneKeysAgainstSet(readKeys, activeKeySet, maxKeys);
}

export function pruneShownNotificationKeys(
  shownKeys: Iterable<string>,
  activeKeySet: ReadonlySet<string>,
  maxKeys: number = MAX_SHOWN_NOTIFICATION_KEYS
): string[] {
  return pruneKeysAgainstSet(shownKeys, activeKeySet, maxKeys);
}

export function areStringListsEqual(
  a: ReadonlyArray<string>,
  b: ReadonlyArray<string>
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function markNotificationKeyAsRead(
  readKeys: Iterable<string>,
  keyToMark: string,
  activeItems?: ReadonlyArray<Pick<ThongBaoCoKhoa, "id" | "khoa">>,
  maxKeys: number = MAX_READ_NOTIFICATION_KEYS
): string[] {
  const cleanKey = typeof keyToMark === "string" ? keyToMark.trim() : "";
  const currentList = normalizeReadKeysList(Array.from(readKeys), maxKeys);
  if (!cleanKey) {
    return activeItems
      ? pruneReadNotificationKeys(currentList, activeItems, maxKeys)
      : currentList;
  }

  const nextList = currentList.filter((k) => k !== cleanKey);
  nextList.push(cleanKey);

  if (activeItems) {
    return pruneReadNotificationKeys(nextList, activeItems, maxKeys);
  }
  return normalizeReadKeysList(nextList, maxKeys);
}

export function markNotificationKeyAsShown(
  shownKeys: Iterable<string>,
  keyToMark: string,
  maxKeys: number = MAX_SHOWN_NOTIFICATION_KEYS
): string[] {
  return markNotificationKeyAsRead(shownKeys, keyToMark, undefined, maxKeys);
}

export function countUnreadNotifications(
  items: ReadonlyArray<Pick<ThongBaoCoKhoa, "id" | "khoa">>,
  readKeys: Iterable<string>
): number {
  const readSet = new Set(readKeys);
  let unread = 0;
  for (const item of items) {
    const key = resolveNotificationKey(item);
    if (!key || !readSet.has(key)) {
      unread += 1;
    }
  }
  return unread;
}

export function formatNotificationBellCount(
  unreadCount: number,
  maxDisplay: number = THONG_BAO_HIEN_THI_TOI_DA
): string {
  if (!Number.isFinite(unreadCount) || unreadCount <= 0) return "0";
  const rounded = Math.floor(unreadCount);
  const ceiling = Number.isFinite(maxDisplay) && maxDisplay > 0 ? Math.floor(maxDisplay) : THONG_BAO_HIEN_THI_TOI_DA;
  return rounded > ceiling ? `${ceiling}+` : String(rounded);
}

/**
 * Sắp xếp thông báo: chưa đọc lên trên, đã đọc xuống dưới;
 * trong mỗi nhóm xếp mới nhất trước dựa trên `mocThoiGian` rồi mã khóa.
 */
export function sortNotificationsByReadAndDate<
  T extends Pick<ThongBaoCoKhoa, "id" | "khoa" | "mocThoiGian">,
>(
  items: ReadonlyArray<T>,
  readKeys: Iterable<string>
): Array<SortedNotificationEntry<T>> {
  const readSet = new Set(readKeys);
  const decorated = items.map((item, index) => {
    const key = resolveNotificationKey(item);
    const isRead = Boolean(key && readSet.has(key));
    return {
      item,
      key,
      isRead,
      mocThoiGian: typeof item.mocThoiGian === "string" ? item.mocThoiGian.trim() : "",
      index,
    };
  });

  decorated.sort((a, b) => {
    if (a.isRead !== b.isRead) {
      return a.isRead ? 1 : -1;
    }
    if (a.mocThoiGian !== b.mocThoiGian) {
      return b.mocThoiGian.localeCompare(a.mocThoiGian);
    }
    const aId = a.item.id?.trim() ?? "";
    const bId = b.item.id?.trim() ?? "";
    if (aId !== bId) {
      return bId.localeCompare(aId);
    }
    if (a.key !== b.key) {
      return b.key.localeCompare(a.key);
    }
    return a.index - b.index;
  });

  return decorated.map(({ item, key, isRead }) => ({ item, key, isRead }));
}

export function inferNotificationGroup(
  item: Pick<ThongBaoCoKhoa, "id" | "nhom">
): LoaiNhomThongBao {
  if (
    item.nhom === "can-hanh-dong" ||
    item.nhom === "bang-luong" ||
    item.nhom === "thong-tin"
  ) {
    return item.nhom;
  }
  const cleanId = typeof item.id === "string" ? item.id.trim().toUpperCase() : "";
  if (
    cleanId.startsWith("YC-") ||
    cleanId.startsWith("QCC-") ||
    cleanId.startsWith("TC-CB-") ||
    cleanId.startsWith("TC-MO-")
  ) {
    return "can-hanh-dong";
  }
  if (cleanId.startsWith("BL-")) {
    return "bang-luong";
  }
  return "thong-tin";
}

export function resolveNotificationEventId(
  item: Pick<ThongBaoCoKhoa, "id" | "khoa" | "suKien">
): string {
  const explicitEvent = typeof item.suKien === "string" ? item.suKien.trim() : "";
  if (explicitEvent) return explicitEvent;

  const cleanId = typeof item.id === "string" ? item.id.trim() : "";
  if (
    cleanId.startsWith("TC-MO-") ||
    cleanId.startsWith("TC-YC-") ||
    cleanId.startsWith("TC-DN-") ||
    cleanId.startsWith("TC-CB-")
  ) {
    return `thay-ca:${cleanId.slice("TC-MO-".length)}`;
  }
  if (cleanId.startsWith("YC-DD") || cleanId.startsWith("DC-")) {
    return `doi-ca:${cleanId.slice(3)}`;
  }
  if (cleanId.startsWith("YC-YC") || cleanId.startsWith("BS-")) {
    return `bo-sung:${cleanId.slice(3)}`;
  }
  if (cleanId.startsWith("YC-PH")) {
    return `phan-hoi:${cleanId.slice(3)}`;
  }
  if (cleanId.startsWith("BL-")) {
    return `luong:${cleanId.slice(3)}`;
  }
  return cleanId || resolveNotificationKey(item);
}

function toVnWallClockMs(date: Date): number {
  return Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  );
}

/**
 * Phân tích `mocThoiGian` thành epoch ms quy đổi trên đồng hồ giờ Việt Nam (GMT+7)
 * để so sánh trực tiếp với `nowVN()` không phụ thuộc múi giờ máy chạy.
 */
export function parseNotificationTimestampWallMs(mocThoiGian?: string): number | null {
  if (typeof mocThoiGian !== "string") return null;
  const trimmed = mocThoiGian.trim();
  if (!trimmed) return null;

  const localMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?$/
  );
  if (localMatch) {
    const year = Number(localMatch[1]);
    const month = Number(localMatch[2]);
    const day = Number(localMatch[3]);
    const hour = Number(localMatch[4] ?? "0");
    const minute = Number(localMatch[5] ?? "0");
    const second = Number(localMatch[6] ?? "0");
    return Date.UTC(year, month - 1, day, hour, minute, second, 0);
  }

  const parsedUtcMs = Date.parse(trimmed);
  if (!Number.isFinite(parsedUtcMs)) return null;
  return parsedUtcMs + 7 * 3600 * 1000;
}

export function isInformationalNotificationExpired(
  item: Pick<ThongBaoCoKhoa, "id" | "nhom" | "mocThoiGian">,
  now: Date = nowVN(),
  expireDays: number = THONG_BAO_THONG_TIN_HET_HAN_NGAY
): boolean {
  if (inferNotificationGroup(item) !== "thong-tin") {
    return false;
  }
  const itemMs = parseNotificationTimestampWallMs(item.mocThoiGian);
  if (itemMs === null) return false;
  const maxAgeMs = expireDays * 86_400_000;
  return toVnWallClockMs(now) - itemMs > maxAgeMs;
}

function pickPreferredDuplicate<T extends Pick<ThongBaoCoKhoa, "id" | "nhom" | "mocThoiGian">>(
  existing: T,
  candidate: T
): T {
  const existingTime = parseNotificationTimestampWallMs(existing.mocThoiGian);
  const candidateTime = parseNotificationTimestampWallMs(candidate.mocThoiGian);
  if (existingTime !== null && candidateTime !== null && existingTime !== candidateTime) {
    return candidateTime > existingTime ? candidate : existing;
  }

  const candidateId = candidate.id?.trim().toUpperCase() ?? "";
  const existingId = existing.id?.trim().toUpperCase() ?? "";
  if (candidateId.startsWith("TC-DN-") && !existingId.startsWith("TC-DN-")) {
    return candidate;
  }
  if (existingId.startsWith("TC-DN-") && !candidateId.startsWith("TC-DN-")) {
    return existing;
  }

  const existingGroup = inferNotificationGroup(existing);
  const candidateGroup = inferNotificationGroup(candidate);
  if (candidateGroup === "can-hanh-dong" && existingGroup !== "can-hanh-dong") {
    return candidate;
  }
  if (existingGroup === "can-hanh-dong" && candidateGroup !== "can-hanh-dong") {
    return existing;
  }

  return candidate;
}

export function deduplicateNotificationsByEvent<
  T extends Pick<ThongBaoCoKhoa, "id" | "khoa" | "suKien" | "nhom" | "mocThoiGian">,
>(items: ReadonlyArray<T>): T[] {
  const byEvent = new Map<string, T>();
  for (const item of items) {
    const eventId = resolveNotificationEventId(item);
    const prev = byEvent.get(eventId);
    if (!prev) {
      byEvent.set(eventId, item);
    } else {
      byEvent.set(eventId, pickPreferredDuplicate(prev, item));
    }
  }
  return Array.from(byEvent.values());
}

/**
 * Chuẩn hóa danh sách thông báo theo quy tắc chống lặp & giới hạn:
 * 1) Gộp trùng theo sự kiện (tối đa 1 dòng/sự kiện).
 * 2) Hết hạn thông báo THÔNG TIN sau `THONG_BAO_THONG_TIN_HET_HAN_NGAY` (7 ngày) tính bằng `nowVN()`.
 * 3) Khi tổng vượt `THONG_BAO_TOI_DA_TRONG_DANH_SACH` (50), chỉ cắt nhóm THÔNG TIN
 *    (ưu tiên cắt ĐÃ ĐỌC cũ nhất trước, rồi CHƯA ĐỌC cũ nhất), KHÔNG cắt CẦN HÀNH ĐỘNG & bảng lương mới nhất.
 * 4) Giữ thứ tự hiển thị: chưa đọc lên trên, đã đọc xuống dưới; mới nhất trước trong mỗi nhóm.
 */
export function filterAndCapNotifications<
  T extends Pick<ThongBaoCoKhoa, "id" | "khoa" | "suKien" | "nhom" | "mocThoiGian">,
>(
  items: ReadonlyArray<T>,
  readKeys: Iterable<string> = [],
  now: Date = nowVN(),
  options?: {
    expireDays?: number;
    maxItems?: number;
    applyCap?: boolean;
  }
): Array<SortedNotificationEntry<T>> {
  const expireDays = options?.expireDays ?? THONG_BAO_THONG_TIN_HET_HAN_NGAY;
  const maxItems = options?.maxItems ?? THONG_BAO_TOI_DA_TRONG_DANH_SACH;
  const applyCap = options?.applyCap ?? true;

  const deduped = deduplicateNotificationsByEvent(items);
  const nonExpired = deduped.filter(
    (item) => !isInformationalNotificationExpired(item, now, expireDays)
  );

  if (!applyCap || nonExpired.length <= maxItems) {
    return sortNotificationsByReadAndDate(nonExpired, readKeys);
  }

  const protectedItems: T[] = [];
  const infoItems: T[] = [];
  for (const item of nonExpired) {
    const group = inferNotificationGroup(item);
    if (group === "can-hanh-dong" || group === "bang-luong") {
      protectedItems.push(item);
    } else {
      infoItems.push(item);
    }
  }

  const allowedInfoCount = Math.max(0, maxItems - protectedItems.length);
  let keptInfoItems = infoItems;
  if (infoItems.length > allowedInfoCount) {
    keptInfoItems = sortNotificationsByReadAndDate(infoItems, readKeys)
      .slice(0, allowedInfoCount)
      .map((entry) => entry.item);
  }

  return sortNotificationsByReadAndDate(
    [...protectedItems, ...keptInfoItems],
    readKeys
  );
}

/**
 * Lọc danh sách thông báo chỉ giữ lại các mục chưa đọc (trừ các mục đã xem),
 * đồng bộ theo cùng quy tắc hết hạn 7 ngày và giới hạn tối đa 50 mục của hệ thống thông báo.
 */
export function filterUnreadNotifications<
  T extends Pick<ThongBaoCoKhoa, "id" | "khoa" | "suKien" | "nhom" | "mocThoiGian">,
>(
  items: ReadonlyArray<T>,
  readKeys: Iterable<string> = [],
  now: Date = nowVN(),
  options?: {
    expireDays?: number;
    maxItems?: number;
    applyCap?: boolean;
  }
): Array<SortedNotificationEntry<T>> {
  return filterAndCapNotifications(items, readKeys, now, options).filter(
    (entry) => !entry.isRead
  );
}
