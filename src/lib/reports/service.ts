import "server-only";
import { getAppDb } from "@/lib/db/app";
import { PerseusError } from "@/lib/errors";
import type { AuthUser } from "@/lib/auth/authz";
import { audit } from "@/lib/auth/audit";
import { getSection, getTemplate, type SectionKey, type TemplateKey } from "@/lib/reports/catalog";
import {
  type PeriodKey,
  type ComparisonKey,
  resolvePeriod,
  resolveComparison,
  resolveAbsoluteRange,
} from "@/lib/reports/periods";
import {
  type ScheduleKind,
  type MonthlyMode,
  type ScheduleSpec,
  nextDeliveries,
  scheduleLabel,
} from "@/lib/reports/schedule";
import {
  type AudienceRule,
  resolveAudience,
  eligibleRecipients,
  type ResolvedRecipient,
} from "@/lib/reports/audience";
import { config } from "@/lib/config";

export type ReportStatus = "draft" | "active" | "paused";

export interface ReportInput {
  name: string;
  description: string | null;
  templateKey: TemplateKey;
  periodKey: PeriodKey;
  comparisonKey: ComparisonKey;
  customDays: number;
  scheduleKind: ScheduleKind;
  scheduleDays: number[];
  monthlyMode: MonthlyMode;
  monthlyDay: number;
  customIntervalDays: number;
  deliveryTime: string;
  timezone: string;
  topN: 5 | 10 | 20;
  formatHtml: boolean;
  formatPdf: boolean;
  formatLink: boolean;
  aiNarrative: boolean;
  status: ReportStatus;
  sectionKeys: string[];
  audience: AudienceRule[];
}

export interface ReportRecord {
  id: number;
  name: string;
  description: string | null;
  ownerUserId: number;
  ownerName: string;
  templateKey: TemplateKey;
  periodKey: PeriodKey;
  comparisonKey: ComparisonKey;
  customDays: number;
  scheduleKind: ScheduleKind;
  scheduleDays: number[];
  monthlyMode: MonthlyMode;
  monthlyDay: number;
  customIntervalDays: number;
  deliveryTime: string;
  timezone: string;
  topN: 5 | 10 | 20;
  formatHtml: boolean;
  formatPdf: boolean;
  formatLink: boolean;
  aiNarrative: boolean;
  status: ReportStatus;
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  sectionKeys: SectionKey[];
  audience: AudienceRule[];
}

function assertAdmin(actor: AuthUser): void {
  if (!actor.permissions.has("app.admin"))
    throw new PerseusError("FORBIDDEN", "Automated reporting lives in the Admin Console.");
  if (!actor.permissions.has("feature.manage_reports"))
    throw new PerseusError("FORBIDDEN", "You do not have permission to manage reports.");
}

function parseDays(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.map(Number).filter((n) => n >= 0 && n <= 6) : [];
  } catch {
    return [];
  }
}

interface DefRow {
  id: number;
  name: string;
  description: string | null;
  owner_user_id: number;
  owner_first: string;
  owner_last: string;
  template_key: string;
  period_key: string;
  comparison_key: string;
  custom_days: number;
  schedule_kind: string;
  schedule_days: string | null;
  monthly_mode: string;
  monthly_day: number | null;
  custom_interval_days: number;
  delivery_time: string;
  timezone: string;
  top_n: number;
  format_html: number;
  format_pdf: number;
  format_link: number;
  ai_narrative: number;
  status: ReportStatus;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

const SELECT_DEF = `
  SELECT d.*, ou.first_name AS owner_first, ou.last_name AS owner_last
  FROM report_definitions d
  JOIN users ou ON ou.id = d.owner_user_id`;

function loadAudience(reportId: number): AudienceRule[] {
  return (
    getAppDb()
      .prepare("SELECT kind, value FROM report_audience_rules WHERE report_id = ? ORDER BY id")
      .all(reportId) as unknown as AudienceRule[]
  );
}

function loadSections(reportId: number): SectionKey[] {
  return (
    getAppDb()
      .prepare("SELECT section_key FROM report_sections WHERE report_id = ? ORDER BY position, id")
      .all(reportId) as { section_key: string }[]
  ).map((r) => r.section_key as SectionKey);
}

function toRecord(row: DefRow): ReportRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ownerUserId: row.owner_user_id,
    ownerName: `${row.owner_first} ${row.owner_last}`.trim(),
    templateKey: row.template_key as TemplateKey,
    periodKey: row.period_key as PeriodKey,
    comparisonKey: row.comparison_key as ComparisonKey,
    customDays: row.custom_days,
    scheduleKind: row.schedule_kind as ScheduleKind,
    scheduleDays: parseDays(row.schedule_days),
    monthlyMode: (row.monthly_mode as MonthlyMode) || "calendar_day",
    monthlyDay: row.monthly_day ?? 1,
    customIntervalDays: row.custom_interval_days,
    deliveryTime: row.delivery_time,
    timezone: row.timezone,
    topN: (row.top_n === 5 || row.top_n === 20 ? row.top_n : 10) as 5 | 10 | 20,
    formatHtml: row.format_html === 1,
    formatPdf: row.format_pdf === 1,
    formatLink: row.format_link === 1,
    aiNarrative: row.ai_narrative === 1,
    status: row.status,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sectionKeys: loadSections(row.id),
    audience: loadAudience(row.id),
  };
}

