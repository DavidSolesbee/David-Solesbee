import "server-only";
import type { AuthUser } from "@/lib/auth/authz";
import { resolveScope, scopeLabel } from "@/lib/analytics/scope";
import { bindViewerTenant } from "@/lib/reports/resolve";
import {
  resolvePeriod,
  resolveComparison,
  type DateRange,
} from "@/lib/reports/periods";
import * as m from "@/lib/reports/metrics";
import { getPartsModule } from "@/lib/analytics/modules";
import { queryForTenant, type TenantAccess } from "@/lib/db/dealership";
import { POSTED_STATUS_SQL, POSTED_DATE_SQL } from "@/lib/semantic/metrics";
import { formatCurrency, formatNumber, formatHours } from "@/lib/utils/format";
import { config } from "@/lib/config";
import { canAsk, getQuestion, type QuestionKey } from "@/lib/ai/catalog";

/**
 * Deterministic findings — the AI security boundary.
 *
 * Operational data → semantic metrics → this module → structured findings.
 * Narration may only interpolate these values. Restricted questions return
 * no findings and compute nothing.
 */

export interface Finding {
  id: string;
  label: string;
  value?: string;
  raw?: number;
  deltaPct?: number | null;
  items?: { label: string; value: string }[];
  methodology: string;
}

export interface AskPayload {
  questionKey: QuestionKey;
  question: string;
  authorized: boolean;
  restrictedReason?: string;
  findings: Finding[];
  scopeLabel: string;
  asOf: string;
  periodLabel?: string;
}

function viewerOf(user: AuthUser): AuthUser {
  return bindViewerTenant(user);
}

function accessOf(user: AuthUser): TenantAccess | null {
  const scope = resolveScope(viewerOf(user));
  if (!scope.tenantId) return null;
  return {
    userId: scope.userId,
    tenantId: scope.tenantId,
    platformViewAs: scope.platformViewAs,
  };
}

function deltaPct(current: number, prior: number): number | null {
  if (!prior && !current) return 0;
  if (!prior) return null;
  return Math.round(((current - prior) / Math.abs(prior)) * 1000) / 10;
}

export function computeAsk(user: AuthUser, key: string): AskPayload {
  const def = getQuestion(key);
  const bound = viewerOf(user);
  const scope = resolveScope(bound);
  const asOf = (m.reportAsOf(scope) || config.dataAsOfFallback).slice(0, 10);

  if (!def) {
    return {
      questionKey: "revenue_change",
      question: key,
      authorized: false,
      restrictedReason: "Unknown question.",
      findings: [],
      scopeLabel: scopeLabel(scope),
      asOf,
    };
  }
  if (!user.permissions.has("feature.use_ai") || !user.permissions.has("module.ai_insights")) {
    return {
      questionKey: def.key,
      question: def.prompt,
      authorized: false,
      restrictedReason: "AI Insights is not enabled for your role.",
      findings: [],
      scopeLabel: scopeLabel(scope),
      asOf,
    };
  }
  if (!canAsk(user.permissions, def) || !accessOf(bound)) {
    return {
      questionKey: def.key,
      question: def.prompt,
      authorized: false,
      restrictedReason:
        "This question needs data you are not authorized to see. Perseus will not compute it.",
      findings: [],
      scopeLabel: scopeLabel(scope),
      asOf,
    };
  }

  const last30 = resolvePeriod("last_30_days", asOf);
  const prior30 = resolveComparison("previous_equivalent", last30);
  const last90 = resolvePeriod("rolling_90_days", asOf);
  const prior90 = resolveComparison("previous_equivalent", last90);
  const ytd = resolvePeriod("year_to_date", asOf);
  const priorYear = resolvePeriod("previous_year", asOf);

  const findings = buildFindings(def.key, bound, {
    asOf,
    last30,
    prior30,
    last90,
    prior90,
    ytd,
    priorYear,
  });

  return {
    questionKey: def.key,
    question: def.prompt,
    authorized: true,
    findings,
    scopeLabel: scopeLabel(scope),
    asOf,
    periodLabel: last30.label,
  };
}

