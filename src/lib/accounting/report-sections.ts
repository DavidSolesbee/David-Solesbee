import "server-only";
import type { AuthUser } from "@/lib/auth/authz";
import { resolveScope } from "@/lib/analytics/scope";
import { formatCurrency, formatNumber } from "@/lib/utils/format";
import type { SectionDef } from "@/lib/reports/catalog";
import type { ResolveContext, ResolvedSection, ReportKpi } from "@/lib/reports/resolve";
import * as m from "@/lib/reports/metrics";
import { getArSummary } from "@/lib/accounting/ar";
import { listAccountingExceptions } from "@/lib/accounting/exceptions";
import { getCloseCenter } from "@/lib/accounting/close";
import { getAccountingHealth } from "@/lib/accounting/health";
import { UNAVAILABLE } from "@/lib/accounting/unavailable";
import { ACCOUNTING_PERMS } from "@/lib/accounting/permissions";

function kpi(label: string, value: string, raw?: number, tone?: ReportKpi["tone"]): ReportKpi {
  return { label, value, raw, tone };
}

export function resolveAccountingReportSection(
  def: SectionDef,
  viewer: AuthUser,
  ctx: ResolveContext,
): ResolvedSection {
  const base = {
    key: def.key,
    label: def.label,
    description: def.description,
    band: def.band,
  };
  const scope = resolveScope(viewer);
  const featureOk = (perm: string) => viewer.permissions.has(perm);

  switch (def.key) {
    case "accounting_snapshot": {
      if (!featureOk(ACCOUNTING_PERMS.overview)) return { ...base, authorized: false };
      const kpis: ReportKpi[] = [];
      if (scope.canViewRevenue) {
        const cur = m.revenueInRange(scope, ctx.period);
        const prior = m.revenueInRange(scope, ctx.comparison);
        const pct =
          prior === 0 && cur === 0
            ? 0
            : prior
              ? Math.round(((cur - prior) / Math.abs(prior)) * 1000) / 10
              : null;
        kpis.push({
          ...kpi("Posted revenue", formatCurrency(cur), cur, "revenue"),
          delta: pct,
          deltaLabel:
            pct === null ? undefined : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}% vs comparison`,
        });
      }
      if (featureOk(ACCOUNTING_PERMS.ar) && scope.canViewPayments) {
        const ar = getArSummary(viewer);
        kpis.push(kpi("Open AR", formatCurrency(ar.openAr), ar.openAr, "attention"));
        kpis.push(kpi("AR accounts", formatNumber(ar.accountCount), ar.accountCount));
      }
      const inv = m.inventorySnapshot(scope, scope.canViewCost);
      kpis.push(
        kpi(
          scope.canViewCost && inv.cost !== null ? "Inventory cost" : "Inventory retail",
          formatCurrency(scope.canViewCost && inv.cost !== null ? inv.cost : inv.retail),
          scope.canViewCost && inv.cost !== null ? inv.cost : inv.retail,
        ),
      );
      return {
        ...base,
        authorized: true,
        kpis,
        methodology: `Posted invoices only. Period ${ctx.period.label}. OpEx, cash, and AP are not in this extract.`,
      };
    }

    case "accounting_receivable": {
      if (!featureOk(ACCOUNTING_PERMS.ar) || !scope.canViewPayments) {
        return { ...base, authorized: false };
      }
      const ar = getArSummary(viewer);
      return {
        ...base,
        authorized: true,
        kpis: [
          kpi("Open AR", formatCurrency(ar.openAr), ar.openAr, "attention"),
          kpi("Net AR", formatCurrency(ar.net), ar.net),
          kpi("Accounts", formatNumber(ar.accountCount), ar.accountCount),
          kpi("DSO", ar.dso === null ? "n/a" : `${ar.dso.toFixed(0)} days`, ar.dso ?? undefined),
        ],
        alerts: [
          ar.overLimitCount
            ? { severity: "attention" as const, text: `${ar.overLimitCount} accounts over credit limit.` }
            : null,
          ar.quiet90Count
            ? {
                severity: "attention" as const,
                text: `${ar.quiet90Count} balances with no payment in 90+ days.`,
              }
            : null,
          ar.creditHoldWithBalance
            ? {
                severity: "critical" as const,
                text: `${ar.creditHoldWithBalance} credit-hold accounts with a balance.`,
              }
            : null,
        ].filter((a): a is NonNullable<typeof a> => a !== null),
        methodology: ar.methodology,
      };
    }

    case "accounting_contribution": {
      if (!featureOk(ACCOUNTING_PERMS.statements) || !scope.canViewRevenue) {
        return { ...base, authorized: false };
      }
      const cur = m.departmentRevenueInRange(scope, ctx.period);
      const prior = m.departmentRevenueInRange(scope, ctx.comparison);
      return {
        ...base,
        authorized: true,
        items: cur.map((d) => ({ label: d.label, value: d.value, format: "currency" as const })),
        kpis: cur.map((d) => {
          const p = prior.find((x) => x.label === d.label)?.value ?? 0;
          const pct = p ? Math.round(((d.value - p) / Math.abs(p)) * 1000) / 10 : null;
          return {
            ...kpi(d.label, formatCurrency(d.value), d.value, "revenue"),
            delta: pct,
            deltaLabel:
              pct === null ? undefined : `${pct > 0 ? "+" : ""}${pct.toFixed(1)}% vs comparison`,
          };
        }),
        methodology:
          "Departmental operating contribution from posted invoice lines. This is not a books P&L.",
      };
    }

    case "accounting_exceptions": {
      if (!featureOk(ACCOUNTING_PERMS.exceptions)) return { ...base, authorized: false };
      const live = listAccountingExceptions(viewer);
      return {
        ...base,
        authorized: true,
        alerts: live.length
          ? live.map((e) => ({
              severity: e.severity,
              text: `${e.title} — ${e.rule}`,
            }))
          : [{ severity: "info" as const, text: "No live exceptions in the authorized scope." }],
        methodology:
          "Only rules this extract can evaluate. AP, bank, and GL exception types are not listed as zero findings.",
      };
    }

    case "accounting_close": {
      if (!featureOk(ACCOUNTING_PERMS.close)) return { ...base, authorized: false };
      const close = getCloseCenter(viewer);
      if (!close) return { ...base, authorized: false };
      return {
        ...base,
        authorized: true,
        kpis: [
          kpi("Period", close.periodLabel),
          kpi("Needs review", String(close.needsReview), close.needsReview, "attention"),
          kpi("Completion", "Data Unavailable"),
          kpi("Target date", "Data Unavailable"),
        ],
        alerts: close.tasks
          .filter((t) => t.status === "needs_review")
          .map((t) => ({
            severity: "attention" as const,
            text: `${t.label}: ${t.note}`,
          })),
        methodology: close.methodology,
      };
    }

    case "accounting_health": {
      if (!featureOk(ACCOUNTING_PERMS.health)) return { ...base, authorized: false };
      const health = getAccountingHealth(viewer);
      if (!health) return { ...base, authorized: false };
      return {
        ...base,
        authorized: true,
        kpis: [
          kpi(
            "Overall (partial)",
            health.overall === null ? "n/a" : String(health.overall),
            health.overall ?? undefined,
            "margin",
          ),
          kpi("Components scored", `${health.scoredCount} of ${health.catalogCount}`),
        ],
        items: health.components
          .filter((c) => c.score !== null)
          .map((c) => ({ label: c.label, value: c.score as number, format: "count" as const })),
        alerts: health.components
          .filter((c) => c.score === null)
          .map((c) => ({
            severity: "info" as const,
            text: `${c.label}: Data Unavailable. ${c.reason}`,
          })),
        methodology: health.methodology,
      };
    }

    case "accounting_gaps": {
      const keys = ["cash", "ap", "opex", "balance_sheet", "cash_flow", "budget"] as const;
      return {
        ...base,
        authorized: true,
        alerts: keys.map((key) => {
          const u = UNAVAILABLE.find((x) => x.key === key)!;
          return {
            severity: "info" as const,
            text: `${u.label}: ${u.reason}. ${u.missing}`,
          };
        }),
        methodology:
          "These measures have no source in the dealership extract. They are not rendered as $0.",
      };
    }

    default:
      return { ...base, authorized: false };
  }
}
