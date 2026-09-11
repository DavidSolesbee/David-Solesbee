import "server-only";
import { getAppDb } from "@/lib/db/app";
import { config } from "@/lib/config";
import { PerseusError } from "@/lib/errors";
import { loadUserById, type AuthUser } from "@/lib/auth/authz";
import { audit } from "@/lib/auth/audit";
import { isYmd } from "@/lib/reports/periods";
import { getSection, getTemplate, canRunTemplate } from "@/lib/reports/catalog";
import {
  loadReport,
  reportContext,
  expectedRecipients,
  ensureTemplateDefinition,
  type ReportRecord,
} from "@/lib/reports/service";
import {
  bindViewerTenant,
  resolveReportForViewer,
  type ResolvedSection,
} from "@/lib/reports/resolve";
import { renderEmailHtml } from "@/lib/reports/render";
import { reportAiNarrative } from "@/lib/ai/service";
import type { ResolvedRecipient } from "@/lib/reports/audience";
import type { DeliverySnapshot } from "@/lib/reports/types";

export type { DeliverySnapshot };

/**
 * Report generation — security at execution.
 *
 * For every recipient:
 *   Resolve Active Account → Role → Department → Location → Permissions
 *   → Apply Security → Generate recipient-specific report → send to login email.
 *
 * Suspended / revoked / expired / pending accounts are suppressed (not sent).
 * Content is never generated unrestricted and then copied to everyone.
 */

function assertCanRun(actor: AuthUser): void {
  if (!actor.permissions.has("app.admin") || !actor.permissions.has("feature.manage_reports")) {
    throw new PerseusError("FORBIDDEN", "You cannot run automated reports.");
  }
}

export type TriggerKind = "manual" | "scheduled" | "test";

export type PeriodOverride = { start: string; end: string };

function assertPeriodOverride(override: PeriodOverride): PeriodOverride {
  const start = override.start.slice(0, 10);
  const end = override.end.slice(0, 10);
  const asOf = config.dataAsOfFallback.slice(0, 10);
  if (!isYmd(start) || !isYmd(end)) {
    throw new PerseusError("VALIDATION", "From and To must be dates (YYYY-MM-DD).");
  }
  if (start > end) {
    throw new PerseusError("VALIDATION", "From date must be on or before To date.");
  }
  if (end > asOf) {
    throw new PerseusError("VALIDATION", "To date cannot be after the latest available data.");
  }
  return { start, end };
}

function snapshotFor(
  report: ReportRecord,
  recipient: AuthUser,
  test: boolean,
  periodOverride?: PeriodOverride,
): { snapshot: DeliverySnapshot; authorized: number; restricted: number } {
  const ctx = reportContext(report, periodOverride);
  const sections = resolveReportForViewer(report.sectionKeys, bindViewerTenant(recipient), {
    period: ctx.period,
    comparison: ctx.comparison,
    topN: report.topN,
    asOf: ctx.asOf,
  });
  let authorized = 0;
  let restricted = 0;
  for (const s of sections) {
    if (s.authorized) authorized++;
    else restricted++;
  }
  return {
    authorized,
    restricted,
    snapshot: {
      reportName: report.name,
      periodLabel: ctx.period.label,
      comparisonLabel: ctx.comparison.label,
      recipientName: `${recipient.firstName} ${recipient.lastName}`.trim(),
      recipientEmail: recipient.email,
      recipientRole: recipient.roleName,
      scopeNote: [
        recipient.department ? `${recipient.department} department` : "All departments",
        recipient.locationName ?? "All locations",
      ].join(" · "),
      test,
      sections,
      aiNarrative: report.aiNarrative ? reportAiNarrative(sections) : null,
    },
  };
}

function deliverableRecipients(actor: AuthUser, report: ReportRecord): ResolvedRecipient[] {
  return expectedRecipients(actor, report.audience);
}

function recipientFromUser(user: AuthUser): ResolvedRecipient {
  return {
    userId: user.id,
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    roleKey: user.roleKey,
    roleName: user.roleName,
    department: user.department,
    locationName: user.locationName,
    hierarchyLevel: user.hierarchyLevel,
    status: user.status,
  };
}

