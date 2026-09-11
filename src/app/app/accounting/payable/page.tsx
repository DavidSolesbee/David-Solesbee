import { guardAccounting, auditAccounting } from "@/lib/accounting/guard";
import { ACCOUNTING_PERMS } from "@/lib/accounting/permissions";
import { unavailable } from "@/lib/accounting/unavailable";
import { ModuleHeader } from "@/components/analytics/Primitives";
import { EmptyState } from "@/components/ui/States";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function PayablePage() {
  const user = await guardAccounting(ACCOUNTING_PERMS.ap);
  auditAccounting(user, "accounting.ap_viewed");
  const ap = unavailable("ap");

  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Accounts payable"
        subtitle="Vendor payables require a bills ledger this extract does not contain."
        scopeLabel="Not in source"
        crossDept
      />

      <EmptyState
        title={ap.reason}
        description={ap.missing}
      />

      <Card className="p-5">
        <p className="text-sm text-ink">
          Payment type <code className="text-caption">apvouch</code> appears on
          customer invoices (finance and warranty credit memos, refunds). That is
          a tender, not vendor AP.           No aging, due dates, or payables figures are
          shown so this page cannot be mistaken for a payables subledger.
        </p>
      </Card>
    </div>
  );
}
