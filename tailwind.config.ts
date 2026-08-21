import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        soft: "0 12px 40px rgba(15, 23, 42, 0.08)",
      },
      colors: {
        brand: {
          navy: "#2b353f",     // primary dark — logo cube dark, buttons, headers
          blue: "#355471",     // secondary — accents, links, hover states
          silver: "#cac9cc",   // tertiary — badges, subtle borders, muted text
          gold: "#355471",     // "gold" alias kept for existing class refs → now maps to brand blue
        },
      },
    },
  },
  plugins: [],
};

export default config;
