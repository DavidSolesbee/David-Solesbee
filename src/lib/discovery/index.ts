import "server-only";
import { query, queryScalar } from "@/lib/db/dealership";

/**
 * Read-only data discovery utilities.
 *
 * Introspects the dealership database to power the internal /data-discovery
 * view and the `npm run discover` CLI. All queries are strictly read-only.
 */

export interface TableInfo {
  name: string;
  rowCount: number;
  columnCount: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
}

/** Tables the workshop prompt asked us to specifically validate exist. */
export const EXPECTED_CORE_TABLES = [
  "Customer",
  "InvoiceHeader",
  "InvoiceDetail",
  "SalePart",
  "PartMaster",
  "PartLocation",
  "UnitBase",
  "UnitCustomer",
  "SaleUnit",
  "InvoiceSegment",
  "WorkInProgress",
  "WorkOrderSchedule",
  "Payment",
] as const;

export function listTableNames(): string[] {
  return query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
  ).map((r) => r.name);
}

export function getColumns(table: string): ColumnInfo[] {
  // table_info takes an identifier, not a bind param — validate against the
  // known table list to avoid any injection risk.
  if (!listTableNames().includes(table)) return [];
  return query<{
    name: string;
    type: string;
    notnull: number;
    pk: number;
  }>(`PRAGMA table_info("${table}")`).map((c) => ({
    name: c.name,
    type: c.type,
    notNull: c.notnull === 1,
    primaryKey: c.pk > 0,
  }));
}

export function getRowCount(table: string): number {
  if (!listTableNames().includes(table)) return 0;
  return queryScalar<number>(`SELECT COUNT(*) FROM "${table}"`) ?? 0;
}

export function getTableOverview(): TableInfo[] {
  const names = listTableNames();
  return names.map((name) => ({
    name,
    rowCount: getRowCount(name),
    columnCount: getColumns(name).length,
  }));
}

export interface CoreTableCheck {
  table: string;
  exists: boolean;
  rowCount: number;
}

export function checkCoreTables(): CoreTableCheck[] {
  const names = new Set(listTableNames());
  return EXPECTED_CORE_TABLES.map((table) => ({
    table,
    exists: names.has(table),
    rowCount: names.has(table) ? getRowCount(table) : 0,
  }));
}

export interface Distribution {
  value: string;
  count: number;
}

export function getInvoiceStatusDistribution(): Distribution[] {
  return query<{ value: string; count: number }>(
    `SELECT Status AS value, COUNT(*) AS count FROM InvoiceHeader GROUP BY Status ORDER BY count DESC`,
  );
}

export function getInvoiceTypeDistribution(): Distribution[] {
  return query<{ value: string; count: number }>(
    `SELECT InvoiceType AS value, COUNT(*) AS count FROM InvoiceHeader GROUP BY InvoiceType ORDER BY count DESC`,
  );
}

export function getStockStatusDistribution(): Distribution[] {
  return query<{ value: string; count: number }>(
    `SELECT TRIM(StockStatus) AS value, COUNT(*) AS count FROM UnitBase GROUP BY TRIM(StockStatus) ORDER BY count DESC`,
  );
}

export interface DateRange {
  label: string;
  min: string | null;
  max: string | null;
}

export function getDateRanges(): DateRange[] {
  const invoice = query<{ min: string; max: string }>(
    `SELECT MIN(COALESCE(NULLIF(FinalizedDate,''), ActivityDate)) AS min,
            MAX(COALESCE(NULLIF(FinalizedDate,''), ActivityDate)) AS max
     FROM InvoiceHeader WHERE Status IN ('finalized','archived')`,
  )[0];
  const payment = query<{ min: string; max: string }>(
    `SELECT MIN(EntDate) AS min, MAX(EntDate) AS max FROM Payment WHERE IsActive=1`,
  )[0];
  return [
    { label: "Posted invoices", min: invoice?.min ?? null, max: invoice?.max ?? null },
    { label: "Payments (entered)", min: payment?.min ?? null, max: payment?.max ?? null },
  ];
}

export interface LookupSummary {
  label: string;
  count: number;
  samples: string[];
}

export function getLookupSummaries(): LookupSummary[] {
  const summarize = (label: string, sql: string): LookupSummary => {
    const rows = query<{ v: string }>(sql);
    return {
      label,
      count: rows.length,
      samples: rows.slice(0, 8).map((r) => r.v),
    };
  };
  return [
    summarize(
      "Locations",
      `SELECT DisplayText AS v FROM SettingsLocation ORDER BY DisplayText`,
    ),
    summarize(
      "Departments",
      `SELECT DisplayText AS v FROM SettingsDepartment ORDER BY DisplayText`,
    ),
    summarize(
      "Work Order Statuses",
      `SELECT DisplayText AS v FROM SettingsWorkOrderStatus WHERE IsActive=1 ORDER BY WorkOrderStatusId`,
    ),
    summarize(
      "Unit Conditions",
      `SELECT DisplayText AS v FROM UnitCondition WHERE IsActive=1 ORDER BY UnitConditionId`,
    ),
    summarize(
      "Unit Categories",
      `SELECT DisplayText AS v FROM UnitCategory WHERE IsActive=1 ORDER BY DisplayText`,
    ),
    summarize(
      "Part Manufacturers",
      `SELECT DisplayText AS v FROM PartManufacturer WHERE IsActive=1 ORDER BY DisplayText`,
    ),
    summarize(
      "Payment Methods",
      `SELECT DisplayText AS v FROM PaymentMethod WHERE IsActive=1 ORDER BY DisplayText`,
    ),
  ];
}

export interface DiscoveryReport {
  totalTables: number;
  coreTables: CoreTableCheck[];
  tableOverview: TableInfo[];
  invoiceStatus: Distribution[];
  invoiceType: Distribution[];
  stockStatus: Distribution[];
  dateRanges: DateRange[];
  lookups: LookupSummary[];
}

export function buildDiscoveryReport(): DiscoveryReport {
  return {
    totalTables: listTableNames().length,
    coreTables: checkCoreTables(),
    tableOverview: getTableOverview(),
    invoiceStatus: getInvoiceStatusDistribution(),
    invoiceType: getInvoiceTypeDistribution(),
    stockStatus: getStockStatusDistribution(),
    dateRanges: getDateRanges(),
    lookups: getLookupSummaries(),
  };
}