export function generateReport(
  actor: AuthUser,
  id: number,
  triggerKind: TriggerKind = "manual",
  opts?: { onlyUserId?: number },
): { runId: number; delivered: number; suppressed: number; failed: number } {
  assertCanRun(actor);
  const report = loadReport(id);
  if (!report) throw new PerseusError("NOT_FOUND", "Report not found.");

  let recipients = deliverableRecipients(actor, report);
  if (opts?.onlyUserId) {
    recipients = recipients.filter((r) => r.userId === opts.onlyUserId);
    if (recipients.length === 0) {
      // Test delivery always goes to the acting admin, even if they are not in audience.
      recipients = [recipientFromUser(actor)];
    }
  }

  return deliverToRecipients(actor, report, triggerKind, recipients);
}

/**
 * Department self-serve run. Uses the same resolve/generate path as Admin
 * Run now, but only for the signed-in viewer and only templates they may run.
 */
export function generateTemplateForSelf(
  viewer: AuthUser,
  templateKey: string,
  periodOverride: PeriodOverride,
): { runId: number; deliveryId: number; delivered: number; suppressed: number; failed: number } {
  if (!viewer.permissions.has("feature.export")) {
    throw new PerseusError("FORBIDDEN", "You do not have permission to run reports.");
  }
  const template = getTemplate(templateKey);
  if (!template || template.key === "custom") {
    throw new PerseusError("NOT_FOUND", "Report type not found.");
  }
  if (!canRunTemplate(viewer.permissions, template)) {
    throw new PerseusError("FORBIDDEN", "You are not authorized to run that report.");
  }
  const range = assertPeriodOverride(periodOverride);
  const reportId = ensureTemplateDefinition(template.key);
  const report = reportId ? loadReport(reportId) : null;
  if (!report) throw new PerseusError("NOT_FOUND", "Report is not available to run.");

  const result = deliverToRecipients(viewer, report, "manual", [recipientFromUser(viewer)], range);
  const delivery = getAppDb()
    .prepare(
      `SELECT id FROM report_deliveries WHERE run_id = ? AND recipient_user_id = ? ORDER BY id DESC LIMIT 1`,
    )
    .get(result.runId, viewer.id) as { id: number } | undefined;
  if (!delivery || result.delivered === 0) {
    throw new PerseusError("FORBIDDEN", "Report could not be generated for your account.");
  }
  return { ...result, deliveryId: delivery.id };
}

