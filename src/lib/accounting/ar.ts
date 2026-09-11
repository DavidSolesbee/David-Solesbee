import "server-only";
import type { AuthUser } from "@/lib/auth/authz";
import { resolveScope } from "@/lib/analytics/scope";
import { bindViewerTenant } from "@/lib/reports/resolve";
import { reportAsOf } from "@/lib/reports/metrics";
import { POSTED_STATUS_SQL, POSTED_DATE_SQL } from "@/lib/semantic/metrics";
import { queryForTenant, type TenantAccess } from "@/lib/db/dealership";
import { itemTypeClause } from "@/lib/analytics/scope";

export interface ArAccount {
  customerId: number;
  name: string;
  accountNo: string;
  openAr: number;
  creditLimit: number | null;
  usedPct: number | null;
  lastCharge: string | null;
  lastPayment: string | null;
  daysSincePayment: number | null;
  termsDays: number;
  creditHold: boolean;
  overLimit: boolean;
  quiet90: boolean;
}

export interface ArSummary {
  asOf: string;
  openAr: number;
  credits: number;
  net: number;
  accountCount: number;
  creditCount: number;
  overLimitCount: number;
  creditHoldWithBalance: number;
  quiet90Count: number;
  charged90: number;
  dso: number | null;
  methodology: string;
}

export interface ArAttention {
  key: string;
  title: string;
  amount?: number;
  count: number;
  rule: string;
  href: string;
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

function invoiceScopeSql(user: AuthUser): { sql: string; params: unknown[] } {
  const scope = resolveScope(bindViewerTenant(user));
  if (scope.allDepartments) return { sql: "1=1", params: [] };
  const it = itemTypeClause(scope);
  return {
    sql: `h.InvoiceDocId IN (SELECT DISTINCT d.InvoiceDocId FROM InvoiceDetail d WHERE ${it.sql})`,
    params: it.params,
  };
}

const LINES_SQL = `
  SELECT
    COALESCE(d.BillToCustomerId, h.CustomerId) AS cust_id,
    COALESCE(NULLIF(d.BillToCustomerName,''), h.CustomerName) AS name,
    COALESCE(NULLIF(d.BillToCustomerNo,''), h.CustomerNo) AS no,
    p.Amount AS amt,
    p.PmtType AS pmt,
    substr(COALESCE(NULLIF(h.FinalizedDate,''), h.ActivityDate),1,10) AS posted,
    substr(p.EntDate,1,10) AS paid_on,
    COALESCE(d.DaysDue, 30) AS days_due
  FROM Payment p
  JOIN InvoiceHeader h ON h.InvoiceDocId = p.InvoiceDocId
  LEFT JOIN PaymentReceivablesDetail d ON d.PaymentId = p.PaymentId
  WHERE p.IsActive = 1
    AND p.PmtType IN ('recv','recvpmt')
    AND ${POSTED_STATUS_SQL}
    AND __SCOPE__
`;

type GlobalWithAr = typeof globalThis & {
  __perseusArList__?: Map<string, ArAccount[]>;
  __perseusArSummary__?: Map<string, ArSummary>;
};
const g = globalThis as GlobalWithAr;
if (!g.__perseusArList__) g.__perseusArList__ = new Map();
if (!g.__perseusArSummary__) g.__perseusArSummary__ = new Map();

function cacheKey(user: AuthUser, kind: "list" | "summary"): string {
  const bound = bindViewerTenant(user);
  const scope = resolveScope(bound);
  return [
    kind,
    user.id,
    scope.tenantId ?? "",
    scope.department ?? "all",
    user.permissions.has("feature.view_ar_detail") ? "1" : "0",
    user.permissions.has("feature.view_customer_contacts") ? "1" : "0",
  ].join(":");
}

export function listArAccounts(user: AuthUser): ArAccount[] {
  const key = cacheKey(user, "list");
  const hit = g.__perseusArList__!.get(key);
  if (hit) return hit;
  const access = accessOf(user);
  if (!access) return [];
  const scope = resolveScope(bindViewerTenant(user));
  const asOf = reportAsOf(scope);
  const sc = invoiceScopeSql(user);
  const sql = LINES_SQL.replace("__SCOPE__", sc.sql);
  const lines = queryForTenant<{
    cust_id: number | null;
    name: string | null;
    no: string | null;
    amt: number;
    pmt: string;
    posted: string | null;
    paid_on: string | null;
    days_due: number | null;
  }>(access, sql, sc.params);

  const map = new Map<
    number,
    {
      name: string;
      no: string;
      open: number;
      lastCharge: string | null;
      lastPayment: string | null;
      terms: number;
    }
  >();

  for (const row of lines) {
    const id = Number(row.cust_id ?? 0);
    if (!id) continue;
    const cur = map.get(id) ?? {
      name: row.name ?? "Unknown",
      no: row.no ?? "",
      open: 0,
      lastCharge: null as string | null,
      lastPayment: null as string | null,
      terms: row.days_due ?? 30,
    };
    cur.open += row.amt ?? 0;
    if (row.pmt === "recv" && row.posted && (!cur.lastCharge || row.posted > cur.lastCharge)) {
      cur.lastCharge = row.posted;
    }
    if (row.pmt === "recvpmt" && row.paid_on && (!cur.lastPayment || row.paid_on > cur.lastPayment)) {
      cur.lastPayment = row.paid_on;
    }
    map.set(id, cur);
  }

  const ids = [...map.keys()];
  const customers = new Map<
    number,
    { cred: number | null; hold: number }
  >();
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(",");
    const rows = queryForTenant<{ id: number; cred: number | null; hold: number }>(
      access,
      `SELECT CustomerId AS id, CredLimit AS cred, CreditHoldFlag AS hold
       FROM Customer WHERE CustomerId IN (${placeholders})`,
      ids,
    );
    for (const r of rows) customers.set(r.id, { cred: r.cred, hold: r.hold });
  }

