import "server-only";
import { query, queryScalar } from "@/lib/db/dealership";
import { POSTED_STATUS_SQL, POSTED_DATE_SQL } from "@/lib/semantic/metrics";
import { itemTypeClause, type AnalyticsScope } from "@/lib/analytics/scope";

/**
 * Scoped analytics queries. Every function that can be scoped takes the
 * AnalyticsScope and applies the department (ItemType) restriction. Measures
 * behind feature gates (cost, margin, payments, technician) are only invoked by
 * the service when the scope permits them — but these builders also keep their
 * SQL minimal and never leak restricted columns implicitly.
 *
 * Revenue convention:
 *   - All-department users get canonical header revenue (SUM TotalInvoice).
 *   - Department-scoped users get line revenue (SUM InvoiceDetail.NetExt) for
 *     their ItemTypes, which is the accurate slice of their department.
 */

export function getDataAsOf(): string | undefined {
  return queryScalar<string>(
    `SELECT MAX(${POSTED_DATE_SQL}) FROM InvoiceHeader h WHERE ${POSTED_STATUS_SQL}`,
  );
}

/** Posted revenue for the scope. */
export function getScopedRevenue(scope: AnalyticsScope): number {
  if (scope.allDepartments) {
    return (
      queryScalar<number>(
        `SELECT ROUND(SUM(h.TotalInvoice),2) FROM InvoiceHeader h WHERE ${POSTED_STATUS_SQL}`,
      ) ?? 0
    );
  }
  const it = itemTypeClause(scope);
  return (
    queryScalar<number>(
      `SELECT ROUND(SUM(d.NetExt),2)
       FROM InvoiceDetail d JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
       WHERE ${POSTED_STATUS_SQL} AND ${it.sql}`,
      it.params,
    ) ?? 0
  );
}

/** Number of posted invoices in scope. */
export function getScopedInvoiceCount(scope: AnalyticsScope): number {
  if (scope.allDepartments) {
    return (
      queryScalar<number>(
        `SELECT COUNT(*) FROM InvoiceHeader h WHERE ${POSTED_STATUS_SQL}`,
      ) ?? 0
    );
  }
  const it = itemTypeClause(scope);
  return (
    queryScalar<number>(
      `SELECT COUNT(DISTINCT d.InvoiceDocId)
       FROM InvoiceDetail d JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
       WHERE ${POSTED_STATUS_SQL} AND ${it.sql}`,
      it.params,
    ) ?? 0
  );
}

/** Distinct customers with posted activity in the trailing 12 months (scoped). */
export function getScopedActiveCustomers(
  scope: AnalyticsScope,
  asOf: string,
): number {
  if (scope.allDepartments) {
    return (
      queryScalar<number>(
        `SELECT COUNT(DISTINCT h.CustomerId) FROM InvoiceHeader h
         WHERE ${POSTED_STATUS_SQL} AND ${POSTED_DATE_SQL} >= date(substr(?,1,10), '-365 day')`,
        [asOf],
      ) ?? 0
    );
  }
  const it = itemTypeClause(scope);
  return (
    queryScalar<number>(
      `SELECT COUNT(DISTINCT h.CustomerId)
       FROM InvoiceDetail d JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
       WHERE ${POSTED_STATUS_SQL} AND ${it.sql}
         AND ${POSTED_DATE_SQL} >= date(substr(?,1,10), '-365 day')`,
      [...it.params, asOf],
    ) ?? 0
  );
}

export interface YearRevenue {
  year: string;
  revenue: number;
  invoices: number;
}

export function getScopedRevenueByYear(scope: AnalyticsScope): YearRevenue[] {
  if (scope.allDepartments) {
    return query<YearRevenue>(
      `SELECT substr(${POSTED_DATE_SQL},1,4) AS year,
              ROUND(SUM(h.TotalInvoice),2) AS revenue,
              COUNT(*) AS invoices
       FROM InvoiceHeader h WHERE ${POSTED_STATUS_SQL}
       GROUP BY year ORDER BY year`,
    );
  }
  const it = itemTypeClause(scope);
  return query<YearRevenue>(
    `SELECT substr(${POSTED_DATE_SQL},1,4) AS year,
            ROUND(SUM(d.NetExt),2) AS revenue,
            COUNT(DISTINCT d.InvoiceDocId) AS invoices
     FROM InvoiceDetail d JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
     WHERE ${POSTED_STATUS_SQL} AND ${it.sql}
     GROUP BY year ORDER BY year`,
    it.params,
  );
}

export interface MonthRevenue {
  month: string; // YYYY-MM
  revenue: number;
  invoices: number;
}

/** Drill-down: monthly revenue within a year, scoped. */
export function getScopedRevenueByMonth(
  scope: AnalyticsScope,
  year: string,
): MonthRevenue[] {
  const yr = year.replace(/[^0-9]/g, "").slice(0, 4);
  if (scope.allDepartments) {
    return query<MonthRevenue>(
      `SELECT substr(${POSTED_DATE_SQL},1,7) AS month,
              ROUND(SUM(h.TotalInvoice),2) AS revenue,
              COUNT(*) AS invoices
       FROM InvoiceHeader h
       WHERE ${POSTED_STATUS_SQL} AND substr(${POSTED_DATE_SQL},1,4) = ?
       GROUP BY month ORDER BY month`,
      [yr],
    );
  }
  const it = itemTypeClause(scope);
  return query<MonthRevenue>(
    `SELECT substr(${POSTED_DATE_SQL},1,7) AS month,
            ROUND(SUM(d.NetExt),2) AS revenue,
            COUNT(DISTINCT d.InvoiceDocId) AS invoices
     FROM InvoiceDetail d JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
     WHERE ${POSTED_STATUS_SQL} AND ${it.sql} AND substr(${POSTED_DATE_SQL},1,4) = ?
     GROUP BY month ORDER BY month`,
    [...it.params, yr],
  );
}