export function scheduleOf(r: ReportRecord): ScheduleSpec {
  return {
    kind: r.scheduleKind,
    days: r.scheduleDays,
    monthlyMode: r.monthlyMode,
    monthlyDay: r.monthlyDay,
    customIntervalDays: r.customIntervalDays,
    time: r.deliveryTime,
    timezone: r.timezone,
  };
}

export function loadReport(id: number): ReportRecord | null {
  const row = getAppDb()
    .prepare(`${SELECT_DEF} WHERE d.id = ?`)
    .get(id) as unknown as DefRow | undefined;
  return row ? toRecord(row) : null;
}

export function listReports(_actor: AuthUser): ReportRecord[] {
  const rows = getAppDb()
    .prepare(`${SELECT_DEF} ORDER BY d.updated_at DESC`)
    .all() as unknown as DefRow[];
  return rows.map(toRecord);
}

function computeNextRun(input: ReportInput, originYmd: string): string | null {
  if (input.status !== "active") return null;
  const next = nextDeliveries(
    {
      kind: input.scheduleKind,
      days: input.scheduleDays,
      monthlyMode: input.monthlyMode,
      monthlyDay: input.monthlyDay,
      customIntervalDays: input.customIntervalDays,
      time: input.deliveryTime,
      timezone: input.timezone,
    },
    1,
    new Date(),
    originYmd,
  )[0];
  return next ? `${next.ymd} ${next.time}` : null;
}

function validate(actor: AuthUser, input: ReportInput): ReportInput {
  const name = input.name.trim();
  if (!name) throw new PerseusError("VALIDATION", "Report name is required.");
  if (!getTemplate(input.templateKey))
    throw new PerseusError("VALIDATION", "Unknown report type.");
  const seen = new Set<string>();
  const sectionKeys = input.sectionKeys.filter((k) => {
    if (seen.has(k) || !getSection(k)) return false;
    seen.add(k);
    return true;
  });
  if (sectionKeys.length === 0)
    throw new PerseusError("VALIDATION", "Select at least one content section.");
  if (input.audience.length === 0)
    throw new PerseusError("VALIDATION", "Select an audience.");
  const resolved = resolveAudience(input.audience);
  const eligible = eligibleRecipients(actor, resolved);
  if (eligible.length === 0)
    throw new PerseusError(
      "VALIDATION",
      "That audience resolves to no eligible recipients at or below your level.",
    );
  const topN = input.topN === 5 || input.topN === 20 ? input.topN : 10;
  const time = /^\d{2}:\d{2}$/.test(input.deliveryTime) ? input.deliveryTime : "06:30";
  return { ...input, name, sectionKeys, topN, deliveryTime: time };
}

