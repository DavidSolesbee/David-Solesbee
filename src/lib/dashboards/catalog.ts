import "server-only";
import type { AuthUser } from "@/lib/auth/authz";
import { resolveScope, type AnalyticsScope } from "@/lib/analytics/scope";
import {
  getScopedRevenue,
  getScopedInvoiceCount,
  getScopedActiveCustomers,
  getScopedRevenueByYear,
  getRevenueByDepartment,
  getPartsProfit,
  getInventorySnapshot,
  getServiceStats,
  getPaymentsTotal,
  getTopCustomers,
  getDataAsOf,
} from "@/lib/analytics/queries";
import { config } from "@/lib/config";
import { formatCurrency, formatNumber } from "@/lib/utils/format";

/**
 * Dashboard widget catalog.
 *
 * THE SECURITY BOUNDARY FOR DASHBOARDS. Each widget declares the permission it
 * requires and a resolver that runs against the *viewer's* scope. `resolve` is
 * only ever called after `isAuthorized(viewer)` passes, and every query is
 * scoped to the viewer — so a dashboard built by a privileged user can never
 * leak restricted measures to a less-privileged viewer. Widgets the viewer is
 * not entitled to are returned as { authorized: false } with no data.
 */

export type WidgetKind = "kpi" | "bars" | "list";

export interface WidgetRender {
  kind: WidgetKind;
  // kpi
  value?: string;
  tone?: string;
  sublabel?: string;
  // bars
  bars?: { year: string; value: number }[];
  // list
  items?: { label: string; value: number }[];
  format?: "currency" | "count" | "hours";
}

export interface WidgetDef {
  key: string;
  label: string;
  description: string;
  category: "Financial" | "Customers" | "Operations" | "Inventory";
  /** Permission required to VIEW this widget's data. null = any app user. */
  requiredPermission: string | null;
  kind: WidgetKind;
  isAuthorized: (user: AuthUser) => boolean;
  resolve: (user: AuthUser, scope: AnalyticsScope) => WidgetRender;
}

function has(user: AuthUser, perm: string | null): boolean {
  return perm === null ? true : user.permissions.has(perm);
}

