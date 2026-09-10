import "server-only";
import { query, queryScalar } from "@/lib/db/dealership";
import { POSTED_STATUS_SQL, POSTED_DATE_SQL } from "@/lib/semantic/metrics";
import { config } from "@/lib/config";

/**
 * Department-module analytics.
 *
 * Each module is inherently a department, so the department dimension is fixed
 * by the module itself (access is guarded by the module.* permission). Within a
 * module, sensitive MEASURES are still gated by feature permissions: cost,
 * margin, payments, technician performance, and customer identities are only
 * computed/returned when the caller is authorized. Callers pass the relevant
 * feature flags; restricted data is never returned otherwise.
 */

export interface NameValue {
  label: string;
  value: number;
}
export interface YearValue {
  year: string;
  value: number;
}

function fullName(first: string | null, last: string | null, fallback: string): string {
  const n = `${(first ?? "").trim()} ${(last ?? "").trim()}`.trim();
  return n || fallback;
}

export function dataAsOf(): string {
  return (
    queryScalar<string>(
      `SELECT MAX(${POSTED_DATE_SQL}) FROM InvoiceHeader h WHERE ${POSTED_STATUS_SQL}`,
    ) ?? config.dataAsOfFallback
  );
}

/* =============================== SALES ================================== */

export interface SalesModule {
  unitRevenue: number;
  unitsSold: number;
  avgUnitPrice: number;
  rentalRevenue: number;
  unitCost: number | null;
  unitMargin: number | null;
  byYear: YearValue[];
  topCategories: NameValue[];
  topSalespeople: NameValue[];
}

export function getSalesModule(opts: { canCost: boolean; canMargin: boolean }): SalesModule {
  const u = query<{ rev: number; cost: number; units: number }>(
    `SELECT ROUND(SUM(su.NetExt),2) rev, ROUND(SUM(su.InvoiceCost),2) cost, COUNT(*) units
     FROM SaleUnit su
     JOIN InvoiceDetail d ON d.ItemId = su.ItemId
     JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
     WHERE ${POSTED_STATUS_SQL}`,
  )[0];
  const unitRevenue = u?.rev ?? 0;
  const unitsSold = u?.units ?? 0;
  const cost = u?.cost ?? 0;

  const rentalRevenue =
    queryScalar<number>(
      `SELECT ROUND(SUM(d.NetExt),2) FROM InvoiceDetail d
       JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
       WHERE ${POSTED_STATUS_SQL} AND d.ItemType IN ('RU','RE')`,
    ) ?? 0;

  const byYear = query<{ year: string; value: number }>(
    `SELECT substr(${POSTED_DATE_SQL},1,4) year, ROUND(SUM(su.NetExt),2) value
     FROM SaleUnit su
     JOIN InvoiceDetail d ON d.ItemId = su.ItemId
     JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
     WHERE ${POSTED_STATUS_SQL} GROUP BY year ORDER BY year`,
  );

  const topCategories = query<{ label: string; value: number }>(
    `SELECT COALESCE(uc.DisplayText, 'Uncategorized') label, ROUND(SUM(su.NetExt),2) value
     FROM SaleUnit su
     JOIN InvoiceDetail d ON d.ItemId = su.ItemId
     JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
     LEFT JOIN UnitBase ub ON ub.UnitId = su.UnitId
     LEFT JOIN UnitCategory uc ON uc.UnitCategoryId = ub.UnitCategoryId
     WHERE ${POSTED_STATUS_SQL} GROUP BY label ORDER BY value DESC LIMIT 8`,
  );

  const topSalespeople = query<{ first: string; last: string; value: number }>(
    `SELECT au.FirstName first, au.LastName last, ROUND(SUM(su.NetExt),2) value
     FROM SaleUnit su
     JOIN InvoiceDetail d ON d.ItemId = su.ItemId
     JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
     LEFT JOIN AppUser au ON au.AppUserId = h.SalesPersonId
     WHERE ${POSTED_STATUS_SQL} GROUP BY h.SalesPersonId ORDER BY value DESC LIMIT 6`,
  ).map((r) => ({ label: fullName(r.first, r.last, "Unassigned"), value: r.value }));

  return {
    unitRevenue,
    unitsSold,
    avgUnitPrice: unitsSold ? Math.round((unitRevenue / unitsSold) * 100) / 100 : 0,
    rentalRevenue,
    unitCost: opts.canCost ? cost : null,
    unitMargin: opts.canMargin ? Math.round((unitRevenue - cost) * 100) / 100 : null,
    byYear,
    topCategories,
    topSalespeople,
  };
}

