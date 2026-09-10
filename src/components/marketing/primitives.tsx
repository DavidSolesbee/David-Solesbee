import * as React from "react";
import { cn } from "@/lib/utils/cn";
import type { KpiTile } from "@/lib/marketing/demoData";

/* ---------------- Layout ---------------- */

export function Container({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mx-auto w-full max-w-content px-6 sm:px-8", className)}
      {...props}
    />
  );
}

type SectionTone = "base" | "raised" | "deep";
const sectionBg: Record<SectionTone, string> = {
  base: "bg-night-900",
  raised: "bg-night-850",
  deep: "bg-night-950",
};

export function Section({
  id,
  tone = "base",
  className,
  children,
}: {
  id?: string;
  tone?: SectionTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-24 py-20 sm:py-28", sectionBg[tone], className)}
    >
      {children}
    </section>
  );
}

export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-caption font-semibold uppercase tracking-[0.28em] text-azure-400",
        className,
      )}
    >
      <span className="h-1 w-1 rounded-full bg-azure-400" aria-hidden />
      {children}
    </span>
  );
}

export function SectionHeading({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "text-3xl font-semibold tracking-tight text-white sm:text-4xl",
        className,
      )}
    >
      {children}
    </h2>
  );
}

export function Lead({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-lg leading-relaxed text-white/60", className)}>
      {children}
    </p>
  );
}

/* ---------------- Data viz ---------------- */

export function DeltaPill({
  delta,
  direction,
  className,
}: {
  delta: string;
  direction: "up" | "down";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold",
        direction === "up"
          ? "bg-signal-up/10 text-signal-up"
          : "bg-signal-down/10 text-signal-down",
        className,
      )}
    >
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden>
        <path
          d={direction === "up" ? "M6 2 L10 8 L2 8 Z" : "M6 10 L2 4 L10 4 Z"}
          fill="currentColor"
        />
      </svg>
      {delta}
    </span>
  );
}

/** Minimal SVG sparkline from 0-100 values. */
export function Sparkline({
  values,
  className,
  stroke = "#5A8BF7",
  width = 120,
  height = 32,
}: {
  values: number[];
  className?: string;
  stroke?: string;
  width?: number;
  height?: number;
}) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const step = width / (values.length - 1 || 1);
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const area = `${d} L${width} ${height} L0 ${height} Z`;
  const id = React.useId();
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-8 w-full", className)}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id}-f)`} />
      <path d={d} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Vertical bar series from 0-100 values. */
export function MiniBars({
  values,
  className,
  color = "#3B78F0",
  activeColor = "#5A8BF7",
}: {
  values: number[];
  className?: string;
  color?: string;
  activeColor?: string;
}) {
  const max = Math.max(...values, 1);
  return (
    <div className={cn("flex h-full items-end gap-1.5", className)}>
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm transition-all duration-500"
          style={{
            height: `${(v / max) * 100}%`,
            background: i === values.length - 1 ? activeColor : color,
            opacity: 0.35 + (0.65 * v) / max,
          }}
        />
      ))}
    </div>
  );
}

/** Donut chart from segments. */
export function Donut({
  segments,
  size = 132,
  thickness = 16,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {segments.map((seg, i) => {
          const frac = seg.value / total;
          const dash = frac * c;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return el;
        })}
      </g>
    </svg>
  );
}

/** Compact KPI card for dashboard previews. */
export function KpiCard({ kpi }: { kpi: KpiTile }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <span className="text-caption text-white/50">{kpi.label}</span>
        <DeltaPill delta={kpi.delta} direction={kpi.direction} />
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-white">
        {kpi.value}
      </div>
      {kpi.spark.length > 0 && (
        <Sparkline
          values={kpi.spark}
          stroke={kpi.direction === "up" ? "#5A8BF7" : "#F2748C"}
          className="mt-2"
        />
      )}
    </div>
  );
}
