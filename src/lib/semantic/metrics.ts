/**
 * Perseus Semantic Layer — Metric Catalog.
 *
 * The SINGLE SOURCE OF TRUTH for how every business metric is defined. Later
 * milestones (dashboards, drill-downs, AI, automated reports) must consume these
 * definitions rather than re-deriving calculations, so that a number means the
 * same thing everywhere in the platform.
 *
 * Each definition documents: label, plain-English description, the underlying
 * source tables/columns, the filters applied, and known caveats discovered
 * during data discovery. The executable query builders live in ./queries.ts and
 * are validated against these definitions.
 */

export type MetricCategory =
  | "revenue"
  | "customers"
  | "parts"
  | "inventory"
  | "service";

export interface MetricDefinition {
  id: string;
  label: string;
  category: MetricCategory;
  /** Plain-English explanation shown to users in tooltips / "how is this calculated". */
  description: string;
  /** Human-readable formula. */
  formula: string;
  sourceTables: string[];
  filters: string[];
  caveats?: string[];
  unit: "currency" | "count" | "hours" | "days" | "ratio";
}

/**
 * Posted revenue is only recognized on finalized/archived invoices. The posted
 * date falls back to ActivityDate for archived rows (which have NULL
 * FinalizedDate). These two expressions are reused across many metrics.
 */
export const POSTED_STATUS_SQL = "h.Status IN ('finalized','archived')";
export const POSTED_DATE_SQL =
  "COALESCE(NULLIF(h.FinalizedDate,''), h.ActivityDate)";

