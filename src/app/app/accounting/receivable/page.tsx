import { redirect } from "next/navigation";
import { guardAccounting, auditAccounting } from "@/lib/accounting/guard";
import { ACCOUNTING_PERMS } from "@/lib/accounting/permissions";
import { getArSummary, listArAccounts } from "@/lib/accounting/ar";
import { ModuleHeader, KpiCard, Section } from "@/components/analytics/Primitives";
import { Input } from "@/components/ui/Input";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatNumber } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function ReceivablePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    overLimit?: string;
    quiet?: string;
    hold?: string;
    hasBalance?: string;
  }>;
}) {
  const user = await guardAccounting(ACCOUNTING_PERMS.ar);
  if (!user.permissions.has("feature.view_payments")) redirect("/app");
  auditAccounting(user, "accounting.ar_viewed");
  const q = await searchParams;
  const summary = getArSummary(user);
  let rows = listArAccounts(user);

  if (q.hasBalance !== "0") rows = rows.filter((r) => r.openAr > 1 || r.openAr < -1);
  if (q.overLimit === "1") rows = rows.filter((r) => r.overLimit);
  if (q.quiet === "1") rows = rows.filter((r) => r.quiet90);
  if (q.hold === "1") rows = rows.filter((r) => r.creditHold);
  if (q.q?.trim()) {
    const needle = q.q.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.name.toLowerCase().includes(needle) ||
        r.accountNo.toLowerCase().includes(needle),
    );
  }

  const detail = user.permissions.has(ACCOUNTING_PERMS.arDetail);

  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Accounts receivable"
        subtitle="Customer-net balances from charge-to-account and receive-payment rows. Invoice aging is not shown because payments often land on a different document than the charge."
        scopeLabel={`As of ${summary.asOf}`}
        crossDept
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Open AR"
          value={formatCurrency(summary.openAr)}
          tone="revenue"
          sublabel={`${formatNumber(summary.accountCount)} accounts`}
        />
        <KpiCard
          label="Credit balances"
          value={formatCurrency(summary.credits)}
          sublabel={`${formatNumber(summary.creditCount)} accounts`}
        />
        <KpiCard label="Net AR" value={formatCurrency(summary.net)} />
        <KpiCard
          label="DSO"
          value={summary.dso === null ? "n/a" : `${summary.dso.toFixed(0)} days`}
          sublabel="Open AR ÷ (trailing-90 charges / 90)"
        />
      </section>

      <Section title="Attention" description="Each row states the rule. Nothing is labeled a problem without a condition.">
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li>
            <StatusBadge intent={summary.overLimitCount ? "attention" : "neutral"} dot={false}>
              {summary.overLimitCount} over credit limit
            </StatusBadge>
            <p className="mt-1 text-caption text-ink-faint">
              Rule: open AR exceeds Customer.CredLimit.
            </p>
          </li>
          <li>
            <StatusBadge intent={summary.quiet90Count ? "attention" : "neutral"} dot={false}>
              {summary.quiet90Count} no payment in 90+ days
            </StatusBadge>
            <p className="mt-1 text-caption text-ink-faint">
              Rule: net AR &gt; $1 and latest payment (or charge) is 90+ days old.
            </p>
          </li>
        </ul>
      </Section>

      <Section title="Collections queue">
        <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1">
            <span className="text-caption text-ink-soft">Search</span>
            <Input name="q" defaultValue={q.q ?? ""} placeholder="Customer or account" />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="overLimit" value="1" defaultChecked={q.overLimit === "1"} />
            Over limit
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="quiet" value="1" defaultChecked={q.quiet === "1"} />
            Quiet 90+
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="hold" value="1" defaultChecked={q.hold === "1"} />
            Credit hold
          </label>
          <button
            type="submit"
            className="rounded-lg border border-line-strong px-3 py-2 text-sm font-medium text-ink hover:bg-surface-tinted"
          >
            Apply
          </button>
        </form>

        <Table>
          <THead>
            <TR>
              <TH>Customer</TH>
              <TH>Account</TH>
              <TH className="text-right">Open AR</TH>
              {detail && <TH className="text-right">Limit</TH>}
              {detail && <TH className="text-right">Used</TH>}
              {detail && <TH>Last payment</TH>}
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {rows.slice(0, 80).map((r) => (
              <TR key={r.customerId}>
                <TD className="font-medium text-ink">{r.name}</TD>
                <TD className="text-ink-soft">{r.accountNo || "—"}</TD>
                <TD className="text-right tabular-nums">{formatCurrency(r.openAr)}</TD>
                {detail && (
                  <TD className="text-right tabular-nums text-ink-soft">
                    {r.creditLimit ? formatCurrency(r.creditLimit) : "—"}
                  </TD>
                )}
                {detail && (
                  <TD className="text-right tabular-nums text-ink-soft">
                    {r.usedPct !== null ? `${r.usedPct.toFixed(0)}%` : "—"}
                  </TD>
                )}
                {detail && (
                  <TD className="text-ink-soft">{r.lastPayment ?? "—"}</TD>
                )}
                <TD>
                  <span className="flex flex-wrap gap-1">
                    {r.overLimit && (
                      <StatusBadge intent="attention" dot={false}>
                        Over limit
                      </StatusBadge>
                    )}
                    {r.quiet90 && (
                      <StatusBadge intent="attention" dot={false}>
                        Quiet
                      </StatusBadge>
                    )}
                    {r.creditHold && (
                      <StatusBadge intent="critical" dot={false}>
                        Hold
                      </StatusBadge>
                    )}
                    {r.openAr < -1 && (
                      <StatusBadge intent="info" dot={false}>
                        Credit
                      </StatusBadge>
                    )}
                  </span>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <p className="mt-3 text-caption text-ink-faint">
          {summary.methodology} Showing {Math.min(80, rows.length)} of {rows.length}.
          {user.permissions.has("feature.view_customer_contacts")
            ? ""
            : " Customer identities are masked."}{" "}
          Terms are Net {rows[0]?.termsDays ?? 30} where receivable detail exists.
        </p>
      </Section>
    </div>
  );
}
