import * as React from "react";
import Image from "next/image";
import { clsx } from "clsx";

/**
 * Solesbee Analytics — official mark.
 *
 * The S-bar icon follows the provided lockup: electric-blue top ribbon, navy
 * base, silver and blue data bars. The full PNG is used on light surfaces;
 * dark marketing surfaces keep the color mark + inverted type.
 */

type Tone = "dark" | "light";

const INK: Record<Tone, { word: string; sub: string }> = {
  dark: { word: "text-white", sub: "text-white/55" },
  light: { word: "text-ink", sub: "text-ink-faint" },
};

export interface SolesbeeMarkProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  title?: string;
}

export function SolesbeeMark({
  size = 32,
  title = "Solesbee Analytics",
  className,
  ...rest
}: SolesbeeMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 140"
      role="img"
      aria-label={title}
      className={clsx("shrink-0", className)}
      {...rest}
    >
      <title>{title}</title>
      <path d="M6 46 L78 6 L98 24 L26 64 Z" fill="#4D8AFF" />
      <path d="M26 64 L98 24 L98 52 L26 92 Z" fill="#1E6BFF" />
      <path d="M18 86 L38 74 L38 102 L18 114 Z" fill="#C5CCD6" />
      <path d="M18 86 L38 74 L48 80 L28 92 Z" fill="#A8B2C1" />
      <path d="M44 78 L64 66 L64 108 L44 120 Z" fill="#2B7BFF" />
      <path d="M44 78 L64 66 L74 72 L54 84 Z" fill="#4D8AFF" />
      <path d="M70 64 L98 52 L98 96 L64 128 L16 156 L16 132 L54 108 L70 98 Z" fill="#0B1F44" />
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
  if (tone === "light") {
    return (
      <Image
        src="/brand/solesbee-analytics.png"
        alt="Solesbee Analytics"
        width={Math.round(size * 4.2)}
        height={size}
        className={clsx("w-auto object-contain object-left", className)}
        style={{ height: size }}
        priority
        unoptimized
      />
    );
  }

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
            className={clsx("mt-0.5 font-medium uppercase tracking-[0.32em]", c.sub)}
            style={{ fontSize: size * 0.24 }}
          >
            Analytics
          </span>
        )}
      </span>
    </span>
  );
}
