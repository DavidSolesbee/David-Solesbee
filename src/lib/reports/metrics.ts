import "server-only";
import { queryForTenant, queryScalarForTenant } from "@/lib/db/dealership";
import { POSTED_STATUS_SQL, POSTED_DATE_SQL } from "@/lib/semantic/metrics";
import { itemTypeClause, type AnalyticsScope } from "@/lib/analytics/scope";
import { getDataAsOf } from "@/lib/analytics/queries";
import { config } from "@/lib/config";
import type { DateRange } from "@/lib/reports/periods";
import { PerseusError } from "@/lib/errors";

function accessOf(scope: AnalyticsScope) {
  if (!scope.tenantId) {
    throw new PerseusError(
      "FORBIDDEN",
      "Dealership data requires a validated tenant context.",
    );
  }
  return {
    userId: scope.userId,
    tenantId: scope.tenantId,
    platformViewAs: scope.platformViewAs,
  };
}
function query<T = Record<string, unknown>>(
  scope: AnalyticsScope,
  sql: string,
  params: unknown[] = [],
): T[] {
  return queryForTenant<T>(accessOf(scope), sql, params);
}
function queryScalar<T = number>(
  scope: AnalyticsScope,
  sql: string,
  params: unknown[] = [],
): T | undefined {
  return queryScalarForTenant<T>(accessOf(scope), sql, params);
}

/**
 * Period-aware report metrics. Each function applies the recipient's
 * AnalyticsScope (department ItemTypes) AND the reporting date range.
 * Restricted measures (cost, margin, technician, contacts) are only returned
 * when the caller passes the matching flag — they are never computed "just
 * in case."
 */

export function reportAsOf(scope: AnalyticsScope): string {
  return (getDataAsOf(scope) ?? config.dataAsOfFallback).slice(0, 10);
}

function rangeClause(range: DateRange): { sql: string; params: string[] } {
  return {
    sql: `${POSTED_DATE_SQL} >= ? AND ${POSTED_DATE_SQL} < date(?, '+1 day')`,
    params: [range.start, range.end],
  };
}

export function revenueInRange(scope: AnalyticsScope, range: DateRange): number {
  const r = rangeClause(range);
  if (scope.allDepartments) {
    return (
      queryScalar<number>(scope,

        `SELECT ROUND(SUM(h.TotalInvoice),2) FROM InvoiceHeader h
         WHERE ${POSTED_STATUS_SQL} AND ${r.sql}`,
        r.params,
      ) ?? 0
    );
  }
  const it = itemTypeClause(scope);
  return (
    queryScalar<number>(scope,

      `SELECT ROUND(SUM(d.NetExt),2)
       FROM InvoiceDetail d JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
       WHERE ${POSTED_STATUS_SQL} AND ${it.sql} AND ${r.sql}`,
      [...it.params, ...r.params],
    ) ?? 0
  );
}

export function invoicesInRange(scope: AnalyticsScope, range: DateRange): number {
  const r = rangeClause(range);
  if (scope.allDepartments) {
    return (
      queryScalar<number>(scope,

        `SELECT COUNT(*) FROM InvoiceHeader h WHERE ${POSTED_STATUS_SQL} AND ${r.sql}`,
        r.params,
      ) ?? 0
    );
  }
  const it = itemTypeClause(scope);
  return (
    queryScalar<number>(scope,

      `SELECT COUNT(DISTINCT d.InvoiceDocId)
       FROM InvoiceDetail d JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
       WHERE ${POSTED_STATUS_SQL} AND ${it.sql} AND ${r.sql}`,
      [...it.params, ...r.params],
    ) ?? 0
  );
}

export function customersInRange(scope: AnalyticsScope, range: DateRange): number {
  const r = rangeClause(range);
  if (scope.allDepartments) {
    return (
      queryScalar<number>(scope,

        `SELECT COUNT(DISTINCT h.CustomerId) FROM InvoiceHeader h
         WHERE ${POSTED_STATUS_SQL} AND ${r.sql}`,
        r.params,
      ) ?? 0
    );
  }
  const it = itemTypeClause(scope);
  return (
    queryScalar<number>(scope,

      `SELECT COUNT(DISTINCT h.CustomerId)
       FROM InvoiceDetail d JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
       WHERE ${POSTED_STATUS_SQL} AND ${it.sql} AND ${r.sql}`,
      [...it.params, ...r.params],
    ) ?? 0
  );
}

