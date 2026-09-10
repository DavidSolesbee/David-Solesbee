# Perseus Equipment Intelligence — Semantic Metric Definitions

This document is the **human-readable companion** to the executable catalog in
[`src/lib/semantic/metrics.ts`](../src/lib/semantic/metrics.ts). Every dashboard,
drill-down, AI answer, and automated report in later milestones must use these
definitions so a number means the same thing everywhere.

## Shared rules

- **Posted revenue statuses:** `finalized`, `archived` only.
- **Excluded from revenue:** `draft`, `quote`, `voided`, `committed`.
- **Posted date:** `COALESCE(NULLIF(FinalizedDate,''), ActivityDate)` (archived rows have no `FinalizedDate`).
- **Data-as-of anchor:** the latest posted date in the data (`2026-04-29`). Relative windows (e.g. "trailing 12 months") are measured from this anchor, not the server clock, because the dataset ends months before "today".

## Metric catalog

| Metric | Definition | Source | Key caveats |
| --- | --- | --- | --- |
| **Posted Revenue** | `SUM(InvoiceHeader.TotalInvoice)` where status in (finalized, archived) | `InvoiceHeader` | Invoice-level total incl. parts/labor/units/misc/discounts |
| **Invoice Count** | `COUNT(*)` of posted invoices | `InvoiceHeader` | — |
| **Average Invoice Value** | Posted Revenue ÷ Invoice Count | `InvoiceHeader` | Undefined when count = 0 |
| **Active Customers** | `COUNT(DISTINCT CustomerId)` posted in trailing 12 mo | `InvoiceHeader`, `Customer` | Window anchored to data-as-of date |
| **Customer Revenue** | Posted revenue for one `CustomerId` | `InvoiceHeader` | — |
| **Customer Last Purchase** | `MAX(postedDate)` for a customer | `InvoiceHeader` | Used for activity classification later |
| **Parts Revenue** | `SUM(SalePart.NetExt)` on posted invoices | `SalePart`→`InvoiceDetail`→`InvoiceHeader` | Join via `ItemId` then `InvoiceDocId` |
| **Estimated Parts Margin** | `SUM(NetExt) − SUM(Qty × AvgCost)` | `SalePart` | **Estimate**; `AvgCost` present on all rows; no core/return reconciliation |
| **Inventory Retail Value** | `SUM(BaseRetail)` where `TRIM(StockStatus)='instock'` | `UnitBase` | Some units unpriced (`BaseRetail=0`) → understated |
| **Inventory Cost Value** | `SUM(BaseCost)` where `TRIM(StockStatus)='instock'` | `UnitBase` | Restricted metric (auth in later milestones) |
| **Unit Age** | `dataAsOf − COALESCE(DateReceived, DatePurchased, EntDate)` | `UnitBase` | `DateReceived` null for ~85% of in-stock units |
| **Open Work Orders** | `wo` invoices with status not in (finalized, archived, voided) | `InvoiceHeader` | `WOStatusId` gives workshop sub-status |
| **Work Order Age** | `dataAsOf − EntDate` for open WOs | `InvoiceHeader` | `WorkOrderSchedule` sparse; `EntDate` is the reliable anchor |
| **Technician Labor Hours** | `SUM(WorkInProgress.ElapsedHours)` by `TechId` | `WorkInProgress`→`AppUser` | Clocked duration per WIP entry |

## Validation

`npm run discover` computes the headline snapshot directly against the read-only
database and prints it, so definitions can be checked against real numbers at any
time. In-app, `computeMetricSnapshot()` in
[`src/lib/semantic/index.ts`](../src/lib/semantic/index.ts) returns the same values.

> Security scoping (role / department / location / permission filters) is **not**
> applied in Milestone 1. These base definitions are wrapped with server-side
> security in later milestones — security always overrides filters.
