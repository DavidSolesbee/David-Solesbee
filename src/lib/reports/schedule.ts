/**
 * Delivery schedule: next occurrence calculation in the admin-chosen timezone.
 */

export type ScheduleKind =
  | "daily"
  | "weekdays"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "custom";

export type MonthlyMode = "calendar_day" | "first_business" | "last_business";

export interface ScheduleSpec {
  kind: ScheduleKind;
  /** 0 = Sunday … 6 = Saturday. Used by weekly / as extra filter. */
  days: number[];
  monthlyMode: MonthlyMode;
  monthlyDay: number;
  customIntervalDays: number;
  time: string;
  timezone: string;
}

export const SCHEDULES: { key: ScheduleKind; label: string; hint: string }[] = [
  { key: "daily", label: "Daily", hint: "Every calendar day" },
  { key: "weekdays", label: "Weekdays", hint: "Monday–Friday" },
  { key: "weekly", label: "Weekly", hint: "Selected days of the week" },
  { key: "biweekly", label: "Biweekly", hint: "Every other week on selected days" },
  { key: "monthly", label: "Monthly", hint: "Calendar or business day" },
  { key: "quarterly", label: "Quarterly", hint: "First month of each quarter" },
  { key: "custom", label: "Custom recurrence", hint: "Every N days" },
];

export const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 0, label: "Sunday", short: "Sun" },
];

export const TIMEZONES: { value: string; label: string }[] = [
  { value: "America/New_York", label: "Eastern — America/New_York" },
  { value: "America/Chicago", label: "Central — America/Chicago" },
  { value: "America/Denver", label: "Mountain — America/Denver" },
  { value: "America/Phoenix", label: "Arizona — America/Phoenix" },
  { value: "America/Los_Angeles", label: "Pacific — America/Los_Angeles" },
  { value: "Pacific/Honolulu", label: "Hawaii — Pacific/Honolulu" },
];

