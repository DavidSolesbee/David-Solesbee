import * as React from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium " +
  "transition-all duration-200 ease-calm select-none " +
  "disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-forest-500 text-white shadow-subtle hover:bg-forest-600 active:bg-forest-700",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-surface-tinted active:bg-surface-sunken",
  ghost: "bg-transparent text-ink-soft hover:bg-surface-sunken hover:text-ink",
  danger:
    "bg-terracotta-500 text-white shadow-subtle hover:bg-terracotta-600",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant = "primary", size = "md", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  },
);
