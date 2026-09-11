import type { Config } from "tailwindcss";

/**
 * Solesbee Analytics / Perseus — Design System tokens.
 *
 * Direction: cool, minimal, spacious, premium, calm, modern, highly readable.
 * Palette is taken from the official Solesbee mark: navy, electric blue, silver.
 *
 * - Cool off-white backgrounds
 * - White or softly tinted surfaces
 * - Navy ink, silver secondary text
 * - Subtle shadows, muted borders, generous whitespace
 * - Accents: electric blue, navy, amber, terracotta
 * - No neon, no heavy gradients, no rainbow charts
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces & background (cool white family)
        canvas: "#F4F6F9",
        surface: "#FFFFFF",
        "surface-tinted": "#F7F9FC",
        "surface-sunken": "#EEF1F6",
        // Text
        ink: "#0B1F44",
        "ink-soft": "#5B6578",
        "ink-faint": "#8B95A5",
        // Borders
        line: "#E2E6EE",
        "line-strong": "#C9D0DC",
        // Accents — token names kept so existing classes pick up the new brand
        sage: {
          50: "#EBF3FF",
          100: "#D4E4FF",
          300: "#8FB6FF",
          500: "#1E6BFF",
          600: "#1554D6",
          700: "#0F3FAD",
        },
        forest: {
          50: "#E8EEF8",
          300: "#4A6FA5",
          500: "#0B1F44",
          600: "#081733",
          700: "#051022",
        },
        amber: {
          50: "#FBF3E6",
          300: "#E9C58A",
          500: "#C98A2B", // warm amber
          600: "#A8711F",
        },
        terracotta: {
          50: "#FaF0EC",
          300: "#E0A78F",
          500: "#C0684A", // soft terracotta
          600: "#9E5138",
        },
        "warm-blue": {
          50: "#EDF1F5",
          300: "#93B0C9",
          500: "#4E7A9B", // warm blue
          600: "#3E6480",
        },

        /* ----------------------------------------------------------------
         * Solesbee Analytics — public marketing surface (DARK enterprise).
         * Additive tokens used ONLY by the public homepage / marketing pages.
         * The authenticated app keeps the warm light theme above.
         * ---------------------------------------------------------------- */
        night: {
          950: "#070B14", // deepest background
          900: "#0A0F1C", // primary marketing background
          850: "#0E1524", // alternating section
          800: "#121B2E", // card surface
          750: "#16203698", // translucent card
          700: "#1C2740", // raised surface / border-strong
          600: "#26324F", // hairline on dark
        },
        azure: {
          50: "#EBF3FF",
          100: "#D4E4FF",
          200: "#A8C6FF",
          300: "#7EB0FF",
          400: "#4D8AFF",
          500: "#1E6BFF",
          600: "#1554D6",
          700: "#0F3FAD",
        },
        signal: {
          up: "#3FD09B", // positive delta (calm emerald)
          down: "#F2748C", // negative delta (soft rose)
          warn: "#F0B454", // attention (amber)
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Segoe UI",
          "Inter",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      fontSize: {
        // Calm, readable type scale
        caption: ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.02em" }],
        sm: ["0.875rem", { lineHeight: "1.375rem" }],
        base: ["1rem", { lineHeight: "1.6rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.375rem", { lineHeight: "1.9rem", letterSpacing: "-0.01em" }],
        "2xl": ["1.75rem", { lineHeight: "2.2rem", letterSpacing: "-0.015em" }],
        "3xl": ["2.25rem", { lineHeight: "2.6rem", letterSpacing: "-0.02em" }],
        "4xl": ["3rem", { lineHeight: "3.2rem", letterSpacing: "-0.025em" }],
      },
      borderRadius: {
        sm: "0.375rem",
        DEFAULT: "0.625rem",
        lg: "0.875rem",
        xl: "1.125rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        // Subtle, warm-tinted elevation
        card: "0 1px 2px rgba(11, 31, 68, 0.04), 0 4px 16px rgba(11, 31, 68, 0.06)",
        "card-hover":
          "0 2px 4px rgba(11, 31, 68, 0.06), 0 10px 28px rgba(11, 31, 68, 0.08)",
        subtle: "0 1px 2px rgba(11, 31, 68, 0.06)",
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
      maxWidth: {
        content: "76rem",
      },
      transitionTimingFunction: {
        calm: "cubic-bezier(0.22, 0.61, 0.36, 1)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.22,0.61,0.36,1) both",
        "fade-in": "fade-in 0.8s ease-out both",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
