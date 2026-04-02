import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: "admin-ui",
  base: "/admin/",
  resolve: {
    alias: {
      "@admin": resolve(__dirname, "admin-ui"),
    },
  },
  build: {
    outDir: resolve(__dirname, "dist/admin"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          sentry: ["@sentry/react"],
          recharts: ["recharts"],
          react: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/admin/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/1.0": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
