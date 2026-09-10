import * as React from "react";
import { clsx } from "clsx";

/**
 * Solesbee Analytics — brand marks.
 *
 * A data-centric identity: an abstract mark built from ascending data columns
 * and a connected trend path with a node — reading as analytical momentum and,
 * loosely, an "S/A". No mountains, no landscape imagery. Crisp at favicon size.
 *
 * Exports:
 *   - <SolesbeeMark />  icon only (square, works as favicon / app icon / avatar)
 *   - <SolesbeeLogo />  icon + "Solesbee Analytics" wordmark
 */

type Tone = "dark" | "light";

const INK: Record<Tone, { word: string; sub: string }> = {
  // On dark marketing surfaces
  dark: { word: "text-white", sub: "text-white/55" },
  // On light surfaces
  light: { word: "text-night-900", sub: "text-ink-soft" },
};

export interface SolesbeeMarkProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  title?: string;
}

/**
 * The mark. Three ascending columns + a connecting analytical path with an
 * accent node. Uses a fixed azure/white gradient so it stays recognizable
 * anywhere (favicon, sidebar, avatar).
 */
export function SolesbeeMark({
  size = 32,
  title = "Solesbee Analytics",
  className,
  ...rest
}: SolesbeeMarkProps) {
  const id = React.useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label={title}
      className={clsx("shrink-0", className)}
      {...rest}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="40" x2="40" y2="0">
          <stop offset="0%" stopColor="#2C61D6" />
          <stop offset="100%" stopColor="#5A8BF7" />
        </linearGradient>
      </defs>
      {/* Rounded container tile */}
      <rect x="0" y="0" width="40" height="40" rx="10" fill={`url(#${id}-g)`} />
      {/* Ascending data columns */}
      <rect x="9" y="23" width="4.5" height="8" rx="1.4" fill="#FFFFFF" fillOpacity="0.55" />
      <rect x="17.75" y="18" width="4.5" height="13" rx="1.4" fill="#FFFFFF" fillOpacity="0.8" />
      <rect x="26.5" y="12" width="4.5" height="19" rx="1.4" fill="#FFFFFF" />
      {/* Analytical trend path across the tops */}
      <path
        d="M11 21 L20 16 L28.75 10"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Accent node */}
      <circle cx="28.75" cy="10" r="3" fill="#0A0F1C" />
      <circle cx="28.75" cy="10" r="3" fill="#FFFFFF" fillOpacity="0.12" />
      <circle cx="28.75" cy="10" r="1.6" fill="#FFFFFF" />
    </svg>
  );
}

export interface SolesbeeLogoProps {
  size?: number;
  tone?: Tone;
  showDescriptor?: boolean;
  className?: string;
}

export function SolesbeeLogo({
  size = 32,
  tone = "dark",
  showDescriptor = true,
  className,
}: SolesbeeLogoProps) {
  const c = INK[tone];
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <SolesbeeMark size={size} />
      <span className="flex flex-col leading-none">
        <span
          className={clsx("font-semibold tracking-tight", c.word)}
          style={{ fontSize: size * 0.58 }}
        >
          Solesbee
        </span>
        {showDescriptor && (
          <span
            className={clsx(
              "mt-0.5 font-medium uppercase tracking-[0.32em]",
              c.sub,
            )}
            style={{ fontSize: size * 0.24 }}
          >
            Analytics
          </span>
        )}
      </span>
    </span>
  );
}
