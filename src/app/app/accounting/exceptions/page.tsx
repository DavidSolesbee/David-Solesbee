import Link from "next/link";
import { guardAccounting, auditAccounting } from "@/lib/accounting/guard";
import { ACCOUNTING_PERMS } from "@/lib/accounting/permissions";
import {
  listAccountingExceptions,
  UNAVAILABLE_EXCEPTION_RULES,
  type ExceptionCategory,
  type ExceptionSeverity,
} from "@/lib/accounting/exceptions";
import { ModuleHeader, Section } from "@/components/analytics/Primitives";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card, CardContent } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const SEV_INTENT = {
  critical: "critical",
  attention: "attention",
  info: "info",
} as const;

export default async function ExceptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; category?: string }>;
}) {
  const user = await guardAccounting(ACCOUNTING_PERMS.exceptions);
  auditAccounting(user, "accounting.exceptions_viewed");
  const q = await searchParams;
  const all = listAccountingExceptions(user);
  const severity = (["critical", "attention", "info"] as ExceptionSeverity[]).includes(
    q.severity as ExceptionSeverity,
  )
    ? (q.severity as ExceptionSeverity)
    : undefined;
  const category = (["AR", "Inventory", "Service", "Data"] as ExceptionCategory[]).includes(
    q.category as ExceptionCategory,
  )
    ? (q.category as ExceptionCategory)
    : undefined;
  const rows = all.filter((e) => {
    if (severity && e.severity !== severity) return false;
    if (category && e.category !== category) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Exception center"
        subtitle="Only conditions this extract can evaluate. Each row prints the rule. Status is NEW because there is no exception workflow store."
        scopeLabel={`${all.length} live`}
        crossDept
      />

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/app/accounting/exceptions"
          className="rounded-md px-3 py-1.5 text-ink-soft hover:bg-surface-tinted"
        >
          All
        </Link>
        {(["critical", "attention", "info"] as const).map((s) => (
          <Link
            key={s}
            href={`/app/accounting/exceptions?severity=${s}${category ? `&category=${category}` : ""}`}
            className="rounded-md px-3 py-1.5 capitalize text-ink-soft hover:bg-surface-tinted"
          >
            {s}
          </Link>
        ))}
        {(["AR", "Inventory", "Service", "Data"] as const).map((c) => (
          <Link
            key={c}
            href={`/app/accounting/exceptions?category=${c}${severity ? `&severity=${severity}` : ""}`}
            className="rounded-md px-3 py-1.5 text-ink-soft hover:bg-surface-tinted"
          >
            {c}
          </Link>
        ))}
      </div>

      <Section
        title="Live exceptions"
        description="Detected from posted AR, in-stock unit age, open work orders, and extract freshness."
      >
        {rows.length === 0 ? (
          <p className="text-sm text-ink-soft">
            No live exceptions in this filter — or AR is not authorized.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((e) => (
              <li key={e.key} className="py-4">
                <Link href={e.href} className="block hover:text-forest-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge intent={SEV_INTENT[e.severity]} dot={false}>
                      {e.severity}
                    </StatusBadge>
                    <StatusBadge intent="neutral" dot={false}>
                      {e.category}
                    </StatusBadge>
                    <StatusBadge intent="info" dot={false}>
                      {e.status}
                    </StatusBadge>
                    <span className="font-medium text-ink">{e.title}</span>
                    {e.amount !== undefined && (
                      <span className="ml-auto tabular-nums text-ink-soft">
                        {formatCurrency(e.amount)}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-ink-soft">{e.description}</p>
                  <p className="mt-1 text-caption text-ink-faint">Rule: {e.rule}</p>
                  <p className="mt-1 text-caption text-ink-faint">
                    Next: {e.action} · Detected {e.detectedOn}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium text-ink">Rules not evaluated</p>
          <p className="text-caption text-ink-faint">
            These exception types exist in the product catalog. They are not shown
            as zero findings — the source is missing.
          </p>
          <ul className="divide-y divide-line text-sm">
            {UNAVAILABLE_EXCEPTION_RULES.map((r) => (
              <li key={r.key} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="text-ink">
                  {r.title}
                  <span className="ml-2 text-caption text-ink-faint">{r.category}</span>
                </span>
                <span className="text-ink-soft">{r.missing}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