function writeChildren(id: number, input: ReportInput): void {
  const db = getAppDb();
  db.prepare("DELETE FROM report_sections WHERE report_id = ?").run(id);
  db.prepare("DELETE FROM report_audience_rules WHERE report_id = ?").run(id);
  const insS = db.prepare(
    "INSERT INTO report_sections (report_id, section_key, position) VALUES (?, ?, ?)",
  );
  input.sectionKeys.forEach((k, i) => insS.run(id, k, i));
  const insA = db.prepare(
    "INSERT INTO report_audience_rules (report_id, kind, value) VALUES (?, ?, ?)",
  );
  input.audience.forEach((r) => insA.run(id, r.kind, r.value));
}

export function createReport(actor: AuthUser, input: ReportInput): number {
  assertAdmin(actor);
  const v = validate(actor, input);
  const origin = new Date().toISOString().slice(0, 10);
  const next = computeNextRun(v, origin);
  const info = getAppDb()
    .prepare(
      `INSERT INTO report_definitions (
         name, description, owner_user_id, template_key, period_key, comparison_key,
         custom_days, schedule_kind, schedule_days, monthly_mode, monthly_day,
         custom_interval_days, delivery_time, timezone, top_n,
         format_html, format_pdf, format_link, ai_narrative, status, next_run_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      v.name,
      v.description,
      actor.id,
      v.templateKey,
      v.periodKey,
      v.comparisonKey,
      v.customDays,
      v.scheduleKind,
      JSON.stringify(v.scheduleDays),
      v.monthlyMode,
      v.monthlyDay,
      v.customIntervalDays,
      v.deliveryTime,
      v.timezone,
      v.topN,
      v.formatHtml ? 1 : 0,
      v.formatPdf ? 1 : 0,
      v.formatLink ? 1 : 0,
      v.aiNarrative ? 1 : 0,
      v.status,
      next,
    );
  const id = Number(info.lastInsertRowid);
  writeChildren(id, v);
  audit({
    actorUserId: actor.id,
    actorLabel: actor.email,
    action: "report.create",
    targetType: "report",
    targetId: String(id),
    detail: `${v.name} (${v.templateKey}, ${v.status})`,
  });
  return id;
}

export function updateReport(actor: AuthUser, id: number, input: ReportInput): void {
  assertAdmin(actor);
  const existing = loadReport(id);
  if (!existing) throw new PerseusError("NOT_FOUND", "Report not found.");
  const v = validate(actor, input);
  const next = computeNextRun(v, existing.createdAt.slice(0, 10));
  getAppDb()
    .prepare(
      `UPDATE report_definitions SET
         name=?, description=?, template_key=?, period_key=?, comparison_key=?,
         custom_days=?, schedule_kind=?, schedule_days=?, monthly_mode=?, monthly_day=?,
         custom_interval_days=?, delivery_time=?, timezone=?, top_n=?,
         format_html=?, format_pdf=?, format_link=?, ai_narrative=?, status=?, next_run_at=?,
         updated_at=datetime('now')
       WHERE id=?`,
    )
    .run(
      v.name,
      v.description,
      v.templateKey,
      v.periodKey,
      v.comparisonKey,
      v.customDays,
      v.scheduleKind,
      JSON.stringify(v.scheduleDays),
      v.monthlyMode,
      v.monthlyDay,
      v.customIntervalDays,
      v.deliveryTime,
      v.timezone,
      v.topN,
      v.formatHtml ? 1 : 0,
      v.formatPdf ? 1 : 0,
      v.formatLink ? 1 : 0,
      v.aiNarrative ? 1 : 0,
      v.status,
      next,
      id,
    );
  writeChildren(id, v);
  audit({
    actorUserId: actor.id,
    actorLabel: actor.email,
    action: "report.update",
    targetType: "report",
    targetId: String(id),
    detail: v.name,
  });
}

export function setReportStatus(actor: AuthUser, id: number, status: ReportStatus): void {
  assertAdmin(actor);
  const existing = loadReport(id);
  if (!existing) throw new PerseusError("NOT_FOUND", "Report not found.");
  const next =
    status === "active"
      ? nextDeliveries(scheduleOf(existing), 1, new Date(), existing.createdAt.slice(0, 10))[0]
        ? (() => {
            const n = nextDeliveries(
              scheduleOf(existing),
              1,
              new Date(),
              existing.createdAt.slice(0, 10),
            )[0];
            return n ? `${n.ymd} ${n.time}` : null;
          })()
        : null
      : null;
  getAppDb()
    .prepare(
      "UPDATE report_definitions SET status=?, next_run_at=?, updated_at=datetime('now') WHERE id=?",
    )
    .run(status, next, id);
  const action =
    status === "active" && existing.status !== "active"
      ? existing.status === "paused"
        ? "report.resume"
        : "report.activate"
      : status === "paused"
        ? "report.pause"
        : "report.update";
  audit({
    actorUserId: actor.id,
    actorLabel: actor.email,
    action,
    targetType: "report",
    targetId: String(id),
    detail: existing.name,
  });
}

export function deleteReport(actor: AuthUser, id: number): void {
  assertAdmin(actor);
  const existing = loadReport(id);
  if (!existing) throw new PerseusError("NOT_FOUND", "Report not found.");
  getAppDb().prepare("DELETE FROM report_definitions WHERE id = ?").run(id);
  audit({
    actorUserId: actor.id,
    actorLabel: actor.email,
    action: "report.delete",
    targetType: "report",
    targetId: String(id),
    detail: existing.name,
  });
}

export function expectedRecipients(actor: AuthUser, rules: AudienceRule[]): ResolvedRecipient[] {
  return eligibleRecipients(actor, resolveAudience(rules));
}

export function reportContext(
  r: ReportRecord,
  periodOverride?: { start: string; end: string },
) {
  const asOf = config.dataAsOfFallback.slice(0, 10);
  const period = periodOverride
    ? resolveAbsoluteRange(periodOverride.start, periodOverride.end)
    : resolvePeriod(r.periodKey, asOf, r.customDays);
  const comparison = resolveComparison(
    periodOverride ? "previous_equivalent" : r.comparisonKey,
    period,
  );
  const schedule = scheduleOf(r);
  const upcoming = nextDeliveries(schedule, 3, new Date(), r.createdAt.slice(0, 10));
  return {
    asOf,
    period,
    comparison,
    schedule,
    scheduleLabel: scheduleLabel(schedule),
    upcoming,
  };
}

export interface HomeKpis {
  activeSchedules: number;
  sentToday: number;
  sentWeek: number;
  recipientsCovered: number;
  successRate: number | null;
  failed: number;
  nextDelivery: string | null;
}

export function homeSnapshot(actor: AuthUser): {
  kpis: HomeKpis;
  reports: ReportRecord[];
  upcoming: { report: ReportRecord; when: string }[];
  recent: DeliveryListItem[];
  attention: { report: ReportRecord; reason: string }[];
} {
  assertAdmin(actor);
  const reports = listReports(actor);
  const db = getAppDb();
  const sentToday =
    (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM report_deliveries
           WHERE status = 'delivered' AND date(delivered_at) = date('now')`,
        )
        .get() as { n: number }
    ).n ?? 0;
  const sentWeek =
    (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM report_deliveries
           WHERE status = 'delivered' AND delivered_at >= datetime('now', '-7 day')`,
        )
        .get() as { n: number }
    ).n ?? 0;
  const failed =
    (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM report_deliveries
           WHERE status = 'failed' AND delivered_at >= datetime('now', '-7 day')`,
        )
        .get() as { n: number }
    ).n ?? 0;
  const covered =
    (
      db
        .prepare(
          `SELECT COUNT(DISTINCT recipient_user_id) AS n FROM report_deliveries
           WHERE status = 'delivered'`,
        )
        .get() as { n: number }
    ).n ?? 0;
  const denom = sentWeek + failed;
  const active = reports.filter((r) => r.status === "active");
  const upcoming = active
    .filter((r) => r.nextRunAt)
    .map((r) => ({ report: r, when: r.nextRunAt as string }))
    .sort((a, b) => a.when.localeCompare(b.when))
    .slice(0, 6);
  const attention: { report: ReportRecord; reason: string }[] = [];
  for (const r of reports) {
    if (r.status === "draft") attention.push({ report: r, reason: "Draft — not yet activated" });
    if (r.status === "active" && r.nextRunAt && r.nextRunAt < new Date().toISOString().slice(0, 16))
      attention.push({ report: r, reason: "Next run is overdue" });
    if (r.status === "paused") attention.push({ report: r, reason: "Paused" });
  }
  return {
    kpis: {
      activeSchedules: active.length,
      sentToday,
      sentWeek,
      recipientsCovered: covered,
      successRate: denom === 0 ? null : Math.round((sentWeek / denom) * 1000) / 10,
      failed,
      nextDelivery: upcoming[0]?.when ?? null,
    },
    reports,
    upcoming,
    recent: listRecentDeliveries(20),
    attention: attention.slice(0, 8),
  };
}

