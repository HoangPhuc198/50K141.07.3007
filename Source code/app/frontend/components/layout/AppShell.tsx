"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ToastProvider } from "../ui/Toast";
import { PopupModal } from "../ui/ConfirmDialog";
import {
  ThayCaInvitationCard,
  type ThayCaInviteStatus,
} from "../thay-ca/ThayCaInvitationCard";
import { chuQuanMenu, nhanVienMenu, type MenuGroup } from "@frontend/config/menu";
import { mapHeaderUser, computeAvatarInitials } from "@frontend/mappers/tong-quan";
import {
  areStringListsEqual,
  filterAndCapNotifications,
  formatNotificationBellCount,
  getThongBaoDaDocStorageKey,
  getThongBaoDaHienStorageKey,
  markNotificationKeyAsRead,
  markNotificationKeyAsShown,
  parseReadKeysJson,
  pruneReadNotificationKeys,
  pruneShownNotificationKeys,
  readReadNotificationKeys,
  readShownNotificationKeys,
  resolveNotificationKey,
  writeReadNotificationKeys,
  writeShownNotificationKeys,
  type LoaiNhomThongBao,
} from "@frontend/lib/thong-bao-da-doc";
import { nowVN } from "@backend/lib/time";
import type { ThayCaPublicItem } from "@backend/services/thay-ca";

export interface UserInfo {
  userId: string;
  username: string;
  role: "ChuQuan" | "NhanVien";
  name: string;
  position?: string;
}

export interface HeaderThongBaoItem {
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

const ICONS: Record<string, React.ReactNode> = {
  main: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  nv: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  lich: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  chamcong: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  luong: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  calam: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  chamcong_nv: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  luong_nv: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
};

const AppShellMountedContext = React.createContext<boolean>(false);

export interface AppShellUserContextValue {
  userId: string;
  notifications: HeaderThongBaoItem[];
  hasLoadedNotifications: boolean;
  isNotificationsReady: boolean;
  readNotificationKeys: string[];
  shownNotificationKeys: string[];
  dismissShownNotificationKey: (key: string) => void;
  markNotificationAsRead: (tb: HeaderThongBaoItem) => void;
  activateNotification: (
    tb: HeaderThongBaoItem,
    options?: { closePopover?: boolean }
  ) => void;
}

const AppShellUserContext = React.createContext<AppShellUserContextValue>({
  userId: "",
  notifications: [],
  hasLoadedNotifications: false,
  isNotificationsReady: true,
  readNotificationKeys: [],
  shownNotificationKeys: [],
  dismissShownNotificationKey: () => {},
  markNotificationAsRead: () => {},
  activateNotification: () => {},
});

export function useAppShellUser(): AppShellUserContextValue {
  return React.useContext(AppShellUserContext);
}

const POPUP_SHOWN_KEY_PREFIX = "popup:thay-ca:";
let pendingManualOpenInviteId: string | null = null;

function buildInvitePopupShownKey(inviteId: string): string {
  const clean = typeof inviteId === "string" ? inviteId.trim() : "";
  return clean ? `${POPUP_SHOWN_KEY_PREFIX}${clean}` : "";
}

type WindowWithTabAuth = Window & {
  __thanhhaFetchPatched?: boolean;
  __thanhhaActiveToken?: string;
};

function ensureTabTokenFetchPatched(): void {
  if (typeof window === "undefined") return;
  const win = window as WindowWithTabAuth;
  if (win.__thanhhaFetchPatched) return;
  win.__thanhhaFetchPatched = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const urlStr =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url;

      const isSameOriginApi =
        urlStr.startsWith("/api/") ||
        (urlStr.startsWith(window.location.origin + "/api/"));

      const isAuthMutation =
        urlStr.includes("/api/auth/login") || urlStr.includes("/api/auth/logout");

      if (isSameOriginApi && !isAuthMutation) {
        const path = window.location.pathname || "";
        const roleKey = path.startsWith("/nhan-vien")
          ? "thanhha_login_token_NhanVien"
          : path.startsWith("/chu-quan")
          ? "thanhha_login_token_ChuQuan"
          : "";

        const tabToken =
          (roleKey ? window.sessionStorage.getItem(roleKey) : null) ||
          win.__thanhhaActiveToken ||
          "";

        if (tabToken) {
          const headers = new Headers(
            init?.headers || (input instanceof Request ? input.headers : undefined)
          );
          if (!headers.has("x-tab-token")) {
            headers.set("x-tab-token", tabToken);
          }
          return originalFetch(input, { ...init, headers });
        }
      }
    } catch {
      // ignore header injection errors
    }
    return originalFetch(input, init);
  };
}

