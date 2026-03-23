import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        status: {
          healthy: "#22c55e",
          degraded: "#f59e0b",
          error: "#ef4444",
          unknown: "#6b7280",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
