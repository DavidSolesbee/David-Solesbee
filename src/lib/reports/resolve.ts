import "server-only";
import type { AuthUser } from "@/lib/auth/authz";
import { resolveScope, scopeLabel } from "@/lib/analytics/scope";
import { listUserOrganizations } from "@/lib/tenant/organizations";
import { formatCurrency, formatNumber } from "@/lib/utils/format";
import {
  SECTIONS,
  getSection,
  type SectionBand,
  type SectionKey,
} from "@/lib/reports/catalog";
import type { DateRange } from "@/lib/reports/periods";
import * as m from "@/lib/reports/metrics";
import { resolveAccountingReportSection } from "@/lib/accounting/report-sections";
import { listAccountingExceptions } from "@/lib/accounting/exceptions";

/**
 * Per-recipient section resolution — the reporting security boundary.
 *
 * `resolveSectionForViewer` is only allowed to compute data AFTER the viewer's
 * current permissions pass. Unauthorized sections return `{ authorized:false }`
 * with no figures. Never generate an unrestricted pack and filter afterward.
 */

export interface ReportKpi {
  label: string;
  value: string;
  raw?: number;
  delta?: number | null;
  deltaLabel?: string;
  tone?: "revenue" | "cost" | "margin" | "service" | "attention";
}

export interface ResolvedSection {
  key: SectionKey;
  label: string;
  description: string;
  band: SectionBand;
  authorized: boolean;
  kpis?: ReportKpi[];
  narrative?: string;
  bars?: { label: string; value: number }[];
  items?: { label: string; value: number; format?: "currency" | "count" | "hours" }[];
  alerts?: { severity: "info" | "attention" | "critical"; text: string }[];
  methodology?: string;
}

export interface ResolveContext {
  period: DateRange;
  comparison: DateRange;
  topN: number;
  asOf: string;
}

function has(user: AuthUser, perm: string | null): boolean {
  return perm === null ? true : user.permissions.has(perm);
}

/** Bind the viewer's primary (validated) tenant so dealership queries may run. */
export function bindViewerTenant(user: AuthUser): AuthUser {
  const existing = user as AuthUser & { activeTenantId?: string };
  if (existing.activeTenantId) return user;
  const org = listUserOrganizations(user.id)[0];
  if (!org) return user;
  return Object.assign({}, user, {
    activeTenantId: org.tenantId,
    activeOrganizationId: org.id,
  });
}

function deltaPct(current: number, prior: number): number | null {
  if (!prior && !current) return 0;
  if (!prior) return null;
  return Math.round(((current - prior) / Math.abs(prior)) * 1000) / 10;
}

