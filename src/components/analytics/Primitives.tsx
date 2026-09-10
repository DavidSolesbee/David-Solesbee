import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/States";
import { formatCurrency, formatNumber, formatHours } from "@/lib/utils/format";

export type ValueFormat = "currency" | "count" | "hours";

export function fmt(v: number, f: ValueFormat, compact = false): string {
  if (f === "currency") return formatCurrency(v, compact);
  if (f === "hours") return formatHours(v);
  return formatNumber(v, compact);
}

const TONE: Record<string, string> = {
  revenue: "text-forest-600",
  margin: "text-sage-600",
  cost: "text-amber-600",
  service: "text-warm-blue-600",
  neutral: "text-ink",
};
const BAR: Record<string, string> = {
  revenue: "bg-sage-500",
  margin: "bg-sage-500",
  cost: "bg-amber-500",
  service: "bg-warm-blue-500",
  neutral: "bg-forest-500",
};

/** Module page header with scope banner and back link. */
export function ModuleHeader({
  title,
  subtitle,
  scopeLabel,
  crossDept,
}: {
  title: string;
  subtitle: string;
  scopeLabel: string;
  crossDept: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <StatusBadge intent={crossDept ? "info" : "attention"} dot={false}>
            {scopeLabel}
          </StatusBadge>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{title}</h1>
        <p className="mt-1 max-w-2xl text-ink-soft">{subtitle}</p>
      </div>
      <Link
        href="/app"
        className="rounded-lg border border-line-strong px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface-tinted hover:text-ink"
      >
        ← Dashboard
      </Link>
    </div>
  );
}

export function KpiCard({
  label,
  value,
  tone = "neutral",
  sublabel,
}: {
  label: string;
  value: string;
  tone?: string;
  sublabel?: string;
}) {
  return (
    <Card className="p-5">
      <div className="text-caption uppercase tracking-wide text-ink-faint">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${TONE[tone] ?? TONE.neutral}`}>{value}</div>
      {sublabel && <div className="mt-1 text-caption text-ink-faint">{sublabel}</div>}
    </Card>
  );
}

/** Vertical bar chart for a yearly series. */
export function YearBars({
  data,
  format,
  tone = "neutral",
}: {
  data: { year: string; value: number }[];
  format: ValueFormat;
  tone?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0)
    return <EmptyState title="No data" description="Nothing to chart for this scope." />;
  return (
    <div className="flex h-52 items-end gap-2">
      {data.map((d) => (
        <div
          key={d.year}
          className="group flex h-full flex-1 flex-col items-center justify-end gap-2"
          title={`${d.year}: ${fmt(d.value, format)}`}
        >
          <span className="text-caption font-medium text-ink-soft opacity-0 transition-opacity group-hover:opacity-100">
            {fmt(d.value, format, true)}
          </span>
          <div
            className={`w-full rounded-t-md ${BAR[tone] ?? BAR.neutral}`}
            style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
          />
          <span className="text-caption text-ink-faint">{d.year}</span>
        </div>
      ))}
    </div>
  );
}

/** Horizontal ranked list with proportional bars. */
export function RankedList({
  items,
  format,
  tone = "neutral",
}: {
  items: { label: string; value: number }[];
  format: ValueFormat;
  tone?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0)
    return <EmptyState title="No data" description="Nothing to rank for this scope." />;
  return (
    <div className="space-y-3">
      {items.map((i, idx) => (
        <div key={`${i.label}-${idx}`}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate text-ink" title={i.label}>
              {i.label}
            </span>
            <span className="shrink-0 tabular-nums text-ink-soft">
              {fmt(i.value, format)}
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div
              className={`h-full rounded-full ${BAR[tone] ?? BAR.neutral}`}
              style={{ width: `${Math.max(1, (i.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Convenience section card wrapper. */
export function Section({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-2">{children}</CardContent>
    </Card>
  );
}
