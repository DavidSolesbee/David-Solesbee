"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/authz";
import { setFlash } from "@/lib/admin/flash";
import { toPerseusError } from "@/lib/errors";
import * as reports from "@/lib/reports/service";
import type { ReportInput, ReportStatus } from "@/lib/reports/service";
import type { AudienceRule } from "@/lib/reports/audience";
import type { TemplateKey, SectionKey } from "@/lib/reports/catalog";
import type { PeriodKey, ComparisonKey } from "@/lib/reports/periods";
import type { ScheduleKind, MonthlyMode } from "@/lib/reports/schedule";
import { generateReport } from "@/lib/reports/generate";

function parseInput(formData: FormData): ReportInput {
  const audience: AudienceRule[] = [];
  for (const v of formData.getAll("audienceRole")) audience.push({ kind: "role", value: String(v) });
  for (const v of formData.getAll("audienceDepartment"))
    audience.push({ kind: "department", value: String(v) });
  for (const v of formData.getAll("audienceLocation"))
    audience.push({ kind: "location", value: String(v) });
  for (const v of formData.getAll("audienceUser")) audience.push({ kind: "user", value: String(v) });

  const top = Number(formData.get("topN"));
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "") || null,
    templateKey: String(formData.get("templateKey") ?? "custom") as TemplateKey,
    periodKey: String(formData.get("periodKey") ?? "last_7_days") as PeriodKey,
    comparisonKey: String(formData.get("comparisonKey") ?? "previous_equivalent") as ComparisonKey,
    customDays: Number(formData.get("customDays") ?? 14) || 14,
    scheduleKind: String(formData.get("scheduleKind") ?? "weekdays") as ScheduleKind,
    scheduleDays: formData.getAll("scheduleDay").map((d) => Number(d)),
    monthlyMode: String(formData.get("monthlyMode") ?? "calendar_day") as MonthlyMode,
    monthlyDay: Number(formData.get("monthlyDay") ?? 1) || 1,
    customIntervalDays: Number(formData.get("customIntervalDays") ?? 14) || 14,
    deliveryTime: String(formData.get("deliveryTime") ?? "06:30"),
    timezone: String(formData.get("timezone") ?? "America/Chicago"),
    topN: top === 5 || top === 20 ? top : 10,
    formatHtml: formData.get("formatHtml") === "1",
    formatPdf: formData.get("formatPdf") === "1",
    formatLink: formData.get("formatLink") === "1",
    aiNarrative: formData.get("aiNarrative") === "1",
    status: String(formData.get("status") ?? "draft") as ReportStatus,
    sectionKeys: formData.getAll("section").map((s) => String(s) as SectionKey),
    audience,
  };
}

export async function createReportAction(formData: FormData): Promise<void> {
  let newId: number | null = null;
  try {
    const actor = await requireAdmin();
    newId = reports.createReport(actor, parseInput(formData));
    await setFlash({ kind: "success", message: "Report saved." });
  } catch (e) {
    await setFlash({ kind: "error", message: toPerseusError(e).message });
  }
  if (newId) {
    revalidatePath("/app/admin/reports");
    redirect(`/app/admin/reports/${newId}`);
  }
  redirect("/app/admin/reports/new");
}

export async function updateReportAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("reportId"));
  let ok = false;
  try {
    const actor = await requireAdmin();
    reports.updateReport(actor, id, parseInput(formData));
    ok = true;
    await setFlash({ kind: "success", message: "Report updated." });
  } catch (e) {
    await setFlash({ kind: "error", message: toPerseusError(e).message });
  }
  revalidatePath("/app/admin/reports");
  redirect(ok ? `/app/admin/reports/${id}` : `/app/admin/reports/${id}/edit`);
}

export async function setReportStatusAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("reportId"));
  const status = String(formData.get("status") ?? "active") as ReportStatus;
  try {
    const actor = await requireAdmin();
    reports.setReportStatus(actor, id, status);
    await setFlash({
      kind: "success",
      message:
        status === "active" ? "Report activated." : status === "paused" ? "Report paused." : "Saved as draft.",
    });
  } catch (e) {
    await setFlash({ kind: "error", message: toPerseusError(e).message });
  }
  revalidatePath("/app/admin/reports");
  redirect(`/app/admin/reports/${id}`);
}

export async function runReportAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("reportId"));
  try {
    const actor = await requireAdmin();
    const result = generateReport(actor, id, "manual");
    await setFlash({
      kind: "success",
      message: `Run complete — ${result.delivered} delivered, ${result.suppressed} suppressed, ${result.failed} failed. Each copy was generated from that recipient’s current permissions.`,
    });
  } catch (e) {
    await setFlash({ kind: "error", message: toPerseusError(e).message });
  }
  revalidatePath("/app/admin/reports");
  redirect(`/app/admin/reports/${id}`);
}

export async function testReportAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("reportId"));
  try {
    const actor = await requireAdmin();
    generateReport(actor, id, "test", { onlyUserId: actor.id });
    await setFlash({
      kind: "success",
      message: "Test report generated for your login email only. Labeled TEST REPORT.",
    });
  } catch (e) {
    await setFlash({ kind: "error", message: toPerseusError(e).message });
  }
  revalidatePath("/app/admin/reports");
  redirect(`/app/admin/reports/${id}`);
}

export async function deleteReportAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("reportId"));
  try {
    const actor = await requireAdmin();
    reports.deleteReport(actor, id);
    await setFlash({ kind: "success", message: "Report deleted." });
  } catch (e) {
    await setFlash({ kind: "error", message: toPerseusError(e).message });
  }
  revalidatePath("/app/admin/reports");
  redirect("/app/admin/reports");
}
