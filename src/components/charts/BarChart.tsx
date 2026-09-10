import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Chart style reference — a minimal, dependency-free bar chart.
 *
 * Charts in Perseus stay calm and single-hued (no rainbow palettes). This
 * primitive establishes the house chart styling: muted gridless bars in a
 * single accent, quiet axis labels, generous spacing.
 */
export interface BarDatum {
  label: string;
  value: number;
}

export function BarChart({
  data,
  height = 200,
  format = (n) => n.toLocaleString("en-US"),
  className,
}: {
  data: BarDatum[];
  height?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={cn("w-full", className)}>
      <div
        className="flex items-end gap-3"
        style={{ height }}
        role="img"
        aria-label="Bar chart"
      >
        {data.map((d) => {
          const pct = Math.max(2, Math.round((d.value / max) * 100));
          return (
            <div
              key={d.label}
              className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              title={`${d.label}: ${format(d.value)}`}
            >
              <span className="text-caption font-medium text-ink-soft">
                {format(d.value)}
              </span>
              <div
                className="w-full rounded-t-md bg-sage-500/85 transition-all duration-500 ease-calm hover:bg-forest-500"
                style={{ height: `${pct}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-3 border-t border-line pt-2">
        {data.map((d) => (
          <div
            key={d.label}
            className="flex-1 text-center text-caption text-ink-faint"
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}
