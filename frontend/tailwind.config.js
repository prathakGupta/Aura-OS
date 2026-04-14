/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  // Our design system uses a dark bg — disable Tailwind's preflight reset
  // so it doesn't fight our own CSS reset in index.css
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        // Mirror our CSS token system so Tailwind classes match our vars
        "bg-root":    "#07070e",
        "bg-surface": "#0d0d1a",
        purple: {
          DEFAULT: "#7c3aed",
          mid:     "#8b5cf6",
          light:   "#a78bfa",
        },
        teal: {
          DEFAULT: "#0d9488",
          light:   "#5eead4",
        },
        coral: "#f43f5e",
        amber: "#f59e0b",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "8px",
        md: "14px",
        lg: "22px",
        xl: "32px",
      },
      animation: {
        "fade-up":    "fadeUp 0.35s ease forwards",
        "pulse-ring": "pulseRing 1.8s ease-out infinite",
        "spin-slow":  "spin 0.7s linear infinite",
      },
    },
  },
  plugins: [],
};