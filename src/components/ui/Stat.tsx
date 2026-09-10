import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { Card } from "@/components/ui/Card";
import { InfoHint } from "@/components/ui/Tooltip";

/**
 * Stat / KPI card. Every KPI can carry an explanation of how it is calculated
 * (surfaced via InfoHint), satisfying the platform rule that "every KPI must
 * explain its calculation".
 */
export function Stat({
  label,
  value,
  delta,
  explanation,
  className,
}: {
  label: string;
  value: React.ReactNode;
  delta?: { value: string; direction: "up" | "down" | "flat" };
  explanation?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-6", className)}>
      <div className="flex items-center gap-1.5">
        <span className="text-caption font-medium uppercase tracking-wide text-ink-faint">
          {label}
        </span>
        {explanation && <InfoHint content={explanation} />}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-ink">
        {value}
      </div>
      {delta && (
        <div
          className={cn("mt-2 text-sm font-medium", {
            "text-sage-600": delta.direction === "up",
            "text-terracotta-600": delta.direction === "down",
            "text-ink-soft": delta.direction === "flat",
          })}
        >
          {delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "—"}{" "}
          {delta.value}
        </div>
      )}
    </Card>
  );
}
