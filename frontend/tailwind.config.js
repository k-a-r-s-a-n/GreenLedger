/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#040806",
        surface: {
          DEFAULT: "#09120E",
          card: "#0E1A15",
          elevated: "#15261F",
          border: "rgba(16, 185, 129, 0.18)",
        },
        primary: {
          DEFAULT: "#10B981",
          glow: "#34D399",
          dark: "#065F46",
        },
        cyber: {
          cyan: "#06B6D4",
          emerald: "#10B981",
          gold: "#F59E0B",
          neon: "#00FF88",
          dark: "#050B08",
        },
      },
      fontFamily: {
        mono: ["var(--font-geist-mono)", "monospace"],
        sans: ["var(--font-geist-sans)", "sans-serif"],
      },
      animation: {
        "pulse-glow": "pulseGlow 2.5s infinite ease-in-out",
        "orbit": "orbit 20s linear infinite",
        "float": "float 4s ease-in-out infinite",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: 0.4, transform: "scale(1)" },
          "50%": { opacity: 0.85, transform: "scale(1.03)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        }
      },
      boxShadow: {
        "glow-green": "0 0 25px rgba(16, 185, 129, 0.25)",
        "glow-cyan": "0 0 25px rgba(6, 182, 212, 0.25)",
        "glow-gold": "0 0 25px rgba(245, 158, 11, 0.25)",
      }
    },
  },
  plugins: [],
};
