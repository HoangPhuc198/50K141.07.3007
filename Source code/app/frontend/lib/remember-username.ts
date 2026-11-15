/**
 * Lưu và đọc lịch sử tên đăng nhập trong localStorage (UC_1).
 * TUYỆT ĐỐI chỉ lưu tên đăng nhập, không bao giờ lưu mật khẩu hay token.
 */

export const REMEMBERED_USERNAMES_KEY = "thanhha_remembered_usernames";
export const MAX_REMEMBERED_USERNAMES = 10;

function normalizeList(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(trimmed);
    if (out.length >= MAX_REMEMBERED_USERNAMES) break;
  }
  return out;
}

export function readRememberedUsernames(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REMEMBERED_USERNAMES_KEY);
    if (!raw) return [];
    return normalizeList(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveRememberedUsername(username: string): string[] {
  const trimmed = username.trim();
  const current = readRememberedUsernames();
  if (!trimmed) return current;

  const lower = trimmed.toLowerCase();
  const next = [
    trimmed,
    ...current.filter((item) => item.toLowerCase() !== lower),
  ].slice(0, MAX_REMEMBERED_USERNAMES);

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(REMEMBERED_USERNAMES_KEY, JSON.stringify(next));
    } catch {
      // Bỏ qua nếu trình duyệt chặn hoặc đầy storage
    }
  }
  return next;
}

export function removeRememberedUsername(username: string): string[] {
  const lower = username.trim().toLowerCase();
  const current = readRememberedUsernames();
  const next = current.filter((item) => item.toLowerCase() !== lower);

  if (typeof window !== "undefined") {
    try {
      if (next.length === 0) {
        window.localStorage.removeItem(REMEMBERED_USERNAMES_KEY);
      } else {
        window.localStorage.setItem(REMEMBERED_USERNAMES_KEY, JSON.stringify(next));
      }
    } catch {
      // Bỏ qua nếu không truy cập được storage
    }
  }
  return next;
}