export interface DeliveryListItem {
  id: number;
  runId: number;
  reportId: number;
  reportName: string;
  recipientName: string;
  recipientEmail: string;
  recipientRole: string | null;
  status: string;
  periodLabel: string | null;
  runAt: string;
  generatedAt: string | null;
  deliveredAt: string | null;
  triggerKind: string;
  authorized: number;
  restricted: number;
}

export function listRecentDeliveries(limit = 30): DeliveryListItem[] {
  return (
    getAppDb()
      .prepare(
        `SELECT d.id, d.run_id, d.report_id, r.name AS report_name,
                d.recipient_name, d.recipient_email, d.recipient_role, d.status,
                run.period_label, run.run_at, run.trigger_kind,
                d.generated_at, d.delivered_at,
                d.sections_authorized, d.sections_restricted
         FROM report_deliveries d
         JOIN report_runs run ON run.id = d.run_id
         JOIN report_definitions r ON r.id = d.report_id
         ORDER BY d.id DESC LIMIT ?`,
      )
      .all(limit) as {
      id: number;
      run_id: number;
      report_id: number;
      report_name: string;
      recipient_name: string;
      recipient_email: string;
      recipient_role: string | null;
      status: string;
      period_label: string | null;
      run_at: string;
      trigger_kind: string;
      generated_at: string | null;
      delivered_at: string | null;
      sections_authorized: number;
      sections_restricted: number;
    }[]
  ).map((row) => ({
    id: row.id,
    runId: row.run_id,
    reportId: row.report_id,
    reportName: row.report_name,
    recipientName: row.recipient_name,
    recipientEmail: row.recipient_email,
    recipientRole: row.recipient_role,
    status: row.status,
    periodLabel: row.period_label,
    runAt: row.run_at,
    generatedAt: row.generated_at,
    deliveredAt: row.delivered_at,
    triggerKind: row.trigger_kind,
    authorized: row.sections_authorized,
    restricted: row.sections_restricted,
  }));
}

