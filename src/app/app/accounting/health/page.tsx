import { guardAccounting, auditAccounting } from "@/lib/accounting/guard";
import { ACCOUNTING_PERMS } from "@/lib/accounting/permissions";
import { getAccountingHealth } from "@/lib/accounting/health";
import { ModuleHeader, KpiCard, Section } from "@/components/analytics/Primitives";
import { Card, CardContent } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const user = await guardAccounting(ACCOUNTING_PERMS.health);
  auditAccounting(user, "accounting.health_viewed");
  const health = getAccountingHealth(user);

  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Accounting health"
        subtitle="A transparent partial score. Missing books components are listed as unavailable — they do not count as 100 or as 0."
        scopeLabel="Partial score"
        crossDept
      />

      {health && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              label="Overall (partial)"
              value={health.overall === null ? "n/a" : String(health.overall)}
              tone="margin"
              sublabel={`${health.scoredCount} of ${health.catalogCount} components · not a complete score`}
            />
            <KpiCard label="As of" value={health.asOf} sublabel={`Calendar today ${health.today}`} />
            <KpiCard
              label="Unavailable components"
              value={String(health.catalogCount - health.scoredCount)}
              sublabel="Omitted from the average"
            />
          </section>

          <p className="text-caption text-ink-faint">{health.methodology}</p>

          <Section title="How the score is calculated" description="Every deduction is printed.">
            <div className="grid gap-4 lg:grid-cols-2">
              {health.components.map((c) => (
                <Card key={c.key}>
                  <CardContent className="space-y-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-medium text-ink">{c.label}</p>
                      <p className="text-xl font-semibold tabular-nums text-ink">
                        {c.score === null ? "Data Unavailable" : c.score}
                      </p>
                    </div>
                    <p className="text-caption text-ink-faint">{c.reason}</p>
                    {c.deductions.length > 0 && (
                      <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
                        {c.deductions.map((d) => (
                          <li key={d}>{d}</li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
