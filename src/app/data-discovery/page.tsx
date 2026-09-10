import { AppShell } from "@/components/shell/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { BarChart } from "@/components/charts/BarChart";
import { buildDiscoveryReport } from "@/lib/discovery";
import { computeMetricSnapshot, METRICS } from "@/lib/semantic";

// Always read fresh from the read-only database on the server.
export const dynamic = "force-dynamic";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const num = (n: number) => n.toLocaleString("en-US");

export default function DataDiscoveryPage() {
  const report = buildDiscoveryReport();
  const snapshot = computeMetricSnapshot();

  return (
    <AppShell active="discovery">
      <div className="space-y-10">
        <header>
          <StatusBadge intent="info">Read-only · Milestone 1</StatusBadge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">
            Data Discovery
          </h1>
          <p className="mt-2 max-w-2xl text-ink-soft">
            Live introspection of{" "}
            <span className="font-medium text-ink">
              perseus_equipment_database.db
            </span>{" "}
            ({report.totalTables} tables), opened strictly read-only. These
            numbers are produced by the semantic layer and match{" "}
            <span className="font-medium text-ink">npm run discover</span>.
          </p>
          <p className="mt-1 text-caption text-ink-faint">
            Data as of {snapshot.dataAsOf ?? "unknown"} — relative periods are
            anchored to this date, not the server clock.
          </p>
        </header>

        {/* Validated semantic snapshot */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-faint">
            Validated semantic metrics
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Posted Revenue"
              value={money(snapshot.postedRevenue)}
              explanation={METRICS.postedRevenue.description}
            />
            <Stat
              label="Invoice Count"
              value={num(snapshot.invoiceCount)}
              explanation={METRICS.invoiceCount.description}
            />
            <Stat
              label="Avg Invoice"
              value={money(snapshot.averageInvoiceValue)}
              explanation={METRICS.averageInvoiceValue.description}
            />
            <Stat
              label="Active Customers"
              value={num(snapshot.activeCustomers)}
              explanation={METRICS.activeCustomers.description}
            />
            <Stat
              label="Parts Revenue"
              value={money(snapshot.partsRevenue)}
              explanation={METRICS.partsRevenue.description}
            />
            <Stat
              label="Inventory (units)"
              value={num(snapshot.inventory.units)}
              explanation={METRICS.inventoryRetailValue.description}
            />
            <Stat
              label="Open Work Orders"
              value={num(snapshot.openWorkOrders)}
              explanation={METRICS.openWorkOrders.description}
            />
            <Stat
              label="Technician Hours"
              value={num(Math.round(snapshot.technicianLaborHours))}
              explanation={METRICS.technicianLaborHours.description}
            />
          </div>
        </section>

        {/* Revenue by year */}
        <Card>
          <CardHeader>
            <CardTitle>Posted revenue by year</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={snapshot.revenueByYear
                .filter((r) => r.year >= "2017")
                .map((r) => ({ label: r.year, value: r.revenue }))}
              format={(n) => `$${(n / 1_000_000).toFixed(1)}M`}
            />
          </CardContent>
        </Card>

        {/* Core tables */}
        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Core tables confirmed</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <Table>
                <THead>
                  <TR>
                    <TH>Table</TH>
                    <TH className="text-right">Rows</TH>
                    <TH className="text-right">Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {report.coreTables.map((t) => (
                    <TR key={t.table}>
                      <TD className="font-medium">{t.table}</TD>
                      <TD className="text-right tabular-nums">
                        {num(t.rowCount)}
                      </TD>
                      <TD className="text-right">
                        <StatusBadge intent={t.exists ? "positive" : "critical"}>
                          {t.exists ? "Confirmed" : "Missing"}
                        </StatusBadge>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Invoice status distribution</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <Table>
                  <THead>
                    <TR>
                      <TH>Status</TH>
                      <TH className="text-right">Count</TH>
                      <TH className="text-right">Posted?</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {report.invoiceStatus.map((s) => {
                      const posted =
                        s.value === "finalized" || s.value === "archived";
                      return (
                        <TR key={s.value}>
                          <TD className="font-medium">{s.value}</TD>
                          <TD className="text-right tabular-nums">
                            {num(s.count)}
                          </TD>
                          <TD className="text-right">
                            <StatusBadge
                              intent={posted ? "positive" : "neutral"}
                              dot={false}
                            >
                              {posted ? "Revenue" : "Excluded"}
                            </StatusBadge>
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Date ranges</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-2 text-sm">
                {report.dateRanges.map((d) => (
                  <div
                    key={d.label}
                    className="flex items-center justify-between border-b border-line pb-2 last:border-0"
                  >
                    <span className="text-ink-soft">{d.label}</span>
                    <span className="tabular-nums text-ink">
                      {(d.min ?? "—").slice(0, 10)} → {(d.max ?? "—").slice(0, 10)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Lookups */}
        <Card>
          <CardHeader>
            <CardTitle>Confirmed lookup values</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 pt-2 sm:grid-cols-2 lg:grid-cols-3">
            {report.lookups.map((l) => (
              <div key={l.label}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">
                    {l.label}
                  </span>
                  <StatusBadge intent="neutral" dot={false}>
                    {l.count}
                  </StatusBadge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {l.samples.map((s) => (
                    <span
                      key={s}
                      className="rounded-md bg-surface-sunken px-2 py-0.5 text-caption text-ink-soft"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Full table overview */}
        <Card>
          <CardHeader>
            <CardTitle>All {report.totalTables} tables</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <Table>
              <THead>
                <TR>
                  <TH>Table</TH>
                  <TH className="text-right">Columns</TH>
                  <TH className="text-right">Rows</TH>
                </TR>
              </THead>
              <TBody>
                {report.tableOverview.map((t) => (
                  <TR key={t.name}>
                    <TD className="font-medium">{t.name}</TD>
                    <TD className="text-right tabular-nums text-ink-soft">
                      {t.columnCount}
                    </TD>
                    <TD className="text-right tabular-nums">{num(t.rowCount)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
