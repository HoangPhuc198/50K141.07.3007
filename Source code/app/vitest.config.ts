import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    fileParallelism: false,
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@frontend": path.resolve(__dirname, "./frontend"),
      "@backend": path.resolve(__dirname, "./backend"),
      "@database": path.resolve(__dirname, "./database"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
