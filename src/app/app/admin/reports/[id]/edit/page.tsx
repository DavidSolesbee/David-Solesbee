import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/authz";
import { loadReport } from "@/lib/reports/service";
import { audienceOptions } from "@/lib/reports/audience";
import { ReportWizard } from "@/components/reports/ReportWizard";
import { updateReportAction } from "@/app/app/admin/reports/actions";

export const dynamic = "force-dynamic";

export default async function EditReportPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAdmin();
  const { id: idRaw } = await params;
  const id = Number(idRaw);
  const report = loadReport(id);
  if (!report) notFound();
  const options = audienceOptions();

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/app/admin/reports/${id}`} className="text-sm text-ink-soft hover:text-ink">
          ← {report.name}
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-ink">Edit report</h2>
      </div>
      <ReportWizard
        action={updateReportAction}
        options={options}
        actorHierarchyLevel={actor.hierarchyLevel ?? 0}
        submitLabel="Save changes"
        initial={{
          reportId: report.id,
          name: report.name,
          description: report.description ?? "",
          templateKey: report.templateKey,
          periodKey: report.periodKey,
          comparisonKey: report.comparisonKey,
          customDays: report.customDays,
          scheduleKind: report.scheduleKind,
          scheduleDays: report.scheduleDays,
          monthlyMode: report.monthlyMode,
          monthlyDay: report.monthlyDay,
          customIntervalDays: report.customIntervalDays,
          deliveryTime: report.deliveryTime,
          timezone: report.timezone,
          topN: report.topN,
          formatHtml: report.formatHtml,
          formatPdf: report.formatPdf,
          formatLink: report.formatLink,
          aiNarrative: report.aiNarrative,
          status: report.status,
          sectionKeys: report.sectionKeys,
          audienceRoles: report.audience.filter((a) => a.kind === "role").map((a) => a.value),
          audienceDepartments: report.audience.filter((a) => a.kind === "department").map((a) => a.value),
          audienceLocations: report.audience.filter((a) => a.kind === "location").map((a) => a.value),
          audienceUsers: report.audience
            .filter((a) => a.kind === "user")
            .map((a) => Number(a.value)),
        }}
      />
    </div>
  );
}