/* =============================== PARTS ================================== */

export interface PartsModule {
  revenue: number;
  cost: number | null;
  margin: number | null;
  lines: number;
  qty: number;
  byYear: YearValue[];
  topManufacturers: NameValue[];
  topParts: NameValue[];
}

export function getPartsModule(opts: { canCost: boolean; canMargin: boolean }): PartsModule {
  const p = query<{ rev: number; cost: number; lines: number; qty: number }>(
    `SELECT ROUND(SUM(sp.NetExt),2) rev, ROUND(SUM(sp.Qty*COALESCE(sp.AvgCost,0)),2) cost,
            COUNT(*) lines, ROUND(SUM(sp.Qty),0) qty
     FROM SalePart sp
     JOIN InvoiceDetail d ON d.ItemId = sp.ItemId
     JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
     WHERE ${POSTED_STATUS_SQL}`,
  )[0];
  const revenue = p?.rev ?? 0;
  const cost = p?.cost ?? 0;

  const byYear = query<{ year: string; value: number }>(
    `SELECT substr(${POSTED_DATE_SQL},1,4) year, ROUND(SUM(sp.NetExt),2) value
     FROM SalePart sp
     JOIN InvoiceDetail d ON d.ItemId = sp.ItemId
     JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
     WHERE ${POSTED_STATUS_SQL} GROUP BY year ORDER BY year`,
  );

  const topManufacturers = query<{ label: string; value: number }>(
    `SELECT COALESCE(pm.DisplayText, sp.MfgCode, 'Unknown') label, ROUND(SUM(sp.NetExt),2) value
     FROM SalePart sp
     JOIN InvoiceDetail d ON d.ItemId = sp.ItemId
     JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
     LEFT JOIN PartManufacturer pm ON pm.MfgId = sp.MfgId
     WHERE ${POSTED_STATUS_SQL} GROUP BY label ORDER BY value DESC LIMIT 8`,
  );

  const topParts = query<{ label: string; value: number }>(
    `SELECT (sp.PartNo || ' · ' || COALESCE(NULLIF(TRIM(sp.Description),''),'')) label,
            ROUND(SUM(sp.NetExt),2) value
     FROM SalePart sp
     JOIN InvoiceDetail d ON d.ItemId = sp.ItemId
     JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
     WHERE ${POSTED_STATUS_SQL} GROUP BY sp.PartNo ORDER BY value DESC LIMIT 8`,
  );

  return {
    revenue,
    cost: opts.canCost ? cost : null,
    margin: opts.canMargin ? Math.round((revenue - cost) * 100) / 100 : null,
    lines: p?.lines ?? 0,
    qty: p?.qty ?? 0,
    byYear,
    topManufacturers,
    topParts,
  };
}

/* ============================== SERVICE ================================ */

export interface ServiceModule {
  laborRevenue: number;
  workOrders: number;
  openWorkOrders: number;
  laborHours: number | null;
  byYear: YearValue[];
  statusBreakdown: NameValue[];
  topTechnicians: NameValue[] | null;
}

