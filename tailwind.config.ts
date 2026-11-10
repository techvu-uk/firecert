import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fef2f2",
          100: "#fde3e3",
          200: "#fbcccc",
          500: "#e03131",
          600: "#c92a2a",
          700: "#a61e1e",
          800: "#861b1b",
        },
        ink: {
          50: "#f7f8fa",
          100: "#eef0f3",
          200: "#dde1e7",
          300: "#c3c9d2",
          400: "#8b94a3",
          500: "#646d7c",
          600: "#4a5261",
          700: "#363c48",
          800: "#232831",
          900: "#151920",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
