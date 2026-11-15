"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { MAU_THONG_BAO } from "@frontend/config/thong-bao";

export type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const showSuccess = useCallback((message: string) => {
    showToast(message, "success");
  }, [showToast]);

  const showError = useCallback((message: string) => {
    showToast(message, "error");
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError }}>
      {children}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-[90vw] sm:max-w-md pointer-events-none">
        {toasts.map((toast) => {
          const cfg =
            toast.type === "error"
              ? MAU_THONG_BAO.loi
              : toast.type === "success"
              ? MAU_THONG_BAO["thanh-cong"]
              : MAU_THONG_BAO["canh-bao"];
          return (
            <div
              key={toast.id}
              className="pointer-events-auto px-4 py-3 rounded-lg shadow-lg text-sm font-medium border flex items-center gap-3 transition-all transform translate-y-0"
              style={{
                backgroundColor: cfg.nen,
                color: cfg.chu,
                borderColor: cfg.vien,
              }}
              role="alert"
            >
              <span>{toast.message}</span>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="ml-auto text-current opacity-60 hover:opacity-100 text-xs px-1"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast phải được dùng bên trong ToastProvider");
  }
  return context;
}