function buildFindings(
  key: QuestionKey,
  user: AuthUser,
  ranges: {
    asOf: string;
    last30: DateRange;
    prior30: DateRange;
    last90: DateRange;
    prior90: DateRange;
    ytd: DateRange;
    priorYear: DateRange;
  },
): Finding[] {
  const scope = resolveScope(user);
  const access = accessOf(user)!;

  switch (key) {
    case "revenue_change": {
      const cur = m.revenueInRange(scope, ranges.last30);
      const prior = m.revenueInRange(scope, ranges.prior30);
      const pct = deltaPct(cur, prior);
      const out: Finding[] = [
        {
          id: "rev_30",
          label: "Posted revenue (last 30 days)",
          value: formatCurrency(cur),
          raw: cur,
          deltaPct: pct,
          methodology: "Posted invoices only. Comparison is the previous equivalent 30 days.",
        },
      ];
      if (scope.allDepartments) {
        const depts = m.departmentRevenueInRange(scope, ranges.last30);
        const priorDepts = m.departmentRevenueInRange(scope, ranges.prior30);
        out.push({
          id: "rev_depts",
          label: "Department contribution",
          items: depts.map((d) => {
            const p = priorDepts.find((x) => x.label === d.label)?.value ?? 0;
            const dp = deltaPct(d.value, p);
            return {
              label: d.label,
              value: `${formatCurrency(d.value)}${dp === null ? "" : ` (${dp > 0 ? "+" : ""}${dp.toFixed(1)}%)`}`,
            };
          }),
          methodology: "Line revenue by ItemType: Sales UN/TR/RU/RE, Parts PA, Service SL.",
        });
      }
      return out;
    }

    case "growing_customers": {
      const current = m.topCustomersInRange(scope, scope.canViewContacts, ranges.last90, 20);
      const prior = m.topCustomersInRange(scope, scope.canViewContacts, ranges.prior90, 40);
      const priorMap = new Map(prior.map((c) => [c.label, c.value]));
      const grown = current
        .map((c) => {
          const p = priorMap.get(c.label) ?? 0;
          return { label: c.label, value: c.value, delta: c.value - p };
        })
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 8);
      return [
        {
          id: "grow",
          label: "Largest revenue increase (last 90 days vs prior 90)",
          items: grown.map((c) => ({
            label: c.label,
            value: `${formatCurrency(c.value)} · ${c.delta >= 0 ? "+" : ""}${formatCurrency(c.delta)}`,
          })),
          methodology: scope.canViewContacts
            ? "Customer names shown. Ranked by period-over-period revenue change."
            : "Customer identities masked. Ranked by period-over-period revenue change.",
        },
      ];
    }

    case "inactive_customers": {
      const quiet = m.inactiveCustomers(scope, scope.canViewContacts, ranges.asOf, 90, 12);
      return [
        {
          id: "quiet",
          label: "Previously active, no purchase in 90+ days",
          items: quiet.map((c) => ({ label: c.label, value: "quiet" })),
          methodology:
            "Customers with posted activity in the last year but none in the last 90 days.",
        },
      ];
    }

    case "top_parts": {
      const parts = getPartsModule({
        access,
        canCost: scope.canViewCost,
        canMargin: scope.canViewMargin,
      });
      return [
        {
          id: "parts_rev",
          label: "Parts revenue (all posted)",
          value: formatCurrency(parts.revenue),
          raw: parts.revenue,
          methodology: "SalePart.NetExt on posted invoices.",
        },
        {
          id: "parts_top",
          label: "Top-selling parts",
          items: parts.topParts.map((p) => ({
            label: p.label,
            value: formatCurrency(p.value),
          })),
          methodology: "Ranked by posted parts revenue.",
        },
      ];
    }

    case "aging_work_orders": {
      const aging = m.workOrderAging(scope, ranges.asOf);
      const longest = queryForTenant<{ no: string | null; days: number }>(
        access,
        `SELECT COALESCE(h.InvoiceNo, h.InvoiceDocId) AS no,
                CAST(julianday(substr(?,1,10))
                  - julianday(substr(COALESCE(NULLIF(h.ActivityDate,''), h.FinalizedDate),1,10))
                  AS INTEGER) AS days
         FROM InvoiceHeader h
         WHERE h.InvoiceType = 'wo' AND h.Status NOT IN ('finalized','archived','voided')
         ORDER BY days DESC LIMIT 10`,
        [ranges.asOf],
      );
      return [
        {
          id: "wo_buckets",
          label: "Open work-order aging",
          items: aging.map((a) => ({ label: a.label, value: formatNumber(a.value) })),
          methodology: "Open WOs exclude finalized, archived, and voided.",
        },
        {
          id: "wo_long",
          label: "Longest open work orders",
          items: longest.map((w) => ({
            label: `WO ${w.no ?? "—"}`,
            value: `${formatNumber(w.days ?? 0)} days`,
          })),
          methodology: "Age from ActivityDate (or FinalizedDate fallback) to as-of.",
        },
      ];
    }

    case "aged_inventory": {
      const snap = m.inventorySnapshot(scope, scope.canViewCost);
      const aged = snap.aging.filter((a) => a.label === "181–365 days" || a.label === "365+ days");
      return [
        {
          id: "inv_units",
          label: "Units in stock",
          value: formatNumber(snap.units),
          raw: snap.units,
          methodology: "TRIM(StockStatus)='instock'.",
        },
        {
          id: "inv_old",
          label: "Units older than 180 days",
          items: aged.map((a) => ({ label: a.label, value: formatNumber(a.value) })),
          methodology: "Age from DateReceived / DatePurchased / EntDate.",
        },
      ];
    }

    case "technician_workload": {
      const techs = m.technicianWorkload(scope);
      return [
        {
          id: "tech",
          label: "Active technician labor hours",
          items: techs.map((t) => ({ label: t.label, value: formatHours(t.value) })),
          methodology: "SUM(WorkInProgress.ElapsedHours) where IsActive=1.",
        },
      ];
    }

    case "revenue_vs_year": {
      const ytd = m.revenueInRange(scope, ranges.ytd);
      const prior = m.revenueInRange(scope, ranges.priorYear);
      return [
        {
          id: "ytd",
          label: "Year to date",
          value: formatCurrency(ytd),
          raw: ytd,
          deltaPct: deltaPct(ytd, prior),
          methodology: "YTD vs the full prior calendar year (posted revenue).",
        },
        {
          id: "prior_year",
          label: "Previous calendar year",
          value: formatCurrency(prior),
          raw: prior,
          methodology: "Full prior year posted revenue in scope.",
        },
      ];
    }
  }
}