export function listDeliveriesForReport(reportId: number, limit = 40): DeliveryListItem[] {
  return listRecentDeliveries(200).filter((d) => d.reportId === reportId).slice(0, limit);
}

export function listDeliveriesForViewer(user: AuthUser, limit = 8): DeliveryListItem[] {
  return (
    getAppDb()
      .prepare(
        `SELECT d.id, d.run_id, d.report_id, r.name AS report_name,
                d.recipient_name, d.recipient_email, d.recipient_role, d.status,
                run.period_label, run.run_at, run.trigger_kind,
                d.generated_at, d.delivered_at,
                d.sections_authorized, d.sections_restricted
         FROM report_deliveries d
         JOIN report_runs run ON run.id = d.run_id
         JOIN report_definitions r ON r.id = d.report_id
         WHERE d.recipient_user_id = ?
         ORDER BY d.id DESC LIMIT ?`,
      )
      .all(user.id, limit) as {
      id: number;
      run_id: number;
      report_id: number;
      report_name: string;
      recipient_name: string;
      recipient_email: string;
      recipient_role: string | null;
      status: string;
      period_label: string | null;
      run_at: string;
      trigger_kind: string;
      generated_at: string | null;
      delivered_at: string | null;
      sections_authorized: number;
      sections_restricted: number;
    }[]
  ).map((row) => ({
    id: row.id,
    runId: row.run_id,
    reportId: row.report_id,
    reportName: row.report_name,
    recipientName: row.recipient_name,
    recipientEmail: row.recipient_email,
    recipientRole: row.recipient_role,
    status: row.status,
    periodLabel: row.period_label,
    runAt: row.run_at,
    generatedAt: row.generated_at,
    deliveredAt: row.delivered_at,
    triggerKind: row.trigger_kind,
    authorized: row.sections_authorized,
    restricted: row.sections_restricted,
  }));
}

