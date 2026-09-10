import type { Config } from "tailwindcss";

/**
 * Perseus Equipment Intelligence — Design System tokens.
 *
 * Direction: warm, minimal, spacious, premium, calm, modern, highly readable.
 * Inspired by the restraint of modern Apple product design (not a copy).
 *
 * - Warm white / ivory backgrounds
 * - White or softly tinted surfaces
 * - Warm charcoal text, soft gray secondary text
 * - Subtle shadows, muted borders, generous whitespace
 * - Accents: sage, forest green, warm amber, soft terracotta, warm blue
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
        // Surfaces & background (warm ivory family)
        canvas: "#F7F5F0", // page background — warm white / ivory
        surface: "#FFFFFF", // primary card surface
        "surface-tinted": "#FBFAF6", // softly tinted surface
        "surface-sunken": "#F1EEE7", // sunken wells / table headers
        // Text
        ink: "#2B2A28", // warm charcoal (primary text)
        "ink-soft": "#6B6863", // soft gray (secondary text)
        "ink-faint": "#9A968E", // faint gray (tertiary / captions)
        // Borders
        line: "#E7E3DA", // muted border
        "line-strong": "#D8D3C7",
        // Accents
        sage: {
          50: "#F1F5F0",
          100: "#DFE8DC",
          300: "#A9C0A0",
          500: "#7C9A73", // primary sage
          600: "#657F5D",
          700: "#4F6549",
        },
        forest: {
          50: "#EAF0EC",
          300: "#7FA087",
          500: "#3F6B4E", // forest green (primary brand accent)
          600: "#335840",
          700: "#274531",
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
        card: "0 1px 2px rgba(43, 42, 40, 0.04), 0 4px 16px rgba(43, 42, 40, 0.05)",
        "card-hover":
          "0 2px 4px rgba(43, 42, 40, 0.06), 0 10px 28px rgba(43, 42, 40, 0.08)",
        subtle: "0 1px 2px rgba(43, 42, 40, 0.05)",
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
    },
  },
  plugins: [],
};

export default config;
