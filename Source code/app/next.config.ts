import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Cho phép Next.js Image tối ưu ảnh trong public/
    unoptimized: false,
    // Kích thước màn hình cần tối ưu
    deviceSizes: [390, 768, 1280, 1920],
    imageSizes: [104, 336],
  },
};

export default nextConfig;
