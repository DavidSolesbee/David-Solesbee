import * as React from "react";
import { cn } from "@/lib/utils/cn";

type Intent = "neutral" | "positive" | "attention" | "critical" | "info";

const intents: Record<Intent, string> = {
  neutral: "bg-surface-sunken text-ink-soft ring-line-strong",
  positive: "bg-sage-50 text-sage-700 ring-sage-300",
  attention: "bg-amber-50 text-amber-600 ring-amber-300",
  critical: "bg-terracotta-50 text-terracotta-600 ring-terracotta-300",
  info: "bg-warm-blue-50 text-warm-blue-600 ring-warm-blue-300",
};

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  intent?: Intent;
  dot?: boolean;
}

export function StatusBadge({
  intent = "neutral",
  dot = true,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5",
        "text-caption font-medium ring-1 ring-inset",
        intents[intent],
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", {
            "bg-ink-faint": intent === "neutral",
            "bg-sage-500": intent === "positive",
            "bg-amber-500": intent === "attention",
            "bg-terracotta-500": intent === "critical",
            "bg-warm-blue-500": intent === "info",
          })}
        />
      )}
      {children}
    </span>
  );
}