  const mask = !scope.canViewContacts;
  const out: ArAccount[] = [];
  for (const [id, cur] of map) {
    const openAr = Math.round(cur.open * 100) / 100;
    const meta = customers.get(id);
    const limit = meta?.cred && meta.cred > 0 ? meta.cred : null;
    const usedPct = limit ? Math.round((openAr / limit) * 1000) / 10 : null;
    let daysSincePayment: number | null = null;
    if (cur.lastPayment) {
      daysSincePayment = Math.round(
        (Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${cur.lastPayment}T00:00:00Z`)) /
          86400000,
      );
    } else if (openAr > 1) {
      daysSincePayment = cur.lastCharge
        ? Math.round(
            (Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${cur.lastCharge}T00:00:00Z`)) /
              86400000,
          )
        : null;
    }
    const quiet90 = openAr > 1 && (daysSincePayment === null || daysSincePayment >= 90);
    out.push({
      customerId: id,
      name: mask ? `Customer ${String(id).padStart(4, "0")}` : cur.name,
      accountNo: mask ? "••••" : cur.no,
      openAr,
      creditLimit: user.permissions.has("feature.view_ar_detail") ? limit : null,
      usedPct: user.permissions.has("feature.view_ar_detail") ? usedPct : null,
      lastCharge: user.permissions.has("feature.view_ar_detail") ? cur.lastCharge : null,
      lastPayment: user.permissions.has("feature.view_ar_detail") ? cur.lastPayment : null,
      daysSincePayment: user.permissions.has("feature.view_ar_detail")
        ? daysSincePayment
        : null,
      termsDays: cur.terms,
      creditHold: meta?.hold === 1,
      overLimit: limit !== null && openAr > limit + 0.5,
      quiet90,
    });
  }
  const sorted = out.sort((a, b) => b.openAr - a.openAr);
  g.__perseusArList__!.set(key, sorted);
  return sorted;
}

