import "server-only";
import type { AuthUser } from "@/lib/auth/authz";
import { resolveScope } from "@/lib/analytics/scope";
import { bindViewerTenant } from "@/lib/reports/resolve";
import { inventorySnapshot, reportAsOf, workOrderAging } from "@/lib/reports/metrics";
import { getArSummary, listArAccounts } from "@/lib/accounting/ar";

export const LARGE_AR_THRESHOLD = 25_000;
export const STALE_DATA_DAYS = 30;

export type ExceptionSeverity = "critical" | "attention" | "info";
export type ExceptionCategory = "AR" | "Inventory" | "Service" | "Data";

export interface AccountingException {
  key: string;
  severity: ExceptionSeverity;
  category: ExceptionCategory;
  title: string;
  description: string;
  amount?: number;
  count?: number;
  rule: string;
  action: string;
  href: string;
  detectedOn: string;
  status: "NEW";
}

export interface UnavailableExceptionRule {
  key: string;
  category: string;
  title: string;
  missing: string;
}

export const UNAVAILABLE_EXCEPTION_RULES: UnavailableExceptionRule[] = [
  {
    key: "ap_past_due",
    category: "AP",
    title: "AP invoices past due",
    missing: "No vendor bills or AP due dates in this extract.",
  },
  {
    key: "dup_vendor",
    category: "AP",
    title: "Possible duplicate vendor invoices",
    missing: "No vendor invoice register to compare.",
  },
  {
    key: "gl_inv_diff",
    category: "GL",
    title: "GL and inventory valuation differences",
    missing: "No general ledger to reconcile to unit or parts value.",
  },
  {
    key: "late_je",
    category: "GL",
    title: "Late journal entries",
    missing: "No journal-entry table.",
  },
  {
    key: "unrec_bank",
    category: "Cash",
    title: "Unreconciled bank accounts",
    missing: "No bank or reconciliation tables.",
  },
  {
    key: "gl_swing",
    category: "GL",
    title: "Large account balance changes",
    missing: "No chart of accounts or period balances.",
  },
  {
    key: "close_incomplete",
    category: "Close",
    title: "Incomplete month-end close tasks",
    missing: "No close-task register. Review items that do have a source are listed above.",
  },
  {
    key: "sync_fail",
    category: "Data",
    title: "Failed accounting data synchronization",
    missing: "This extract is a static file, not a live sync.",
  },
];

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function calendarToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function listAccountingExceptions(user: AuthUser): AccountingException[] {
  const bound = bindViewerTenant(user);
  const scope = resolveScope(bound);
  if (!scope.tenantId) return [];
  const asOf = reportAsOf(scope);
  const today = calendarToday();
  const out: AccountingException[] = [];

  if (user.permissions.has("feature.view_ar") && scope.canViewPayments) {
    const summary = getArSummary(user);
    const accounts = listArAccounts(user);
    const large = accounts.filter((a) => a.openAr >= LARGE_AR_THRESHOLD);
    const largeSum = Math.round(large.reduce((s, a) => s + a.openAr, 0) * 100) / 100;

    if (summary.overLimitCount) {
      out.push({
        key: "ar_over_limit",
        severity: "attention",
        category: "AR",
        title: `${summary.overLimitCount} accounts over credit limit`,
        description: "Open customer-net AR exceeds the stored credit limit.",
        count: summary.overLimitCount,
        rule: "Open AR > Customer.CredLimit when a limit is set.",
        action: "Review credit or collect the excess on Receivable.",
        href: "/app/accounting/receivable?overLimit=1",
        detectedOn: asOf,
        status: "NEW",
      });
    }
    if (summary.quiet90Count) {
      out.push({
        key: "ar_quiet_90",
        severity: "attention",
        category: "AR",
        title: `${summary.quiet90Count} balances with no payment in 90+ days`,
        description: "Net AR remains above $1 and the latest payment (or charge) is 90 or more days before as-of.",
        count: summary.quiet90Count,
        amount: undefined,
        rule: "Net AR > $1 and latest recvpmt (or latest charge if never paid) is 90+ days before as-of.",
        action: "Confirm collection status on the quiet filter.",
        href: "/app/accounting/receivable?quiet=1",
        detectedOn: asOf,
        status: "NEW",
      });
    }
    if (summary.creditHoldWithBalance) {
      out.push({
        key: "ar_hold",
        severity: "critical",
        category: "AR",
        title: `${summary.creditHoldWithBalance} credit-hold accounts with a balance`,
        description: "Credit hold is on and customer-net AR is still above $1.",
        count: summary.creditHoldWithBalance,
        rule: "Customer.CreditHoldFlag = 1 and customer-net AR > $1.",
        action: "Resolve hold or collect the open balance.",
        href: "/app/accounting/receivable?hold=1",
        detectedOn: asOf,
        status: "NEW",
      });
    }
    if (large.length) {
      out.push({
        key: "ar_large",
        severity: "attention",
        category: "AR",
        title: `${large.length} customer balances at or above $${LARGE_AR_THRESHOLD.toLocaleString("en-US")}`,
        description: "Large open balances using a printed threshold, not invoice aging.",
        count: large.length,
        amount: largeSum,
        rule: `Customer-net open AR ≥ $${LARGE_AR_THRESHOLD.toLocaleString("en-US")}.`,
        action: "Open Receivable and work the highest balances first.",
        href: "/app/accounting/receivable?hasBalance=1",
        detectedOn: asOf,
        status: "NEW",
      });
    }
  }

  try {
    const inv = inventorySnapshot(scope, false);
    const aged = inv.aging.find((a) => a.label === "365+ days")?.value ?? 0;
    if (aged > 0) {
      out.push({
        key: "inv_aged_365",
        severity: "attention",
        category: "Inventory",
        title: `${aged} in-stock units older than 365 days`,
        description: "Lot age from DateReceived, then DatePurchased, then EntDate.",
        count: aged,
        rule: "UnitBase StockStatus = instock and age vs as-of > 365 days.",
        action: "Review aged units on Inventory operations.",
        href: "/app/inventory",
        detectedOn: asOf,
        status: "NEW",
      });
    }
  } catch {
    /* no tenant / inventory access */
  }

  try {
    const staleWo = workOrderAging(scope, asOf).find((a) => a.label === "15+ days")?.value ?? 0;
    if (staleWo > 0) {
      out.push({
        key: "wo_aged_15",
        severity: "info",
        category: "Service",
        title: `${staleWo} open work orders aging 15+ days`,
        description: "Open WOs (not finalized, archived, or voided) aged from ActivityDate.",
        count: staleWo,
        rule: "InvoiceType = wo, status not posted/void, age vs as-of ≥ 15 days.",
        action: "Review open work on the Service module.",
        href: "/app/service",
        detectedOn: asOf,
        status: "NEW",
      });
    }
  } catch {
    /* ignore */
  }

  const staleDays = daysBetween(asOf, today);
  if (staleDays >= STALE_DATA_DAYS) {
    out.push({
      key: "data_stale",
      severity: "critical",
      category: "Data",
      title: `Extract is ${staleDays} days behind calendar today`,
      description: `Posted activity as-of ${asOf}; calendar today is ${today}.`,
      count: staleDays,
      rule: `As-of date is ${STALE_DATA_DAYS} or more days before calendar today.`,
      action: "Treat figures as historical. Refresh the extract before close.",
      href: "/app/accounting",
      detectedOn: today,
      status: "NEW",
    });
  }

  const rank = { critical: 0, attention: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || a.category.localeCompare(b.category));
}
