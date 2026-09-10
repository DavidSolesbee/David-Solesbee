import * as React from "react";
import { cn } from "@/lib/utils/cn";

/** Empty state — calm, centered messaging with an optional action. */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface-tinted px-6 py-14 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-ink-faint shadow-subtle">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-ink">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-ink-soft">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Skeleton — shimmering placeholder block for loading states. */
export function Skeleton({
  className,
}: {
  className?: string;
}) {
  return <div className={cn("shimmer rounded-md", className)} />;
}

/** A KPI-card-shaped loading placeholder. */
export function KpiSkeleton() {
  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-card">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-8 w-32" />
      <Skeleton className="mt-3 h-3 w-20" />
    </div>
  );
}