export function scheduleLabel(spec: ScheduleSpec): string {
  const time = spec.time;
  const tz =
    TIMEZONES.find((t) => t.value === spec.timezone)?.label.split(" — ")[0] ??
    spec.timezone;
  const dayNames = (spec.days.length ? spec.days : [1])
    .map((d) => WEEKDAYS.find((w) => w.value === d)?.short ?? String(d))
    .join(", ");
  switch (spec.kind) {
    case "daily":
      return `Daily at ${time} — ${tz}`;
    case "weekdays":
      return `Weekdays at ${time} — ${tz}`;
    case "weekly":
      return `Weekly (${dayNames}) at ${time} — ${tz}`;
    case "biweekly":
      return `Biweekly (${dayNames}) at ${time} — ${tz}`;
    case "monthly":
      if (spec.monthlyMode === "first_business")
        return `Monthly, first business day at ${time} — ${tz}`;
      if (spec.monthlyMode === "last_business")
        return `Monthly, last business day at ${time} — ${tz}`;
      return `Monthly on day ${spec.monthlyDay || 1} at ${time} — ${tz}`;
    case "quarterly":
      return `Quarterly at ${time} — ${tz}`;
    case "custom":
      return `Every ${spec.customIntervalDays || 14} days at ${time} — ${tz}`;
  }
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
  ymd: string;
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const year = Number(map.year);
  const month = Number(map.month);
  const day = Number(map.day);
  return {
    year,
    month,
    day,
    weekday: weekdayMap[map.weekday] ?? 0,
    hour: Number(map.hour),
    minute: Number(map.minute),
    ymd: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

function parseTime(hhmm: string): { hour: number; minute: number } {
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  return {
    hour: Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 6,
    minute: Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 30,
  };
}

function isWeekend(weekday: number): boolean {
  return weekday === 0 || weekday === 6;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function daysInMonthMatch(
  parts: ZonedParts,
  spec: ScheduleSpec,
  kind: "monthly" | "quarterly",
): boolean {
  if (kind === "quarterly" && ![1, 4, 7, 10].includes(parts.month)) return false;
  if (spec.monthlyMode === "first_business") {
    if (isWeekend(parts.weekday)) return false;
    let d = 1;
    while (d <= 7) {
      const wd = new Date(Date.UTC(parts.year, parts.month - 1, d)).getUTCDay();
      if (wd !== 0 && wd !== 6) return parts.day === d;
      d++;
    }
    return false;
  }
  if (spec.monthlyMode === "last_business") {
    if (isWeekend(parts.weekday)) return false;
    let d = lastDayOfMonth(parts.year, parts.month);
    while (d >= 1) {
      const wd = new Date(Date.UTC(parts.year, parts.month - 1, d)).getUTCDay();
      if (wd !== 0 && wd !== 6) return parts.day === d;
      d--;
    }
    return false;
  }
  const target = Math.min(spec.monthlyDay || 1, lastDayOfMonth(parts.year, parts.month));
  return parts.day === target;
}

function matchesDay(spec: ScheduleSpec, parts: ZonedParts, originYmd: string): boolean {
  switch (spec.kind) {
    case "daily":
      return true;
    case "weekdays":
      return !isWeekend(parts.weekday);
    case "weekly":
      return (spec.days.length ? spec.days : [1]).includes(parts.weekday);
    case "biweekly": {
      if (!(spec.days.length ? spec.days : [1]).includes(parts.weekday)) return false;
      const origin = Date.parse(`${originYmd}T00:00:00Z`);
      const here = Date.parse(`${parts.ymd}T00:00:00Z`);
      const weeks = Math.floor((here - origin) / (7 * 86400000));
      return weeks % 2 === 0 && here >= origin;
    }
    case "monthly":
      return daysInMonthMatch(parts, spec, "monthly");
    case "quarterly":
      return daysInMonthMatch(parts, spec, "quarterly");
    case "custom": {
      const interval = Math.max(1, spec.customIntervalDays || 14);
      const origin = Date.parse(`${originYmd}T00:00:00Z`);
      const here = Date.parse(`${parts.ymd}T00:00:00Z`);
      if (here < origin) return false;
      const days = Math.round((here - origin) / 86400000);
      return days % interval === 0;
    }
  }
}

export interface NextDelivery {
  ymd: string;
  time: string;
  timezone: string;
  label: string;
}

/**
 * Next `count` delivery instants after `from`, in the schedule timezone.
 * `originYmd` anchors biweekly / custom recurrence (typically created-at date).
 */
export function nextDeliveries(
  spec: ScheduleSpec,
  count = 3,
  from: Date = new Date(),
  originYmd?: string,
): NextDelivery[] {
  const { hour, minute } = parseTime(spec.time);
  const origin = originYmd ?? zonedParts(from, spec.timezone).ymd;
  const out: NextDelivery[] = [];
  // Walk calendar days in the target zone by advancing 12 hours (safe across DST).
  let cursor = new Date(from.getTime());
  for (let i = 0; i < 800 && out.length < count; i++) {
    const parts = zonedParts(cursor, spec.timezone);
    if (matchesDay(spec, parts, origin)) {
      const alreadyPassed =
        parts.ymd === zonedParts(from, spec.timezone).ymd &&
        (parts.hour > hour || (parts.hour === hour && parts.minute >= minute));
      const isToday = parts.ymd === zonedParts(from, spec.timezone).ymd;
      if (!(isToday && alreadyPassed)) {
        if (!out.some((o) => o.ymd === parts.ymd)) {
          out.push({
            ymd: parts.ymd,
            time: spec.time,
            timezone: spec.timezone,
            label: `${parts.ymd} at ${spec.time} — ${spec.timezone}`,
          });
        }
      }
    }
    cursor = new Date(cursor.getTime() + 12 * 60 * 60 * 1000);
  }
  return out;
}
