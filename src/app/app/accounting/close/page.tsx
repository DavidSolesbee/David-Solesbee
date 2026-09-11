import Link from "next/link";
import { guardAccounting, auditAccounting } from "@/lib/accounting/guard";
import { ACCOUNTING_PERMS } from "@/lib/accounting/permissions";
import { getCloseCenter } from "@/lib/accounting/close";
import { ModuleHeader, KpiCard, Section } from "@/components/analytics/Primitives";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Card, CardContent } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

const STATUS_LABEL = {
  needs_review: "Needs review",
  clear: "Clear",
  source_unavailable: "Source unavailable",
} as const;

const STATUS_INTENT = {
  needs_review: "attention",
  clear: "positive",
  source_unavailable: "neutral",
} as const;

export default async function ClosePage() {
  const user = await guardAccounting(ACCOUNTING_PERMS.close);
  auditAccounting(user, "accounting.close_viewed");
  const close = getCloseCenter(user);

  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Month-end close"
        subtitle="A capability map for close — not a posting workflow and not a completion percentage."
        scopeLabel={close?.periodLabel ?? "Close"}
        crossDept
      />

      {close && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Accounting period" value={close.periodLabel} sublabel={`As of ${close.asOf}`} />
            <KpiCard
              label="Close target date"
              value="Data Unavailable"
              sublabel="No close calendar in this extract"
            />
            <KpiCard
              label="Completion"
              value="Data Unavailable"
              sublabel="No close-task register"
            />
            <KpiCard
              label="Needs review"
              value={String(close.needsReview)}
              tone="attention"
              sublabel={`${close.unavailable} tasks have no source`}
            />
          </section>

          <p className="text-caption text-ink-faint">{close.methodology}</p>

          <Section
            title="Close tasks"
            description="Statuses are evaluated from live sources or marked unavailable. Nothing is marked Complete."
          >
            <Table>
              <THead>
                <TR>
                  <TH>Task</TH>
                  <TH>Owner hint</TH>
                  <TH>Status</TH>
                  <TH>Note</TH>
                </TR>
              </THead>
              <TBody>
                {close.tasks.map((t) => (
                  <TR key={t.key}>
                    <TD>
                      {t.href ? (
                        <Link href={t.href} className="font-medium text-forest-600 hover:text-forest-700">
                          {t.label}
                        </Link>
                      ) : (
                        t.label
                      )}
                    </TD>
                    <TD className="text-ink-soft">{t.ownerHint}</TD>
                    <TD>
                      <StatusBadge intent={STATUS_INTENT[t.status]} dot={false}>
                        {STATUS_LABEL[t.status]}
                      </StatusBadge>
                    </TD>
                    <TD className="text-ink-soft">{t.note}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Section>

          <Card>
            <CardContent>
              <p className="text-sm text-ink-soft">
                Assignment, due dates, notes, and Final Close Approval need a close-task
                register. That store is not in this extract, so those fields are omitted
                rather than invented.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
