import { guardAccounting, auditAccounting } from "@/lib/accounting/guard";
import { ACCOUNTING_PERMS } from "@/lib/accounting/permissions";
import { ComingRelease } from "@/components/accounting/ComingRelease";

export const dynamic = "force-dynamic";

export default async function InventoryAccountingPage() {
  const user = await guardAccounting(ACCOUNTING_PERMS.inventory);
  auditAccounting(user, "accounting.inventory_preview");

  return (
    <ComingRelease
      title="Inventory accounting"
      blockedBy="In-stock unit value is already on Overview and in Inventory operations. Dedicated inventory accounting — turns, floor-plan, WIP, and valuation methods — needs sources this extract does not provide."
      relatedHref="/app/inventory"
      relatedLabel="Open inventory operations (live)"
      planned={[
        "Inventory valuation methods and period-to-period change",
        "Turns, aging of stock, and floor-plan / carrying cost when those ledgers exist",
        "Work-in-process and parts-to-GL reconciliation",
      ]}
    />
  );
}