export function getServiceModule(opts: { canTechnician: boolean }): ServiceModule {
  const laborRevenue =
    queryScalar<number>(
      `SELECT ROUND(SUM(d.NetExt),2) FROM InvoiceDetail d
       JOIN InvoiceHeader h ON h.InvoiceDocId = d.InvoiceDocId
       WHERE ${POSTED_STATUS_SQL} AND d.ItemType = 'SL'`,
    ) ?? 0;
  const workOrders =
    queryScalar<number>(
      `SELECT COUNT(*) FROM InvoiceHeader h WHERE h.InvoiceType='wo' AND ${POSTED_STATUS_SQL}`,
    ) ?? 0;
  const openWorkOrders =
    queryScalar<number>(
      `SELECT COUNT(*) FROM InvoiceHeader h
       WHERE h.InvoiceType='wo' AND h.Status NOT IN ('finalized','archived','voided')`,
    ) ?? 0;

  const byYear = query<{ year: string; value: number }>(
    `SELECT substr(${POSTED_DATE_SQL},1,4) year, ROUND(SUM(d.NetExt),2) value
     FROM InvoiceDetail d JOIN InvoiceHeader h ON h.InvoiceDocId=d.InvoiceDocId
     WHERE ${POSTED_STATUS_SQL} AND d.ItemType='SL' GROUP BY year ORDER BY year`,
  );

  const statusBreakdown = query<{ label: string; value: number }>(
    `SELECT COALESCE(s.DisplayText, 'Unspecified') label, COUNT(*) value
     FROM InvoiceHeader h
     LEFT JOIN SettingsWorkOrderStatus s ON s.WorkOrderStatusId = h.WOStatusId
     WHERE h.InvoiceType='wo' AND h.Status NOT IN ('finalized','archived','voided')
     GROUP BY label ORDER BY value DESC LIMIT 10`,
  );

  let laborHours: number | null = null;
  let topTechnicians: NameValue[] | null = null;
  if (opts.canTechnician) {
    laborHours =
      queryScalar<number>(
        `SELECT ROUND(SUM(ElapsedHours),1) FROM WorkInProgress WHERE IsActive=1`,
      ) ?? 0;
    topTechnicians = query<{ first: string; last: string; value: number }>(
      `SELECT au.FirstName first, au.LastName last, ROUND(SUM(w.ElapsedHours),1) value
       FROM WorkInProgress w LEFT JOIN AppUser au ON au.AppUserId = w.TechId
       WHERE w.IsActive=1 GROUP BY w.TechId ORDER BY value DESC LIMIT 8`,
    ).map((r) => ({ label: fullName(r.first, r.last, "Unassigned"), value: r.value }));
  }

  return {
    laborRevenue,
    workOrders,
    openWorkOrders,
    laborHours,
    byYear,
    statusBreakdown,
    topTechnicians,
  };
}

/* ============================= CUSTOMERS =============================== */

export interface CustomersModule {
  total: number;
  business: number;
  individual: number;
  active12mo: number;
  topCustomers: { customerId: number; name: string; revenue: number }[];
  newByYear: YearValue[];
  contactsMasked: boolean;
}

export function getCustomersModule(opts: { canContacts: boolean }): CustomersModule {
  const counts = query<{ total: number; biz: number }>(
    `SELECT COUNT(*) total, SUM(CASE WHEN IsBusiness=1 THEN 1 ELSE 0 END) biz
     FROM Customer WHERE IsActive=1`,
  )[0];
  const total = counts?.total ?? 0;
  const business = counts?.biz ?? 0;

  const asOf = dataAsOf();
  const active12mo =
    queryScalar<number>(
      `SELECT COUNT(DISTINCT h.CustomerId) FROM InvoiceHeader h
       WHERE ${POSTED_STATUS_SQL} AND ${POSTED_DATE_SQL} >= date(substr(?,1,10),'-365 day')`,
      [asOf],
    ) ?? 0;

  const rows = query<{ customerId: number; name: string | null; revenue: number }>(
    `SELECT h.CustomerId customerId, c.CustomerName name, ROUND(SUM(h.TotalInvoice),2) revenue
     FROM InvoiceHeader h LEFT JOIN Customer c ON c.CustomerId=h.CustomerId
     WHERE ${POSTED_STATUS_SQL} GROUP BY h.CustomerId ORDER BY revenue DESC LIMIT 12`,
  );
  const topCustomers = rows.map((r) => ({
    customerId: r.customerId,
    revenue: r.revenue ?? 0,
    name: opts.canContacts
      ? r.name?.trim() || `Customer #${r.customerId}`
      : `Customer #${r.customerId}`,
  }));

  const newByYear = query<{ year: string; value: number }>(
    `SELECT substr(EntDate,1,4) year, COUNT(*) value FROM Customer
     WHERE EntDate IS NOT NULL AND EntDate <> '' GROUP BY year ORDER BY year`,
  ).filter((r) => r.year >= "2017");

  return {
    total,
    business,
    individual: total - business,
    active12mo,
    topCustomers,
    newByYear,
    contactsMasked: !opts.canContacts,
  };
}

/* ============================= INVENTORY ============================== */

export interface InventoryModule {
  units: number;
  retailValue: number;
  retailPricedUnits: number;
  costValue: number | null;
  costValuedUnits: number;
  byCategory: { label: string; units: number; retail: number }[];
  byCondition: NameValue[];
  agingBuckets: NameValue[];
  topMakes: NameValue[];
}

