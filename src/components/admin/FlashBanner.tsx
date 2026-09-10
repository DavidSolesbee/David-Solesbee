import { cn } from "@/lib/utils/cn";
import type { Flash } from "@/lib/admin/flash";

/** Renders a one-time flash message (success / error / revealed secret). */
export function FlashBanner({ flash }: { flash: Flash | null }) {
  if (!flash) return null;
  const styles = {
    success: "border-sage-300 bg-sage-50 text-forest-700",
    error: "border-terracotta-300 bg-terracotta-50 text-terracotta-600",
    secret: "border-amber-300 bg-amber-50 text-amber-600",
  }[flash.kind];
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
        styles,
      )}
    >
      <span className="mt-0.5">
        {flash.kind === "error" ? "⚠" : flash.kind === "secret" ? "🔑" : "✓"}
      </span>
      <span className={flash.kind === "secret" ? "font-mono" : undefined}>
        {flash.message}
      </span>
    </div>
  );
}