/** Briefing findings — the union of authorized pulse measures. */
export function computeBriefingFindings(user: AuthUser): Finding[] {
  const bound = viewerOf(user);
  const scope = resolveScope(bound);
  if (!accessOf(bound)) return [];
  const asOf = (m.reportAsOf(scope) || config.dataAsOfFallback).slice(0, 10);
  const last30 = resolvePeriod("last_30_days", asOf);
  const prior30 = resolveComparison("previous_equivalent", last30);
  const out: Finding[] = [];

  if (scope.canViewRevenue) {
    out.push(...buildFindings("revenue_change", bound, {
      asOf,
      last30,
      prior30,
      last90: last30,
      prior90: prior30,
      ytd: last30,
      priorYear: prior30,
    }));
    const quiet = m.inactiveCustomers(scope, scope.canViewContacts, asOf, 90, 4);
    if (quiet.length) {
      out.push({
        id: "brief_quiet",
        label: "Quiet customers",
        raw: quiet.length,
        value: formatNumber(quiet.length),
        methodology: "No purchase in 90+ days, active in the last year.",
      });
    }
  }
  if (user.permissions.has("module.service")) {
    const stale = m.workOrderAging(scope, asOf).find((a) => a.label === "15+ days")?.value ?? 0;
    if (stale > 0) {
      out.push({
        id: "brief_wo",
        label: "Work orders aging 15+ days",
        value: formatNumber(stale),
        raw: stale,
        methodology: "Open WOs aged from ActivityDate.",
      });
    }
  }
  return out;
}