export function getArSummary(user: AuthUser): ArSummary {
  const skey = cacheKey(user, "summary");
  const cached = g.__perseusArSummary__!.get(skey);
  if (cached) return cached;
  const accounts = listArAccounts(user);
  const debtors = accounts.filter((a) => a.openAr > 1);
  const credits = accounts.filter((a) => a.openAr < -1);
  const openAr = Math.round(debtors.reduce((s, a) => s + a.openAr, 0) * 100) / 100;
  const creditAmt = Math.round(credits.reduce((s, a) => s + a.openAr, 0) * 100) / 100;
  const bound = bindViewerTenant(user);
  const scope = resolveScope(bound);
  const asOf = reportAsOf(scope);
  const access = accessOf(user);
  let charged90 = 0;
  if (access) {
    const sc = invoiceScopeSql(user);
    charged90 =
      queryForTenant<{ c: number }>(
        access,
        `SELECT ROUND(SUM(p.Amount),2) AS c
         FROM Payment p
         JOIN InvoiceHeader h ON h.InvoiceDocId = p.InvoiceDocId
         WHERE p.IsActive = 1 AND p.PmtType = 'recv' AND ${POSTED_STATUS_SQL}
           AND ${POSTED_DATE_SQL} >= date(?, '-90 day')
           AND ${sc.sql}`,
        [asOf, ...sc.params],
      )[0]?.c ?? 0;
  }
  const dso = charged90 > 0 ? Math.round((openAr / (charged90 / 90)) * 10) / 10 : null;
  const summary: ArSummary = {
    asOf,
    openAr,
    credits: creditAmt,
    net: Math.round((openAr + creditAmt) * 100) / 100,
    accountCount: debtors.length,
    creditCount: credits.length,
    overLimitCount: debtors.filter((a) => a.overLimit).length,
    creditHoldWithBalance: debtors.filter((a) => a.creditHold).length,
    quiet90Count: debtors.filter((a) => a.quiet90).length,
    charged90,
    dso,
    methodology:
      "Customer-net AR is SUM(recv) + SUM(recvpmt) on finalized/archived invoices, grouped by bill-to customer. Invoice-level aging is not shown — payments often apply to a different document than the original charge.",
  };
  g.__perseusArSummary__!.set(skey, summary);
  return summary;
}

export function attentionFromSummary(summary: ArSummary): ArAttention[] {
  const items: ArAttention[] = [];
  if (summary.accountCount) {
    items.push({
      key: "open",
      title: `${summary.accountCount} customer balances outstanding`,
      amount: summary.openAr,
      count: summary.accountCount,
      rule: "Customer-net SUM(recv)+SUM(recvpmt) greater than $1 on posted invoices.",
      href: "/app/accounting/receivable?hasBalance=1",
    });
  }
  if (summary.overLimitCount) {
    items.push({
      key: "limit",
      title: `${summary.overLimitCount} accounts over credit limit`,
      count: summary.overLimitCount,
      rule: "Open AR exceeds Customer.CredLimit when a limit is set.",
      href: "/app/accounting/receivable?overLimit=1",
    });
  }
  if (summary.quiet90Count) {
    items.push({
      key: "quiet",
      title: `${summary.quiet90Count} balances with no payment in 90+ days`,
      count: summary.quiet90Count,
      rule: "Net AR remains above $1 and the latest recvpmt (or latest charge if never paid) is 90 or more days before as-of.",
      href: "/app/accounting/receivable?quiet=1",
    });
  }
  if (summary.creditHoldWithBalance) {
    items.push({
      key: "hold",
      title: `${summary.creditHoldWithBalance} credit-hold accounts with a balance`,
      count: summary.creditHoldWithBalance,
      rule: "Customer.CreditHoldFlag = 1 and customer-net AR > $1.",
      href: "/app/accounting/receivable?hold=1",
    });
  }
  return items;
}

export function arAttention(user: AuthUser): ArAttention[] {
  return attentionFromSummary(getArSummary(user));
}