export interface DepartmentRevenue {
  department: string;
  revenue: number;
}

/** Revenue split across the three departments (cross-department users only). */
export function getRevenueByDepartment(): DepartmentRevenue[] {
  const rows = query<{ department: string; revenue: number }>(
    `SELECT CASE
              WHEN d.ItemType IN ('UN','TR','RU','RE') THEN 'Sales'
              WHEN d.ItemType = 'PA' THEN 'Parts'
              WHEN d.ItemType = 'SL' THEN 'Service'
              ELSE 'Other'
            END AS department,
            ROUND(SUM(d.NetExt),2) AS revenue
     FROM InvoiceDetail d JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
     WHERE ${POSTED_STATUS_SQL}
     GROUP BY department`,
  );
  const order = ["Sales", "Parts", "Service", "Other"];
  return rows
    .filter((r) => r.department !== "Other")
    .sort((a, b) => order.indexOf(a.department) - order.indexOf(b.department));
}

export interface PartsProfit {
  revenue: number;
  cost: number;
  margin: number;
}

/** Parts revenue/cost/margin — only call when cost/margin are permitted. */
export function getPartsProfit(): PartsProfit {
  const row = query<{ rev: number; cost: number }>(
    `SELECT ROUND(SUM(sp.NetExt),2) AS rev,
            ROUND(SUM(sp.Qty * COALESCE(sp.AvgCost,0)),2) AS cost
     FROM SalePart sp
     JOIN InvoiceDetail d ON d.ItemId = sp.ItemId
     JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
     WHERE ${POSTED_STATUS_SQL}`,
  )[0];
  const revenue = row?.rev ?? 0;
  const cost = row?.cost ?? 0;
  return { revenue, cost, margin: Math.round((revenue - cost) * 100) / 100 };
}

export interface InventorySnapshot {
  units: number;
  retailValue: number;
  costValue: number;
}

export function getInventorySnapshot(): InventorySnapshot {
  const row = query<{ units: number; retail: number; cost: number }>(
    `SELECT COUNT(*) AS units, ROUND(SUM(BaseRetail),2) AS retail, ROUND(SUM(BaseCost),2) AS cost
     FROM UnitBase WHERE TRIM(StockStatus) = 'instock'`,
  )[0];
  return {
    units: row?.units ?? 0,
    retailValue: row?.retail ?? 0,
    costValue: row?.cost ?? 0,
  };
}

export interface ServiceStats {
  openWorkOrders: number;
  technicianLaborHours: number | null;
}

export function getServiceStats(includeTech: boolean): ServiceStats {
  const openWorkOrders =
    queryScalar<number>(
      `SELECT COUNT(*) FROM InvoiceHeader h
       WHERE h.InvoiceType = 'wo' AND h.Status NOT IN ('finalized','archived','voided')`,
    ) ?? 0;
  let technicianLaborHours: number | null = null;
  if (includeTech) {
    technicianLaborHours =
      queryScalar<number>(
        `SELECT ROUND(SUM(ElapsedHours),1) FROM WorkInProgress WHERE IsActive = 1`,
      ) ?? 0;
  }
  return { openWorkOrders, technicianLaborHours };
}

/** Receivables / payments total — only call when payments are permitted. */
export function getPaymentsTotal(scope: AnalyticsScope): number {
  if (scope.allDepartments) {
    return (
      queryScalar<number>(
        `SELECT ROUND(SUM(p.Amount),2) FROM Payment p`,
      ) ?? 0
    );
  }
  const it = itemTypeClause(scope);
  return (
    queryScalar<number>(
      `SELECT ROUND(SUM(p.Amount),2) FROM Payment p
       WHERE p.InvoiceDocId IN (
         SELECT DISTINCT d.InvoiceDocId FROM InvoiceDetail d WHERE ${it.sql}
       )`,
      it.params,
    ) ?? 0
  );
}

export interface TopCustomer {
  customerId: number;
  name: string;
  revenue: number;
}

/**
 * Top customers by posted revenue in scope. Names are only revealed when the
 * caller has customer-contact permission; otherwise they are masked.
 */
export function getTopCustomers(
  scope: AnalyticsScope,
  canViewContacts: boolean,
  limit = 8,
): TopCustomer[] {
  let rows: { customerId: number; name: string | null; revenue: number }[];
  if (scope.allDepartments) {
    rows = query(
      `SELECT h.CustomerId AS customerId,
              c.CustomerName AS name,
              ROUND(SUM(h.TotalInvoice),2) AS revenue
       FROM InvoiceHeader h LEFT JOIN Customer c ON c.CustomerId = h.CustomerId
       WHERE ${POSTED_STATUS_SQL}
       GROUP BY h.CustomerId ORDER BY revenue DESC LIMIT ?`,
      [limit],
    );
  } else {
    const it = itemTypeClause(scope);
    rows = query(
      `SELECT h.CustomerId AS customerId,
              c.CustomerName AS name,
              ROUND(SUM(d.NetExt),2) AS revenue
       FROM InvoiceDetail d
       JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
       LEFT JOIN Customer c ON c.CustomerId = h.CustomerId
       WHERE ${POSTED_STATUS_SQL} AND ${it.sql}
       GROUP BY h.CustomerId ORDER BY revenue DESC LIMIT ?`,
      [...it.params, limit],
    );
  }
  return rows.map((r) => ({
    customerId: r.customerId,
    revenue: r.revenue ?? 0,
    name: canViewContacts
      ? r.name?.trim() || `Customer #${r.customerId}`
      : `Customer #${r.customerId}`,
  }));
}
