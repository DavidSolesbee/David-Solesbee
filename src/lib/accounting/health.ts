import "server-only";
import type { AuthUser } from "@/lib/auth/authz";
import { resolveScope } from "@/lib/analytics/scope";
import { bindViewerTenant } from "@/lib/reports/resolve";
import { inventorySnapshot, reportAsOf } from "@/lib/reports/metrics";
import { getArSummary } from "@/lib/accounting/ar";
import {
  calendarToday,
  listAccountingExceptions,
  STALE_DATA_DAYS,
} from "@/lib/accounting/exceptions";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export interface HealthComponent {
  key: string;
  label: string;
  score: number | null;
  reason: string;
  deductions: string[];
}

export interface AccountingHealth {
  asOf: string;
  today: string;
  overall: number | null;
  scoredCount: number;
  catalogCount: number;
  methodology: string;
  components: HealthComponent[];
}

const CATALOG_COUNT = 8;

export function getAccountingHealth(user: AuthUser): AccountingHealth | null {
  const bound = bindViewerTenant(user);
  const scope = resolveScope(bound);
  if (!scope.tenantId) return null;
  const asOf = reportAsOf(scope);
  const today = calendarToday();
  const components: HealthComponent[] = [];

  if (user.permissions.has("feature.view_ar") && scope.canViewPayments) {
    const ar = getArSummary(user);
    const n = Math.max(1, ar.accountCount);
    const deductions: string[] = [];
    let score = 100;
    const over = (ar.overLimitCount / n) * 100;
    const overHit = Math.min(30, over);
    if (overHit) {
      score -= overHit;
      deductions.push(
        `−${overHit.toFixed(1)} from ${ar.overLimitCount} / ${ar.accountCount} accounts over limit (cap 30).`,
      );
    }
    const quiet = (ar.quiet90Count / n) * 100;
    const quietHit = Math.min(30, quiet);
    if (quietHit) {
      score -= quietHit;
      deductions.push(
        `−${quietHit.toFixed(1)} from ${ar.quiet90Count} / ${ar.accountCount} quiet 90+ day balances (cap 30).`,
      );
    }
    const hold = Math.min(15, (ar.creditHoldWithBalance / n) * 50);
    if (hold) {
      score -= hold;
      deductions.push(
        `−${hold.toFixed(1)} from ${ar.creditHoldWithBalance} credit-hold accounts with a balance (cap 15).`,
      );
    }
    if (ar.dso !== null && ar.dso > 45) {
      const dsoHit = Math.min(25, (ar.dso - 45) * 0.8);
      score -= dsoHit;
      deductions.push(`−${dsoHit.toFixed(1)} from DSO ${ar.dso} days vs 45-day baseline (cap 25).`);
    }
    if (!deductions.length) deductions.push("No AR deductions from the published rules.");
    components.push({
      key: "ar",
      label: "AR Health",
      score: clamp(score),
      reason: "From customer-net AR, credit limits, quiet-90, holds, and DSO.",
      deductions,
    });
  } else {
    components.push({
      key: "ar",
      label: "AR Health",
      score: null,
      reason: "Requires view AR and payments.",
      deductions: [],
    });
  }

  components.push({
    key: "ap",
    label: "AP Health",
    score: null,
    reason: "Data Unavailable — no vendor AP ledger.",
    deductions: [],
  });
  components.push({
    key: "cash",
    label: "Cash / Reconciliation Health",
    score: null,
    reason: "Data Unavailable — no bank or reconciliation tables.",
    deductions: [],
  });

  try {
    const inv = inventorySnapshot(scope, false);
    const aged = inv.aging.find((a) => a.label === "365+ days")?.value ?? 0;
    const unknown = inv.aging.find((a) => a.label === "Unknown")?.value ?? 0;
    const units = Math.max(1, inv.units);
    const deductions: string[] = [];
    let score = 100;
    const agedHit = Math.min(50, (aged / units) * 80);
    if (agedHit) {
      score -= agedHit;
      deductions.push(`−${agedHit.toFixed(1)} from ${aged} / ${inv.units} units older than 365 days (cap 50).`);
    }
    const unkHit = Math.min(15, (unknown / units) * 20);
    if (unkHit) {
      score -= unkHit;
      deductions.push(`−${unkHit.toFixed(1)} from ${unknown} units with unknown received date (cap 15).`);
    }
    if (!deductions.length) deductions.push("No inventory-age deductions.");
    components.push({
      key: "inventory",
      label: "Inventory Health",
      score: clamp(score),
      reason: "Share of in-stock units aged over a year, plus unknown lot dates.",
      deductions,
    });
  } catch {
    components.push({
      key: "inventory",
      label: "Inventory Health",
      score: null,
      reason: "Inventory snapshot requires a tenant context.",
      deductions: [],
    });
  }

  components.push({
    key: "gl",
    label: "General Ledger Health",
    score: null,
    reason: "Data Unavailable — no chart of accounts or journals.",
    deductions: [],
  });
  components.push({
    key: "close",
    label: "Month-End Close Health",
    score: null,
    reason: "Data Unavailable — no close-task register to score completion.",
    deductions: [],
  });

  const staleDays = daysBetween(asOf, today);
  let fresh = 100;
  const freshDeduct: string[] = [];
  if (staleDays > 7) {
    const hit = Math.min(100, (staleDays - 7) * 0.7);
    fresh -= hit;
    freshDeduct.push(
      `−${hit.toFixed(1)} because as-of ${asOf} is ${staleDays} days before ${today} (7-day grace, 0.7 per extra day).`,
    );
  } else {
    freshDeduct.push(`As-of ${asOf} is within 7 days of ${today}.`);
  }
  components.push({
    key: "freshness",
    label: "Data Freshness",
    score: clamp(fresh),
    reason: `As-of vs calendar today. ${STALE_DATA_DAYS}+ days also raises a Data exception.`,
    deductions: freshDeduct,
  });

  const live = listAccountingExceptions(user);
  const volumeHit = Math.min(100, live.length * 8);
  components.push({
    key: "exceptions",
    label: "Exception Volume",
    score: clamp(100 - volumeHit),
    reason: "−8 per live exception group (not per account), from the Exception Center.",
    deductions: live.length
      ? [`−${volumeHit} from ${live.length} live exception group${live.length === 1 ? "" : "s"}.`]
      : ["No live exception groups."],
  });

  const scored = components.filter((c) => c.score !== null);
  const overall =
    scored.length === 0
      ? null
      : clamp(scored.reduce((s, c) => s + (c.score ?? 0), 0) / scored.length);

  return {
    asOf,
    today,
    overall,
    scoredCount: scored.length,
    catalogCount: CATALOG_COUNT,
    methodology:
      "Partial score only. Overall is the average of components that have a source. Unavailable components are omitted — they are not scored as 0 or as 100.",
    components,
  };
}
