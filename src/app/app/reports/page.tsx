import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/tenant/context";
import { config } from "@/lib/config";
import { runnableTemplates } from "@/lib/reports/catalog";
import { listDeliveriesForViewer, seedDemoPartsPerformance } from "@/lib/reports/service";
import { runReportOnceAction } from "@/app/app/reports/actions";
import { readFlash } from "@/lib/admin/flash";
import { FlashBanner } from "@/components/admin/FlashBanner";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/States";

function defaultFrom(asOf: string): string {
  const [y, m, d] = asOf.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() - 30);
  return dt.toISOString().slice(0, 10);
}

export const dynamic = "force-dynamic";

export default async function DepartmentReportsPage() {
  const user = await getActiveContext();
  if (!user || user.status !== "active" || !user.permissions.has("app.access")) {
    redirect("/login");
  }
  if (!user.permissions.has("feature.export")) redirect("/app");

  if (user.permissions.has("app.admin") && user.permissions.has("feature.manage_reports")) {
    seedDemoPartsPerformance(user);
  }

  const templates = runnableTemplates(user.permissions);
  const mine = listDeliveriesForViewer(user, 8);
  const flash = await readFlash();
  const isAdmin = user.permissions.has("app.admin");
  const asOf = config.dataAsOfFallback.slice(0, 10);
  const fromDefault = defaultFrom(asOf);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Reports</h1>
        <p className="mt-1 max-w-2xl text-ink-soft">
          Run a pack for yourself from templates you are authorized to see. Scheduled
          audiences stay in the Admin Console.
        </p>
      </div>

      {flash && <FlashBanner flash={flash} />}

      {templates.length === 0 ? (
        <EmptyState
          title="No reports available"
          description="Your role does not currently authorize any report templates."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.key}>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-semibold text-ink">{t.label}</p>
                  <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
                  <p className="mt-2 text-caption text-ink-faint">
                    {t.scheduleKind.replace("_", " ")} · {t.deliveryTime}
                  </p>
                </div>
                <form action={runReportOnceAction} className="space-y-3">
                  <input type="hidden" name="templateKey" value={t.key} />
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-caption font-medium text-ink-soft">From</span>
                      <Input type="date" name="from" required defaultValue={fromDefault} max={asOf} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-caption font-medium text-ink-soft">To</span>
                      <Input type="date" name="to" required defaultValue={asOf} max={asOf} />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" name="after" value="view" size="sm">
                      Run
                    </Button>
                    <Button type="submit" name="after" value="print" size="sm" variant="secondary">
                      Print
                    </Button>
                    <Button type="submit" name="after" value="pdf" size="sm" variant="secondary">
                      Save PDF
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink">My recent deliveries</h2>
        {mine.length === 0 ? (
          <p className="text-sm text-ink-soft">None yet. Run a report to open it here.</p>
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-line">
              {mine.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <div>
                    <Link href={`/app/deliveries/${d.id}`} className="font-medium text-ink hover:text-forest-600">
                      {d.reportName}
                    </Link>
                    <div className="text-caption text-ink-faint">
                      {d.periodLabel ?? "Period"} · {d.deliveredAt ?? d.runAt}
                    </div>
                  </div>
                  <StatusBadge
                    intent={d.status === "delivered" ? "positive" : d.status === "failed" ? "critical" : "neutral"}
                    dot={false}
                  >
                    {d.status}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {isAdmin && (
        <p className="text-sm text-ink-soft">
          Schedule and audience live in{" "}
          <Link href="/app/admin/reports" className="font-medium text-forest-600 hover:text-forest-700">
            Admin → Automated Reporting
          </Link>
          .
        </p>
      )}
    </div>
  );
}
