import { guardAccounting, auditAccounting } from "@/lib/accounting/guard";
import { ACCOUNTING_PERMS } from "@/lib/accounting/permissions";
import { ComingRelease } from "@/components/accounting/ComingRelease";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const user = await guardAccounting(ACCOUNTING_PERMS.departments);
  auditAccounting(user, "accounting.departments_preview");

  return (
    <ComingRelease
      title="Department performance"
      blockedBy="A full comparison workspace (budget variance, allocated expense, and books P&L by department) is reserved for a later release. Live contribution by Sales, Service, and Parts is already on Statements."
      relatedHref="/app/accounting/statements"
      relatedLabel="See departmental contribution (live)"
      planned={[
        "Side-by-side department comparison with shared period controls",
        "Budget and forecast variance once those tables are connected",
        "Allocated overhead and operating income by department — not inventable from invoices alone",
      ]}
    />
  );
}
