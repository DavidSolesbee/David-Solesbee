import { guardAccounting, auditAccounting } from "@/lib/accounting/guard";
import { ACCOUNTING_PERMS } from "@/lib/accounting/permissions";
import { ComingRelease } from "@/components/accounting/ComingRelease";

export const dynamic = "force-dynamic";

export default async function CashPage() {
  const user = await guardAccounting(ACCOUNTING_PERMS.cash);
  auditAccounting(user, "accounting.cash_preview");

  return (
    <ComingRelease
      title="Cash & banking"
      blockedBy="No bank, deposit, or reconciliation tables exist in this extract. Cash position is not shown as zero — it is reserved for a later release."
      relatedHref="/app/accounting"
      relatedLabel="Back to accounting overview"
      planned={[
        "Cash position by account and location",
        "Deposits, withdrawals, and uncleared items",
        "Bank reconciliation status and cash-flow statement support",
      ]}
    />
  );
}
