import Link from "next/link";
import { requireAdmin } from "@/lib/auth/authz";
import { audienceOptions } from "@/lib/reports/audience";
import { getTemplate, type TemplateKey } from "@/lib/reports/catalog";
import { ReportWizard } from "@/components/reports/ReportWizard";
import { createReportAction } from "@/app/app/admin/reports/actions";

export const dynamic = "force-dynamic";

export default async function NewReportPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const actor = await requireAdmin();
  const { template } = await searchParams;
  const t = template ? getTemplate(template) : undefined;
  const options = audienceOptions();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/admin/reports" className="text-sm text-ink-soft hover:text-ink">
          ← Automated Reporting
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-ink">New report</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Seven steps: type, audience, period, schedule, content, preview, activate. Recipients
          resolve from approved users only.
        </p>
      </div>
      <ReportWizard
        action={createReportAction}
        options={options}
        actorHierarchyLevel={actor.hierarchyLevel ?? 0}
        submitLabel="Save report"
        initial={
          t
            ? {
                name: t.label,
                description: t.description,
                templateKey: t.key as TemplateKey,
                periodKey: t.periodKey,
                comparisonKey: t.comparisonKey,
                scheduleKind: t.scheduleKind,
                scheduleDays: t.scheduleDays,
                monthlyMode: t.monthlyMode,
                deliveryTime: t.deliveryTime,
                topN: t.topN,
                sectionKeys: t.sections,
                audienceRoles: t.suggestedAudience.filter((a) => a.kind === "role").map((a) => a.value),
                audienceDepartments: t.suggestedAudience
                  .filter((a) => a.kind === "department")
                  .map((a) => a.value),
              }
            : undefined
        }
      />
    </div>
  );
}