export const WIDGETS: WidgetDef[] = [
  {
    key: "kpi.revenue",
    label: "Total Revenue",
    description: "Posted revenue within your scope.",
    category: "Financial",
    requiredPermission: "feature.view_revenue",
    kind: "kpi",
    isAuthorized: (u) => has(u, "feature.view_revenue"),
    resolve: (_u, scope) => ({
      kind: "kpi",
      tone: "revenue",
      value: formatCurrency(getScopedRevenue(scope)),
    }),
  },
  {
    key: "kpi.invoices",
    label: "Invoices",
    description: "Count of posted invoices in scope.",
    category: "Financial",
    requiredPermission: "feature.view_revenue",
    kind: "kpi",
    isAuthorized: (u) => has(u, "feature.view_revenue"),
    resolve: (_u, scope) => ({
      kind: "kpi",
      value: formatNumber(getScopedInvoiceCount(scope)),
    }),
  },
  {
    key: "kpi.active_customers",
    label: "Active Customers",
    description: "Distinct customers with activity in the last 12 months.",
    category: "Customers",
    requiredPermission: "feature.view_revenue",
    kind: "kpi",
    isAuthorized: (u) => has(u, "feature.view_revenue"),
    resolve: (_u, scope) => ({
      kind: "kpi",
      tone: "service",
      value: formatNumber(
        getScopedActiveCustomers(scope, getDataAsOf(scope) ?? config.dataAsOfFallback),
      ),
    }),
  },
  {
    key: "kpi.parts_margin",
    label: "Parts Gross Margin",
    description: "Parts revenue minus cost.",
    category: "Financial",
    requiredPermission: "feature.view_margin",
    kind: "kpi",
    isAuthorized: (u) => has(u, "feature.view_margin"),
    resolve: (_u, scope) => {
      const p = getPartsProfit(scope);
      return {
        kind: "kpi",
        tone: "margin",
        value: formatCurrency(p.margin),
        sublabel: p.revenue ? `${((p.margin / p.revenue) * 100).toFixed(1)}% of parts revenue` : undefined,
      };
    },
  },
  {
    key: "kpi.payments",
    label: "Payments Received",
    description: "Total payment receipts in scope.",
    category: "Financial",
    requiredPermission: "feature.view_payments",
    kind: "kpi",
    isAuthorized: (u) => has(u, "feature.view_payments"),
    resolve: (_u, scope) => ({
      kind: "kpi",
      tone: "revenue",
      value: formatCurrency(getPaymentsTotal(scope), true),
    }),
  },
  {
    key: "kpi.open_wo",
    label: "Open Work Orders",
    description: "Work orders not yet finalized.",
    category: "Operations",
    requiredPermission: "module.service",
    kind: "kpi",
    isAuthorized: (u) => has(u, "module.service"),
    resolve: (_u, scope) => ({
      kind: "kpi",
      tone: "service",
      value: formatNumber(getServiceStats(scope, false).openWorkOrders),
    }),
  },
  {
    key: "kpi.inventory_value",
    label: "Inventory Retail Value",
    description: "Retail value of equipment in stock.",
    category: "Inventory",
    requiredPermission: "module.inventory",
    kind: "kpi",
    isAuthorized: (u) => has(u, "module.inventory"),
    resolve: (_u, scope) => ({
      kind: "kpi",
      tone: "revenue",
      value: formatCurrency(getInventorySnapshot(scope).retailValue, true),
    }),
  },
  {
    key: "bars.revenue_by_year",
    label: "Revenue by Year",
    description: "Posted revenue trend within your scope.",
    category: "Financial",
    requiredPermission: "feature.view_revenue",
    kind: "bars",
    isAuthorized: (u) => has(u, "feature.view_revenue"),
    resolve: (_u, scope) => ({
      kind: "bars",
      format: "currency",
      bars: getScopedRevenueByYear(scope).map((r) => ({ year: r.year, value: r.revenue })),
    }),
  },
  {
    key: "split.revenue_by_department",
    label: "Revenue by Department",
    description: "Sales / Parts / Service split (cross-department only).",
    category: "Financial",
    requiredPermission: "data.cross_department",
    kind: "list",
    isAuthorized: (u) => has(u, "data.cross_department"),
    resolve: (_u, scope) => ({
      kind: "list",
      format: "currency",
      items: getRevenueByDepartment(scope).map((d) => ({ label: d.department, value: d.revenue })),
    }),
  },
  {
    key: "list.top_customers",
    label: "Top Customers",
    description: "Highest-revenue customers in scope (identities gated by contact permission).",
    category: "Customers",
    requiredPermission: "feature.view_revenue",
    kind: "list",
    isAuthorized: (u) => has(u, "feature.view_revenue"),
    resolve: (u, scope) => ({
      kind: "list",
      format: "currency",
      items: getTopCustomers(scope, u.permissions.has("feature.view_customer_contacts"), 8).map(
        (c) => ({ label: c.name, value: c.revenue }),
      ),
    }),
  },
];

const WIDGET_MAP = new Map(WIDGETS.map((w) => [w.key, w]));

export function getWidget(key: string): WidgetDef | undefined {
  return WIDGET_MAP.get(key);
}

export interface ResolvedWidget {
  key: string;
  label: string;
  description: string;
  category: string;
  kind: WidgetKind;
  authorized: boolean;
  render: WidgetRender | null;
}

/**
 * Resolve a widget for a specific VIEWER. Returns { authorized:false, render:null }
 * when the viewer lacks the required permission — no data is computed. This is
 * called for every widget on every dashboard render.
 */
export function resolveWidgetForViewer(key: string, viewer: AuthUser): ResolvedWidget | null {
  const def = WIDGET_MAP.get(key);
  if (!def) return null;
  const authorized = def.isAuthorized(viewer);
  const base = {
    key: def.key,
    label: def.label,
    description: def.description,
    category: def.category,
    kind: def.kind,
  };
  if (!authorized) return { ...base, authorized: false, render: null };
  const scope = resolveScope(viewer);
  return { ...base, authorized: true, render: def.resolve(viewer, scope) };
}
