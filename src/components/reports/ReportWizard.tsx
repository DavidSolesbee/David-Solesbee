"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Field } from "@/components/ui/Input";
import { TEMPLATES, SECTIONS, type TemplateKey, type SectionKey } from "@/lib/reports/catalog";
import { PERIODS, COMPARISONS, type PeriodKey, type ComparisonKey } from "@/lib/reports/periods";
import {
  SCHEDULES,
  WEEKDAYS,
  TIMEZONES,
  nextDeliveries,
  scheduleLabel,
  type ScheduleKind,
  type MonthlyMode,
} from "@/lib/reports/schedule";
import { cn } from "@/lib/utils/cn";

export interface WizardUser {
  id: number;
  name: string;
  email: string;
  roleKey: string | null;
  roleName: string | null;
  department: string | null;
  locationName: string | null;
  hierarchyLevel: number | null;
}

export interface WizardOptions {
  roles: { key: string; name: string }[];
  departments: string[];
  locations: string[];
  users: WizardUser[];
}

export interface WizardInitial {
  reportId?: number;
  name: string;
  description: string;
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
  status: "draft" | "active" | "paused";
  sectionKeys: SectionKey[];
  audienceRoles: string[];
  audienceDepartments: string[];
  audienceLocations: string[];
  audienceUsers: number[];
}

const STEPS = [
  "Report type",
  "Audience",
  "Period",
  "Schedule",
  "Content",
  "Preview",
  "Activate",
];

function estimateRecipients(opts: WizardOptions, state: WizardInitial, actorLevel: number): WizardUser[] {
  const hasFilter =
    state.audienceRoles.length + state.audienceDepartments.length + state.audienceLocations.length > 0;
  return opts.users.filter((u) => {
    if ((u.hierarchyLevel ?? 0) > actorLevel) return false;
    const userHit = state.audienceUsers.includes(u.id);
    if (!hasFilter) return userHit;
    const roleOk = !state.audienceRoles.length || (u.roleKey !== null && state.audienceRoles.includes(u.roleKey));
    const deptOk =
      !state.audienceDepartments.length ||
      (u.department !== null && state.audienceDepartments.includes(u.department));
    const locOk =
      !state.audienceLocations.length ||
      (u.locationName !== null && state.audienceLocations.includes(u.locationName));
    return (roleOk && deptOk && locOk) || userHit;
  });
}