export function paymentsInRange(scope: AnalyticsScope, range: DateRange): number {
  const r = {
    sql: `p.EntDate >= ? AND p.EntDate < date(?, '+1 day')`,
    params: [range.start, range.end],
  };
  if (scope.allDepartments) {
    return (
      queryScalar<number>(scope,

        `SELECT ROUND(SUM(p.Amount),2) FROM Payment p WHERE p.IsActive = 1 AND ${r.sql}`,
        r.params,
      ) ?? 0
    );
  }
  const it = itemTypeClause(scope);
  return (
    queryScalar<number>(scope,

      `SELECT ROUND(SUM(p.Amount),2) FROM Payment p
       WHERE p.IsActive = 1 AND ${r.sql} AND p.InvoiceDocId IN (
         SELECT DISTINCT d.InvoiceDocId FROM InvoiceDetail d WHERE ${it.sql}
       )`,
      [...r.params, ...it.params],
    ) ?? 0
  );
}

export function partsInRange(
  scope: AnalyticsScope,
  range: DateRange,
  opts: { canCost: boolean; canMargin: boolean },
): { revenue: number; cost: number | null; margin: number | null } {
  const r = rangeClause(range);
  const row = query<{ rev: number; cost: number }>(scope,

    `SELECT ROUND(SUM(sp.NetExt),2) AS rev,
            ROUND(SUM(sp.Qty * COALESCE(sp.AvgCost,0)),2) AS cost
     FROM SalePart sp
     JOIN InvoiceDetail d ON d.ItemId = sp.ItemId
     JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
     WHERE ${POSTED_STATUS_SQL} AND ${r.sql}`,
    r.params,
  )[0];
  const revenue = row?.rev ?? 0;
  const cost = row?.cost ?? 0;
  return {
    revenue,
    cost: opts.canCost ? cost : null,
    margin: opts.canMargin ? Math.round((revenue - cost) * 100) / 100 : null,
  };
}

export function departmentRevenueInRange(
  scope: AnalyticsScope,
  range: DateRange,
): { label: string; value: number }[] {
  const r = rangeClause(range);
  const rows = query<{ department: string; revenue: number }>(scope,

    `SELECT CASE
              WHEN d.ItemType IN ('UN','TR','RU','RE') THEN 'Sales'
              WHEN d.ItemType = 'PA' THEN 'Parts'
              WHEN d.ItemType = 'SL' THEN 'Service'
              ELSE 'Other'
            END AS department,
            ROUND(SUM(d.NetExt),2) AS revenue
     FROM InvoiceDetail d JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
     WHERE ${POSTED_STATUS_SQL} AND ${r.sql}
     GROUP BY department`,
    r.params,
  );
  const order = ["Sales", "Parts", "Service"];
  return order
    .map((label) => ({
      label,
      value: rows.find((x) => x.department === label)?.revenue ?? 0,
    }))
    .filter((x) => x.value > 0);
}

export function topCustomersInRange(
  scope: AnalyticsScope,
  canViewContacts: boolean,
  range: DateRange,
  limit: number,
): { label: string; value: number }[] {
  const r = rangeClause(range);
  let rows: { customerId: number; name: string | null; revenue: number }[];
  if (scope.allDepartments) {
    rows = query(
      scope,
      `SELECT h.CustomerId AS customerId, c.CustomerName AS name,
              ROUND(SUM(h.TotalInvoice),2) AS revenue
       FROM InvoiceHeader h LEFT JOIN Customer c ON c.CustomerId = h.CustomerId
       WHERE ${POSTED_STATUS_SQL} AND ${r.sql}
       GROUP BY h.CustomerId ORDER BY revenue DESC LIMIT ?`,
      [...r.params, limit],
    );
  } else {
    const it = itemTypeClause(scope);
    rows = query(
      scope,
      `SELECT h.CustomerId AS customerId, c.CustomerName AS name,
              ROUND(SUM(d.NetExt),2) AS revenue
       FROM InvoiceDetail d
       JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
       LEFT JOIN Customer c ON c.CustomerId = h.CustomerId
       WHERE ${POSTED_STATUS_SQL} AND ${it.sql} AND ${r.sql}
       GROUP BY h.CustomerId ORDER BY revenue DESC LIMIT ?`,
      [...it.params, ...r.params, limit],
    );
  }
  return rows.map((row) => ({
    value: row.revenue ?? 0,
    label: canViewContacts
      ? row.name?.trim() || `Customer #${row.customerId}`
      : `Customer #${row.customerId}`,
  }));
}

