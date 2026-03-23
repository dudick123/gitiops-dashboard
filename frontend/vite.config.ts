import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api/argocd": {
        target: process.env.VITE_ARGOCD_DEV_URL || "http://localhost:8001",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/argocd/, ""),
      },
      "/api/prometheus": {
        target: process.env.VITE_PROMETHEUS_URL || "http://localhost:8002",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/prometheus/, ""),
      },
      "/api/network": {
        target: process.env.VITE_NETWORK_URL || "http://localhost:8003",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/network/, ""),
      },
    },
  },
  build: {
    sourcemap: false,
  },
});
