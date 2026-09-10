import "server-only";
import { query, queryScalar } from "@/lib/db/dealership";
import { POSTED_STATUS_SQL, POSTED_DATE_SQL } from "@/lib/semantic/metrics";

/**
 * Executable semantic query builders.
 *
 * These functions implement the definitions in ./metrics.ts against the
 * read-only dealership database. They intentionally keep security scoping OUT
 * of scope for Milestone 1 — role/department/location filters are layered on in
 * later milestones. For now they express the base calculations so the semantic
 * layer can be validated end-to-end.
 */

/** Latest posted activity date in the data — the platform's "as-of" anchor. */
export function getDataAsOfDate(): string | undefined {
  return queryScalar<string>(
    `SELECT MAX(${POSTED_DATE_SQL}) FROM InvoiceHeader h WHERE ${POSTED_STATUS_SQL}`,
  );
}

export function getPostedRevenue(): number {
  return (
    queryScalar<number>(
      `SELECT ROUND(SUM(h.TotalInvoice), 2) FROM InvoiceHeader h WHERE ${POSTED_STATUS_SQL}`,
    ) ?? 0
  );
}

export function getInvoiceCount(): number {
  return (
    queryScalar<number>(
      `SELECT COUNT(*) FROM InvoiceHeader h WHERE ${POSTED_STATUS_SQL}`,
    ) ?? 0
  );
}

export function getAverageInvoiceValue(): number {
  const count = getInvoiceCount();
  if (count === 0) return 0;
  return getPostedRevenue() / count;
}

/** Distinct customers with a posted invoice in the trailing 12 months of data. */
export function getActiveCustomers(asOf?: string): number {
  const anchor = asOf ?? getDataAsOfDate();
  if (!anchor) return 0;
  return (
    queryScalar<number>(
      `SELECT COUNT(DISTINCT h.CustomerId)
       FROM InvoiceHeader h
       WHERE ${POSTED_STATUS_SQL}
         AND ${POSTED_DATE_SQL} >= date(substr(?,1,10), '-365 day')`,
      [anchor],
    ) ?? 0
  );
}

export function getPartsRevenue(): number {
  return (
    queryScalar<number>(
      `SELECT ROUND(SUM(sp.NetExt), 2)
       FROM SalePart sp
       JOIN InvoiceDetail d ON d.ItemId = sp.ItemId
       JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
       WHERE ${POSTED_STATUS_SQL}`,
    ) ?? 0
  );
}

export function getEstimatedPartsMargin(): number {
  return (
    queryScalar<number>(
      `SELECT ROUND(SUM(sp.NetExt) - SUM(sp.Qty * COALESCE(sp.AvgCost, 0)), 2)
       FROM SalePart sp
       JOIN InvoiceDetail d ON d.ItemId = sp.ItemId
       JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
       WHERE ${POSTED_STATUS_SQL}`,
    ) ?? 0
  );
}

export interface InventoryValue {
  units: number;
  retailValue: number;
  costValue: number;
}

export function getInventoryValue(): InventoryValue {
  const row = query<{ units: number; retail: number; cost: number }>(
    `SELECT COUNT(*) AS units,
            ROUND(SUM(BaseRetail), 2) AS retail,
            ROUND(SUM(BaseCost), 2) AS cost
     FROM UnitBase
     WHERE TRIM(StockStatus) = 'instock'`,
  )[0];
  return {
    units: row?.units ?? 0,
    retailValue: row?.retail ?? 0,
    costValue: row?.cost ?? 0,
  };
}

export function getOpenWorkOrders(): number {
  return (
    queryScalar<number>(
      `SELECT COUNT(*) FROM InvoiceHeader h
       WHERE h.InvoiceType = 'wo'
         AND h.Status NOT IN ('finalized','archived','voided')`,
    ) ?? 0
  );
}

export function getTechnicianLaborHours(): number {
  return (
    queryScalar<number>(
      `SELECT ROUND(SUM(ElapsedHours), 1) FROM WorkInProgress WHERE IsActive = 1`,
    ) ?? 0
  );
}

/** Posted revenue grouped by calendar year — a quick sanity/validation view. */
export function getRevenueByYear(): Array<{
  year: string;
  invoices: number;
  revenue: number;
}> {
  return query<{ year: string; invoices: number; revenue: number }>(
    `SELECT substr(${POSTED_DATE_SQL}, 1, 4) AS year,
            COUNT(*) AS invoices,
            ROUND(SUM(h.TotalInvoice), 2) AS revenue
     FROM InvoiceHeader h
     WHERE ${POSTED_STATUS_SQL}
     GROUP BY year
     ORDER BY year`,
  );
}
