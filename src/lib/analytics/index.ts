import "server-only";
import { config } from "@/lib/config";
import type { AuthUser } from "@/lib/auth/authz";
import { resolveScope, scopeLabel, type AnalyticsScope } from "@/lib/analytics/scope";
import * as q from "@/lib/analytics/queries";

/**
 * Executive analytics service — THE server-side security boundary for
 * dashboards and drill-downs.
 *
 * It resolves the caller's scope + feature gates and returns a DTO that
 * contains ONLY the data the user is authorized to see. Restricted measures
 * (cost, margin, payments, technician performance, customer identities) are
 * never computed or returned unless permitted. The UI renders whatever is in
 * the DTO; it can never widen access because unauthorized data is simply absent.
 */

export type KpiFormat = "currency" | "count" | "hours";
export type KpiTone = "revenue" | "neutral" | "margin" | "cost" | "service";

export interface Kpi {
  key: string;
  label: string;
  value: number;
  format: KpiFormat;
  tone: KpiTone;
  sublabel?: string;
}

export interface ExecutiveDashboard {
  asOf: string;
  scope: {
    label: string;
    allDepartments: boolean;
    department: string | null;
  };
  canViewRevenue: boolean;
  contactsMasked: boolean;
  kpis: Kpi[];
  revenueByYear: q.YearRevenue[];
  revenueByDepartment: q.DepartmentRevenue[] | null;
  topCustomers: q.TopCustomer[];
}

function isSalesish(scope: AnalyticsScope): boolean {
  return scope.allDepartments || scope.department === "Sales";
}
function isPartsish(scope: AnalyticsScope): boolean {
  return scope.allDepartments || scope.department === "Parts";
}
function isServiceish(scope: AnalyticsScope): boolean {
  return scope.allDepartments || scope.department === "Service";
}

export function getExecutiveDashboard(user: AuthUser): ExecutiveDashboard {
  const scope = resolveScope(user);
  const asOf = q.getDataAsOf() ?? config.dataAsOfFallback;
  const kpis: Kpi[] = [];

  // Revenue (gated)
  if (scope.canViewRevenue) {
    kpis.push({
      key: "revenue",
      label: "Posted Revenue",
      value: q.getScopedRevenue(scope),
      format: "currency",
      tone: "revenue",
      sublabel: scopeLabel(scope),
    });
  }

  // Volume — not sensitive
  kpis.push({
    key: "invoices",
    label: "Invoices",
    value: q.getScopedInvoiceCount(scope),
    format: "count",
    tone: "neutral",
  });
  kpis.push({
    key: "customers",
    label: "Active Customers",
    value: q.getScopedActiveCustomers(scope, asOf),
    format: "count",
    tone: "neutral",
    sublabel: "Trailing 12 months",
  });

  // Payments / receivables (gated)
  if (scope.canViewPayments) {
    kpis.push({
      key: "payments",
      label: "Payments Received",
      value: q.getPaymentsTotal(scope),
      format: "currency",
      tone: "neutral",
    });
  }

  // Parts profitability (gated by margin)
  if (scope.canViewMargin && isPartsish(scope)) {
    const p = q.getPartsProfit();
    kpis.push({
      key: "parts_margin",
      label: "Parts Margin (est.)",
      value: p.margin,
      format: "currency",
      tone: "margin",
      sublabel: "Estimated gross",
    });
    if (scope.canViewCost) {
      kpis.push({
        key: "parts_cost",
        label: "Parts Cost",
        value: p.cost,
        format: "currency",
        tone: "cost",
      });
    }
  }

  // Inventory (Sales-oriented)
  if (scope.canViewRevenue && isSalesish(scope)) {
    const inv = q.getInventorySnapshot();
    kpis.push({
      key: "inv_retail",
      label: "Inventory Retail Value",
      value: inv.retailValue,
      format: "currency",
      tone: "revenue",
      sublabel: `${inv.units} units in stock`,
    });
    if (scope.canViewCost) {
      kpis.push({
        key: "inv_cost",
        label: "Inventory Cost Value",
        value: inv.costValue,
        format: "currency",
        tone: "cost",
      });
    }
  }

  // Service (Service-oriented)
  if (isServiceish(scope)) {
    const svc = q.getServiceStats(scope.canViewTechnician);
    kpis.push({
      key: "open_wo",
      label: "Open Work Orders",
      value: svc.openWorkOrders,
      format: "count",
      tone: "service",
    });
    if (svc.technicianLaborHours !== null) {
      kpis.push({
        key: "tech_hours",
        label: "Technician Labor Hours",
        value: svc.technicianLaborHours,
        format: "hours",
        tone: "service",
      });
    }
  }

  return {
    asOf,
    scope: {
      label: scopeLabel(scope),
      allDepartments: scope.allDepartments,
      department: scope.department,
    },
    canViewRevenue: scope.canViewRevenue,
    contactsMasked: !scope.canViewContacts,
    kpis,
    revenueByYear: scope.canViewRevenue ? q.getScopedRevenueByYear(scope) : [],
    revenueByDepartment:
      scope.canViewRevenue && scope.allDepartments
        ? q.getRevenueByDepartment()
        : null,
    topCustomers: scope.canViewRevenue
      ? q.getTopCustomers(scope, scope.canViewContacts, 8)
      : [],
  };
}

export interface RevenueDrilldown {
  year: string;
  months: q.MonthRevenue[];
  total: number;
  canViewRevenue: boolean;
}

/** Drill-down: months within a year, fully scoped. Returns nothing sensitive
 * when the user lacks revenue permission. */
export function getRevenueDrilldown(
  user: AuthUser,
  year: string,
): RevenueDrilldown {
  const scope = resolveScope(user);
  if (!scope.canViewRevenue) {
    return { year, months: [], total: 0, canViewRevenue: false };
  }
  const months = q.getScopedRevenueByMonth(scope, year);
  const total = months.reduce((s, m) => s + (m.revenue ?? 0), 0);
  return { year, months, total: Math.round(total * 100) / 100, canViewRevenue: true };
}