function deltaLabel(pct: number | null): string | undefined {
  if (pct === null) return "n/a vs comparison";
  if (pct === 0) return "unchanged vs comparison";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}% vs comparison`;
}

function kpi(
  label: string,
  value: string,
  raw: number,
  prior: number | null,
  tone?: ReportKpi["tone"],
): ReportKpi {
  const pct = prior === null ? null : deltaPct(raw, prior);
  return { label, value, raw, delta: pct, deltaLabel: prior === null ? undefined : deltaLabel(pct), tone };
}

export function resolveSectionForViewer(
  key: string,
  viewer: AuthUser,
  ctx: ResolveContext,
): ResolvedSection | null {
  const def = getSection(key);
  if (!def) return null;
  viewer = bindViewerTenant(viewer);
  const authorized = has(viewer, def.requiredPermission);
  const base = {
    key: def.key,
    label: def.label,
    description: def.description,
    band: def.band,
  };
  if (!authorized) return { ...base, authorized: false };

  const scope = resolveScope(viewer);
  const { period, comparison, topN, asOf } = ctx;

  switch (def.key) {
    case "executive_summary":
      return {
        ...base,
        authorized: true,
        narrative: buildSummary(viewer, ctx),
        methodology: `Deterministic briefing from authorized measures only. Period ${period.label}. Scope: ${scopeLabel(scope)}.`,
      };

    case "kpi_scorecard": {
      const kpis: ReportKpi[] = [];
      if (scope.canViewRevenue) {
        const cur = m.revenueInRange(scope, period);
        const prior = m.revenueInRange(scope, comparison);
        kpis.push(kpi("Revenue", formatCurrency(cur), cur, prior, "revenue"));
        const inv = m.invoicesInRange(scope, period);
        kpis.push(kpi("Invoices", formatNumber(inv), inv, m.invoicesInRange(scope, comparison)));
        const cust = m.customersInRange(scope, period);
        kpis.push(
          kpi("Active customers", formatNumber(cust), cust, m.customersInRange(scope, comparison), "service"),
        );
      }
      if (viewer.permissions.has("module.service")) {
        const open = m.openWorkOrders(scope);
        kpis.push({ label: "Open work orders", value: formatNumber(open), raw: open, tone: "service" });
      }
      if (scope.canViewPayments) {
        const pay = m.paymentsInRange(scope, period);
        kpis.push(
          kpi("Payments", formatCurrency(pay), pay, m.paymentsInRange(scope, comparison), "revenue"),
        );
      }
      return {
        ...base,
        authorized: true,
        kpis,
        methodology: "Posted invoices only (finalized/archived). Comparison uses the selected prior period.",
      };
    }

    case "revenue_trend": {
      if (!scope.canViewRevenue) return { ...base, authorized: false };
      return {
        ...base,
        authorized: true,
        bars: m.trendInRange(scope, period),
        methodology: "Posted revenue grouped by day or month depending on period length.",
      };
    }

    case "business_pulse": {
      if (!viewer.permissions.has("data.cross_department")) return { ...base, authorized: false };
      const cur = m.departmentRevenueInRange(scope, period);
      const prior = m.departmentRevenueInRange(scope, comparison);
      return {
        ...base,
        authorized: true,
        items: cur.map((d) => ({ label: d.label, value: d.value, format: "currency" })),
        kpis: cur.map((d) =>
          kpi(
            d.label,
            formatCurrency(d.value),
            d.value,
            prior.find((p) => p.label === d.label)?.value ?? 0,
            "revenue",
          ),
        ),
        methodology: "Line revenue by ItemType: Sales UN/TR/RU/RE, Parts PA, Service SL.",
      };
    }

    case "customer_opportunities": {
      if (!scope.canViewRevenue) return { ...base, authorized: false };
      const top = m.topCustomersInRange(scope, scope.canViewContacts, period, topN);
      const quiet = m.inactiveCustomers(scope, scope.canViewContacts, asOf, 90, topN);
      return {
        ...base,
        authorized: true,
        items: top.map((c) => ({ ...c, format: "currency" })),
        alerts: quiet.slice(0, 5).map((c) => ({
          severity: "attention" as const,
          text: `${c.label} — no purchase in 90+ days`,
        })),
        methodology: scope.canViewContacts
          ? "Customer names shown. Quiet accounts last purchased 90–365 days ago."
          : "Customer identities masked. Quiet accounts last purchased 90–365 days ago.",
      };
    }

    case "parts_performance": {
      if (!viewer.permissions.has("module.parts")) return { ...base, authorized: false };
      const cur = m.partsInRange(scope, period, {
        canCost: scope.canViewCost,
        canMargin: scope.canViewMargin,
      });
      const prior = m.partsInRange(scope, comparison, {
        canCost: scope.canViewCost,
        canMargin: scope.canViewMargin,
      });
      const kpis: ReportKpi[] = [
        kpi("Parts revenue", formatCurrency(cur.revenue), cur.revenue, prior.revenue, "revenue"),
      ];
      if (cur.margin !== null && prior.margin !== null) {
        kpis.push(kpi("Parts margin", formatCurrency(cur.margin), cur.margin, prior.margin, "margin"));
      }
      if (cur.cost !== null) {
        kpis.push({ label: "Parts cost", value: formatCurrency(cur.cost), raw: cur.cost, tone: "cost" });
      }
      return {
        ...base,
        authorized: true,
        kpis,
        methodology: "SalePart.NetExt for revenue; Qty × AvgCost for cost when authorized.",
      };
    }

    case "inventory_aging": {
      if (!viewer.permissions.has("module.inventory")) return { ...base, authorized: false };
      const snap = m.inventorySnapshot(scope, scope.canViewCost);
      const kpis: ReportKpi[] = [
        { label: "Units in stock", value: formatNumber(snap.units), raw: snap.units },
        { label: "Retail value", value: formatCurrency(snap.retail), raw: snap.retail, tone: "revenue" },
      ];
      if (snap.cost !== null) {
        kpis.push({ label: "Cost value", value: formatCurrency(snap.cost), raw: snap.cost, tone: "cost" });
      }
      return {
        ...base,
        authorized: true,
        kpis,
        items: snap.aging.map((a) => ({ ...a, format: "count" })),
        methodology: "Point-in-time in-stock units. Age from DateReceived / DatePurchased / EntDate.",
      };
    }

    case "service_performance": {
      if (!viewer.permissions.has("module.service")) return { ...base, authorized: false };
      const labor = m.serviceLaborInRange(scope, period);
      const prior = m.serviceLaborInRange(scope, comparison);
      const open = m.openWorkOrders(scope);
      const aging = m.workOrderAging(scope, asOf);
      const kpis: ReportKpi[] = [
        kpi("Service labor", formatCurrency(labor.revenue), labor.revenue, prior.revenue, "service"),
        kpi("Posted WOs", formatNumber(labor.workOrders), labor.workOrders, prior.workOrders, "service"),
        { label: "Open work orders", value: formatNumber(open), raw: open, tone: "service" },
      ];
      const items: { label: string; value: number; format: "count" | "hours" }[] =
        aging.map((a) => ({ ...a, format: "count" as const }));
      if (scope.canViewTechnician) {
        for (const t of m.technicianWorkload(scope)) {
          items.push({ label: t.label, value: t.value, format: "hours" as const });
        }
      }
      return {
        ...base,
        authorized: true,
        kpis,
        items,
        methodology: "Open WOs exclude finalized/archived/voided. Technician hours only when authorized.",
      };
    }

    case "accounting_snapshot":
    case "accounting_receivable":
    case "accounting_contribution":
    case "accounting_exceptions":
    case "accounting_close":
    case "accounting_health":
    case "accounting_gaps":
      return resolveAccountingReportSection(def, viewer, ctx);

    case "needs_attention":
      return {
        ...base,
        authorized: true,
        alerts: buildAlerts(viewer, ctx),
        methodology: "Exceptions derived only from measures this recipient is authorized to see.",
      };

    case "detail_tables":
      return {
        ...base,
        authorized: true,
        items: buildDetails(viewer, ctx),
        methodology:
          "Supporting ranks use the same posted-revenue definitions as the executive analytics layer.",
      };
  }
}

function buildSummary(viewer: AuthUser, ctx: ResolveContext): string {
  const scope = resolveScope(viewer);
  const parts: string[] = [];
  if (scope.canViewRevenue) {
    const cur = m.revenueInRange(scope, ctx.period);
    const prior = m.revenueInRange(scope, ctx.comparison);
    const pct = deltaPct(cur, prior);
    const move =
      pct === null
        ? "no prior-period baseline"
        : pct === 0
          ? "unchanged versus the comparison period"
          : `${pct > 0 ? "up" : "down"} ${Math.abs(pct).toFixed(1)}% versus the comparison period`;
    parts.push(`Posted revenue was ${formatCurrency(cur)}, ${move}.`);
  }
  if (viewer.permissions.has("module.service")) {
    const open = m.openWorkOrders(scope);
    const aging = m.workOrderAging(scope, ctx.asOf);
    const stale = aging.find((a) => a.label === "15+ days")?.value ?? 0;
    parts.push(
      `${formatNumber(open)} work orders are open` +
        (stale ? `, ${formatNumber(stale)} of them aging past 15 days` : "") +
        ".",
    );
  }
  if (scope.canViewRevenue) {
    const quiet = m.inactiveCustomers(scope, scope.canViewContacts, ctx.asOf, 90, 4);
    if (quiet.length) {
      parts.push(
        `${quiet.length} previously active customer${quiet.length === 1 ? "" : "s"} recorded no purchase in the past 90 days.`,
      );
    }
  }
  if (viewer.permissions.has("module.inventory")) {
    const aged = m.inventorySnapshot(scope, false).aging.find((a) => a.label === "365+ days");
    if (aged && aged.value > 0) {
      parts.push(`${formatNumber(aged.value)} in-stock units have been on the lot more than a year.`);
    }
  }
  if (!parts.length) {
    return "No authorized performance measures are available for this recipient in the selected period.";
  }
  return parts.join(" ");
}

function buildAlerts(viewer: AuthUser, ctx: ResolveContext): ResolvedSection["alerts"] {
  const scope = resolveScope(viewer);
  const alerts: NonNullable<ResolvedSection["alerts"]> = [];
  if (viewer.permissions.has("module.service")) {
    const stale = m.workOrderAging(scope, ctx.asOf).find((a) => a.label === "15+ days")?.value ?? 0;
    if (stale > 0) {
      alerts.push({
        severity: "critical",
        text: `${formatNumber(stale)} work orders have been open 15+ days.`,
      });
    }
    const open = m.openWorkOrders(scope);
    if (open > 0) {
      alerts.push({
        severity: "info",
        text: `${formatNumber(open)} work orders are currently open.`,
      });
    }
  }
  if (viewer.permissions.has("module.inventory")) {
    const aged = m.inventorySnapshot(scope, false).aging.find((a) => a.label === "365+ days")?.value ?? 0;
    if (aged > 0) {
      alerts.push({
        severity: "attention",
        text: `${formatNumber(aged)} units have been in stock longer than 365 days.`,
      });
    }
  }
  if (scope.canViewRevenue) {
    const quiet = m.inactiveCustomers(scope, scope.canViewContacts, ctx.asOf, 90, 3);
    for (const q of quiet) {
      alerts.push({ severity: "attention", text: `Quiet account: ${q.label}` });
    }
  }
  if (
    viewer.permissions.has("module.accounting") &&
    viewer.permissions.has("feature.view_exceptions")
  ) {
    for (const e of listAccountingExceptions(viewer).slice(0, 4)) {
      alerts.push({ severity: e.severity, text: e.title });
    }
  }
  if (!alerts.length) {
    alerts.push({
      severity: "info",
      text: "No material exceptions in the authorized scope for this period.",
    });
  }
  return alerts;
}

function buildDetails(viewer: AuthUser, ctx: ResolveContext): NonNullable<ResolvedSection["items"]> {
  const scope = resolveScope(viewer);
  const items: NonNullable<ResolvedSection["items"]> = [];
  if (scope.canViewRevenue) {
    for (const c of m.topCustomersInRange(scope, scope.canViewContacts, ctx.period, ctx.topN)) {
      items.push({ label: c.label, value: c.value, format: "currency" });
    }
  }
  if (viewer.permissions.has("data.cross_department") && scope.canViewRevenue) {
    for (const d of m.departmentRevenueInRange(scope, ctx.period)) {
      items.push({ label: `Dept · ${d.label}`, value: d.value, format: "currency" });
    }
  }
  return items;
}

export function resolveReportForViewer(
  keys: string[],
  viewer: AuthUser,
  ctx: ResolveContext,
): ResolvedSection[] {
  const out: ResolvedSection[] = [];
  for (const key of keys) {
    const resolved = resolveSectionForViewer(key, viewer, ctx);
    if (resolved) out.push(resolved);
  }
  return out;
}

export { SECTIONS };
