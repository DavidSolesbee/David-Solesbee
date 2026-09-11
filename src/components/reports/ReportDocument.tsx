import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatNumber, formatHours } from "@/lib/utils/format";
import { sectionBandOrder } from "@/lib/reports/render";
import type { DeliverySnapshot } from "@/lib/reports/types";
import type { ResolvedSection } from "@/lib/reports/resolve";
import { cn } from "@/lib/utils/cn";

function fmtItem(value: number, format?: "currency" | "count" | "hours"): string {
  if (format === "currency") return formatCurrency(value);
  if (format === "hours") return formatHours(value);
  return formatNumber(value);
}

function SectionBody({ section }: { section: ResolvedSection }) {
  if (!section.authorized) {
    return (
      <div className="rounded-xl border border-dashed border-line px-4 py-5 text-sm text-ink-soft">
        Restricted — this measure is omitted from this recipient’s copy.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {section.narrative && <p className="text-[17px] leading-relaxed text-ink">{section.narrative}</p>}
      {section.kpis && section.kpis.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {section.kpis.map((k) => (
            <div key={k.label} className="rounded-xl bg-surface-tinted/70 px-4 py-3">
              <div className="text-caption uppercase tracking-wide text-ink-faint">{k.label}</div>
              <div className="mt-1 text-2xl font-semibold text-ink">{k.value}</div>
              {k.deltaLabel && <div className="mt-1 text-caption text-ink-soft">{k.deltaLabel}</div>}
            </div>
          ))}
        </div>
      )}
      {section.bars && section.bars.length > 0 && (
        <div className="space-y-2">
          {section.bars.map((b) => {
            const max = Math.max(...section.bars!.map((x) => x.value), 1);
            return (
              <div key={b.label} className="flex items-center gap-3 text-sm">
                <div className="w-24 shrink-0 text-ink-soft">{b.label}</div>
                <div className="h-2 flex-1 rounded-full bg-surface-sunken">
                  <div
                    className="h-2 rounded-full bg-forest-500"
                    style={{ width: `${Math.max(4, (b.value / max) * 100)}%` }}
                  />
                </div>
                <div className="w-24 text-right tabular-nums text-ink">{formatCurrency(b.value)}</div>
              </div>
            );
          })}
        </div>
      )}
      {section.items && section.items.length > 0 && (
        <ol className="divide-y divide-line">
          {section.items.map((item, i) => (
            <li key={`${item.label}-${i}`} className="flex items-center justify-between py-2 text-sm">
              <span className="text-ink">{item.label}</span>
              <span className="tabular-nums text-ink-soft">{fmtItem(item.value, item.format)}</span>
            </li>
          ))}
        </ol>
      )}
      {section.alerts && section.alerts.length > 0 && (
        <ul className="space-y-2">
          {section.alerts.map((a, i) => (
            <li
              key={i}
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                a.severity === "critical" && "bg-terracotta-50 text-terracotta-600",
                a.severity === "attention" && "bg-amber-50 text-amber-700",
                a.severity === "info" && "bg-warm-blue-50 text-warm-blue-600",
              )}
            >
              {a.text}
            </li>
          ))}
        </ul>
      )}
      {section.methodology && (
        <p className="text-caption text-ink-faint">Methodology: {section.methodology}</p>
      )}
    </div>
  );
}

export function ReportDocument({
  snap,
  mark,
}: {
  snap: DeliverySnapshot;
  mark?: "preview" | "test" | null;
}) {
  const bands = sectionBandOrder(snap.sections);
  const kpis = snap.sections.flatMap((s) => (s.authorized ? s.kpis ?? [] : [])).slice(0, 4);
  const alerts = snap.sections.flatMap((s) => (s.authorized ? s.alerts ?? [] : [])).slice(0, 3);

  return (
    <div className="space-y-8">
      {mark && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-center text-caption font-semibold uppercase tracking-[0.18em] text-amber-700">
          {mark === "preview" ? "PREVIEW — NOT SENT" : "TEST REPORT"}
        </div>
      )}

      <header>
        <div className="text-caption font-semibold uppercase tracking-[0.22em] text-forest-600">
          Perseus Equipment Intelligence
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">{snap.reportName}</h1>
        <p className="mt-1 text-ink-soft">{snap.periodLabel}</p>
        <p className="text-sm text-ink-faint">
          {snap.recipientName}
          {snap.recipientRole ? ` · ${snap.recipientRole}` : ""} · {snap.recipientEmail}
        </p>
        <p className="text-caption text-ink-faint">{snap.scopeNote}</p>
      </header>

      {snap.aiNarrative && (
        <Card className="border-sage-300/70 bg-sage-50/40">
          <CardContent className="space-y-2">
            <div className="text-caption font-semibold uppercase tracking-[0.16em] text-forest-600">
              AI Executive Summary
            </div>
            <p className="text-[17px] leading-relaxed text-ink">{snap.aiNarrative}</p>
            <p className="text-caption text-ink-faint">
              Explains only the authorized findings in this copy. Perseus does not invent values.
            </p>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-caption font-semibold uppercase tracking-[0.16em] text-ink-faint">
          10-second view
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <Card key={k.label} className="p-4">
              <div className="text-caption uppercase tracking-wide text-ink-faint">{k.label}</div>
              <div className="mt-1 text-2xl font-semibold text-ink">{k.value}</div>
              {k.deltaLabel && <div className="mt-1 text-caption text-ink-soft">{k.deltaLabel}</div>}
            </Card>
          ))}
        </div>
        {alerts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {alerts.map((a, i) => (
              <StatusBadge
                key={i}
                intent={a.severity === "critical" ? "critical" : a.severity === "attention" ? "attention" : "info"}
              >
                {a.text}
              </StatusBadge>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-caption font-semibold uppercase tracking-[0.16em] text-ink-faint">
          30-second view
        </h2>
        {snap.sections
          .filter((s) => s.authorized && (s.key === "executive_summary" || s.key === "revenue_trend" || s.key === "business_pulse"))
          .map((s) => (
            <Card key={s.key}>
              <CardContent>
                <h3 className="mb-3 font-semibold text-ink">{s.label}</h3>
                <SectionBody section={s} />
              </CardContent>
            </Card>
          ))}
      </section>

      {bands.map((band) => (
        <section key={band.band} className="space-y-3">
          <div>
            <h2 className="text-caption font-semibold uppercase tracking-[0.16em] text-forest-600">
              {band.title}
            </h2>
            <p className="text-sm text-ink-soft">{band.question}</p>
          </div>
          {band.sections.map((s) => (
            <Card key={s.key}>
              <CardContent>
                <h3 className="mb-3 font-semibold text-ink">{s.label}</h3>
                <SectionBody section={s} />
              </CardContent>
            </Card>
          ))}
        </section>
      ))}

      <p className="text-caption text-ink-faint">
        Investigation view is the ranked tables and methodology notes above. Every figure is computed
        from this recipient’s current authorization — restricted sections contain no data.
      </p>
    </div>
  );
}
