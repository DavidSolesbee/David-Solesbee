# Perseus Equipment Intelligence — Data Discovery

Read-only inspection of `perseus_equipment_database.db` (729 MB SQLite, **43 tables**).
The database was opened **READ ONLY** for all discovery. No source data was modified.

Regenerate this summary any time with:

```bash
npm run discover
```

---

## 1. Confirmed core tables

All tables the workshop asked us to validate **exist** and are populated:

| Table | Rows | Purpose |
| --- | ---: | --- |
| `Customer` | 5,967 | Customers (business + individual) |
| `InvoiceHeader` | 107,233 | Invoice / work-order / rental documents (the transactional spine) |
| `InvoiceDetail` | 351,055 | Line items across all documents |
| `SalePart` | 248,162 | Parts line detail |
| `PartMaster` | 16,208 | Part catalog |
| `PartLocation` | 16,066 | Per-location part settings (bins, min/max, price class) |
| `UnitBase` | 6,374 | Equipment units (inventory + customer-owned) |
| `UnitCustomer` | 9,622 | Unit ⇄ customer ownership/activity events |
| `SaleUnit` | 5,747 | Unit sale line detail |
| `InvoiceSegment` | 31,134 | Service segments (labor) on work orders |
| `WorkInProgress` | 72,011 | Technician clock/labor entries |
| `WorkOrderSchedule` | 2,889 | WO scheduling times (sparse — see limitations) |
| `Payment` | 138,542 | Payments / receivables activity |

Supporting lookups: `SettingsLocation`, `SettingsDepartment`, `SettingsWorkOrderStatus`,
`UnitCondition`, `UnitCategory`, `UnitMake`, `PartManufacturer`, `PaymentMethod`, `AppUser`, and
customer sub-tables (`Contact`, `CustomerAddress`, `CustomerEmail`, `CustomerPhone`, `CustomerClass`).

---

## 2. Relationships (implicit — no FK constraints declared)

SQLite foreign keys are **not** declared in this dump; relationships are by convention on `*Id` columns.

```
Customer (CustomerId)
  └─< InvoiceHeader (CustomerId)
        ├─ InvoiceHeader.LocationId  -> SettingsLocation.LocationId
        ├─ InvoiceHeader.SalesPersonId -> AppUser.AppUserId
        ├─ InvoiceHeader.WOStatusId -> SettingsWorkOrderStatus.WorkOrderStatusId
        ├─ InvoiceHeader.WOTechId   -> AppUser.AppUserId
        └─< InvoiceDetail (InvoiceDocId)         [ItemId is the line PK]
              ├─ SalePart (ItemId)      ItemType 'PA'
              ├─ SaleUnit (ItemId)      ItemType 'UN' -> UnitBase.UnitId
              └─ InvoiceSegment (ItemId) ItemType 'SL'
                    └─< WorkInProgress (SegmentId) -> AppUser.AppUserId (TechId)
InvoiceHeader (InvoiceDocId)
  ├─< Payment (InvoiceDocId) -> PaymentMethod.PaymentMethodId
  └─  WorkOrderSchedule (InvoiceDocId)
UnitBase (UnitId)
  ├─ UnitCategoryId -> UnitCategory ; UnitConditionId -> UnitCondition
  ├─ CurrentCustomerId -> Customer
  └─< UnitCustomer (UnitId, CustomerId)
```

`InvoiceDetail.ItemType` distribution (confirms the line-detail joins):

| ItemType | Count | Meaning |
| --- | ---: | --- |
| `PA` | 248,161 | Parts (≈ `SalePart`) |
| `SL` | 31,134 | Service labor segment (= `InvoiceSegment`, exact match) |
| `MC` | 27,872 | Miscellaneous charge |
| `RU` / `RE` | 22,995 / 13,269 | Rental unit / rental-related |
| `UN` | 5,747 | Unit sale (= `SaleUnit`, exact match) |
| `TR` | 1,775 | Trade-in |
| `QU` | 102 | Quote line |

---

## 3. Status values (confirmed)

**Invoice status** (`InvoiceHeader.Status`) — matches the spec exactly:

| Status | Count | Counts as posted revenue? |
| --- | ---: | :---: |
| `finalized` | 93,333 | ✅ |
| `archived` | 8,448 | ✅ |
| `voided` | 4,600 | ❌ |
| `quote` | 672 | ❌ |
| `committed` | 147 | ❌ |
| `draft` | 33 | ❌ |

