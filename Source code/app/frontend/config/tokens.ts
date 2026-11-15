/**
 * TOKENS DÙNG CHUNG CHO BỐ CỤC & KHOẢNG CÁCH (Design Tokens)
 * Tuân theo RULES.md mục "ĐỒNG BỘ GIAO DIỆN GIỮA CÁC MÀN"
 * CẤM tự đặt margin/padding/gap/min-height/height cố định lớn để "căn cho đẹp".
 */

export const LAYOUT_TOKENS = {
  // Khoảng cách giữa các section / khối lớn (24px)
  spaceSection: "gap-6",
  spaceSectionMb: "mb-6",
  spaceSectionMt: "mt-6",
  spaceSectionPy: "py-6",

  // Khoảng cách giữa các khối con / nhóm form (16px)
  spaceBlock: "gap-4",
  spaceBlockMb: "mb-4",
  spaceBlockMt: "mt-4",
  spaceBlockSpaceY: "space-y-4",

  // Khoảng cách giữa các dòng / hàng dữ liệu (8px)
  spaceRow: "gap-2",
  spaceRowMb: "mb-2",
  spaceRowMt: "mt-2",
  spaceRowSpaceY: "space-y-2",

  // Giá trị pixel chuẩn (phục vụ test layout sai số tối đa 4px)
  pixel: {
    "space-section": 24,
    "space-block": 16,
    "space-row": 8,
  },

  // Bo góc & Viền
  cardRadius: "rounded-[14.4px]",
  controlRadius: "rounded-[9.6px]",
  badgeRadius: "rounded-[7.2px]",
  cardBorder: "border-[1.2px] border-[#7096D1]",
  controlBorder: "border-[1.2px] border-[#7096D1]",

  // Đổ bóng
  cardShadow: "shadow-[0px_4px_16px_0px_rgba(0,0,0,0.12)]",

  // Padding card chuẩn
  cardPadding: "p-5 sm:p-6",
} as const;

export type LayoutTokenKey = keyof typeof LAYOUT_TOKENS.pixel;
