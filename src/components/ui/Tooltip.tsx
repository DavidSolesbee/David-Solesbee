"use client";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Tooltip — a lightweight, dependency-free hover/focus tooltip. Used across the
 * platform to explain how a KPI is calculated (a Milestone-4 requirement, seeded
 * here in the design system).
 */
export function Tooltip({
  content,
  children,
  className,
  side = "top",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  side?: "top" | "bottom";
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={cn(
            "absolute z-50 w-max max-w-xs rounded-lg bg-ink px-3 py-2",
            "text-caption font-normal leading-snug text-surface shadow-card-hover",
            "left-1/2 -translate-x-1/2",
            side === "top" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}

/** A small "i" affordance that reveals a calculation explanation on hover. */
export function InfoHint({ content }: { content: React.ReactNode }) {
  return (
    <Tooltip content={content}>
      <span
        aria-hidden
        className="flex h-4 w-4 items-center justify-center rounded-full border border-line-strong text-[10px] font-semibold text-ink-faint hover:border-sage-500 hover:text-sage-600"
      >
        i
      </span>
    </Tooltip>
  );
}