export function inactiveCustomers(
  scope: AnalyticsScope,
  canViewContacts: boolean,
  asOf: string,
  quietDays: number,
  limit: number,
): { label: string; value: number }[] {
  const cutoff = `date(?, '-${Math.max(30, quietDays)} day')`;
  let rows: { customerId: number; name: string | null; last: string }[];
  if (scope.allDepartments) {
    rows = query(
      scope,
      `SELECT h.CustomerId AS customerId, c.CustomerName AS name,
              MAX(${POSTED_DATE_SQL}) AS last
       FROM InvoiceHeader h LEFT JOIN Customer c ON c.CustomerId = h.CustomerId
       WHERE ${POSTED_STATUS_SQL}
       GROUP BY h.CustomerId
       HAVING last < ${cutoff} AND last >= date(?, '-365 day')
       ORDER BY last ASC LIMIT ?`,
      [asOf, asOf, limit],
    );
  } else {
    const it = itemTypeClause(scope);
    rows = query(
      scope,
      `SELECT h.CustomerId AS customerId, c.CustomerName AS name,
              MAX(${POSTED_DATE_SQL}) AS last
       FROM InvoiceDetail d
       JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
       LEFT JOIN Customer c ON c.CustomerId = h.CustomerId
       WHERE ${POSTED_STATUS_SQL} AND ${it.sql}
       GROUP BY h.CustomerId
       HAVING last < ${cutoff} AND last >= date(?, '-365 day')
       ORDER BY last ASC LIMIT ?`,
      [...it.params, asOf, asOf, limit],
    );
  }
  return rows.map((row) => ({
    value: 1,
    label: canViewContacts
      ? `${row.name?.trim() || `Customer #${row.customerId}`} · last ${String(row.last).slice(0, 10)}`
      : `Customer #${row.customerId} · last ${String(row.last).slice(0, 10)}`,
  }));
}

export function trendInRange(
  scope: AnalyticsScope,
  range: DateRange,
): { label: string; value: number }[] {
  const r = rangeClause(range);
  const span =
    (Date.parse(`${range.end}T00:00:00Z`) - Date.parse(`${range.start}T00:00:00Z`)) /
    86400000;
  const grain = span > 60 ? "month" : "day";
  const expr = grain === "month" ? `substr(${POSTED_DATE_SQL},1,7)` : `substr(${POSTED_DATE_SQL},1,10)`;

  if (scope.allDepartments) {
    return query<{ label: string; value: number }>(scope,

      `SELECT ${expr} AS label, ROUND(SUM(h.TotalInvoice),2) AS value
       FROM InvoiceHeader h WHERE ${POSTED_STATUS_SQL} AND ${r.sql}
       GROUP BY label ORDER BY label`,
      r.params,
    );
  }
  const it = itemTypeClause(scope);
  return query<{ label: string; value: number }>(scope,

    `SELECT ${expr} AS label, ROUND(SUM(d.NetExt),2) AS value
     FROM InvoiceDetail d JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
     WHERE ${POSTED_STATUS_SQL} AND ${it.sql} AND ${r.sql}
     GROUP BY label ORDER BY label`,
    [...it.params, ...r.params],
  );
}

export function openWorkOrders(scope: AnalyticsScope): number {
  return (
    queryScalar<number>(scope,

      `SELECT COUNT(*) FROM InvoiceHeader h
       WHERE h.InvoiceType = 'wo' AND h.Status NOT IN ('finalized','archived','voided')`,
    ) ?? 0
  );
}

export function workOrderAging(scope: AnalyticsScope, asOf: string): { label: string; value: number }[] {
  const rows = query<{ label: string; value: number }>(scope,

    `WITH aged AS (
       SELECT CAST(julianday(substr(?,1,10))
         - julianday(substr(COALESCE(NULLIF(h.ActivityDate,''), h.FinalizedDate),1,10))
         AS INTEGER) AS days
       FROM InvoiceHeader h
       WHERE h.InvoiceType = 'wo' AND h.Status NOT IN ('finalized','archived','voided')
     )
     SELECT CASE
       WHEN days IS NULL THEN 'Unknown'
       WHEN days <= 3 THEN '0–3 days'
       WHEN days <= 7 THEN '4–7 days'
       WHEN days <= 14 THEN '8–14 days'
       ELSE '15+ days' END AS label,
       COUNT(*) AS value
     FROM aged GROUP BY label`,
    [asOf],
  );
  const order = ["0–3 days", "4–7 days", "8–14 days", "15+ days", "Unknown"];
  return order
    .map((label) => ({ label, value: rows.find((r) => r.label === label)?.value ?? 0 }))
    .filter((r) => r.value > 0);
}

