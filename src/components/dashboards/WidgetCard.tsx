import { Card } from "@/components/ui/Card";
import { KpiCard, YearBars, RankedList, Section } from "@/components/analytics/Primitives";
import type { ResolvedWidget } from "@/lib/dashboards/catalog";

/**
 * Renders a single resolved dashboard widget. When the viewer is not authorized
 * for the widget's metric, a locked placeholder is shown and NO data is present
 * (the server never resolved it). This is the visible half of the dashboard
 * security boundary.
 */
export function WidgetCard({ widget }: { widget: ResolvedWidget }) {
  if (!widget.authorized || !widget.render) {
    return (
      <Card className="flex flex-col justify-center border-dashed bg-surface-tinted p-5">
        <div className="flex items-center gap-2 text-caption uppercase tracking-wide text-ink-faint">
          <LockGlyph />
          Restricted
        </div>
        <div className="mt-1 text-sm font-medium text-ink-soft">{widget.label}</div>
        <div className="mt-1 text-caption text-ink-faint">
          You don’t have access to this metric.
        </div>
      </Card>
    );
  }

  const r = widget.render;
  if (r.kind === "kpi") {
    return (
      <KpiCard
        label={widget.label}
        value={r.value ?? "—"}
        tone={r.tone}
        sublabel={r.sublabel}
      />
    );
  }
  if (r.kind === "bars") {
    return (
      <Section title={widget.label} description={widget.description}>
        <YearBars data={r.bars ?? []} format={r.format ?? "currency"} tone="revenue" />
      </Section>
    );
  }
  // list
  return (
    <Section title={widget.label} description={widget.description}>
      <RankedList items={r.items ?? []} format={r.format ?? "currency"} tone="revenue" />
    </Section>
  );
}

function LockGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="10" width="16" height="10" rx="2" fill="currentColor" opacity="0.5" />
      <path d="M8 10V7a4 4 0 118 0v3" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  );
}