export function AppShell({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser?: UserInfo | null;
}) {
  const isNested = React.useContext(AppShellMountedContext);
  if (isNested) {
    return <>{children}</>;
  }
  return (
    <AppShellMountedContext.Provider value={true}>
      <AppShellInner initialUser={initialUser}>{children}</AppShellInner>
    </AppShellMountedContext.Provider>
  );
}

function AppShellInner({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser?: UserInfo | null;
}) {
  ensureTabTokenFetchPatched();
  const pathname = usePathname();
  const router = useRouter();

  const fallbackRole: "ChuQuan" | "NhanVien" = pathname?.startsWith("/nhan-vien")
    ? "NhanVien"
    : "ChuQuan";

  const [user, setUser] = useState<UserInfo | null>(
    initialUser || {
      userId: "",
      username: "",
      role: fallbackRole,
      name: "",
      position: "",
    }
  );

  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [activeNavId, setActiveNavId] = useState<string>("main");
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [notifications, setNotifications] = useState<HeaderThongBaoItem[]>([]);
  const [hasLoadedNotifications, setHasLoadedNotifications] = useState(false);
  const [isNotificationsReady, setIsNotificationsReady] = useState(false);
  const [readNotificationKeys, setReadNotificationKeys] = useState<string[]>([]);
  const [shownNotificationKeys, setShownNotificationKeys] = useState<string[]>([]);

  // UC_2.3: Popup mời thay ca gấp (polling 6 giây, dừng khi tab ẩn)
  const [activeInvite, setActiveInvite] = useState<ThayCaPublicItem | null>(null);
  const [inviteStatus, setInviteStatus] = useState<ThayCaInviteStatus>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const evictedReadKeysRef = useRef<Set<string>>(new Set());
  const notificationContainerRef = useRef<HTMLDivElement>(null);
  const inviteStatusRef = useRef<ThayCaInviteStatus>(null);
  inviteStatusRef.current = inviteStatus;
  const activeInviteRef = useRef<ThayCaPublicItem | null>(null);
  activeInviteRef.current = activeInvite;
  const userIdRef = useRef<string>(user?.userId || "");
  userIdRef.current = user?.userId || "";
  const userRoleRef = useRef<"ChuQuan" | "NhanVien" | undefined>(user?.role);
  userRoleRef.current = user?.role;
  const notificationsRef = useRef<HeaderThongBaoItem[]>(notifications);
  notificationsRef.current = notifications;
  const hasLoadedNotificationsRef = useRef<boolean>(false);
  const readKeysRef = useRef<string[]>(readNotificationKeys);
  readKeysRef.current = readNotificationKeys;
  const shownKeysRef = useRef<string[]>(shownNotificationKeys);
  shownKeysRef.current = shownNotificationKeys;

  const sortedNotifications = useMemo(
    () => filterAndCapNotifications(notifications, readNotificationKeys, nowVN()),
    [notifications, readNotificationKeys]
  );
  const unreadNotificationCount = useMemo(
    () => sortedNotifications.reduce((acc, entry) => acc + (entry.isRead ? 0 : 1), 0),
    [sortedNotifications]
  );
  const bellCountText = useMemo(
    () => formatNotificationBellCount(unreadNotificationCount),
    [unreadNotificationCount]
  );

  const dismissShownNotificationKey = useCallback((keyToMark: string) => {
    const cleanKey = typeof keyToMark === "string" ? keyToMark.trim() : "";
    if (!cleanKey) return;
    const uid = userIdRef.current.trim().toUpperCase();
    const baseKeys = uid
      ? readShownNotificationKeys(uid)
      : shownKeysRef.current;
    const merged = Array.from(new Set([...shownKeysRef.current, ...baseKeys]));
    const nextKeys = markNotificationKeyAsShown(merged, cleanKey);
    if (!areStringListsEqual(shownKeysRef.current, nextKeys)) {
      shownKeysRef.current = nextKeys;
      setShownNotificationKeys(nextKeys);
    }
    if (uid) {
      writeShownNotificationKeys(uid, nextKeys);
    }
  }, []);

  const applyNotificationsUpdate = useCallback(
    (items: HeaderThongBaoItem[], resolvedUserId?: string) => {
      const uid = (resolvedUserId ?? userIdRef.current).trim().toUpperCase();
      hasLoadedNotificationsRef.current = true;
      setHasLoadedNotifications(true);

      if (!uid) {
        const capped = filterAndCapNotifications(items, [], nowVN()).map(
          (entry) => entry.item
        );
        notificationsRef.current = capped;
        setNotifications(capped);
        if (readKeysRef.current.length > 0) {
          readKeysRef.current = [];
          setReadNotificationKeys([]);
        }
        return;
      }

      const storedKeys = readReadNotificationKeys(uid);
      const effectiveReadKeys = Array.from(
        new Set([...storedKeys, ...evictedReadKeysRef.current])
      );
      const filteredEntries = filterAndCapNotifications(
        items,
        effectiveReadKeys,
        nowVN()
      );
      const filteredItems = filteredEntries.map((entry) => entry.item);
      notificationsRef.current = filteredItems;
      setNotifications(filteredItems);

      const keptKeySet = new Set(
        filteredEntries.map((entry) => entry.key).filter(Boolean)
      );
      for (const k of effectiveReadKeys) {
        if (!keptKeySet.has(k) && storedKeys.includes(k)) {
          evictedReadKeysRef.current.add(k);
        }
      }

      const prunedKeys = pruneReadNotificationKeys(storedKeys, filteredItems);
      if (!areStringListsEqual(storedKeys, prunedKeys)) {
        writeReadNotificationKeys(uid, prunedKeys);
      }
      if (!areStringListsEqual(readKeysRef.current, prunedKeys)) {
        readKeysRef.current = prunedKeys;
        setReadNotificationKeys(prunedKeys);
      }
    },
    []
  );

  const markNotificationAsRead = useCallback((tb: HeaderThongBaoItem) => {
    const key = resolveNotificationKey(tb);
    if (!key) return;
    const uid = userIdRef.current.trim().toUpperCase();
    const activeItems = hasLoadedNotificationsRef.current
      ? notificationsRef.current
      : undefined;
    const nextKeys = markNotificationKeyAsRead(readKeysRef.current, key, activeItems);
    if (!areStringListsEqual(readKeysRef.current, nextKeys)) {
      readKeysRef.current = nextKeys;
      setReadNotificationKeys(nextKeys);
    }
    if (uid) {
      writeReadNotificationKeys(uid, nextKeys);
    }
  }, []);

  // Lấy session và thông báo thực tế từ API
  useEffect(() => {
    ensureTabTokenFetchPatched();
    let active = true;
    async function loadHeaderData() {
      try {
        const [meRes, notifRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/thong-bao"),
        ]);

        if (!active) return;

        let resolvedUserId = userIdRef.current.trim().toUpperCase();
        if (meRes.ok) {
          const data = await meRes.json();
          if (data?.data?.token && typeof window !== "undefined") {
            (window as WindowWithTabAuth).__thanhhaActiveToken = data.data.token;
          }
          if (data?.data?.user) {
            const mapped = mapHeaderUser(data.data.user, fallbackRole);
            resolvedUserId = mapped.userId.trim().toUpperCase();
            userIdRef.current = mapped.userId;
            evictedReadKeysRef.current.clear();
            const storedRead = readReadNotificationKeys(mapped.userId);
            if (!areStringListsEqual(readKeysRef.current, storedRead)) {
              readKeysRef.current = storedRead;
              setReadNotificationKeys(storedRead);
            }
            const storedShown = readShownNotificationKeys(mapped.userId);
            shownKeysRef.current = storedShown;
            setShownNotificationKeys(storedShown);
            setUser({
              userId: mapped.userId,
              username: mapped.username,
              role: mapped.role,
              name: mapped.name,
              position: mapped.position,
            });
          }
        }

        if (notifRes.ok) {
          const notifData = await notifRes.json();
          if (notifData?.data) {
            const items: HeaderThongBaoItem[] = Array.isArray(notifData.data.items)
              ? notifData.data.items
              : [];
            applyNotificationsUpdate(items, resolvedUserId);
          }
        }
      } catch {
        // bỏ qua nếu lỗi mạng
      } finally {
        if (active) {
          setIsNotificationsReady(true);
        }
      }
    }
    loadHeaderData();
    return () => {
      active = false;
    };
  }, [applyNotificationsUpdate]);

  // Đồng bộ trạng thái đã đọc & đã hiện popup/banner theo tài khoản và sự kiện storage giữa các tab
  useEffect(() => {
    const uid = user?.userId?.trim().toUpperCase();
    if (!uid) return;

    const storedKeys = readReadNotificationKeys(uid);
    const nextKeys = hasLoadedNotificationsRef.current
      ? pruneReadNotificationKeys(storedKeys, notificationsRef.current)
      : storedKeys;

    if (
      hasLoadedNotificationsRef.current &&
      !areStringListsEqual(storedKeys, nextKeys)
    ) {
      writeReadNotificationKeys(uid, nextKeys);
    }
    if (!areStringListsEqual(readKeysRef.current, nextKeys)) {
      readKeysRef.current = nextKeys;
      setReadNotificationKeys(nextKeys);
    }

    const storedShown = readShownNotificationKeys(uid);
    if (!areStringListsEqual(shownKeysRef.current, storedShown)) {
      shownKeysRef.current = storedShown;
      setShownNotificationKeys(storedShown);
    }

    const readStorageKey = getThongBaoDaDocStorageKey(uid);
    const shownStorageKey = getThongBaoDaHienStorageKey(uid);
    if (typeof window === "undefined") return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea && event.storageArea !== window.localStorage) return;

      if (event.key === null || event.key === readStorageKey) {
        if (event.key === null) {
          evictedReadKeysRef.current.clear();
        }
        const updated =
          event.key === null ? [] : parseReadKeysJson(event.newValue);
        const synced = hasLoadedNotificationsRef.current
          ? pruneReadNotificationKeys(updated, notificationsRef.current)
          : updated;
        if (!areStringListsEqual(readKeysRef.current, synced)) {
          readKeysRef.current = synced;
          setReadNotificationKeys(synced);
        }
      }

      if (event.key === null || event.key === shownStorageKey) {
        const updatedShown =
          event.key === null ? [] : parseReadKeysJson(event.newValue);
        if (!areStringListsEqual(shownKeysRef.current, updatedShown)) {
          shownKeysRef.current = updatedShown;
          setShownNotificationKeys(updatedShown);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [user?.userId]);

  const pollThayCaAndNotifications = useCallback(
    async (role: "ChuQuan" | "NhanVien") => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      try {
        const notifPromise = fetch("/api/thong-bao", { cache: "no-store" });
        const thayCaPromise =
          role === "NhanVien"
            ? fetch("/api/thay-ca/dang-mo", { cache: "no-store" })
            : Promise.resolve(null);

        const [notifRes, thayCaRes] = await Promise.all([
          notifPromise,
          thayCaPromise,
        ]);

        if (notifRes?.ok) {
          const notifData = await notifRes.json().catch(() => null);
          if (notifData?.data) {
            const items: HeaderThongBaoItem[] = Array.isArray(notifData.data.items)
              ? notifData.data.items
              : [];
            applyNotificationsUpdate(items);
          }
        }

        if (role === "NhanVien" && thayCaRes?.ok) {
          const json = await thayCaRes.json().catch(() => null);
          if (typeof window !== "undefined" && json?.data) {
            window.dispatchEvent(
              new CustomEvent("thanhha:thay-ca-poll", { detail: json.data })
            );
          }
          const loiMoi: ThayCaPublicItem[] = Array.isArray(json?.data?.loiMoi)
            ? json.data.loiMoi
            : [];

          // Nếu đang giữ trạng thái xác nhận / đã có người nhận thì không ghi đè popup
          if (activeInviteRef.current && inviteStatusRef.current !== null) {
            return;
          }

          const currentUserId = userIdRef.current.trim().toUpperCase();
          if (!currentUserId) return;

          // Đọc bản mới nhất từ localStorage và dọn khóa popup mời thay ca không còn trong loiMoi
          const storedShown = readShownNotificationKeys(currentUserId);
          const activePopupKeys = new Set(
            loiMoi.map((item) => buildInvitePopupShownKey(item.id)).filter(Boolean)
          );
          const mergedShown = Array.from(
            new Set([...shownKeysRef.current, ...storedShown])
          );
          const nonPopupShown = mergedShown.filter(
            (k) => !k.startsWith(POPUP_SHOWN_KEY_PREFIX)
          );
          const activePopupShown = pruneShownNotificationKeys(
            mergedShown.filter((k) => k.startsWith(POPUP_SHOWN_KEY_PREFIX)),
            activePopupKeys
          );
          const cleanedShown = [...nonPopupShown, ...activePopupShown];

          if (!areStringListsEqual(storedShown, cleanedShown)) {
            writeShownNotificationKeys(currentUserId, cleanedShown);
          }
          if (!areStringListsEqual(shownKeysRef.current, cleanedShown)) {
            shownKeysRef.current = cleanedShown;
            setShownNotificationKeys(cleanedShown);
          }

          const requestedManualId = pendingManualOpenInviteId;
          if (requestedManualId) {
            pendingManualOpenInviteId = null;
            const manualTarget = loiMoi.find((item) => item.id === requestedManualId);
            if (manualTarget) {
              setInviteStatus(null);
              setInviteError(null);
              setActiveInvite(manualTarget);
              return;
            }
          }

          if (activeInviteRef.current && inviteStatusRef.current === null) {
            const stillValid = loiMoi.find(
              (item) => item.id === activeInviteRef.current?.id
            );
            if (!stillValid) {
              setActiveInvite(null);
            }
            return;
          }

          const shownSet = new Set(cleanedShown);
          const nextInvite =
            loiMoi.find((item) => {
              const popupKey = buildInvitePopupShownKey(item.id);
              return (
                (!popupKey || !shownSet.has(popupKey)) &&
                item.manvXinNghi.trim().toUpperCase() !== currentUserId
              );
            }) || null;

          if (nextInvite) {
            const popupKey = buildInvitePopupShownKey(nextInvite.id);
            if (popupKey) {
              dismissShownNotificationKey(popupKey);
            }
            setInviteStatus(null);
            setInviteError(null);
            setActiveInvite(nextInvite);
          }
        }
      } catch {
        // bỏ qua nếu lỗi mạng
      }
    },
    [applyNotificationsUpdate, dismissShownNotificationKey]
  );

  const triggerInviteSideEffect = useCallback(
    (tb: HeaderThongBaoItem) => {
      if (tb.id.startsWith("TC-MO-") && userRoleRef.current === "NhanVien") {
        const tcId = tb.id.slice("TC-MO-".length);
        pendingManualOpenInviteId = tcId;
        pollThayCaAndNotifications("NhanVien");
      }
    },
    [pollThayCaAndNotifications]
  );

  const activateNotification = useCallback(
    (tb: HeaderThongBaoItem, options?: { closePopover?: boolean }) => {
      markNotificationAsRead(tb);
      if (options?.closePopover) {
        setShowNotificationPopup(false);
      }
      triggerInviteSideEffect(tb);
    },
    [markNotificationAsRead, triggerInviteSideEffect]
  );

  const appShellUserContextValue = useMemo<AppShellUserContextValue>(
    () => ({
      userId: user?.userId || "",
      notifications,
      hasLoadedNotifications,
      isNotificationsReady,
      readNotificationKeys,
      shownNotificationKeys,
      dismissShownNotificationKey,
      markNotificationAsRead,
      activateNotification,
    }),
    [
      user?.userId,
      notifications,
      hasLoadedNotifications,
      isNotificationsReady,
      readNotificationKeys,
      shownNotificationKeys,
      dismissShownNotificationKey,
      markNotificationAsRead,
      activateNotification,
    ]
  );

  useEffect(() => {
    const role = user?.role;
    const uid = user?.userId?.trim();
    if (!role || !uid) return;

    const intervalMs = role === "NhanVien" ? 6000 : 8000;
    let timer: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (timer) clearInterval(timer);
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      timer = setInterval(() => {
        pollThayCaAndNotifications(role);
      }, intervalMs);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      } else {
        pollThayCaAndNotifications(role);
        startPolling();
      }
    };

    const handleThayCaUpdated = () => {
      pollThayCaAndNotifications(role);
    };

    pollThayCaAndNotifications(role);
    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("thanhha:thay-ca-updated", handleThayCaUpdated);

    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("thanhha:thay-ca-updated", handleThayCaUpdated);
    };
  }, [user?.role, user?.userId, pollThayCaAndNotifications]);

  // Đóng popup chuông thông báo khi bấm ra ngoài, nhấn Escape hoặc chuyển trang
  useEffect(() => {
    setShowNotificationPopup(false);
  }, [pathname]);

  useEffect(() => {
    if (!showNotificationPopup) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (
        notificationContainerRef.current &&
        !notificationContainerRef.current.contains(e.target as Node)
      ) {
        setShowNotificationPopup(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowNotificationPopup(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showNotificationPopup]);

  const handleAcceptInvite = async () => {
    if (!activeInvite || inviteSubmitting) return;
    const popupKey = buildInvitePopupShownKey(activeInvite.id);
    if (popupKey) {
      dismissShownNotificationKey(popupKey);
    }
    setInviteSubmitting(true);
    setInviteError(null);

    try {
      const res = await fetch(`/api/thay-ca/${activeInvite.id}/chap-nhan`, {
        method: "POST",
      });
      const json = await res.json().catch(() => null);

      if (res.ok && json?.ok) {
        setInviteStatus("accepted");
        window.dispatchEvent(new CustomEvent("thanhha:thay-ca-updated"));
      } else if (res.status === 409) {
        setInviteStatus("taken");
        window.dispatchEvent(new CustomEvent("thanhha:thay-ca-updated"));
      } else {
        const errMsg =
          json?.error?.message ||
          (typeof json?.error === "string" ? json.error : null) ||
          "Không thể chấp nhận yêu cầu thay ca.";
        setInviteError(errMsg);
      }
    } catch {
      setInviteError("Không thể kết nối máy chủ.");
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleDeclineInvite = async () => {
    if (!activeInvite || inviteSubmitting) return;
    const declinedId = activeInvite.id;
    const popupKey = buildInvitePopupShownKey(declinedId);
    if (popupKey) {
      dismissShownNotificationKey(popupKey);
    }
    setInviteSubmitting(true);
    try {
      await fetch(`/api/thay-ca/${declinedId}/tu-choi`, {
        method: "POST",
      });
      setActiveInvite(null);
      setInviteStatus(null);
      setInviteError(null);
      window.dispatchEvent(new CustomEvent("thanhha:thay-ca-updated"));
    } catch {
      setActiveInvite(null);
      setInviteStatus(null);
      setInviteError(null);
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleCloseInvite = () => {
    if (activeInvite) {
      const popupKey = buildInvitePopupShownKey(activeInvite.id);
      if (popupKey) {
        dismissShownNotificationKey(popupKey);
      }
    }
    setActiveInvite(null);
    setInviteStatus(null);
    setInviteError(null);
  };

  // Tự động mở nhóm menu nếu đường dẫn hiện tại khớp với một trong các mục con
  useEffect(() => {
    const matched: Record<string, boolean> = {};
    const navGroups = user?.role === "ChuQuan" ? chuQuanMenu : nhanVienMenu;
    navGroups.forEach((g) => {
      if (g.items?.some((i) => pathname.startsWith(i.href))) {
        matched[g.id] = true;
      }
    });
    setOpenGroups((prev) => ({ ...prev, ...matched }));
  }, [pathname, user?.role]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const handleLogout = async () => {
    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("thanhha_login_token_NhanVien");
        window.sessionStorage.removeItem("thanhha_login_token_ChuQuan");
        (window as WindowWithTabAuth).__thanhhaActiveToken = undefined;
      }
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // bỏ qua lỗi
    } finally {
      router.push("/dang-nhap");
      router.refresh();
    }
  };

  const getInitials = computeAvatarInitials;

  const currentNav = user?.role === "ChuQuan" ? chuQuanMenu : nhanVienMenu;

  // Render danh sách Sidebar với kích thước gốc gọn gàng, màu sắc theo Figma MCP
  const renderNavList = (onItemClick?: () => void) => (
    <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
      {currentNav.map((group) => {
        const isMain = !group.items;
        const isMainActive = isMain && pathname === group.href;
        const hasActiveChild = Boolean(group.items?.some((i) => pathname === i.href));
        const isGroupActive = !isMain && (hasActiveChild || activeNavId === group.id);
        const isOpen = openGroups[group.id];

        if (isMain && group.href) {
          return (
            <Link
              key={group.id}
              href={group.href}
              onClick={() => {
                setActiveNavId("main");
                onItemClick?.();
              }}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                isMainActive
                  ? "bg-[#F7F2EB] text-[#334EAC] shadow-sm font-semibold"
                  : "text-[#FFF9F0] hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className={isMainActive ? "text-[#334EAC]" : "text-[#FFF9F0]/90"}>
                {ICONS[group.id]}
              </span>
              <span>{group.title}</span>
            </Link>
          );
        }

        return (
          <div key={group.id} className="space-y-1">
            {/* Mục cha: Cả cha và mục con active đều sáng nền #F7F2EB theo Figma */}
            <button
              onClick={() => {
                setOpenGroups((prev) => ({
                  ...prev,
                  [group.id]: !prev[group.id],
                }));
                setActiveNavId(group.id);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                isGroupActive
                  ? "bg-[#F7F2EB] text-[#334EAC] shadow-sm font-semibold"
                  : "text-[#FFF9F0] hover:bg-white/10 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={isGroupActive ? "text-[#334EAC]" : "text-[#FFF9F0]/90"}>
                  {ICONS[group.id]}
                </span>
                <span>{group.title}</span>
              </div>
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${
                  isGroupActive ? "text-[#334EAC]" : "text-[#FFF9F0]/80"
                } ${isOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Mục con mở rộng */}
            {isOpen && group.items && (
              <div className="pl-6 pr-1 py-0.5 space-y-1">
                {group.items.map((item) => {
                  const isItemActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => {
                        setActiveNavId(item.href);
                        onItemClick?.();
                      }}
                      className={`w-full text-left block px-3.5 py-2 rounded-lg text-[13.5px] leading-snug transition-all cursor-pointer ${
                        isItemActive
                          ? "bg-[#F7F2EB] text-[#334EAC] shadow-sm font-semibold"
                          : "text-[#FFF9F0]/90 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {item.title}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <ToastProvider>
      <AppShellUserContext.Provider value={appShellUserContextValue}>
        <div className="flex h-[100dvh] w-full bg-[#FFF9F0] overflow-hidden">
        {/* ================= DESKTOP SIDEBAR (≥ 1024px) ================= */}
        <aside className="hidden lg:flex w-[336px] bg-[#334EAC] flex-col flex-shrink-0 z-20 text-white shadow-xl">
          {/* Logo Brand Header – Asset chuẩn từ Figma */}
          <div className="h-[76px] px-6 flex items-center">
            <Image
              src="/assets/sidebar-brand.png"
              alt="Thanh Hà Coffee"
              width={199}
              height={57}
              className="h-[57px] w-auto object-contain"
              priority
            />
          </div>

          {/* Navigation Links */}
          {renderNavList()}
        </aside>

        {/* ================= MOBILE DRAWER (< 1024px) ================= */}
        {isMobileDrawerOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => setIsMobileDrawerOpen(false)}
            />

            {/* Drawer Body */}
            <div className="relative w-72 max-w-[80vw] bg-[#334EAC] text-white flex flex-col h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
              {/* Drawer Header */}
              <div className="h-[76px] px-5 flex items-center justify-between border-b border-white/10">
                <Image
                  src="/assets/sidebar-brand.png"
                  alt="Thanh Hà Coffee"
                  width={160}
                  height={46}
                  className="h-[46px] w-auto object-contain"
                  priority
                />
                <button
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-1 rounded-md text-white/80 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Thông tin user trong Drawer (theo 03-RESPONSIVE.md) */}
              <div className="p-4 bg-white/5 border-b border-white/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 text-white font-bold flex items-center justify-center text-sm">
                  {getInitials(user?.name || "")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{user?.name || "–"}</p>
                  <p className="text-xs text-white/70">{user?.position || ""}</p>
                </div>
              </div>

              {/* Navigation */}
              {renderNavList(() => setIsMobileDrawerOpen(false))}

              {/* Đăng xuất trong drawer */}
              <div className="p-4 border-t border-white/15">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MAIN CONTAINER ================= */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Thanh trên (Header): giữ kích thước h=76px, màu theo Figma MCP (#FFF9F0, border #7096D1) */}
          <header className="h-[76px] bg-[#FFF9F0] border-b border-[#7096D1] px-4 md:px-8 flex items-center justify-between flex-shrink-0 z-10">
            {/* Bên trái: Nút hamburger cho Mobile */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileDrawerOpen(true)}
                className="lg:hidden p-2 rounded-lg text-[#334EAC] hover:bg-[#F7F2EB] focus:outline-none"
                aria-label="Mở menu"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>

            {/* Bên phải: Chuông + Avatar + Tên/Vị trí + Đăng xuất */}
            <div className="flex items-center gap-2 sm:gap-5 min-w-0">
              {/* Chuông thông báo (Figma 13:1210 & 13:1600) */}
              <div className="relative" ref={notificationContainerRef}>
                <button
                  id="topbar-notification-bell"
                  type="button"
                  onClick={() => setShowNotificationPopup((prev) => !prev)}
                  className="relative p-2 text-[#334EAC] hover:bg-[#F7F2EB] rounded-[7.2px] transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                  aria-label="Thông báo"
                  aria-expanded={showNotificationPopup}
                  aria-controls="topbar-notification-popover"
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  <span
                    data-testid="notification-bell-count"
                    className="inline-flex items-center justify-center min-w-[18px] px-1 rounded-[7.2px] bg-[#FFF9F0] text-xs font-semibold text-[#C0392B] leading-tight whitespace-nowrap shrink-0"
                  >
                    {bellCountText}
                  </span>
                </button>

                {/* Popup danh sách thông báo (Figma 13:1600: "Thông báo của bạn") */}
                {showNotificationPopup && (
                  <div
                    id="topbar-notification-popover"
                    role="region"
                    aria-label="Thông báo của bạn"
                    data-testid="notification-popover"
                    className="fixed left-3 right-3 top-[70px] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[340px] max-w-[calc(100vw-24px)] bg-[#FFF9F0] rounded-[14.4px] border-[1.2px] border-[#7096D1] p-3 shadow-[0px_4px_16px_0px_rgba(0,0,0,0.2)] z-50"
                  >
                    <div className="px-1.5 pb-2 font-semibold text-sm text-[#334EAC]">
                      Thông báo của bạn
                    </div>
                    <div className="rounded-[9.6px] border-[1.2px] border-[#7096D1] bg-[#F7F2EB] text-xs text-[#334EAC] max-h-80 overflow-y-auto overflow-x-hidden divide-y divide-[#FFF9F0]">
                      {sortedNotifications.length > 0 ? (
                        sortedNotifications.map(({ item: tb, key, isRead }) => {
                          const content = (
                            <div className="px-3.5 py-2.5 flex items-start gap-2.5">
                              {!isRead && (
                                <span
                                  aria-hidden="true"
                                  data-testid="notification-unread-dot"
                                  className="mt-1.5 h-2 w-2 rounded-full bg-[#334EAC] shrink-0"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p
                                    className={`break-words ${
                                      isRead
                                        ? "font-normal text-[#334EAC]/70"
                                        : "font-bold text-[#334EAC]"
                                    }`}
                                  >
                                    {tb.tieuDe}
                                  </p>
                                  {tb.thoiGian && (
                                    <span className="text-[11px] text-[#334EAC]/70 whitespace-nowrap shrink-0">
                                      {tb.thoiGian}
                                    </span>
                                  )}
                                </div>
                                <p
                                  className={`text-[11px] mt-0.5 leading-relaxed break-words ${
                                    isRead ? "text-[#334EAC]/60" : "text-[#334EAC]/85"
                                  }`}
                                >
                                  {tb.chiTiet}
                                </p>
                              </div>
                            </div>
                          );

                          const baseClassName = `block w-full text-left min-h-[44px] hover:bg-[#EBF0FA] transition-colors focus:outline-none focus:bg-[#EBF0FA] cursor-pointer ${
                            isRead ? "opacity-65" : ""
                          }`;

                          return tb.link ? (
                            <Link
                              key={tb.id}
                              href={tb.link}
                              data-testid={`notification-item-${tb.id}`}
                              data-notification-key={key}
                              data-read={isRead ? "true" : "false"}
                              onClick={() =>
                                activateNotification(tb, { closePopover: true })
                              }
                              onKeyDown={(e) => {
                                if (e.key === " " || e.key === "Spacebar") {
                                  e.preventDefault();
                                  activateNotification(tb, {
                                    closePopover: true,
                                  });
                                  router.push(tb.link!);
                                }
                              }}
                              className={baseClassName}
                            >
                              {content}
                            </Link>
                          ) : (
                            <button
                              key={tb.id}
                              type="button"
                              data-testid={`notification-item-${tb.id}`}
                              data-notification-key={key}
                              data-read={isRead ? "true" : "false"}
                              onClick={() => activateNotification(tb)}
                              className={baseClassName}
                            >
                              {content}
                            </button>
                          );
                        })
                      ) : (
                        <p className="text-center py-4 text-[#7096D1]">–</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Avatar + Tên + Vị trí (theo Figma) */}
              <div className="flex items-center gap-3">
                {/* Avatar tròn */}
                <div className="w-9 h-9 rounded-full bg-[#F7F2EB] text-[#334EAC] font-bold flex items-center justify-center text-xs border border-[#7096D1]/40">
                  {getInitials(user?.name || "")}
                </div>

                {/* Tên + Vị trí (Ẩn trên mobile theo 03-RESPONSIVE.md) */}
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-semibold text-[#334EAC] leading-tight">
                    {user?.name || "–"}
                  </p>
                  <p className="text-xs text-[#334EAC]/80 font-normal">
                    {user?.position || ""}
                  </p>
                </div>
              </div>

              {/* Nút Đăng xuất */}
              <button
                id="header-logout-btn"
                onClick={handleLogout}
                className="p-2 text-[#334EAC] hover:text-red-600 hover:bg-[#F7F2EB] rounded-lg transition-colors ml-1"
                title="Đăng xuất"
                aria-label="Đăng xuất"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </header>

          {/* Vùng nội dung chính (giữ max-w-7xl & padding gốc, nền #FFF9F0 theo Figma) */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#FFF9F0]">
            <div className="max-w-7xl mx-auto min-w-0">{children}</div>
          </main>
        </div>

        {/* Popup lời mời thay ca gấp dùng PopupModal thống nhất (UC_2.3_02 / 03 / 04) */}
        <PopupModal
          open={Boolean(activeInvite && user?.role === "NhanVien")}
          onClose={handleCloseInvite}
          backdrop="dim"
          maxWidthClass="max-w-[560px]"
          paddingClass="p-4 sm:p-6"
          ariaLabelledBy="thay-ca-invite-title"
          id="dialog-thay-ca-loi-moi"
        >
          {activeInvite && (
            <ThayCaInvitationCard
              loiMoi={activeInvite}
              status={inviteStatus}
              errorMessage={inviteError}
              submitting={inviteSubmitting}
              onAccept={handleAcceptInvite}
              onDecline={handleDeclineInvite}
              onBack={handleCloseInvite}
            />
          )}
        </PopupModal>
      </div>
      </AppShellUserContext.Provider>
    </ToastProvider>
  );
}
