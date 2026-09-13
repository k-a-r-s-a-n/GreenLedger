/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Pure black cinematic base (reference spec), emerald kept as the single accent.
        background: "#000000",
        // Legacy surface token names re-pointed at monochrome values so existing
        // widgets (TelemetryCard, PowerGauge, ...) inherit the new palette
        // without a widget-by-widget rewrite.
        surface: {
          DEFAULT: "#0A0A0A",
          card: "#0D0D0D",
          elevated: "#161616",
          border: "rgba(255, 255, 255, 0.08)",
        },
        primary: {
          DEFAULT: "#10B981",
          glow: "#34D399",
          dark: "#064E3B",
        },
        cyber: {
          // Kept for chart/data color coding; neon is now the emerald accent,
          // dark is pure black to match the cinematic base.
          cyan: "#22D3EE",
          emerald: "#10B981",
          gold: "#F59E0B",
          neon: "#34D399",
          dark: "#000000",
        },
        // White-type hierarchy per the reference spec.
        ink: {
          primary: "#FFFFFF",
          secondary: "rgba(255, 255, 255, 0.68)",
          tertiary: "rgba(255, 255, 255, 0.45)",
        },
      },
      fontFamily: {
        // Syne for high-impact creative display headlines (Lusion design aesthetic).
        display: ["var(--font-display)", "Syne", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "Plus Jakarta Sans", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      letterSpacing: {
        // Refined tracking for modern geometric headlines
        "display": "-0.03em",
        "tighter-2": "-0.02em",
      },
      animation: {
        "pulse-glow": "pulseGlow 2.5s infinite ease-in-out",
        "float": "float 4s ease-in-out infinite",
        "shimmer": "shimmer 1.8s linear infinite",
        "pulse-dot": "pulseDot 1.6s ease-in-out infinite",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "0.85", transform: "scale(1.03)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        // Skeleton shimmer sweep (loading states, visually distinct from data).
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      boxShadow: {
        "glow-green": "0 0 30px rgba(16, 185, 129, 0.18)",
        "glow-cyan": "0 0 25px rgba(34, 211, 238, 0.18)",
        "glow-gold": "0 0 25px rgba(245, 158, 11, 0.18)",
        // Cinematic depth used by .liquid-glass panels.
        "glass": "0 24px 70px rgba(0, 0, 0, 0.65)",
      },
    },
  },
  plugins: [],
};
