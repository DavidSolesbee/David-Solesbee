import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/tenant/context";
import {
  getExecutiveDashboard,
  getRevenueDrilldown,
  type Kpi,
} from "@/lib/analytics";
import { perseusBriefing } from "@/lib/ai/service";
import { BriefingCard } from "@/components/ai/BriefingCard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/States";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/Table";
import {
  formatCurrency,
  formatNumber,
  formatHours,
  formatMonthLabel,
} from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const TONE_ACCENT: Record<string, string> = {
  revenue: "text-forest-600",
  margin: "text-sage-600",
  cost: "text-amber-600",
  service: "text-warm-blue-600",
  neutral: "text-ink",
};

function kpiValue(k: Kpi): string {
  if (k.format === "currency") return formatCurrency(k.value);
  if (k.format === "hours") return formatHours(k.value);
  return formatNumber(k.value);
}

export default async function ExecutiveDashboard({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const user = await getActiveContext();
  if (!user) redirect("/login");
  const dash = getExecutiveDashboard(user);
  const briefing = perseusBriefing(user);
  const sp = await searchParams;
  const drillYear = sp.year;
  const drill = drillYear ? getRevenueDrilldown(user, drillYear) : null;

  const maxYear = Math.max(1, ...dash.revenueByYear.map((y) => y.revenue));
  const maxDept = Math.max(
    1,
    ...(dash.revenueByDepartment?.map((d) => d.revenue) ?? [1]),
  );
  const maxMonth = Math.max(1, ...(drill?.months.map((m) => m.revenue) ?? [1]));

  return (
    <div className="space-y-8">
      {/* Header + scope banner */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <StatusBadge intent={dash.scope.allDepartments ? "info" : "attention"} dot={false}>
              {dash.scope.label}
            </StatusBadge>
            <span className="text-caption text-ink-faint">
              Data as of {dash.asOf.slice(0, 10)}
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
            Welcome, {user.firstName}.
          </h1>
          <p className="mt-1 text-sm font-medium text-ink">
            {user.activeOrganizationName}
          </p>
          <p className="mt-1 text-ink-soft">
            {dash.scope.allDepartments
              ? "Dealership-wide performance across all departments."
              : `Performance for the ${dash.scope.department} department. Your view is scoped to what you're authorized to see.`}
          </p>
        </div>
        <Link
          href="/app/account"
          className="rounded-lg border border-line-strong px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface-tinted hover:text-ink"
        >
          Your access
        </Link>
      </div>

      {briefing && <BriefingCard narrative={briefing.narrative} />}

      {/* KPI grid */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dash.kpis.map((k) => (
          <Card key={k.key} className="p-5">
            <div className="text-caption uppercase tracking-wide text-ink-faint">
              {k.label}
            </div>
            <div
              className={`mt-1 text-2xl font-semibold ${TONE_ACCENT[k.tone] ?? "text-ink"}`}
            >
              {kpiValue(k)}
            </div>
            {k.sublabel && (
              <div className="mt-1 text-caption text-ink-faint">{k.sublabel}</div>
            )}
          </Card>
        ))}
      </section>

      {!dash.canViewRevenue && (
        <Card className="p-6">
          <p className="text-sm text-ink-soft">
            Revenue figures are not part of your current permissions, so
            financial charts are hidden. You still see activity volume above.
          </p>
        </Card>
      )}

      {/* Revenue trend + drill-down */}
      {dash.canViewRevenue && dash.revenueByYear.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Revenue by year</CardTitle>
              <CardDescription>
                Select a year to drill into monthly detail. {dash.scope.label}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-56 items-end gap-2">
                {dash.revenueByYear.map((y) => {
                  const pct = Math.max(2, (y.revenue / maxYear) * 100);
                  const selected = drillYear === y.year;
                  return (
                    <Link
                      key={y.year}
                      href={`/app?year=${y.year}`}
                      scroll={false}
                      className="group flex h-full flex-1 flex-col items-center justify-end gap-2"
                      title={`${y.year}: ${formatCurrency(y.revenue)}`}
                    >
                      <span className="text-caption font-medium text-ink-soft opacity-0 transition-opacity group-hover:opacity-100">
                        {formatCurrency(y.revenue, true)}
                      </span>
                      <div
                        className={`w-full rounded-t-md transition-colors ${
                          selected
                            ? "bg-forest-600"
                            : "bg-sage-500 group-hover:bg-forest-500"
                        }`}
                        style={{ height: `${pct}%` }}
                      />
                      <span
                        className={`text-caption ${selected ? "font-semibold text-forest-700" : "text-ink-faint"}`}
                      >
                        {y.year}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Department split (cross-department users only) */}
          {dash.revenueByDepartment && (
            <Card>
              <CardHeader>
                <CardTitle>By department</CardTitle>
                <CardDescription>Share of posted revenue.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                {dash.revenueByDepartment.map((d) => (
                  <div key={d.department}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-ink">{d.department}</span>
                      <span className="text-ink-soft">
                        {formatCurrency(d.revenue, true)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
                      <div
                        className="h-full rounded-full bg-sage-500"
                        style={{ width: `${(d.revenue / maxDept) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Drill-down panel */}
      {drill && drill.canViewRevenue && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Monthly detail · {drill.year}</CardTitle>
                <CardDescription>
                  {formatCurrency(drill.total)} across {drill.months.length}{" "}
                  month{drill.months.length === 1 ? "" : "s"} · {dash.scope.label}.
                </CardDescription>
              </div>
              <Link
                href="/app"
                scroll={false}
                className="text-sm text-ink-soft hover:text-ink"
              >
                Close
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {drill.months.length === 0 ? (
              <EmptyState title="No activity" description={`No posted revenue in ${drill.year} for your scope.`} />
            ) : (
              <div className="flex h-44 items-end gap-1.5">
                {drill.months.map((m) => (
                  <div
                    key={m.month}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-1"
                    title={`${formatMonthLabel(m.month)}: ${formatCurrency(m.revenue)}`}
                  >
                    <div
                      className="w-full rounded-t bg-warm-blue-500"
                      style={{ height: `${Math.max(2, (m.revenue / maxMonth) * 100)}%` }}
                    />
                    <span className="text-caption text-ink-faint">
                      {m.month.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Top customers */}
      {dash.canViewRevenue && dash.topCustomers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top customers</CardTitle>
            <CardDescription>
              By posted revenue · {dash.scope.label}.
              {dash.contactsMasked &&
                " Customer identities are hidden for your role."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <tr>
                  <TH>#</TH>
                  <TH>Customer</TH>
                  <TH className="text-right">Revenue</TH>
                </tr>
              </THead>
              <TBody>
                {dash.topCustomers.map((c, i) => (
                  <TR key={c.customerId}>
                    <TD className="text-ink-faint">{i + 1}</TD>
                    <TD className="font-medium">{c.name}</TD>
                    <TD className="text-right tabular-nums text-ink">
                      {formatCurrency(c.revenue)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
