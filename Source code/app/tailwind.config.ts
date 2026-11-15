import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./frontend/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ============================================================
      // Design tokens – lấy từ Figma MCP (docs/ke-hoach/05-THONG-SO-FIGMA.md)
      // ============================================================
      colors: {
        primary: {
          DEFAULT: "#334EAC",   // Xanh chính: sidebar, nút, chữ nhấn
          hover:   "#283E8C",
          light:   "#EBF0FA",
        },
        background: "#FFF9F0",  // Trắng chính: nền nội dung, thẻ chính, thanh trên
        card: {
          DEFAULT: "#F7F2EB",   // Nền phụ: active nav, ô chỉ đọc, card xen kẽ
          light:   "#FFF9F0",
        },
        brand: {
          primary: "#334EAC",
          bg:      "#FFF9F0",
          card:    "#F7F2EB",
        },
        "input-border":      "#7096D1", // Viền card, input, bảng, thanh trên/dưới
        "login-card-border": "#FFF9F0",
        "header-border":     "#7096D1",
      },
      maxWidth: {
        "login-card": "680px",
      },
      height: {
        "input-figma": "57px",
        "btn-figma":   "57px",
        "header":      "76px",
      },
      width: {
        sidebar: "336px",
      },
      borderRadius: {
        "login-card": "16px",
        "input":      "8px",
        "btn":        "8px",
        "logo":       "16px",
      },
      fontFamily: {
        // Inter (đóng gói qua next/font/google) làm font chính cho toàn hệ thống
        sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        "figma":      "0px 4px 16px 0px rgba(0, 0, 0, 0.2)",
        "login-card": "0px 12px 32px 0px rgba(71, 48, 31, 0.13)",
      },
    },
  },
  plugins: [],
};
export default config;
