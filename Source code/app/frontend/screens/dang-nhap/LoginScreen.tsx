"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { DANG_NHAP_TRONG, DANG_NHAP_SAI } from "@frontend/config/thong-bao";
import { PLACEHOLDER } from "@frontend/config/placeholder";
import {
  readRememberedUsernames,
  saveRememberedUsername,
  removeRememberedUsername,
} from "@frontend/lib/remember-username";

// ============================================================
// Màn hình Đăng nhập (UC_1) – Thanh Hà Coffee
// - Khóa trong 100dvh, căn giữa ngang & dọc, TUYỆT ĐỐI không sinh thanh cuộn ngoài
// - Nền: docs/figma-assets/bg-dang-nhap.png phủ kín toàn màn hình (cover, căn giữa)
// - Logo: docs/figma-assets/logo-thanhha.png (104x104px)
// - Tên thương hiệu: "THANH HÀ COFFEE" (theo đặc tả SRS dòng 1255)
// ============================================================

function EyeOpen({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function EyeOff({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("from");

  const [isHydrated, setIsHydrated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [savedUsernames, setSavedUsernames] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isFilteringByTyping, setIsFilteringByTyping] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const usernameWrapperRef = React.useRef<HTMLDivElement>(null);
  const listboxRef = React.useRef<HTMLDivElement>(null);
  const passwordInputRef = React.useRef<HTMLInputElement>(null);
  const isSubmittingRef = React.useRef(false);

  React.useEffect(() => {
    setIsHydrated(true);
    document.body.setAttribute("data-app-ready", "true");
    try {
      window.sessionStorage.removeItem("thanhha_login_token_NhanVien");
      window.sessionStorage.removeItem("thanhha_login_token_ChuQuan");
      (window as unknown as { __thanhhaActiveToken?: string }).__thanhhaActiveToken = undefined;
    } catch {
      // ignore storage errors
    }

    const stored = readRememberedUsernames();
    if (stored.length > 0) {
      setSavedUsernames(stored);
      setUsername(stored[0]);
      // Đưa con trỏ xuống ô mật khẩu khi đã tự điền tên đăng nhập gần nhất
      requestAnimationFrame(() => {
        passwordInputRef.current?.focus();
      });
    }

    return () => document.body.removeAttribute("data-app-ready");
  }, []);

  React.useEffect(() => {
    if (!isDropdownOpen) return;
    const handleOutside = (e: PointerEvent | MouseEvent) => {
      if (
        usernameWrapperRef.current &&
        !usernameWrapperRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [isDropdownOpen]);

  const filteredUsernames = React.useMemo(() => {
    if (savedUsernames.length === 0) return [];
    if (!isFilteringByTyping) return savedUsernames;
    const q = username.trim().toLowerCase();
    if (!q) return savedUsernames;
    return savedUsernames.filter((u) => u.toLowerCase().includes(q));
  }, [savedUsernames, isFilteringByTyping, username]);

  const showDropdown = isDropdownOpen && filteredUsernames.length > 0;

  React.useEffect(() => {
    if (!showDropdown || activeIndex < 0 || !listboxRef.current) return;
    const activeEl = listboxRef.current.querySelector(
      `#username-option-${activeIndex}`
    );
    if (activeEl instanceof HTMLElement) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, showDropdown]);

  const selectSuggestion = (picked: string) => {
    setUsername(picked);
    setIsDropdownOpen(false);
    setIsFilteringByTyping(false);
    setActiveIndex(-1);
    if (usernameError) setUsernameError("");
    if (generalError) setGeneralError("");
    passwordInputRef.current?.focus();
  };

  const handleRemoveSuggestion = (target: string) => {
    const next = removeRememberedUsername(target);
    setSavedUsernames(next);
    setActiveIndex(-1);
    if (next.length === 0) {
      setIsDropdownOpen(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoading || isSubmittingRef.current) return;
    setUsernameError(""); setPasswordError(""); setGeneralError("");

    let hasError = false;
    const trimmedUsername = username.trim();
    if (!trimmedUsername) { setUsernameError(DANG_NHAP_TRONG); hasError = true; }
    if (!password)        { setPasswordError(DANG_NHAP_TRONG); hasError = true; }
    if (hasError) return;

    setIsLoading(true);
    isSubmittingRef.current = true;
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmedUsername, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setGeneralError(data?.error?.message ?? DANG_NHAP_SAI);
        return;
      }
      const nextSaved = saveRememberedUsername(trimmedUsername);
      setSavedUsernames(nextSaved);
      setIsDropdownOpen(false);
      try {
        if (typeof window !== "undefined" && data?.data?.token) {
          const role = data?.data?.user?.role;
          if (role) {
            window.sessionStorage.setItem(`thanhha_login_token_${role}`, data.data.token);
          }
          (window as unknown as { __thanhhaActiveToken?: string }).__thanhhaActiveToken =
            data.data.token;
        }
      } catch {
        // ignore storage errors
      }
      if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      if (typeof window !== "undefined") {
        window.scrollTo(0, 0);
      }
      router.push(fromUrl || data.data.redirectUrl);
      router.refresh();
    } catch {
      setGeneralError(DANG_NHAP_SAI);
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    /**
     * Lớp nền: ảnh /assets/bg-dang-nhap.png phủ kín toàn màn hình (cover, căn giữa).
     * h-[100dvh], overflow-hidden, flex items-center justify-center:
     * Đảm bảo giao diện luôn nằm trọn trong khung nhìn, KHÔNG BAO GIỜ sinh thanh cuộn dọc ngoài.
     */
    <div
      className="relative min-h-[100dvh] w-full flex items-center justify-center p-3 sm:p-6 py-6 sm:py-10 overflow-y-auto"
      style={{
        backgroundImage: "url('/assets/bg-dang-nhap.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
      }}
    >
      {/*
       * Thẻ đăng nhập responsive:
       * - Tự co giãn mượt mà khi cửa sổ thu nhỏ ngang/dọc
       * - Không bị tràn màn hình, không bị che khuất nút Đăng nhập
       */}
      <div
        data-hydrated={isHydrated ? "true" : "false"}
        className={[
          "relative z-10 w-full max-w-[560px]",
          "mx-auto flex flex-col items-center",
          "bg-[#FFF9F0] rounded-2xl sm:rounded-3xl shadow-[0px_12px_32px_0px_rgba(71,48,31,0.13)]",
          "border border-[#EFE9E0]",
          "px-4 sm:px-10 md:px-12 py-5 sm:py-8 md:py-9",
          "transition-all duration-200",
        ].join(" ")}
      >
        {/* LOGO co giãn theo kích thước màn hình */}
        <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 relative pointer-events-none">
          <Image
            src="/assets/logo-thanhha.png"
            alt="Logo Thanh Hà Coffee"
            fill
            sizes="(max-width: 640px) 64px, (max-width: 768px) 80px, 96px"
            className="rounded-xl sm:rounded-2xl object-contain pointer-events-none"
            priority
          />
        </div>

        {/* TÊN THƯƠNG HIỆU (SRS d.1255: THANH HÀ COFFEE) */}
        <p
          className="text-[#334EAC] font-semibold text-center uppercase tracking-[0.12em] sm:tracking-[0.15em] mt-2.5 sm:mt-3 text-xs sm:text-sm md:text-base"
        >
          THANH HÀ COFFEE
        </p>

        {/* TIÊU ĐỀ */}
        <h1
          className="text-[#334EAC] font-bold text-center mt-0.5 sm:mt-1 text-xl sm:text-2xl md:text-3xl"
        >
          Đăng nhập
        </h1>

        {/* FORM */}
        <form
          onSubmit={handleSubmit}
          className="w-full mt-4 sm:mt-6 space-y-3 sm:space-y-4"
          noValidate
        >
          {/* Ô 1: Tên đăng nhập */}
          <div ref={usernameWrapperRef} className="relative">
            <label
              htmlFor="username-input"
              className="block text-[#334EAC] font-medium text-xs sm:text-sm mb-1 sm:mb-1.5"
            >
              Tên đăng nhập <span>*</span>
            </label>
            <input
              id="username-input"
              type="text"
              placeholder={PLACEHOLDER.tenDangNhap}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showDropdown}
              aria-controls={showDropdown ? "username-history-listbox" : undefined}
              aria-activedescendant={
                showDropdown && activeIndex >= 0 && filteredUsernames[activeIndex]
                  ? `username-option-${activeIndex}`
                  : undefined
              }
              autoComplete="off"
              enterKeyHint="next"
              value={username}
              onFocus={() => {
                if (savedUsernames.length > 0) {
                  setIsFilteringByTyping(false);
                  setIsDropdownOpen(true);
                  setActiveIndex(-1);
                }
              }}
              onClick={() => {
                if (savedUsernames.length > 0) {
                  setIsFilteringByTyping(false);
                  setIsDropdownOpen(true);
                  setActiveIndex(-1);
                }
              }}
              onChange={(e) => {
                setUsername(e.target.value);
                setIsFilteringByTyping(true);
                if (savedUsernames.length > 0) {
                  setIsDropdownOpen(true);
                  setActiveIndex(-1);
                }
                if (usernameError) setUsernameError("");
                if (generalError)  setGeneralError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  if (savedUsernames.length === 0) return;
                  e.preventDefault();
                  if (!isDropdownOpen) {
                    setIsFilteringByTyping(false);
                    setIsDropdownOpen(true);
                    setActiveIndex(0);
                  } else if (filteredUsernames.length > 0) {
                    setActiveIndex((prev) => (prev + 1) % filteredUsernames.length);
                  }
                } else if (e.key === "ArrowUp") {
                  if (!showDropdown || filteredUsernames.length === 0) return;
                  e.preventDefault();
                  setActiveIndex((prev) =>
                    prev <= 0 ? filteredUsernames.length - 1 : prev - 1
                  );
                } else if (e.key === "Escape") {
                  if (isDropdownOpen) {
                    e.preventDefault();
                    setIsDropdownOpen(false);
                    setActiveIndex(-1);
                  }
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (showDropdown && activeIndex >= 0 && filteredUsernames[activeIndex]) {
                    selectSuggestion(filteredUsernames[activeIndex]);
                  } else {
                    setIsDropdownOpen(false);
                    setActiveIndex(-1);
                    passwordInputRef.current?.focus();
                  }
                }
              }}
              className={[
                "w-full h-11 sm:h-12 md:h-[50px] px-3.5 sm:px-4 rounded-lg border outline-none",
                "bg-[#FFF9F0] text-base",
                usernameError
                  ? "transition-none border-[#C0392B] text-[#C0392B] placeholder:text-[#C0392B] ring-1 ring-[#C0392B]/40"
                  : "transition-colors border-[#7096D1] text-[#334EAC] placeholder:text-[#334EAC]/70 focus:border-[#334EAC] focus:ring-1 focus:ring-[#334EAC]/30",
              ].join(" ")}
            />
            {showDropdown && (
              <div
                ref={listboxRef}
                id="username-history-listbox"
                role="listbox"
                aria-label="Tài khoản đã đăng nhập"
                className="absolute left-0 right-0 top-full mt-1 z-30 max-h-[208px] overflow-y-auto overscroll-contain rounded-lg border border-[#7096D1] bg-[#FFF9F0] shadow-[0px_8px_20px_0px_rgba(71,48,31,0.12)]"
              >
                {filteredUsernames.map((item, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <div
                      key={item}
                      className={`flex items-center min-h-[44px] border-b border-[#EFE9E0] last:border-b-0 ${
                        isActive ? "bg-[#F7F2EB]" : "hover:bg-[#F7F2EB]"
                      }`}
                    >
                      <button
                        type="button"
                        id={`username-option-${idx}`}
                        role="option"
                        aria-selected={isActive}
                        tabIndex={-1}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectSuggestion(item)}
                        className={`flex-1 min-w-0 min-h-[44px] px-3.5 text-left text-sm sm:text-base text-[#334EAC] truncate cursor-pointer focus:outline-none ${
                          isActive ? "font-semibold" : "font-normal"
                        }`}
                      >
                        {item}
                      </button>
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-label={`Xóa ${item} khỏi danh sách`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveSuggestion(item);
                        }}
                        className="w-[44px] h-[44px] shrink-0 flex items-center justify-center text-[#334EAC]/70 hover:text-[#C0392B] hover:bg-[#F7ECEA] transition-colors cursor-pointer text-lg leading-none"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {usernameError && (
              <p id="empty-username-error" className="mt-1 text-xs" style={{ color: "#C0392B" }}>
                {usernameError}
              </p>
            )}
          </div>

          {/* Ô 2: Mật khẩu */}
          <div>
            <label
              htmlFor="password-input"
              className="block text-[#334EAC] font-medium text-xs sm:text-sm mb-1 sm:mb-1.5"
            >
              Mật khẩu <span>*</span>
            </label>
            <div className="relative">
              <input
                ref={passwordInputRef}
                id="password-input"
                type={showPassword ? "text" : "password"}
                placeholder={PLACEHOLDER.matKhau}
                autoComplete="off"
                enterKeyHint="go"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError("");
                  if (generalError)  setGeneralError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                className={[
                  "w-full h-11 sm:h-12 md:h-[50px] pl-3.5 sm:pl-4 pr-11 sm:pr-12 rounded-lg border outline-none",
                  "bg-[#FFF9F0] text-base",
                  passwordError
                    ? "transition-none border-[#C0392B] text-[#C0392B] placeholder:text-[#C0392B] ring-1 ring-[#C0392B]/40"
                    : "transition-colors border-[#7096D1] text-[#334EAC] placeholder:text-[#334EAC]/70 focus:border-[#334EAC] focus:ring-1 focus:ring-[#334EAC]/30",
                ].join(" ")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-[#334EAC] hover:text-[#283E8C] p-1 focus:outline-none"
              >
                {showPassword ? <EyeOpen className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              </button>
            </div>
            {passwordError && (
              <p id="empty-password-error" className="mt-1 text-xs" style={{ color: "#C0392B" }}>
                {passwordError}
              </p>
            )}
          </div>

          {/* NÚT ĐĂNG NHẬP */}
          <button
            id="login-button"
            type="submit"
            disabled={isLoading}
            className={[
              "w-full h-11 sm:h-12 md:h-[50px] rounded-lg font-semibold text-[#FFF9F0]",
              "bg-[#334EAC] hover:bg-[#283E8C] active:bg-[#203270]",
              "transition-colors shadow-sm cursor-pointer",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              "flex items-center justify-center gap-2 text-sm sm:text-base pt-0.5 mt-2",
            ].join(" ")}
          >
            {isLoading && (
              <span className="inline-block w-4 h-4 border-2 border-[#FFF9F0] border-t-transparent rounded-full animate-spin" />
            )}
            Đăng nhập
          </button>

          {/* BÁO LỖI CHUNG */}
          {generalError && (
            <p
              id="login-error-message"
              className="mt-2 text-xs font-medium text-left leading-relaxed"
              style={{ color: "#C0392B" }}
            >
              {generalError}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
