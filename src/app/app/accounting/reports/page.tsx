import Link from "next/link";
import { guardAccounting, auditAccounting } from "@/lib/accounting/guard";
import { ACCOUNTING_PERMS } from "@/lib/accounting/permissions";
import { TEMPLATES, isAccountingTemplate } from "@/lib/reports/catalog";
import { listReports, seedDemoAccountingReports } from "@/lib/reports/service";
import { ModuleHeader, Section } from "@/components/analytics/Primitives";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

const UNAVAILABLE_KEYS = new Set([
  "accounting_cash_position",
  "accounting_ap_review",
  "accounting_balance_sheet",
]);

export default async function AccountingReportsPage() {
  const user = await guardAccounting(ACCOUNTING_PERMS.overview);
  auditAccounting(user, "accounting.reports_viewed");
  const canSchedule = user.permissions.has("app.admin") && user.permissions.has("feature.manage_reports");
  if (canSchedule) seedDemoAccountingReports(user);
  const templates = TEMPLATES.filter((t) => isAccountingTemplate(t.key));
  const live = templates.filter((t) => !UNAVAILABLE_KEYS.has(t.key));
  const reserved = templates.filter((t) => UNAVAILABLE_KEYS.has(t.key));
  const scheduled = canSchedule
    ? listReports(user).filter((r) => isAccountingTemplate(r.templateKey))
    : [];

  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Accounting reports"
        subtitle="These packs use the existing Automated Reporting engine. There is no second scheduler. Each send is generated from the recipient’s current permissions."
        scopeLabel="Existing engine"
        crossDept
      />

      <p className="text-sm text-ink-soft">
        {canSchedule ? (
          <>
            Activate or edit schedules in{" "}
            <Link href="/app/admin/reports" className="font-medium text-forest-600 hover:text-forest-700">
              Admin → Automated Reporting
            </Link>
            .
          </>
        ) : (
          <>
            An administrator schedules these in Admin → Automated Reporting. Recipients only
            receive measures they are authorized to see.
          </>
        )}
      </p>

      {scheduled.length > 0 && (
        <Section title="Scheduled" description="Active and paused accounting definitions already on the engine.">
          <ul className="divide-y divide-line">
            {scheduled.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <Link
                  href={`/app/admin/reports/${r.id}`}
                  className="font-medium text-ink hover:text-forest-700"
                >
                  {r.name}
                </Link>
                <StatusBadge intent={r.status === "active" ? "positive" : "neutral"} dot={false}>
                  {r.status}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        title="Live packs"
        description="Computed from posted operational data. Invoice aging, books P&L, and cash totals are not invented."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {live.map((t) => (
            <Card key={t.key}>
              <CardContent className="space-y-2">
                <p className="font-medium text-ink">{t.label}</p>
                <p className="text-sm text-ink-soft">{t.description}</p>
                <p className="text-caption text-ink-faint">
                  Default {t.scheduleKind.replace("_", " ")} · {t.deliveryTime}
                </p>
                {canSchedule && (
                  <Link
                    href={`/app/admin/reports/new?template=${t.key}`}
                    className="inline-block text-sm font-medium text-forest-600 hover:text-forest-700"
                  >
                    Schedule in Automated Reporting →
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        title="Reserved packs"
        description="You can schedule these so the catalog is complete. Each send states Data Unavailable — it will not invent cash, AP, or balance-sheet totals."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {reserved.map((t) => (
            <Card key={t.key}>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-ink">{t.label}</p>
                  <StatusBadge intent="info" dot={false}>
                    Source unavailable
                  </StatusBadge>
                </div>
                <p className="text-sm text-ink-soft">{t.description}</p>
                {canSchedule && (
                  <Link
                    href={`/app/admin/reports/new?template=${t.key}`}
                    className="inline-block text-sm font-medium text-forest-600 hover:text-forest-700"
                  >
                    Schedule unavailable pack →
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>
    </div>
  );
}
