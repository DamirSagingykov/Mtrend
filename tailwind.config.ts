import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: { DEFAULT: "1rem", md: "2rem", xl: "3rem" }, screens: { sm: "640px", md: "768px", lg: "1024px", xl: "1280px", "2xl": "1440px" } },
    extend: {
      colors: {
        ink: { DEFAULT: "#141414", soft: "#2b2b2b", muted: "#6b6661" },
        graphite: "#3a3a3a",
        milk: { DEFAULT: "#f7f3ee", deep: "#efe8df" },
        sand: { DEFAULT: "#d9c8b4", dark: "#b39b80" },
        wood: { DEFAULT: "#8a6a4f", dark: "#6b5039" },
        line: "#e6e0d8",
        danger: "#9b2c2c",
        success: "#2f5d3a",
      },
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ['"Cormorant Garamond"', "Georgia", "serif"],
      },
      letterSpacing: { wider2: "0.18em" },
      keyframes: {
        fadeUp: { "0%": { opacity: "0", transform: "translateY(12px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideIn: { "0%": { transform: "translateX(100%)" }, "100%": { transform: "translateX(0)" } },
        slideLeft: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(0)" } },
        slideUp: { "0%": { transform: "translateY(100%)" }, "100%": { transform: "translateY(0)" } },
      },
      animation: {
        "fade-up": "fadeUp .6s cubic-bezier(.2,.7,.2,1) both",
        "fade-in": "fadeIn .3s ease both",
        "slide-in": "slideIn .35s cubic-bezier(.2,.7,.2,1) both",
        "slide-left": "slideLeft .35s cubic-bezier(.2,.7,.2,1) both",
        "slide-up": "slideUp .35s cubic-bezier(.2,.7,.2,1) both",
      },
    },
  },
  plugins: [],
};
export default config;
