import Link from "next/link";
import { guardAccounting, auditAccounting } from "@/lib/accounting/guard";
import { ACCOUNTING_PERMS } from "@/lib/accounting/permissions";
import { departmentalContribution } from "@/lib/accounting/statements";
import { unavailable } from "@/lib/accounting/unavailable";
import { ModuleHeader, Section } from "@/components/analytics/Primitives";
import { Card } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { formatCurrency } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function StatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await guardAccounting(ACCOUNTING_PERMS.statements);
  auditAccounting(user, "accounting.statements_viewed");
  const sp = await searchParams;
  const period =
    sp.period === "quarter_to_date" || sp.period === "year_to_date"
      ? sp.period
      : "month_to_date";
  const stmt = departmentalContribution(user, period);

  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Financial statements"
        subtitle="Departmental operating contribution from posted invoices. This is not a books P&L — there is no general ledger in the extract."
        scopeLabel={stmt?.periodLabel ?? "Statements"}
        crossDept
      />

      <div className="flex flex-wrap gap-2 text-sm">
        {(
          [
            ["month_to_date", "Month to date"],
            ["quarter_to_date", "Quarter to date"],
            ["year_to_date", "Year to date"],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={`/app/accounting/statements?period=${key}`}
            className={`rounded-md px-3 py-1.5 ${
              period === key
                ? "bg-surface font-medium text-forest-600 shadow-subtle"
                : "text-ink-soft hover:bg-surface-tinted"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {stmt && (
        <Section
          title="Departmental operating contribution"
          description={`${stmt.comparisonLabel}. As of ${stmt.asOf}.`}
        >
          <Table>
            <THead>
              <TR>
                <TH>Department</TH>
                <TH className="text-right">Revenue</TH>
                <TH className="text-right">vs prior</TH>
                <TH className="text-right">vs prior year</TH>
                <TH className="text-right">Identifiable COGS</TH>
                <TH className="text-right">Contribution</TH>
              </TR>
            </THead>
            <TBody>
              {stmt.rows.map((r) => (
                <TR key={r.label}>
                  <TD>
                    {r.href ? (
                      <Link href={r.href} className="text-forest-600 hover:text-forest-700">
                        {r.label}
                      </Link>
                    ) : (
                      r.label
                    )}
                  </TD>
                  <TD className="text-right tabular-nums">{formatCurrency(r.revenue)}</TD>
                  <TD className="text-right tabular-nums text-ink-soft">
                    {formatCurrency(r.priorRevenue)}
                  </TD>
                  <TD className="text-right tabular-nums text-ink-soft">
                    {formatCurrency(r.priorYearRevenue)}
                  </TD>
                  <TD className="text-right tabular-nums text-ink-soft">
                    {r.cost === null ? "Not in source" : formatCurrency(r.cost)}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {r.grossProfit === null ? "—" : formatCurrency(r.grossProfit)}
                  </TD>
                </TR>
              ))}
              <TR>
                <TD className="font-semibold">Total</TD>
                <TD className="text-right font-semibold tabular-nums">
                  {formatCurrency(stmt.totalRevenue)}
                </TD>
                <TD />
                <TD />
                <TD className="text-right tabular-nums text-ink-soft">
                  {stmt.totalCost === null ? "Partial" : formatCurrency(stmt.totalCost)}
                </TD>
                <TD className="text-right font-semibold tabular-nums">
                  {stmt.totalGp === null ? "—" : formatCurrency(stmt.totalGp)}
                </TD>
              </TR>
            </TBody>
          </Table>
          <p className="mt-4 text-caption text-ink-faint">{stmt.methodology}</p>
        </Section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {(["balance_sheet", "cash_flow"] as const).map((key) => {
          const u = unavailable(key);
          return (
            <Card key={key} className="p-5">
              <div className="text-sm font-semibold text-ink">{u.label}</div>
              <p className="mt-1 text-sm text-ink-soft">{u.reason}</p>
              <p className="mt-1 text-caption text-ink-faint">{u.missing}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