export function getInventoryModule(opts: { canCost: boolean }): InventoryModule {
  const totals = query<{
    units: number;
    retail: number;
    cost: number;
    priced: number;
    costed: number;
  }>(
    `SELECT COUNT(*) units, ROUND(SUM(BaseRetail),2) retail, ROUND(SUM(BaseCost),2) cost,
            SUM(CASE WHEN COALESCE(BaseRetail,0) > 0 THEN 1 ELSE 0 END) priced,
            SUM(CASE WHEN COALESCE(BaseCost,0) > 0 THEN 1 ELSE 0 END) costed
     FROM UnitBase WHERE TRIM(StockStatus)='instock'`,
  )[0];

  const byCategory = query<{ label: string; units: number; retail: number }>(
    `SELECT COALESCE(uc.DisplayText,'Uncategorized') label, COUNT(*) units, ROUND(SUM(ub.BaseRetail),2) retail
     FROM UnitBase ub LEFT JOIN UnitCategory uc ON uc.UnitCategoryId=ub.UnitCategoryId
     WHERE TRIM(ub.StockStatus)='instock' GROUP BY label ORDER BY units DESC LIMIT 10`,
  );

  const byCondition = query<{ label: string; value: number }>(
    `SELECT COALESCE(cond.DisplayText,'Unknown') label, COUNT(*) value
     FROM UnitBase ub LEFT JOIN UnitCondition cond ON cond.UnitConditionId=ub.UnitConditionId
     WHERE TRIM(ub.StockStatus)='instock' GROUP BY label ORDER BY value DESC`,
  );

  const asOf = dataAsOf();
  const agingBuckets = query<{ label: string; value: number }>(
    `WITH aged AS (
       SELECT CAST(julianday(substr(?,1,10)) - julianday(substr(COALESCE(NULLIF(DateReceived,''), NULLIF(DatePurchased,''), EntDate),1,10)) AS INTEGER) days
       FROM UnitBase WHERE TRIM(StockStatus)='instock'
     )
     SELECT CASE
       WHEN days IS NULL THEN 'Unknown'
       WHEN days <= 90 THEN '0–90 days'
       WHEN days <= 180 THEN '91–180 days'
       WHEN days <= 365 THEN '181–365 days'
       ELSE '365+ days' END label,
       COUNT(*) value
     FROM aged GROUP BY label`,
    [asOf],
  );
  const bucketOrder = ["0–90 days", "91–180 days", "181–365 days", "365+ days", "Unknown"];
  agingBuckets.sort((a, b) => bucketOrder.indexOf(a.label) - bucketOrder.indexOf(b.label));

  const topMakes = query<{ label: string; value: number }>(
    `SELECT COALESCE(NULLIF(TRIM(Make),''),'Unknown') label, COUNT(*) value
     FROM UnitBase WHERE TRIM(StockStatus)='instock' GROUP BY label ORDER BY value DESC LIMIT 8`,
  );

  return {
    units: totals?.units ?? 0,
    retailValue: totals?.retail ?? 0,
    retailPricedUnits: totals?.priced ?? 0,
    costValue: opts.canCost ? (totals?.cost ?? 0) : null,
    costValuedUnits: totals?.costed ?? 0,
    byCategory,
    byCondition,
    agingBuckets,
    topMakes,
  };
}

/* ============================== PAYMENTS ============================== */

export interface PaymentsModule {
  total: number;
  count: number;
  byYear: YearValue[];
  byMethod: NameValue[];
}

export function getPaymentsModule(): PaymentsModule {
  const t = query<{ total: number; count: number }>(
    `SELECT ROUND(SUM(Amount),2) total, COUNT(*) count FROM Payment WHERE IsActive=1`,
  )[0];

  const byYear = query<{ year: string; value: number }>(
    `SELECT substr(EntDate,1,4) year, ROUND(SUM(Amount),2) value
     FROM Payment WHERE IsActive=1 AND EntDate IS NOT NULL AND EntDate <> ''
     GROUP BY year ORDER BY year`,
  ).filter((r) => r.year >= "2017");

  const byMethod = query<{ label: string; value: number }>(
    `SELECT COALESCE(pm.DisplayText, p.PmtType, 'Other') label, ROUND(SUM(p.Amount),2) value
     FROM Payment p LEFT JOIN PaymentMethod pm ON pm.PaymentMethodId = p.PaymentMethodId
     WHERE p.IsActive=1 GROUP BY label ORDER BY value DESC LIMIT 8`,
  );

  return {
    total: t?.total ?? 0,
    count: t?.count ?? 0,
    byYear,
    byMethod,
  };
}