function deliverToRecipients(
  actor: AuthUser,
  report: ReportRecord,
  triggerKind: TriggerKind,
  recipients: ResolvedRecipient[],
  periodOverride?: PeriodOverride,
): { runId: number; delivered: number; suppressed: number; failed: number } {
  const ctx = reportContext(report, periodOverride);
  const db = getAppDb();
  const runInfo = db
    .prepare(
      `INSERT INTO report_runs
         (report_id, triggered_by, trigger_kind, period_start, period_end, period_label,
          recipient_count, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'generating')`,
    )
    .run(
      report.id,
      actor.id,
      triggerKind,
      ctx.period.start,
      ctx.period.end,
      ctx.period.label,
      recipients.length,
    );
  const runId = Number(runInfo.lastInsertRowid);
  const id = report.id;

  const ins = db.prepare(
    `INSERT INTO report_deliveries
       (run_id, report_id, recipient_user_id, recipient_email, recipient_role, recipient_name,
        status, generated_at, delivered_at, error_message,
        sections_total, sections_authorized, sections_restricted, snapshot, email_html)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  let delivered = 0;
  let suppressed = 0;
  let failed = 0;
  const test = triggerKind === "test";

  for (const rec of recipients) {
    const user = loadUserById(rec.userId);
    const loginEmail = user?.email ?? rec.email;
    const bound = user ? bindViewerTenant(user) : null;
    const hasTenant = !!(bound as { activeTenantId?: string } | null)?.activeTenantId;
    if (
      !user ||
      !bound ||
      user.status !== "active" ||
      !user.permissions.has("app.access") ||
      !hasTenant
    ) {
      ins.run(
        runId,
        id,
        rec.userId,
        loginEmail,
        rec.roleName,
        rec.name,
        "suppressed",
        null,
        null,
        !hasTenant && user?.status === "active"
          ? "No active tenant membership — not sent."
          : `Account is ${user?.status ?? "missing"} — not sent.`,
        report.sectionKeys.length,
        0,
        report.sectionKeys.length,
        null,
        null,
      );
      suppressed++;
      continue;
    }

    try {
      const { snapshot, authorized, restricted } = snapshotFor(report, bound, test, periodOverride);
      const html = renderEmailHtml(snapshot, { deliveryId: 0, includeLink: report.formatLink });
      const now = new Date().toISOString().replace("T", " ").slice(0, 19);
      const info = ins.run(
        runId,
        id,
        user.id,
        user.email,
        user.roleName,
        `${user.firstName} ${user.lastName}`.trim(),
        "delivered",
        now,
        now,
        null,
        report.sectionKeys.length,
        authorized,
        restricted,
        JSON.stringify(snapshot),
        html,
      );
      // Rewrite the View-in-Perseus link with the real delivery id.
      const deliveryId = Number(info.lastInsertRowid);
      if (report.formatLink) {
        const html2 = renderEmailHtml(snapshot, { deliveryId, includeLink: true });
        db.prepare("UPDATE report_deliveries SET email_html = ? WHERE id = ?").run(html2, deliveryId);
      }
      delivered++;
    } catch (e) {
      ins.run(
        runId,
        id,
        rec.userId,
        loginEmail,
        rec.roleName,
        rec.name,
        "failed",
        null,
        null,
        e instanceof Error ? e.message : "Generation failed",
        report.sectionKeys.length,
        0,
        0,
        null,
        null,
      );
      failed++;
    }
  }

  db.prepare(
    `UPDATE report_runs SET status='delivered', delivered_count=?, failed_count=?, suppressed_count=?
     WHERE id=?`,
  ).run(delivered, failed, suppressed, runId);
  db.prepare(
    "UPDATE report_definitions SET last_run_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
  ).run(id);

  audit({
    actorUserId: actor.id,
    actorLabel: actor.email,
    action: test ? "report.test" : triggerKind === "scheduled" ? "report.generated" : "report.run",
    targetType: "report",
    targetId: String(id),
    detail: `${report.name}: ${delivered} delivered, ${suppressed} suppressed, ${failed} failed`,
  });

  return { runId, delivered, suppressed, failed };
}

export type PreviewCell =
  | { state: "shown"; section: ResolvedSection }
  | { state: "recipient_only" }
  | { state: "restricted" };

export interface RecipientPreview {
  recipientUserId: number;
  recipientName: string;
  recipientEmail: string;
  recipientRole: string | null;
  recipientStatus: string;
  periodLabel: string;
  comparisonLabel: string;
  authorized: number;
  restricted: number;
  cells: { key: string; label: string; cell: PreviewCell }[];
  emailHtml: string | null;
}

function gateSection(section: ResolvedSection, actor: AuthUser): PreviewCell {
  if (!section.authorized) return { state: "restricted" };
  const def = getSection(section.key);
  if (def?.requiredPermission && !actor.permissions.has(def.requiredPermission)) {
    return { state: "recipient_only" };
  }
  return { state: "shown", section };
}

export function previewForRecipient(
  actor: AuthUser,
  reportId: number,
  recipientUserId: number,
): RecipientPreview {
  assertCanRun(actor);
  const report = loadReport(reportId);
  if (!report) throw new PerseusError("NOT_FOUND", "Report not found.");
  const user = loadUserById(recipientUserId);
  if (!user) throw new PerseusError("NOT_FOUND", "Recipient not found.");
  const ctx = reportContext(report);

  const active = user.status === "active" && user.permissions.has("app.access");
  const sections = active
    ? resolveReportForViewer(report.sectionKeys, bindViewerTenant(user), {
        period: ctx.period,
        comparison: ctx.comparison,
        topN: report.topN,
        asOf: ctx.asOf,
      })
    : report.sectionKeys
        .map((k) => getSection(k))
        .filter((s): s is NonNullable<typeof s> => !!s)
        .map((s) => ({
          key: s.key,
          label: s.label,
          description: s.description,
          band: s.band,
          authorized: false,
        }));

  let authorized = 0;
  let restricted = 0;
  const cells = sections.map((s) => {
    const cell = active ? gateSection(s, actor) : ({ state: "restricted" } as PreviewCell);
    if (cell.state === "restricted") restricted++;
    else authorized++;
    return { key: s.key, label: s.label, cell };
  });

  const shown: ResolvedSection[] = sections.map((s) => {
    const cell = gateSection(s, actor);
    if (cell.state === "shown") return cell.section;
    return { ...s, authorized: false, kpis: undefined, narrative: undefined, bars: undefined, items: undefined, alerts: undefined };
  });

  const emailHtml = active
    ? renderEmailHtml(
        {
          reportName: report.name,
          periodLabel: ctx.period.label,
          comparisonLabel: ctx.comparison.label,
          recipientName: `${user.firstName} ${user.lastName}`.trim(),
          recipientEmail: user.email,
          recipientRole: user.roleName,
          scopeNote: "PREVIEW — NOT SENT",
          test: true,
          sections: shown,
        },
        { deliveryId: 0, includeLink: false, preview: true },
      )
    : null;

  return {
    recipientUserId: user.id,
    recipientName: `${user.firstName} ${user.lastName}`.trim(),
    recipientEmail: user.email,
    recipientRole: user.roleName,
    recipientStatus: user.status,
    periodLabel: ctx.period.label,
    comparisonLabel: ctx.comparison.label,
    authorized,
    restricted,
    cells,
    emailHtml,
  };
}

export function previewForRole(
  actor: AuthUser,
  reportId: number,
  roleKey: string,
): RecipientPreview {
  const row = getAppDb()
    .prepare(
      `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
       WHERE r.key = ? AND u.status = 'active' ORDER BY u.id LIMIT 1`,
    )
    .get(roleKey) as { id: number } | undefined;
  if (!row) throw new PerseusError("NOT_FOUND", "No active user holds that role to preview as.");
  return previewForRecipient(actor, reportId, row.id);
}

export interface StoredDelivery {
  id: number;
  reportId: number;
  reportName: string;
  recipientUserId: number;
  recipientEmail: string;
  recipientName: string;
  recipientRole: string | null;
  status: string;
  generatedAt: string | null;
  deliveredAt: string | null;
  errorMessage: string | null;
  snapshot: DeliverySnapshot | null;
  emailHtml: string | null;
}

export function loadDelivery(id: number): StoredDelivery | null {
  const row = getAppDb()
    .prepare(
      `SELECT d.*, r.name AS report_name
       FROM report_deliveries d
       JOIN report_definitions r ON r.id = d.report_id
       WHERE d.id = ?`,
    )
    .get(id) as
    | {
        id: number;
        report_id: number;
        report_name: string;
        recipient_user_id: number;
        recipient_email: string;
        recipient_name: string;
        recipient_role: string | null;
        status: string;
        generated_at: string | null;
        delivered_at: string | null;
        error_message: string | null;
        snapshot: string | null;
        email_html: string | null;
      }
    | undefined;
  if (!row) return null;
  let snapshot: DeliverySnapshot | null = null;
  if (row.snapshot) {
    try {
      snapshot = JSON.parse(row.snapshot) as DeliverySnapshot;
    } catch {
      snapshot = null;
    }
  }
  return {
    id: row.id,
    reportId: row.report_id,
    reportName: row.report_name,
    recipientUserId: row.recipient_user_id,
    recipientEmail: row.recipient_email,
    recipientName: row.recipient_name,
    recipientRole: row.recipient_role,
    status: row.status,
    generatedAt: row.generated_at,
    deliveredAt: row.delivered_at,
    errorMessage: row.error_message,
    snapshot,
    emailHtml: row.email_html,
  };
}

/** Authenticated "View in Perseus" — recipient or admin only. No tokens. */
export function getDeliveryForViewer(viewer: AuthUser, id: number): StoredDelivery | null {
  const d = loadDelivery(id);
  if (!d) return null;
  const isOwner = d.recipientUserId === viewer.id;
  const isAdmin = viewer.permissions.has("app.admin");
  if (!isOwner && !isAdmin) return null;
  return d;
}
