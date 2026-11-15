// Kiểm tra biến môi trường bắt buộc khi server khởi động. Chỉ in TÊN biến thiếu, không bao giờ in giá trị.
export const REQUIRED_ENV = ["DATABASE_URL", "DIRECT_URL", "ENCRYPTION_KEY", "JWT_SECRET", "DEFAULT_PASSWORD"] as const;

export function missingEnv(env: Record<string, string | undefined> = process.env): string[] {
  return REQUIRED_ENV.filter((k) => !env[k]?.trim());
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const missing = missingEnv();
  if (missing.length > 0) {
    throw new Error(`Thiếu biến môi trường bắt buộc: ${missing.join(", ")}`);
  }
}
