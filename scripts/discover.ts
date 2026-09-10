/**
 * Perseus data discovery + semantic validation CLI.
 *
 * Usage: npm run discover
 *
 * Standalone (does not import the server-only app modules) so it can run under
 * tsx. Opens the dealership database READ ONLY and prints a discovery summary
 * plus a semantic-layer sanity check. It never writes to dealership data.
 */
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { POSTED_STATUS_SQL, POSTED_DATE_SQL } from "../src/lib/semantic/metrics";

const dbPath = path.join(process.cwd(), "perseus_equipment_database.db");
const db = new DatabaseSync(dbPath, { readOnly: true });
db.exec("PRAGMA query_only = ON");

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const num = (n: number) => n.toLocaleString("en-US");

function scalar<T = number>(sql: string): T {
  const row = db.prepare(sql).get() as Record<string, unknown> | undefined;
  return (row ? Object.values(row)[0] : undefined) as T;
}

function rows<T = Record<string, unknown>>(sql: string): T[] {
  return db.prepare(sql).all() as T[];
}

console.log("\n=== PERSEUS DATA DISCOVERY ===\n");

const tableCount = scalar<number>(
  "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
);
console.log(`Tables: ${tableCount}`);

console.log("\n--- Core tables (workshop validation) ---");
for (const t of [
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
]) {
  const exists = scalar<number>(
    `SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='${t}'`,
  );
  const c = exists ? scalar<number>(`SELECT COUNT(*) FROM "${t}"`) : 0;
  console.log(`  ${exists ? "OK " : "MISSING "} ${t.padEnd(20)} ${num(c)} rows`);
}

console.log("\n--- Invoice status distribution ---");
for (const r of rows<{ Status: string; c: number }>(
  "SELECT Status, COUNT(*) c FROM InvoiceHeader GROUP BY Status ORDER BY c DESC",
)) {
  console.log(`  ${r.Status.padEnd(12)} ${num(r.c)}`);
}

console.log("\n=== SEMANTIC LAYER VALIDATION ===\n");
const asOf = scalar<string>(
  `SELECT MAX(${POSTED_DATE_SQL}) FROM InvoiceHeader h WHERE ${POSTED_STATUS_SQL}`,
);
const revenue = scalar<number>(
  `SELECT SUM(h.TotalInvoice) FROM InvoiceHeader h WHERE ${POSTED_STATUS_SQL}`,
);
const invoices = scalar<number>(
  `SELECT COUNT(*) FROM InvoiceHeader h WHERE ${POSTED_STATUS_SQL}`,
);
const activeCust = scalar<number>(
  `SELECT COUNT(DISTINCT h.CustomerId) FROM InvoiceHeader h
   WHERE ${POSTED_STATUS_SQL} AND ${POSTED_DATE_SQL} >= date(substr('${asOf}',1,10),'-365 day')`,
);
const partsRev = scalar<number>(
  `SELECT SUM(sp.NetExt) FROM SalePart sp
   JOIN InvoiceDetail d ON d.ItemId=sp.ItemId
   JOIN InvoiceHeader h ON h.InvoiceDocId=d.InvoiceDocId
   WHERE ${POSTED_STATUS_SQL}`,
);
const inv = rows<{ units: number; retail: number; cost: number }>(
  `SELECT COUNT(*) units, SUM(BaseRetail) retail, SUM(BaseCost) cost
   FROM UnitBase WHERE TRIM(StockStatus)='instock'`,
)[0];
const openWO = scalar<number>(
  `SELECT COUNT(*) FROM InvoiceHeader WHERE InvoiceType='wo' AND Status NOT IN ('finalized','archived','voided')`,
);
const laborHrs = scalar<number>(
  `SELECT SUM(ElapsedHours) FROM WorkInProgress WHERE IsActive=1`,
);

console.log(`  Data as-of date:        ${asOf}`);
console.log(`  Posted Revenue:         ${money(revenue)}`);
console.log(`  Invoice Count:          ${num(invoices)}`);
console.log(`  Average Invoice Value:  ${money(revenue / invoices)}`);
console.log(`  Active Customers (12m): ${num(activeCust)}`);
console.log(`  Parts Revenue:          ${money(partsRev)}`);
console.log(
  `  Inventory:              ${num(inv.units)} units, retail ${money(inv.retail)}, cost ${money(inv.cost)}`,
);
console.log(`  Open Work Orders:       ${num(openWO)}`);
console.log(`  Technician Labor Hours: ${num(Math.round(laborHrs))}`);

console.log("\nValidation complete. Dealership DB was opened READ ONLY.\n");
db.close();
export {};
