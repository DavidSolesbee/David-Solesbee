import Link from "next/link";
import { guardAccounting, auditAccounting } from "@/lib/accounting/guard";
import { ACCOUNTING_PERMS, accountingNav } from "@/lib/accounting/permissions";
import { getAccountingOverview, formatDelta } from "@/lib/accounting/metrics";
import { attentionFromSummary } from "@/lib/accounting/ar";
import { unavailable } from "@/lib/accounting/unavailable";
import { ModuleHeader, KpiCard, Section } from "@/components/analytics/Primitives";
import { Card } from "@/components/ui/Card";
import { formatCurrency, formatNumber } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function AccountingOverviewPage() {
  const user = await guardAccounting(ACCOUNTING_PERMS.overview);
  auditAccounting(user, "accounting.view", "overview");
  const data = getAccountingOverview(user);
  const attention =
    user.permissions.has(ACCOUNTING_PERMS.ar) && data?.ar
      ? attentionFromSummary(data.ar)
      : [];
  const canClose = user.permissions.has(ACCOUNTING_PERMS.close);
  const canHealth = user.permissions.has(ACCOUNTING_PERMS.health);

  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Accounting"
        subtitle="Financial visibility from posted operational data. Measures the source cannot support are marked unavailable — never shown as zero."
        scopeLabel={data?.scopeLabel ?? "Accounting"}
        crossDept
      />

      {data && (
        <>
          <p className="text-caption text-ink-faint">
            Posted activity as of {data.asOf}. Revenue uses finalized and archived
            invoices. Gross profit subtracts identifiable parts and unit cost only.
          </p>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.canRevenue ? (
              <KpiCard
                label="Revenue MTD"
                value={formatCurrency(data.mtd.revenue)}
                tone="revenue"
                sublabel={[
                  formatDelta(data.mtd.revenue, data.mtd.prior),
                  data.mtd.priorYear !== null
                    ? `${formatDelta(data.mtd.revenue, data.mtd.priorYear)?.replace("comparison", "prior year") ?? ""}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ) : (
              <KpiCard label="Revenue MTD" value="Withheld" sublabel="Requires view revenue" />
            )}
            {data.canProfit && data.mtd.grossProfit !== null ? (
              <KpiCard
                label="Gross Profit MTD"
                value={formatCurrency(data.mtd.grossProfit)}
                tone="margin"
                sublabel={
                  data.mtd.marginPct !== null
                    ? `${data.mtd.marginPct.toFixed(1)}% of identifiable COGS`
                    : undefined
                }
              />
            ) : (
              <KpiCard
                label="Gross Profit MTD"
                value="Withheld"
                sublabel="Requires cost and margin"
              />
            )}
            {data.canRevenue ? (
              <KpiCard
                label="Revenue QTD"
                value={formatCurrency(data.qtd.revenue)}
                sublabel={formatDelta(data.qtd.revenue, data.qtd.prior)}
              />
            ) : (
              <KpiCard label="Revenue QTD" value="Withheld" />
            )}
            {data.canRevenue ? (
              <KpiCard
                label="Revenue YTD"
                value={formatCurrency(data.ytd.revenue)}
                sublabel={formatDelta(data.ytd.revenue, data.ytd.priorYear)?.replace(
                  "comparison",
                  "prior year",
                )}
              />
            ) : (
              <KpiCard label="Revenue YTD" value="Withheld" />
            )}
            {data.ar ? (
              <KpiCard
                label="Accounts Receivable"
                value={formatCurrency(data.ar.openAr)}
                tone="attention"
                sublabel={`${formatNumber(data.ar.accountCount)} accounts · net ${formatCurrency(data.ar.net)}`}
              />
            ) : (
              <KpiCard
                label="Accounts Receivable"
                value="Withheld"
                sublabel="Requires view AR and payments"
              />
            )}
            <KpiCard
              label="Inventory Value"
              value={formatCurrency(
                data.canInventoryCost && data.inventoryCost !== null
                  ? data.inventoryCost
                  : data.inventoryRetail,
              )}
              sublabel={
                data.canInventoryCost && data.inventoryCost !== null
                  ? `${formatNumber(data.inventoryUnits)} in-stock units · cost`
                  : `${formatNumber(data.inventoryUnits)} in-stock units · retail`
              }
            />
            {(["opex", "cash", "ap"] as const).map((key) => {
              const u = unavailable(key);
              return (
                <Card key={key} className="p-5">
                  <div className="text-caption uppercase tracking-wide text-ink-faint">
                    {u.label}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-ink-soft">{u.reason}</div>
                  <div className="mt-1 text-caption text-ink-faint">{u.missing}</div>
                </Card>
              );
            })}
            {canClose ? (
              <Link href="/app/accounting/close" className="block">
                <Card className="p-5 hover:border-line-strong">
                  <div className="text-caption uppercase tracking-wide text-ink-faint">
                    Month-End Close
                  </div>
                  <div className="mt-1 text-lg font-semibold text-ink-soft">Partial</div>
                  <div className="mt-1 text-caption text-ink-faint">
                    Completion % not computed · open the close center
                  </div>
                </Card>
              </Link>
            ) : (
              <Card className="p-5">
                <div className="text-caption uppercase tracking-wide text-ink-faint">
                  {unavailable("close").label}
                </div>
                <div className="mt-1 text-lg font-semibold text-ink-soft">
                  {unavailable("close").reason}
                </div>
                <div className="mt-1 text-caption text-ink-faint">{unavailable("close").missing}</div>
              </Card>
            )}
            {canHealth ? (
              <Link href="/app/accounting/health" className="block">
                <Card className="p-5 hover:border-line-strong">
                  <div className="text-caption uppercase tracking-wide text-ink-faint">
                    Accounting Health
                  </div>
                  <div className="mt-1 text-lg font-semibold text-ink-soft">Partial</div>
                  <div className="mt-1 text-caption text-ink-faint">
                    Not a complete score · open health for the breakdown
                  </div>
                </Card>
              </Link>
            ) : (
              <Card className="p-5">
                <div className="text-caption uppercase tracking-wide text-ink-faint">
                  {unavailable("health").label}
                </div>
                <div className="mt-1 text-lg font-semibold text-ink-soft">
                  {unavailable("health").reason}
                </div>
                <div className="mt-1 text-caption text-ink-faint">{unavailable("health").missing}</div>
              </Card>
            )}
          </section>
        </>
      )}

      {accountingNav(user).some((l) => l.soon) && (
        <Section
          title="Coming in a newer release"
          description="These areas are reserved in Accounting so the module is complete. They will not show sample figures."
        >
          <ul className="divide-y divide-line">
            {accountingNav(user)
              .filter((l) => l.soon)
              .map((l) => (
                <li key={l.href} className="py-3">
                  <Link href={l.href} className="block hover:text-forest-700">
                    <span className="font-medium text-ink">{l.label}</span>
                    <p className="mt-1 text-caption text-ink-faint">
                      Placeholder page — marked coming in a newer release
                    </p>
                  </Link>
                </li>
              ))}
          </ul>
        </Section>
      )}

      <Section
        title="Items requiring attention"
        description={
          user.permissions.has(ACCOUNTING_PERMS.exceptions)
            ? "Only conditions we can evaluate from this extract. The Exception Center has the full live list plus rules that cannot be evaluated."
            : "Only conditions we can evaluate from this extract. Each item shows the rule that triggered it."
        }
      >
        {user.permissions.has(ACCOUNTING_PERMS.exceptions) && (
          <p className="mb-3 text-sm">
            <Link href="/app/accounting/exceptions" className="font-medium text-forest-600 hover:text-forest-700">
              Open exception center →
            </Link>
          </p>
        )}
        {attention.length === 0 ? (
          <p className="text-sm text-ink-soft">
            No receivable exceptions in your current scope — or AR is not authorized.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {attention.map((a) => (
              <li key={a.key} className="py-3">
                <Link href={a.href} className="block hover:text-forest-700">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-ink">{a.title}</span>
                    {a.amount !== undefined && (
                      <span className="tabular-nums text-ink-soft">
                        {formatCurrency(a.amount)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-caption text-ink-faint">Rule: {a.rule}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
