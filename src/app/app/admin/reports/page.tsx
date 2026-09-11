import Link from "next/link";
import { requireAdmin } from "@/lib/auth/authz";
import { homeSnapshot, seedDemoShopPulse, seedDemoAccountingReports, seedDemoPartsPerformance } from "@/lib/reports/service";
import { TEMPLATES } from "@/lib/reports/catalog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/States";

export const dynamic = "force-dynamic";

const STATUS_INTENT: Record<string, "positive" | "attention" | "neutral" | "critical" | "info"> = {
  active: "positive",
  paused: "attention",
  draft: "neutral",
  delivered: "positive",
  failed: "critical",
  suppressed: "attention",
  queued: "info",
  generating: "info",
  cancelled: "neutral",
};

export default async function AdminReportsHome() {
  const actor = await requireAdmin();
  seedDemoShopPulse(actor);
  seedDemoPartsPerformance(actor);
  seedDemoAccountingReports(actor);
  const snap = homeSnapshot(actor);
  const { kpis } = snap;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">Automated Reporting</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Schedules, audiences, and delivery live here — not in ordinary navigation. Every send
            is generated from the recipient’s current permissions and login email.
          </p>
        </div>
        <Link href="/app/admin/reports/new">
          <Button>New report</Button>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Active schedules" value={String(kpis.activeSchedules)} />
        <Kpi label="Sent today" value={String(kpis.sentToday)} />
        <Kpi label="Sent this week" value={String(kpis.sentWeek)} />
        <Kpi label="Recipients covered" value={String(kpis.recipientsCovered)} />
        <Kpi
          label="Delivery success rate"
          value={kpis.successRate === null ? "—" : `${kpis.successRate}%`}
        />
        <Kpi label="Failed (7 days)" value={String(kpis.failed)} tone={kpis.failed ? "attention" : undefined} />
        <Kpi label="Next scheduled delivery" value={kpis.nextDelivery ?? "None"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming reports</CardTitle>
          </CardHeader>
          <CardContent>
            {snap.upcoming.length === 0 ? (
              <p className="text-sm text-ink-soft">No active schedules.</p>
            ) : (
              <ul className="divide-y divide-line">
                {snap.upcoming.map((u) => (
                  <li key={u.report.id} className="flex items-center justify-between py-2.5 text-sm">
                    <Link href={`/app/admin/reports/${u.report.id}`} className="font-medium text-ink hover:text-forest-600">
                      {u.report.name}
                    </Link>
                    <span className="text-ink-faint">{u.when}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
          </CardHeader>
          <CardContent>
            {snap.attention.length === 0 ? (
              <p className="text-sm text-ink-soft">Nothing waiting.</p>
            ) : (
              <ul className="divide-y divide-line">
                {snap.attention.map((a) => (
                  <li key={`${a.report.id}-${a.reason}`} className="py-2.5 text-sm">
                    <Link href={`/app/admin/reports/${a.report.id}`} className="font-medium text-ink hover:text-forest-600">
                      {a.report.name}
                    </Link>
                    <div className="text-ink-faint">{a.reason}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-ink">Active reports</h3>
        {snap.reports.length === 0 ? (
          <EmptyState
            title="No reports yet"
            description="Start from a template — Daily Shop Pulse is the recommended demo."
            action={
              <Link href="/app/admin/reports/new">
                <Button>New report</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {snap.reports.map((r) => (
              <Link key={r.id} href={`/app/admin/reports/${r.id}`}>
                <Card className="p-5 transition-shadow hover:shadow-card-hover">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-ink">{r.name}</div>
                      <p className="mt-1 text-sm text-ink-soft">{r.description}</p>
                    </div>
                    <StatusBadge intent={STATUS_INTENT[r.status] ?? "neutral"} dot={false}>
                      {r.status}
                    </StatusBadge>
                  </div>
                  <p className="mt-3 text-caption text-ink-faint">
                    {r.deliveryTime} · {r.timezone.split("/")[1] ?? r.timezone} · {r.sectionKeys.length} sections
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-ink">Recent deliveries</h3>
        {snap.recent.length === 0 ? (
          <p className="text-sm text-ink-soft">No deliveries yet. Use Test or Run now on a report.</p>
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-line">
              {snap.recent.slice(0, 12).map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <div>
                    <Link href={`/app/deliveries/${d.id}`} className="font-medium text-ink hover:text-forest-600">
                      {d.reportName}
                    </Link>
                    <div className="text-caption text-ink-faint">
                      {d.recipientName} · {d.recipientEmail}
                      {d.triggerKind === "test" ? " · TEST" : ""}
                    </div>
                  </div>
                  <StatusBadge intent={STATUS_INTENT[d.status] ?? "neutral"} dot={false}>
                    {d.status}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-ink">Templates</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t) => (
            <Link key={t.key} href={`/app/admin/reports/new?template=${t.key}`}>
              <Card className="h-full p-4 transition-shadow hover:shadow-card-hover">
                <div className="font-medium text-ink">{t.label}</div>
                <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "attention" }) {
  return (
    <Card className="p-4">
      <div className="text-caption uppercase tracking-wide text-ink-faint">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === "attention" ? "text-amber-600" : "text-ink"}`}>
        {value}
      </div>
    </Card>
  );
}
