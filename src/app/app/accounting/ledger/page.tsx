import { guardAccounting, auditAccounting } from "@/lib/accounting/guard";
import { ACCOUNTING_PERMS } from "@/lib/accounting/permissions";
import { ComingRelease } from "@/components/accounting/ComingRelease";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const user = await guardAccounting(ACCOUNTING_PERMS.gl);
  auditAccounting(user, "accounting.gl_preview");

  return (
    <ComingRelease
      title="General ledger analytics"
      blockedBy="This extract has no chart of accounts, journal entries, or GL balances. A later release will connect those sources before any ledger totals appear."
      relatedHref="/app/accounting/statements"
      relatedLabel="See departmental contribution (live)"
      planned={[
        "Account activity, trial balance, and period movement",
        "Expense and below-the-line accounts that statements cannot show today",
        "Drill from operating contribution into posted journal lines",
      ]}
    />
  );
}