export function technicianWorkload(scope: AnalyticsScope): { label: string; value: number }[] {
  return query<{ first: string | null; last: string | null; value: number }>(scope,

    `SELECT au.FirstName AS first, au.LastName AS last, ROUND(SUM(w.ElapsedHours),1) AS value
     FROM WorkInProgress w LEFT JOIN AppUser au ON au.AppUserId = w.TechId
     WHERE w.IsActive = 1
     GROUP BY w.TechId ORDER BY value DESC LIMIT 12`,
  ).map((r) => ({
    label: `${(r.first ?? "").trim()} ${(r.last ?? "").trim()}`.trim() || "Unassigned",
    value: r.value ?? 0,
  }));
}

export function serviceLaborInRange(scope: AnalyticsScope, range: DateRange): { revenue: number; workOrders: number } {
  const r = rangeClause(range);
  const revenue =
    queryScalar<number>(scope,

      `SELECT ROUND(SUM(d.NetExt),2) FROM InvoiceDetail d
       JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
       WHERE ${POSTED_STATUS_SQL} AND d.ItemType = 'SL' AND ${r.sql}`,
      r.params,
    ) ?? 0;
  const workOrders =
    queryScalar<number>(scope,

      `SELECT COUNT(*) FROM InvoiceHeader h
       WHERE h.InvoiceType = 'wo' AND ${POSTED_STATUS_SQL} AND ${r.sql}`,
      r.params,
    ) ?? 0;
  return { revenue, workOrders };
}

export function inventorySnapshot(scope: AnalyticsScope, canCost: boolean): {
  units: number;
  retail: number;
  cost: number | null;
  aging: { label: string; value: number }[];
} {
  const asOf = reportAsOf(scope);
  const totals = query<{ units: number; retail: number; cost: number }>(scope,

    `SELECT COUNT(*) AS units, ROUND(SUM(BaseRetail),2) AS retail, ROUND(SUM(BaseCost),2) AS cost
     FROM UnitBase WHERE TRIM(StockStatus) = 'instock'`,
  )[0];
  const aging = query<{ label: string; value: number }>(scope,

    `WITH aged AS (
       SELECT CAST(julianday(substr(?,1,10))
         - julianday(substr(COALESCE(NULLIF(DateReceived,''), NULLIF(DatePurchased,''), EntDate),1,10))
         AS INTEGER) AS days
       FROM UnitBase WHERE TRIM(StockStatus) = 'instock'
     )
     SELECT CASE
       WHEN days IS NULL THEN 'Unknown'
       WHEN days <= 90 THEN '0–90 days'
       WHEN days <= 180 THEN '91–180 days'
       WHEN days <= 365 THEN '181–365 days'
       ELSE '365+ days' END AS label,
       COUNT(*) AS value
     FROM aged GROUP BY label`,
    [asOf],
  );
  const order = ["0–90 days", "91–180 days", "181–365 days", "365+ days", "Unknown"];
  return {
    units: totals?.units ?? 0,
    retail: totals?.retail ?? 0,
    cost: canCost ? (totals?.cost ?? 0) : null,
    aging: order
      .map((label) => ({ label, value: aging.find((a) => a.label === label)?.value ?? 0 }))
      .filter((a) => a.value > 0),
  };
}

export function salesUnitsInRange(scope: AnalyticsScope, range: DateRange): { units: number; revenue: number } {
  const r = rangeClause(range);
  const row = query<{ units: number; revenue: number }>(scope,

    `SELECT COUNT(*) AS units, ROUND(SUM(su.NetExt),2) AS revenue
     FROM SaleUnit su
     JOIN InvoiceDetail d ON d.ItemId = su.ItemId
     JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
     WHERE ${POSTED_STATUS_SQL} AND ${r.sql}`,
    r.params,
  )[0];
  return { units: row?.units ?? 0, revenue: row?.revenue ?? 0 };
}
