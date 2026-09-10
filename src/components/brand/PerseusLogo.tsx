import * as React from "react";
import { clsx } from "clsx";

/**
 * Perseus Equipment Intelligence — brand marks.
 *
 * A minimal, geometric identity: two overlapping summit peaks (higher insight)
 * crowned by a four-point north star (Perseus / direction). No literal
 * equipment, gears, or industrial clip-art. Crisp at small sizes for use across
 * dashboard, email, and PDF.
 *
 * Exports:
 *   - <PerseusMark />  icon only
 *   - <PerseusLogo />  icon + "Perseus Equipment Intelligence" wordmark
 */

type Tone = "color" | "mono" | "inverse";

// Faithful to the brand image: a sage front peak, a deep charcoal-green back
// peak, and a warm gold north star cresting the summit.
const PALETTE: Record<Tone, { back: string; front: string; star: string }> = {
  color: { back: "#26302A", front: "#7C9A73", star: "#C99A3B" },
  mono: { back: "#2B2A28", front: "#6B6863", star: "#2B2A28" },
  inverse: { back: "#DFE8DC", front: "#FFFFFF", star: "#E9C58A" },
};

export interface PerseusMarkProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  tone?: Tone;
  title?: string;
}

export function PerseusMark({
  size = 40,
  tone = "color",
  title = "Perseus",
  className,
  ...rest
}: PerseusMarkProps) {
  const c = PALETTE[tone];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={title}
      className={clsx("shrink-0", className)}
      {...rest}
    >
      <title>{title}</title>
      {/* Back peak — taller, right, deep charcoal-green */}
      <path d="M30 8 L47 44 L15 44 Z" fill={c.back} />
      {/* Front peak — left, sage, overlapping the back peak */}
      <path d="M18 17 L35 44 L1 44 Z" fill={c.front} />
      {/* Subtle facet on the front peak's shaded side */}
      <path d="M18 17 L26 44 L18 44 Z" fill={c.back} fillOpacity={0.16} />
      {/* North star / four-point sparkle cresting the summit */}
      <path
        d="M32 3
           C32.5 8 34 9.5 39 10
           C34 10.5 32.5 12 32 17
           C31.5 12 30 10.5 25 10
           C30 9.5 31.5 8 32 3 Z"
        fill={c.star}
      />
    </svg>
  );
}

export interface PerseusLogoProps {
  size?: number;
  tone?: Tone;
  /** Show the "Equipment Intelligence" descriptor under the wordmark. */
  showDescriptor?: boolean;
  className?: string;
}

export function PerseusLogo({
  size = 36,
  tone = "color",
  showDescriptor = true,
  className,
}: PerseusLogoProps) {
  const wordColor =
    tone === "inverse" ? "text-surface" : tone === "mono" ? "text-ink" : "text-forest-600";
  const descColor = tone === "inverse" ? "text-line" : "text-ink-soft";
  return (
    <span className={clsx("inline-flex items-center gap-3", className)}>
      <PerseusMark size={size} tone={tone} />
      <span className="flex flex-col leading-none">
        <span
          className={clsx(
            "font-semibold tracking-[0.22em] uppercase",
            wordColor,
          )}
          style={{ fontSize: size * 0.5 }}
        >
          Perseus
        </span>
        {showDescriptor && (
          <span
            className={clsx("mt-1 tracking-[0.28em] uppercase", descColor)}
            style={{ fontSize: size * 0.22 }}
          >
            Equipment Intelligence
          </span>
        )}
      </span>
    </span>
  );
}
