import "server-only";
import type { AuthUser } from "@/lib/auth/authz";
import { resolveScope } from "@/lib/analytics/scope";
import { bindViewerTenant } from "@/lib/reports/resolve";
import { resolvePeriod, resolveComparison, type DateRange } from "@/lib/reports/periods";
import * as m from "@/lib/reports/metrics";
import { POSTED_STATUS_SQL, POSTED_DATE_SQL } from "@/lib/semantic/metrics";
import { queryForTenant } from "@/lib/db/dealership";

export interface ContributionRow {
  label: string;
  revenue: number;
  priorRevenue: number;
  priorYearRevenue: number;
  cost: number | null;
  grossProfit: number | null;
  href: string | null;
}

export interface ContributionStatement {
  asOf: string;
  periodLabel: string;
  comparisonLabel: string;
  rows: ContributionRow[];
  totalRevenue: number;
  totalCost: number | null;
  totalGp: number | null;
  methodology: string;
}

function access(user: AuthUser) {
  const bound = bindViewerTenant(user);
  const scope = resolveScope(bound);
  if (!scope.tenantId) return null;
  return {
    bound,
    scope,
    access: {
      userId: scope.userId,
      tenantId: scope.tenantId,
      platformViewAs: scope.platformViewAs,
    },
  };
}

function unitCostInRange(
  ctx: NonNullable<ReturnType<typeof access>>,
  range: DateRange,
): number {
  return (
    queryForTenant<{ c: number }>(
      ctx.access,
      `SELECT ROUND(SUM(su.InvoiceCost),2) AS c
       FROM SaleUnit su
       JOIN InvoiceDetail d ON d.ItemId = su.ItemId
       JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
       WHERE ${POSTED_STATUS_SQL}
         AND ${POSTED_DATE_SQL} >= ? AND ${POSTED_DATE_SQL} < date(?, '+1 day')`,
      [range.start, range.end],
    )[0]?.c ?? 0
  );
}

export function departmentalContribution(
  user: AuthUser,
  periodKey: "month_to_date" | "quarter_to_date" | "year_to_date" = "month_to_date",
): ContributionStatement | null {
  const ctx = access(user);
  if (!ctx) return null;
  const asOf = m.reportAsOf(ctx.scope);
  const period = resolvePeriod(periodKey, asOf);
  const prior = resolveComparison("previous_equivalent", period);
  const priorYear = resolveComparison("same_period_prior_year", period);
  const canCost = ctx.scope.canViewCost && ctx.scope.canViewMargin;

  const rev = m.departmentRevenueInRange(ctx.scope, period);
  const revPrior = m.departmentRevenueInRange(ctx.scope, prior);
  const revPy = m.departmentRevenueInRange(ctx.scope, priorYear);
  const parts = canCost
    ? m.partsInRange(ctx.scope, period, { canCost: true, canMargin: true })
    : null;
  const salesCost = canCost ? unitCostInRange(ctx, period) : null;

  const wanted = ctx.scope.allDepartments
    ? ["Sales", "Service", "Parts"]
    : ctx.scope.department
      ? [ctx.scope.department]
      : ["Sales", "Service", "Parts"];

  const hrefs: Record<string, string> = {
    Sales: "/app/sales",
    Service: "/app/service",
    Parts: "/app/parts",
  };

  const rows: ContributionRow[] = wanted.map((label) => {
    const revenue = rev.find((r) => r.label === label)?.value ?? 0;
    const priorRevenue = revPrior.find((r) => r.label === label)?.value ?? 0;
    const priorYearRevenue = revPy.find((r) => r.label === label)?.value ?? 0;
    let cost: number | null = null;
    if (canCost) {
      if (label === "Parts") cost = parts?.cost ?? 0;
      else if (label === "Sales") cost = salesCost;
      else cost = null;
    }
    const grossProfit = cost === null ? null : Math.round((revenue - cost) * 100) / 100;
    return {
      label,
      revenue,
      priorRevenue,
      priorYearRevenue,
      cost,
      grossProfit,
      href: hrefs[label] ?? null,
    };
  });

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const knownCosts = rows.map((r) => r.cost).filter((c): c is number => c !== null);
  const totalCost =
    canCost && knownCosts.length ? knownCosts.reduce((s, c) => s + c, 0) : null;
  const totalGp =
    totalCost === null ? null : Math.round((totalRevenue - totalCost) * 100) / 100;

  return {
    asOf,
    periodLabel: period.label,
    comparisonLabel: "Previous equivalent period and same period prior year",
    rows,
    totalRevenue,
    totalCost,
    totalGp,
    methodology:
      "Posted line revenue by ItemType (Sales UN/TR/RU/RE, Parts PA, Service SL). Identifiable COGS is SalePart.AvgCost for parts and SaleUnit.InvoiceCost for units. Service labor has no cost in this extract. This is an operating contribution, not a books P&L.",
  };
}