export function ReportWizard({
  action,
  options,
  initial,
  actorHierarchyLevel,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  options: WizardOptions;
  initial?: Partial<WizardInitial>;
  actorHierarchyLevel: number;
  submitLabel: string;
}) {
  const [step, setStep] = React.useState(0);
  const [state, setState] = React.useState<WizardInitial>({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    templateKey: initial?.templateKey ?? "custom",
    periodKey: initial?.periodKey ?? "last_7_days",
    comparisonKey: initial?.comparisonKey ?? "previous_equivalent",
    customDays: initial?.customDays ?? 14,
    scheduleKind: initial?.scheduleKind ?? "weekdays",
    scheduleDays: initial?.scheduleDays ?? [1, 2, 3, 4, 5],
    monthlyMode: initial?.monthlyMode ?? "calendar_day",
    monthlyDay: initial?.monthlyDay ?? 1,
    customIntervalDays: initial?.customIntervalDays ?? 14,
    deliveryTime: initial?.deliveryTime ?? "06:30",
    timezone: initial?.timezone ?? "America/Chicago",
    topN: initial?.topN ?? 10,
    formatHtml: initial?.formatHtml ?? true,
    formatPdf: initial?.formatPdf ?? true,
    formatLink: initial?.formatLink ?? true,
    aiNarrative: initial?.aiNarrative ?? false,
    status: initial?.status ?? "draft",
    sectionKeys: initial?.sectionKeys ?? ["executive_summary", "kpi_scorecard", "needs_attention"],
    audienceRoles: initial?.audienceRoles ?? [],
    audienceDepartments: initial?.audienceDepartments ?? [],
    audienceLocations: initial?.audienceLocations ?? [],
    audienceUsers: initial?.audienceUsers ?? [],
  });

  function applyTemplate(key: TemplateKey) {
    const t = TEMPLATES.find((x) => x.key === key);
    if (!t) return;
    setState((s) => ({
      ...s,
      templateKey: key,
      name: s.name || t.label,
      description: s.description || t.description,
      periodKey: t.periodKey,
      comparisonKey: t.comparisonKey,
      scheduleKind: t.scheduleKind,
      scheduleDays: t.scheduleDays,
      monthlyMode: t.monthlyMode,
      deliveryTime: t.deliveryTime,
      topN: t.topN,
      sectionKeys: t.sections,
      audienceRoles: t.suggestedAudience.filter((a) => a.kind === "role").map((a) => a.value),
      audienceDepartments: t.suggestedAudience.filter((a) => a.kind === "department").map((a) => a.value),
    }));
  }

  const recipients = estimateRecipients(options, state, actorHierarchyLevel);
  const upcoming = nextDeliveries(
    {
      kind: state.scheduleKind,
      days: state.scheduleDays,
      monthlyMode: state.monthlyMode,
      monthlyDay: state.monthlyDay,
      customIntervalDays: state.customIntervalDays,
      time: state.deliveryTime,
      timezone: state.timezone,
    },
    3,
  );

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
  }

  return (
    <form action={action} className="space-y-6">
      {initial?.reportId && <input type="hidden" name="reportId" value={initial.reportId} />}
      <input type="hidden" name="name" value={state.name} />
      <input type="hidden" name="description" value={state.description} />
      <input type="hidden" name="templateKey" value={state.templateKey} />
      <input type="hidden" name="periodKey" value={state.periodKey} />
      <input type="hidden" name="comparisonKey" value={state.comparisonKey} />
      <input type="hidden" name="customDays" value={state.customDays} />
      <input type="hidden" name="scheduleKind" value={state.scheduleKind} />
      {state.scheduleDays.map((d) => (
        <input key={`sd-${d}`} type="hidden" name="scheduleDay" value={d} />
      ))}
      <input type="hidden" name="monthlyMode" value={state.monthlyMode} />
      <input type="hidden" name="monthlyDay" value={state.monthlyDay} />
      <input type="hidden" name="customIntervalDays" value={state.customIntervalDays} />
      <input type="hidden" name="deliveryTime" value={state.deliveryTime} />
      <input type="hidden" name="timezone" value={state.timezone} />
      <input type="hidden" name="topN" value={state.topN} />
      {state.formatHtml && <input type="hidden" name="formatHtml" value="1" />}
      {state.formatPdf && <input type="hidden" name="formatPdf" value="1" />}
      {state.formatLink && <input type="hidden" name="formatLink" value="1" />}
      {state.aiNarrative && <input type="hidden" name="aiNarrative" value="1" />}
      <input type="hidden" name="status" value={state.status} />
      {state.sectionKeys.map((k) => (
        <input key={k} type="hidden" name="section" value={k} />
      ))}
      {state.audienceRoles.map((k) => (
        <input key={`ar-${k}`} type="hidden" name="audienceRole" value={k} />
      ))}
      {state.audienceDepartments.map((k) => (
        <input key={`ad-${k}`} type="hidden" name="audienceDepartment" value={k} />
      ))}
      {state.audienceLocations.map((k) => (
        <input key={`al-${k}`} type="hidden" name="audienceLocation" value={k} />
      ))}
      {state.audienceUsers.map((k) => (
        <input key={`au-${k}`} type="hidden" name="audienceUser" value={k} />
      ))}

      <ol className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                "rounded-full px-3 py-1 text-caption font-medium transition-colors",
                i === step
                  ? "bg-forest-500 text-white"
                  : i < step
                    ? "bg-sage-50 text-sage-700"
                    : "bg-surface-tinted text-ink-faint",
              )}
            >
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="space-y-4">
          <Field label="Report name" htmlFor="name-vis">
            <Input
              id="name-vis"
              value={state.name}
              onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
              placeholder="Daily Shop Pulse"
            />
          </Field>
          <Field label="Description" htmlFor="desc-vis">
            <Input
              id="desc-vis"
              value={state.description}
              onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))}
              placeholder="Optional context for the audit trail"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => applyTemplate(t.key)}
                className={cn(
                  "rounded-xl border p-4 text-left transition-shadow",
                  state.templateKey === t.key
                    ? "border-forest-500 bg-sage-50 shadow-subtle"
                    : "border-line bg-surface hover:shadow-card-hover",
                )}
              >
                <div className="font-semibold text-ink">{t.label}</div>
                <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="space-y-3">
              <h3 className="font-semibold text-ink">Role</h3>
              {options.roles.map((r) => (
                <label key={r.key} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={state.audienceRoles.includes(r.key)}
                    onChange={() =>
                      setState((s) => ({ ...s, audienceRoles: toggle(s.audienceRoles, r.key) }))
                    }
                  />
                  {r.name}
                </label>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3">
              <h3 className="font-semibold text-ink">Department</h3>
              {options.departments.map((d) => (
                <label key={d} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={state.audienceDepartments.includes(d)}
                    onChange={() =>
                      setState((s) => ({
                        ...s,
                        audienceDepartments: toggle(s.audienceDepartments, d),
                      }))
                    }
                  />
                  {d}
                </label>
              ))}
              <h3 className="pt-2 font-semibold text-ink">Location</h3>
              {options.locations.map((d) => (
                <label key={d} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={state.audienceLocations.includes(d)}
                    onChange={() =>
                      setState((s) => ({
                        ...s,
                        audienceLocations: toggle(s.audienceLocations, d),
                      }))
                    }
                  />
                  {d}
                </label>
              ))}
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardContent className="space-y-3">
              <h3 className="font-semibold text-ink">Individual users</h3>
              <p className="text-sm text-ink-soft">
                Combined rules intersect (e.g. Service Managers at Main Location). Named users are
                always included. Only approved application users — login email is the delivery address.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {options.users
                  .filter((u) => (u.hierarchyLevel ?? 0) <= actorHierarchyLevel)
                  .slice(0, 40)
                  .map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={state.audienceUsers.includes(u.id)}
                        onChange={() =>
                          setState((s) => ({ ...s, audienceUsers: toggle(s.audienceUsers, u.id) }))
                        }
                      />
                      <span>
                        {u.name}
                        <span className="text-ink-faint"> · {u.email}</span>
                      </span>
                    </label>
                  ))}
              </div>
            </CardContent>
          </Card>
          <p className="text-sm font-medium text-forest-700 lg:col-span-2">
            Expected recipients: {recipients.length} active account
            {recipients.length === 1 ? "" : "s"}
          </p>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reporting period">
            <Select
              value={state.periodKey}
              onChange={(e) => setState((s) => ({ ...s, periodKey: e.target.value as PeriodKey }))}
            >
              {PERIODS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Comparison">
            <Select
              value={state.comparisonKey}
              onChange={(e) =>
                setState((s) => ({ ...s, comparisonKey: e.target.value as ComparisonKey }))
              }
            >
              {COMPARISONS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          {state.periodKey === "custom" && (
            <Field label="Custom relative days" hint="Last N days including the as-of date">
              <Input
                type="number"
                min={1}
                max={365}
                value={state.customDays}
                onChange={(e) =>
                  setState((s) => ({ ...s, customDays: Number(e.target.value) || 14 }))
                }
              />
            </Field>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Recurrence">
              <Select
                value={state.scheduleKind}
                onChange={(e) =>
                  setState((s) => ({ ...s, scheduleKind: e.target.value as ScheduleKind }))
                }
              >
                {SCHEDULES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Delivery time">
              <Input
                type="time"
                value={state.deliveryTime}
                onChange={(e) => setState((s) => ({ ...s, deliveryTime: e.target.value }))}
              />
            </Field>
            <Field label="Time zone">
              <Select
                value={state.timezone}
                onChange={(e) => setState((s) => ({ ...s, timezone: e.target.value }))}
              >
                {TIMEZONES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            {(state.scheduleKind === "weekly" || state.scheduleKind === "biweekly") && (
              <div className="sm:col-span-2">
                <p className="mb-2 text-sm font-medium text-ink-soft">Days</p>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() =>
                        setState((s) => ({ ...s, scheduleDays: toggle(s.scheduleDays, d.value) }))
                      }
                      className={cn(
                        "rounded-full px-3 py-1 text-sm",
                        state.scheduleDays.includes(d.value)
                          ? "bg-forest-500 text-white"
                          : "bg-surface-tinted text-ink-soft",
                      )}
                    >
                      {d.short}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {(state.scheduleKind === "monthly" || state.scheduleKind === "quarterly") && (
              <>
                <Field label="Monthly mode">
                  <Select
                    value={state.monthlyMode}
                    onChange={(e) =>
                      setState((s) => ({ ...s, monthlyMode: e.target.value as MonthlyMode }))
                    }
                  >
                    <option value="calendar_day">Calendar day</option>
                    <option value="first_business">First business day</option>
                    <option value="last_business">Last business day</option>
                  </Select>
                </Field>
                {state.monthlyMode === "calendar_day" && (
                  <Field label="Day of month">
                    <Input
                      type="number"
                      min={1}
                      max={28}
                      value={state.monthlyDay}
                      onChange={(e) =>
                        setState((s) => ({ ...s, monthlyDay: Number(e.target.value) || 1 }))
                      }
                    />
                  </Field>
                )}
              </>
            )}
            {state.scheduleKind === "custom" && (
              <Field label="Every N days">
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={state.customIntervalDays}
                  onChange={(e) =>
                    setState((s) => ({ ...s, customIntervalDays: Number(e.target.value) || 14 }))
                  }
                />
              </Field>
            )}
          </div>
          <p className="text-sm text-ink-soft">{scheduleLabel({
            kind: state.scheduleKind,
            days: state.scheduleDays,
            monthlyMode: state.monthlyMode,
            monthlyDay: state.monthlyDay,
            customIntervalDays: state.customIntervalDays,
            time: state.deliveryTime,
            timezone: state.timezone,
          })}</p>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <Field label="Top N for ranked lists">
            <Select
              value={String(state.topN)}
              onChange={(e) =>
                setState((s) => ({ ...s, topN: Number(e.target.value) as 5 | 10 | 20 }))
              }
            >
              <option value="5">Top 5</option>
              <option value="10">Top 10</option>
              <option value="20">Top 20</option>
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            {SECTIONS.map((sec) => (
              <label
                key={sec.key}
                className={cn(
                  "rounded-xl border p-4 text-sm",
                  state.sectionKeys.includes(sec.key)
                    ? "border-forest-500 bg-sage-50"
                    : "border-line bg-surface",
                )}
              >
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={state.sectionKeys.includes(sec.key)}
                  onChange={() =>
                    setState((s) => ({ ...s, sectionKeys: toggle(s.sectionKeys, sec.key) }))
                  }
                />
                <span className="font-medium text-ink">{sec.label}</span>
                <p className="mt-1 text-ink-soft">{sec.description}</p>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-ink-soft">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={state.formatHtml}
                onChange={() => setState((s) => ({ ...s, formatHtml: !s.formatHtml }))}
              />
              HTML email
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={state.formatPdf}
                onChange={() => setState((s) => ({ ...s, formatPdf: !s.formatPdf }))}
              />
              PDF / print
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={state.formatLink}
                onChange={() => setState((s) => ({ ...s, formatLink: !s.formatLink }))}
              />
              Secure “View in Perseus” link
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={state.aiNarrative}
                onChange={() => setState((s) => ({ ...s, aiNarrative: !s.aiNarrative }))}
              />
              AI Executive Summary (explains authorized findings only)
            </label>
          </div>
        </div>
      )}

      {step === 5 && (
        <Card>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-caption font-semibold uppercase tracking-[0.16em] text-amber-700">
              Preview — not sent
            </div>
            <h3 className="text-lg font-semibold text-ink">{state.name || "Untitled report"}</h3>
            <p className="text-sm text-ink-soft">{state.description}</p>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-faint">Audience</dt>
                <dd className="text-ink">{recipients.length} recipients</dd>
              </div>
              <div>
                <dt className="text-ink-faint">Period</dt>
                <dd className="text-ink">{PERIODS.find((p) => p.key === state.periodKey)?.label}</dd>
              </div>
              <div>
                <dt className="text-ink-faint">Schedule</dt>
                <dd className="text-ink">
                  {scheduleLabel({
                    kind: state.scheduleKind,
                    days: state.scheduleDays,
                    monthlyMode: state.monthlyMode,
                    monthlyDay: state.monthlyDay,
                    customIntervalDays: state.customIntervalDays,
                    time: state.deliveryTime,
                    timezone: state.timezone,
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-ink-faint">Content</dt>
                <dd className="text-ink">
                  {state.sectionKeys.map((k) => SECTIONS.find((s) => s.key === k)?.label).join(", ")}
                </dd>
              </div>
            </dl>
            <div>
              <p className="text-caption font-medium uppercase tracking-wide text-ink-faint">
                Next three deliveries
              </p>
              <ul className="mt-1 text-sm text-ink">
                {upcoming.map((u) => (
                  <li key={u.label}>{u.label}</li>
                ))}
              </ul>
            </div>
            <p className="text-sm text-ink-soft">
              After you save, open the report to preview as a user or role. Each recipient’s copy is
              generated from their current permissions — never from yours.
            </p>
          </CardContent>
        </Card>
      )}

      {step === 6 && (
        <Card>
          <CardContent className="space-y-4">
            <p className="text-sm text-ink-soft">
              Activate to place this report on the schedule, or save as a draft. Generation always
              re-checks each recipient at send time.
            </p>
            <div className="flex flex-wrap gap-2">
              {(["draft", "active", "paused"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setState((s) => ({ ...s, status: st }))}
                  className={cn(
                    "rounded-full px-3 py-1 text-sm capitalize",
                    state.status === st ? "bg-forest-500 text-white" : "bg-surface-tinted text-ink-soft",
                  )}
                >
                  {st}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="secondary"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Back
        </Button>
        <div className="flex gap-2">
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              Continue
            </Button>
          ) : (
            <Button type="submit">{submitLabel}</Button>
          )}
        </div>
      </div>
    </form>
  );
}
