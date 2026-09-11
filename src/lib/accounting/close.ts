import "server-only";
import type { AuthUser } from "@/lib/auth/authz";
import { resolveScope } from "@/lib/analytics/scope";
import { bindViewerTenant } from "@/lib/reports/resolve";
import { inventorySnapshot, reportAsOf } from "@/lib/reports/metrics";
import { getArSummary } from "@/lib/accounting/ar";
import { calendarToday, listAccountingExceptions, STALE_DATA_DAYS } from "@/lib/accounting/exceptions";

export type CloseTaskStatus = "needs_review" | "clear" | "source_unavailable";

export interface CloseTask {
  key: string;
  label: string;
  ownerHint: string;
  status: CloseTaskStatus;
  note: string;
  href?: string;
}

export interface CloseCenter {
  asOf: string;
  today: string;
  periodLabel: string;
  targetDate: null;
  completionPct: null;
  tasks: CloseTask[];
  needsReview: number;
  unavailable: number;
  methodology: string;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function periodLabel(asOf: string): string {
  const [y, m] = asOf.split("-");
  const month = MONTHS[Number(m) - 1] ?? m;
  return `${month} ${y}`;
}

function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function getCloseCenter(user: AuthUser): CloseCenter | null {
  const bound = bindViewerTenant(user);
  const scope = resolveScope(bound);
  if (!scope.tenantId) return null;
  const asOf = reportAsOf(scope);
  const today = calendarToday();
  const exceptions = listAccountingExceptions(user);
  const arLive = exceptions.filter((e) => e.category === "AR");
  const canAr = user.permissions.has("feature.view_ar") && scope.canViewPayments;

  let agedUnits = 0;
  try {
    agedUnits = inventorySnapshot(scope, false).aging.find((a) => a.label === "365+ days")?.value ?? 0;
  } catch {
    agedUnits = 0;
  }

  const staleDays = daysBetween(asOf, today);
  let arNote = "Requires view AR and payments.";
  if (canAr) {
    const summary = getArSummary(user);
    arNote = arLive.length
      ? `${arLive.length} AR exception group${arLive.length === 1 ? "" : "s"} · ${summary.accountCount} balances.`
      : "No AR exception groups on the published rules.";
  }

  const tasks: CloseTask[] = [
    {
      key: "ar",
      label: "AR Review",
      ownerHint: "Receivable",
      status: !canAr ? "source_unavailable" : arLive.length ? "needs_review" : "clear",
      note: arNote,
      href: canAr ? "/app/accounting/exceptions" : undefined,
    },
    {
      key: "inventory",
      label: "Inventory Review",
      ownerHint: "Inventory",
      status: agedUnits > 0 ? "needs_review" : "clear",
      note:
        agedUnits > 0
          ? `${agedUnits} in-stock units older than 365 days.`
          : "No units in the 365+ day bucket.",
      href: "/app/inventory",
    },
    {
      key: "freshness",
      label: "Data Freshness",
      ownerHint: "Controller",
      status: staleDays >= STALE_DATA_DAYS ? "needs_review" : "clear",
      note: `As-of ${asOf} vs calendar ${today} (${staleDays} days).`,
      href: "/app/accounting/exceptions",
    },
    {
      key: "bank",
      label: "Bank Reconciliation",
      ownerHint: "Controller",
      status: "source_unavailable",
      note: "No bank or reconciliation tables.",
    },
    {
      key: "ap",
      label: "AP Review",
      ownerHint: "Payables",
      status: "source_unavailable",
      note: "No vendor bills ledger.",
    },
    {
      key: "wip",
      label: "WIP Review",
      ownerHint: "Service",
      status: "source_unavailable",
      note: "No WIP valuation ledger. Open work-order aging is on Exceptions when present.",
    },
    {
      key: "je",
      label: "Journal Entry Review",
      ownerHint: "Controller",
      status: "source_unavailable",
      note: "No journal-entry table.",
    },
    {
      key: "accrual",
      label: "Accrual Review",
      ownerHint: "Controller",
      status: "source_unavailable",
      note: "No accrual register.",
    },
    {
      key: "prepaid",
      label: "Prepaid Expense Review",
      ownerHint: "Controller",
      status: "source_unavailable",
      note: "No prepaid-expense register.",
    },
    {
      key: "fixed",
      label: "Fixed Asset Review",
      ownerHint: "Controller",
      status: "source_unavailable",
      note: "No fixed-asset register.",
    },
    {
      key: "interco",
      label: "Intercompany Reconciliation",
      ownerHint: "Controller",
      status: "source_unavailable",
      note: "No intercompany ledger.",
    },
    {
      key: "statements",
      label: "Financial Statement Review",
      ownerHint: "Controller",
      status: "source_unavailable",
      note: "No books P&L, balance sheet, or cash-flow statement.",
    },
    {
      key: "approval",
      label: "Final Close Approval",
      ownerHint: "Dealer principal",
      status: "source_unavailable",
      note: "No close-task register to approve.",
    },
  ];

  return {
    asOf,
    today,
    periodLabel: periodLabel(asOf),
    targetDate: null,
    completionPct: null,
    tasks,
    needsReview: tasks.filter((t) => t.status === "needs_review").length,
    unavailable: tasks.filter((t) => t.status === "source_unavailable").length,
    methodology:
      "This is not a close-task register. Completion % and target date are not computed. Only AR, inventory age, and extract freshness can be evaluated.",
  };
}