**Invoice type** (`InvoiceHeader.InvoiceType`): `in` counter/parts sale (79,068), `wo` work order (15,670), `rl` rental (12,495).

**Unit stock status** (`UnitBase.StockStatus`, space-padded): `customer` (5,891), `instock` (460), `expected` (23).

**Unit condition**: New, Good, Excellent, Fair, Poor, Salvage (`New` flagged via `IsNew`).

**Work order status**: 26 active workshop statuses (e.g. `In Progress`, `Ready Review`, `Payment`, `Waiting Cust`, `Not Started Sch`).

---

## 4. Date fields & ranges

| Field | Notes |
| --- | --- |
| `InvoiceHeader.ActivityDate` | Business/transaction date (date only, `00:00:00`). Never null on posted rows. |
| `InvoiceHeader.FinalizedDate` | Timestamp when finalized. **NULL for all 8,448 archived rows.** |
| `InvoiceHeader.EntDate` / `ModDate` | Record entered / modified timestamps. |
| `UnitBase.DateReceived` / `DatePurchased` | Inventory intake dates (frequently null — see limitations). |

- **Posted invoice date range:** 2017-06 → **2026-04-29** (using `COALESCE(NULLIF(FinalizedDate,''), ActivityDate)`).
- **Overall activity range:** 2017-03-17 → 2026-04-29.
- All dates are ISO-ish text (`YYYY-MM-DD HH:MM:SS[.fff]`), safe for SQLite `date()` functions.

---

## 5. NULL frequency / completeness highlights

- **Posted-revenue date:** `FinalizedDate` is NULL for 100% of `archived` invoices → the semantic layer falls back to `ActivityDate` (never null on posted rows).
- **`UnitBase.DateReceived`:** NULL for **389 of 460** in-stock units (~85%) → Unit Age falls back to `DatePurchased`, then `EntDate`.
- **`SalePart.AvgCost`:** populated for **all 248,162** rows → parts margin is computable (as an estimate).
- **`Customer`:** 5,928 active / 39 inactive. **`CustomerEmail`:** 1,494 active emails (all non-empty) — contact coverage is partial.
- **`WorkOrderSchedule`:** only 2,889 rows vs 15,670 work-order invoices → scheduling/adherence data is sparse.

---

## 6. Discrepancies: workshop documentation vs. actual database

1. **No dedicated work-order "open date" field.** WO age must derive from `InvoiceHeader.EntDate` (+ optional `WorkOrderSchedule` times). Documented separately from the (sparse) schedule table.
2. **Archived invoices lack `FinalizedDate`.** Any posted-date logic must `COALESCE` to `ActivityDate`, or archived revenue silently drops out of time series.
3. **`StockStatus` is space-padded** (`'instock   '`). Must be `TRIM`med. `Status` and `InvoiceType` are **not** padded — padding is field-specific, so trimming is applied deliberately, not blanket.
4. **Single location, three departments.** Only `Main Location` (Sioux City, IA) and Sales/Service/Parts exist. Location- and department-scoped security is still built generically, but demos have limited real diversity.
5. **`AppUser` has no Perseus roles/permissions.** It carries only `IsSales` / `IsServiceTech` / `AllowLogin` flags (48 users; 18 login-enabled + active). The Perseus role hierarchy, permission sets, and account states must live in the **separate application store**, never in dealership data.
6. **In-stock retail can be understated.** Many in-stock units have `BaseRetail = 0` (not yet priced), so `SUM(BaseCost)` ($5.06M) exceeds `SUM(BaseRetail)` ($1.42M). Flagged as a caveat on inventory value metrics.

---

## 7. Validated semantic numbers (as of 2026-04-29)

Produced by `npm run discover` (read-only):

| Metric | Value |
| --- | ---: |
| Posted Revenue | $125,367,223.57 |
| Invoice Count | 101,781 |
| Average Invoice Value | $1,231.74 |
| Active Customers (trailing 12 mo) | 1,879 |
| Parts Revenue | $22,085,990.39 |
| Inventory | 460 units — retail $1,424,904.52, cost $5,056,376.32 |
| Open Work Orders | 93 |
| Technician Labor Hours | 78,991 |

See [`METRICS.md`](./METRICS.md) for the authoritative definition of each.