export const METRICS: Record<string, MetricDefinition> = {
  postedRevenue: {
    id: "postedRevenue",
    label: "Posted Revenue",
    category: "revenue",
    description:
      "Total invoiced revenue that has been posted to the books. Only finalized and archived invoices count. Drafts, quotes, committed, and voided invoices are excluded.",
    formula: "SUM(InvoiceHeader.TotalInvoice) WHERE Status IN (finalized, archived)",
    sourceTables: ["InvoiceHeader"],
    filters: ["Status IN ('finalized','archived')"],
    caveats: [
      "Archived invoices have NULL FinalizedDate; the posted date falls back to ActivityDate.",
      "TotalInvoice is the invoice-level total (includes parts, labor, units, misc, discounts).",
    ],
    unit: "currency",
  },
  invoiceCount: {
    id: "invoiceCount",
    label: "Invoice Count",
    category: "revenue",
    description:
      "Number of posted invoices (finalized or archived) in the selected period.",
    formula: "COUNT(InvoiceHeader) WHERE Status IN (finalized, archived)",
    sourceTables: ["InvoiceHeader"],
    filters: ["Status IN ('finalized','archived')"],
    unit: "count",
  },
  averageInvoiceValue: {
    id: "averageInvoiceValue",
    label: "Average Invoice Value",
    category: "revenue",
    description: "Posted Revenue divided by Invoice Count for the period.",
    formula: "PostedRevenue / InvoiceCount",
    sourceTables: ["InvoiceHeader"],
    filters: ["Status IN ('finalized','archived')"],
    caveats: ["Undefined when Invoice Count is 0."],
    unit: "currency",
  },
  activeCustomers: {
    id: "activeCustomers",
    label: "Active Customers",
    category: "customers",
    description:
      "Distinct customers with at least one posted invoice in the trailing 12 months (relative to the data-as-of date).",
    formula:
      "COUNT(DISTINCT InvoiceHeader.CustomerId) WHERE posted AND postedDate >= dataAsOf - 365 days",
    sourceTables: ["InvoiceHeader", "Customer"],
    filters: ["Status IN ('finalized','archived')", "trailing 12 months"],
    caveats: [
      "Window is anchored to the data-as-of date (latest posted activity), not the server clock.",
    ],
    unit: "count",
  },
  customerRevenue: {
    id: "customerRevenue",
    label: "Customer Revenue",
    category: "customers",
    description: "Posted Revenue attributed to a single customer over a period.",
    formula:
      "SUM(InvoiceHeader.TotalInvoice) WHERE posted AND CustomerId = :customerId",
    sourceTables: ["InvoiceHeader", "Customer"],
    filters: ["Status IN ('finalized','archived')", "CustomerId = :customerId"],
    unit: "currency",
  },
  customerLastPurchase: {
    id: "customerLastPurchase",
    label: "Customer Last Purchase",
    category: "customers",
    description: "The most recent posted-invoice date for a customer.",
    formula: "MAX(postedDate) WHERE posted AND CustomerId = :customerId",
    sourceTables: ["InvoiceHeader"],
    filters: ["Status IN ('finalized','archived')"],
    unit: "days",
  },
  partsRevenue: {
    id: "partsRevenue",
    label: "Parts Revenue",
    category: "parts",
    description:
      "Revenue from parts line items on posted invoices. Sums the net extended price of each parts line.",
    formula:
      "SUM(SalePart.NetExt) via InvoiceDetail JOIN InvoiceHeader WHERE posted",
    sourceTables: ["SalePart", "InvoiceDetail", "InvoiceHeader"],
    filters: ["Status IN ('finalized','archived')"],
    caveats: [
      "SalePart links to InvoiceDetail via ItemId; InvoiceDetail links to InvoiceHeader via InvoiceDocId.",
    ],
    unit: "currency",
  },
  estimatedPartsMargin: {
    id: "estimatedPartsMargin",
    label: "Estimated Parts Margin",
    category: "parts",
    description:
      "Estimated gross margin on parts: parts revenue minus estimated cost (quantity x average cost). This is an ESTIMATE based on the average cost recorded on each sale line.",
    formula: "SUM(SalePart.NetExt) - SUM(SalePart.Qty * SalePart.AvgCost)",
    sourceTables: ["SalePart", "InvoiceDetail", "InvoiceHeader"],
    filters: ["Status IN ('finalized','archived')"],
    caveats: [
      "AvgCost is captured on the sale line (populated for all 248,162 SalePart rows in this dataset).",
      "Labeled ESTIMATE — landed cost, core charges, and returns are not reconciled here.",
    ],
    unit: "currency",
  },
  inventoryRetailValue: {
    id: "inventoryRetailValue",
    label: "Inventory Retail Value",
    category: "inventory",
    description:
      "Total retail (list) value of equipment units currently in stock.",
    formula: "SUM(UnitBase.BaseRetail) WHERE TRIM(StockStatus) = 'instock'",
    sourceTables: ["UnitBase"],
    filters: ["TRIM(StockStatus) = 'instock'"],
    caveats: [
      "StockStatus is space-padded in the source data and MUST be TRIMmed.",
      "Some in-stock units have BaseRetail = 0 (not yet priced), so retail value can be understated.",
    ],
    unit: "currency",
  },
  inventoryCostValue: {
    id: "inventoryCostValue",
    label: "Inventory Cost Value",
    category: "inventory",
    description:
      "Total cost basis of equipment units currently in stock. Cost is a restricted metric (authorization required in later milestones).",
    formula: "SUM(UnitBase.BaseCost) WHERE TRIM(StockStatus) = 'instock'",
    sourceTables: ["UnitBase"],
    filters: ["TRIM(StockStatus) = 'instock'"],
    caveats: ["StockStatus is space-padded and MUST be TRIMmed."],
    unit: "currency",
  },
  unitAge: {
    id: "unitAge",
    label: "Unit Age (days in stock)",
    category: "inventory",
    description:
      "Days a unit has been in stock, measured from when it was received to the data-as-of date.",
    formula: "dataAsOf - COALESCE(DateReceived, DatePurchased, EntDate)",
    sourceTables: ["UnitBase"],
    filters: ["TRIM(StockStatus) = 'instock'"],
    caveats: [
      "DateReceived is NULL for ~85% of in-stock units (389 of 460); falls back to DatePurchased then EntDate.",
    ],
    unit: "days",
  },
  openWorkOrders: {
    id: "openWorkOrders",
    label: "Open Work Orders",
    category: "service",
    description:
      "Work-order invoices that have not yet been finalized, archived, or voided (still committed/quote/draft).",
    formula:
      "COUNT(InvoiceHeader) WHERE InvoiceType='wo' AND Status NOT IN (finalized, archived, voided)",
    sourceTables: ["InvoiceHeader", "SettingsWorkOrderStatus"],
    filters: ["InvoiceType = 'wo'", "Status NOT IN ('finalized','archived','voided')"],
    caveats: [
      "In this DMS a work order becomes 'finalized' once invoiced; WOStatusId (e.g. 'In Progress', 'Ready Review') provides the workshop sub-status.",
    ],
    unit: "count",
  },
  workOrderAge: {
    id: "workOrderAge",
    label: "Work Order Age (days)",
    category: "service",
    description:
      "Days a work order has been open, measured from when it was entered to the data-as-of date.",
    formula: "dataAsOf - InvoiceHeader.EntDate (for open WOs)",
    sourceTables: ["InvoiceHeader", "WorkOrderSchedule"],
    filters: ["InvoiceType = 'wo'"],
    caveats: [
      "WorkOrderSchedule (start/end times) is sparse (2,889 rows for 15,670 WO invoices); EntDate is the reliable age anchor.",
    ],
    unit: "days",
  },
  technicianLaborHours: {
    id: "technicianLaborHours",
    label: "Technician Labor Hours",
    category: "service",
    description:
      "Clocked labor hours recorded by technicians against work-order segments.",
    formula: "SUM(WorkInProgress.ElapsedHours) GROUP BY TechId",
    sourceTables: ["WorkInProgress", "InvoiceSegment", "AppUser"],
    filters: ["WorkInProgress.IsActive = 1"],
    caveats: [
      "ElapsedHours is the clocked duration per WIP entry; TechId maps to AppUser.",
    ],
    unit: "hours",
  },
};

export type MetricId = keyof typeof METRICS;
