import "server-only";
import type { AuthUser } from "@/lib/auth/authz";
import { resolveScope } from "@/lib/analytics/scope";
import { bindViewerTenant } from "@/lib/reports/resolve";
import { resolvePeriod, resolveComparison, type DateRange } from "@/lib/reports/periods";
import * as m from "@/lib/reports/metrics";
import { POSTED_STATUS_SQL, POSTED_DATE_SQL } from "@/lib/semantic/metrics";
import { queryForTenant, type TenantAccess } from "@/lib/db/dealership";
import { getArSummary, type ArSummary } from "@/lib/accounting/ar";

export interface PeriodPoint {
  label: string;
  revenue: number;
  prior: number | null;
  priorYear: number | null;
  cost: number | null;
  grossProfit: number | null;
  marginPct: number | null;
}

export interface AccountingOverview {
  asOf: string;
  scopeLabel: string;
  canRevenue: boolean;
  canProfit: boolean;
  canInventoryCost: boolean;
  mtd: PeriodPoint;
  qtd: PeriodPoint;
  ytd: PeriodPoint;
  inventoryRetail: number;
  inventoryCost: number | null;
  inventoryUnits: number;
  ar: ArSummary | null;
}

function accessOf(user: AuthUser): TenantAccess | null {
  const bound = bindViewerTenant(user);
  const scope = resolveScope(bound);
  if (!scope.tenantId) return null;
  return {
    userId: scope.userId,
    tenantId: scope.tenantId,
    platformViewAs: scope.platformViewAs,
  };
}

function deltaPct(current: number, prior: number | null): number | null {
  if (prior === null || !prior) return prior === 0 && current === 0 ? 0 : null;
  return Math.round(((current - prior) / Math.abs(prior)) * 1000) / 10;
}

export function formatDelta(current: number, prior: number | null): string | undefined {
  const pct = deltaPct(current, prior);
  if (pct === null) return undefined;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}% vs comparison`;
}

function identifiableCogs(user: AuthUser, range: DateRange): number | null {
  const bound = bindViewerTenant(user);
  const scope = resolveScope(bound);
  const access = accessOf(bound);
  if (!access || !scope.canViewCost || !scope.canViewMargin) return null;

  const parts = m.partsInRange(scope, range, { canCost: true, canMargin: true });
  const unitCost =
    queryForTenant<{ c: number }>(
      access,
      `SELECT ROUND(SUM(su.InvoiceCost),2) AS c
       FROM SaleUnit su
       JOIN InvoiceDetail d ON d.ItemId = su.ItemId
       JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
       WHERE ${POSTED_STATUS_SQL}
         AND ${POSTED_DATE_SQL} >= ? AND ${POSTED_DATE_SQL} < date(?, '+1 day')`,
      [range.start, range.end],
    )[0]?.c ?? 0;

  return Math.round(((parts.cost ?? 0) + unitCost) * 100) / 100;
}

function point(user: AuthUser, range: DateRange, label: string): PeriodPoint {
  const bound = bindViewerTenant(user);
  const scope = resolveScope(bound);
  const prior = resolveComparison("previous_equivalent", range);
  const priorYear = resolveComparison("same_period_prior_year", range);
  const revenue = scope.canViewRevenue ? m.revenueInRange(scope, range) : 0;
  const priorRev = scope.canViewRevenue ? m.revenueInRange(scope, prior) : null;
  const pyRev = scope.canViewRevenue ? m.revenueInRange(scope, priorYear) : null;
  const cost = identifiableCogs(user, range);
  const grossProfit = cost === null ? null : Math.round((revenue - cost) * 100) / 100;
  const marginPct =
    grossProfit === null || !revenue
      ? null
      : Math.round((grossProfit / revenue) * 1000) / 10;
  return {
    label,
    revenue,
    prior: priorRev,
    priorYear: pyRev,
    cost,
    grossProfit,
    marginPct,
  };
}

export function getAccountingOverview(user: AuthUser): AccountingOverview | null {
  const bound = bindViewerTenant(user);
  const scope = resolveScope(bound);
  if (!accessOf(bound)) return null;
  const asOf = m.reportAsOf(scope);
  const mtd = resolvePeriod("month_to_date", asOf);
  const qtd = resolvePeriod("quarter_to_date", asOf);
  const ytd = resolvePeriod("year_to_date", asOf);
  const inv = m.inventorySnapshot(scope, scope.canViewCost);
  return {
    asOf,
    scopeLabel: scope.allDepartments
      ? "All departments"
      : `${scope.department ?? "Limited"} department`,
    canRevenue: scope.canViewRevenue,
    canProfit: scope.canViewCost && scope.canViewMargin,
    canInventoryCost: scope.canViewCost,
    mtd: point(user, mtd, mtd.label),
    qtd: point(user, qtd, qtd.label),
    ytd: point(user, ytd, ytd.label),
    inventoryRetail: inv.retail,
    inventoryCost: inv.cost,
    inventoryUnits: inv.units,
    ar:
      user.permissions.has("feature.view_ar") && scope.canViewPayments
        ? getArSummary(user)
        : null,
  };
}

export { deltaPct };