export function findReportByTemplate(templateKey: string): ReportRecord | null {
  const row = getAppDb()
    .prepare(`${SELECT_DEF} WHERE d.template_key = ? ORDER BY d.id LIMIT 1`)
    .get(templateKey) as unknown as DefRow | undefined;
  return row ? toRecord(row) : null;
}

function firstAdminOwnerId(): number | null {
  const row = getAppDb()
    .prepare(
      `SELECT u.id FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.status = 'active' AND r.key IN ('system_administrator', 'dealer_principal')
       ORDER BY r.hierarchy_level DESC, u.id LIMIT 1`,
    )
    .get() as { id: number } | undefined;
  return row?.id ?? null;
}

/** Ensure a catalog template has a persisted definition so deliveries can FK it. */
export function ensureTemplateDefinition(templateKey: string): number | null {
  const existing = findReportByTemplate(templateKey);
  if (existing) return existing.id;
  const t = getTemplate(templateKey);
  if (!t || t.key === "custom") return null;
  const ownerId = firstAdminOwnerId();
  if (!ownerId) return null;
  const audience: AudienceRule[] =
    t.suggestedAudience.length > 0
      ? t.suggestedAudience.map((a) => ({ kind: a.kind, value: a.value }))
      : [{ kind: "user", value: String(ownerId) }];
  const origin = new Date().toISOString().slice(0, 10);
  const next = computeNextRun(
    {
      name: t.label,
      description: t.description,
      templateKey: t.key,
      periodKey: t.periodKey,
      comparisonKey: t.comparisonKey,
      customDays: 14,
      scheduleKind: t.scheduleKind,
      scheduleDays: t.scheduleDays,
      monthlyMode: t.monthlyMode,
      monthlyDay: 1,
      customIntervalDays: 14,
      deliveryTime: t.deliveryTime,
      timezone: "America/Chicago",
      topN: t.topN,
      formatHtml: true,
      formatPdf: true,
      formatLink: true,
      aiNarrative: false,
      status: "active",
      sectionKeys: [...t.sections],
      audience,
    },
    origin,
  );
  const info = getAppDb()
    .prepare(
      `INSERT INTO report_definitions (
         name, description, owner_user_id, template_key, period_key, comparison_key,
         custom_days, schedule_kind, schedule_days, monthly_mode, monthly_day,
         custom_interval_days, delivery_time, timezone, top_n,
         format_html, format_pdf, format_link, ai_narrative, status, next_run_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      t.label,
      t.description,
      ownerId,
      t.key,
      t.periodKey,
      t.comparisonKey,
      14,
      t.scheduleKind,
      JSON.stringify(t.scheduleDays),
      t.monthlyMode,
      1,
      14,
      t.deliveryTime,
      "America/Chicago",
      t.topN,
      1,
      1,
      1,
      0,
      "active",
      next,
    );
  const id = Number(info.lastInsertRowid);
  writeChildren(id, {
    name: t.label,
    description: t.description,
    templateKey: t.key,
    periodKey: t.periodKey,
    comparisonKey: t.comparisonKey,
    customDays: 14,
    scheduleKind: t.scheduleKind,
    scheduleDays: t.scheduleDays,
    monthlyMode: t.monthlyMode,
    monthlyDay: 1,
    customIntervalDays: 14,
    deliveryTime: t.deliveryTime,
    timezone: "America/Chicago",
    topN: t.topN,
    formatHtml: true,
    formatPdf: true,
    formatLink: true,
    aiNarrative: false,
    status: "active",
    sectionKeys: [...t.sections],
    audience,
  });
  return id;
}

export function seedDemoPartsPerformance(owner: AuthUser): number | null {
  const existing = findReportByTemplate("parts_performance");
  if (existing) return existing.id;
  const t = getTemplate("parts_performance");
  if (!t) return null;
  try {
    return createReport(owner, {
      name: "Parts Performance",
      description: "Weekday counter pack for the Parts role.",
      templateKey: "parts_performance",
      periodKey: t.periodKey,
      comparisonKey: t.comparisonKey,
      customDays: 14,
      scheduleKind: t.scheduleKind,
      scheduleDays: t.scheduleDays,
      monthlyMode: t.monthlyMode,
      monthlyDay: 1,
      customIntervalDays: 14,
      deliveryTime: t.deliveryTime,
      timezone: "America/Chicago",
      topN: t.topN,
      formatHtml: true,
      formatPdf: true,
      formatLink: true,
      aiNarrative: false,
      status: "active",
      sectionKeys: [...t.sections],
      audience: [{ kind: "role", value: "parts_manager" }],
    });
  } catch {
    return ensureTemplateDefinition("parts_performance");
  }
}

export function seedDemoShopPulse(owner: AuthUser): number | null {
  const existing = getAppDb()
    .prepare("SELECT id FROM report_definitions WHERE template_key = 'service_daily_shop_pulse' LIMIT 1")
    .get() as { id: number } | undefined;
  if (existing) {
    getAppDb()
      .prepare("UPDATE report_definitions SET ai_narrative = 1 WHERE id = ? AND COALESCE(ai_narrative,0) = 0")
      .run(existing.id);
    return existing.id;
  }
  try {
    return createReport(owner, {
      name: "Daily Shop Pulse",
      description: "Weekday shop briefing for service managers.",
      templateKey: "service_daily_shop_pulse",
      periodKey: "previous_day",
      comparisonKey: "prior_week",
      customDays: 14,
      scheduleKind: "weekdays",
      scheduleDays: [1, 2, 3, 4, 5],
      monthlyMode: "calendar_day",
      monthlyDay: 1,
      customIntervalDays: 14,
      deliveryTime: "06:30",
      timezone: "America/Chicago",
      topN: 10,
      formatHtml: true,
      formatPdf: true,
      formatLink: true,
      aiNarrative: true,
      status: "active",
      sectionKeys: ["service_performance", "needs_attention", "kpi_scorecard", "detail_tables"],
      audience: [{ kind: "role", value: "service_manager" }],
    });
  } catch {
    return null;
  }
}

function seedAccountingTemplate(
  owner: AuthUser,
  templateKey: TemplateKey,
  name: string,
  description: string,
  audience: AudienceRule[],
): number | null {
  const existing = getAppDb()
    .prepare("SELECT id FROM report_definitions WHERE template_key = ? LIMIT 1")
    .get(templateKey) as { id: number } | undefined;
  if (existing) return existing.id;
  const t = getTemplate(templateKey);
  if (!t) return null;
  try {
    return createReport(owner, {
      name,
      description,
      templateKey,
      periodKey: t.periodKey,
      comparisonKey: t.comparisonKey,
      customDays: 14,
      scheduleKind: t.scheduleKind,
      scheduleDays: t.scheduleDays,
      monthlyMode: t.monthlyMode,
      monthlyDay: 1,
      customIntervalDays: 14,
      deliveryTime: t.deliveryTime,
      timezone: "America/Chicago",
      topN: t.topN,
      formatHtml: true,
      formatPdf: true,
      formatLink: true,
      aiNarrative: false,
      status: "active",
      sectionKeys: [...t.sections],
      audience,
    });
  } catch {
    return null;
  }
}

/** Idempotent demo schedules — same engine as all other automated reports. */
export function seedDemoAccountingReports(owner: AuthUser): void {
  seedAccountingTemplate(
    owner,
    "accounting_executive_summary",
    "Executive Financial Summary",
    "Weekly accounting pack for principals. Generated per recipient permissions.",
    [{ kind: "role", value: "dealer_principal" }],
  );
  seedAccountingTemplate(
    owner,
    "accounting_ar_review",
    "Weekly AR Review",
    "Customer-net AR. Invoice aging is not included.",
    [{ kind: "role", value: "general_manager" }],
  );
  seedAccountingTemplate(
    owner,
    "accounting_exception_report",
    "Accounting Exception Report",
    "Weekday live exceptions. Missing-source rules are not sent as zero findings.",
    [{ kind: "role", value: "operations_manager" }],
  );
}
