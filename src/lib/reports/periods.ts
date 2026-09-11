/**
 * Reporting periods and comparisons.
 *
 * Calendar math is date-string based (YYYY-MM-DD) so the same helpers can
 * run in the admin wizard (next-period labels) and on the server (generation).
 * The dealership "as of" date is the typical anchor so reports aren't empty
 * against a historical extract.
 */

export type PeriodKey =
  | "today"
  | "previous_day"
  | "previous_business_day"
  | "last_7_days"
  | "week_to_date"
  | "previous_week"
  | "month_to_date"
  | "previous_month"
  | "last_30_days"
  | "quarter_to_date"
  | "previous_quarter"
  | "rolling_90_days"
  | "year_to_date"
  | "previous_year"
  | "custom";

export type ComparisonKey =
  | "previous_equivalent"
  | "prior_week"
  | "prior_month"
  | "prior_quarter"
  | "prior_year"
  | "same_period_prior_year";

export interface DateRange {
  start: string;
  end: string;
  label: string;
}

export const PERIODS: { key: PeriodKey; label: string; hint: string }[] = [
  { key: "today", label: "Today", hint: "The as-of date only" },
  { key: "previous_day", label: "Previous day", hint: "Yesterday relative to as-of" },
  { key: "previous_business_day", label: "Previous business day", hint: "Skips Saturday and Sunday" },
  { key: "last_7_days", label: "Last 7 days", hint: "Trailing week including as-of" },
  { key: "week_to_date", label: "Week to date", hint: "Monday through as-of" },
  { key: "previous_week", label: "Previous week", hint: "Last complete Monday–Sunday" },
  { key: "month_to_date", label: "Month to date", hint: "First of month through as-of" },
  { key: "previous_month", label: "Previous month", hint: "Full prior calendar month" },
  { key: "last_30_days", label: "Last 30 days", hint: "Trailing 30 days including as-of" },
  { key: "quarter_to_date", label: "Quarter to date", hint: "Current quarter through as-of" },
  { key: "previous_quarter", label: "Previous quarter", hint: "Full prior calendar quarter" },
  { key: "rolling_90_days", label: "Rolling 90 days", hint: "Trailing 90 days including as-of" },
  { key: "year_to_date", label: "Year to date", hint: "January 1 through as-of" },
  { key: "previous_year", label: "Previous year", hint: "Full prior calendar year" },
  { key: "custom", label: "Custom relative period", hint: "Last N days including as-of" },
];

export const COMPARISONS: { key: ComparisonKey; label: string }[] = [
  { key: "previous_equivalent", label: "Previous equivalent period" },
  { key: "prior_week", label: "Prior week" },
  { key: "prior_month", label: "Prior month" },
  { key: "prior_quarter", label: "Prior quarter" },
  { key: "prior_year", label: "Prior year" },
  { key: "same_period_prior_year", label: "Same period prior year" },
];

export function periodLabel(key: PeriodKey): string {
  return PERIODS.find((p) => p.key === key)?.label ?? key;
}

export function comparisonLabel(key: ComparisonKey): string {
  return COMPARISONS.find((c) => c.key === key)?.label ?? key;
}

function parseYmd(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

function startOfWeekMonday(d: Date): Date {
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(d, diff);
}

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

function previousBusinessDay(d: Date): Date {
  let x = addDays(d, -1);
  while (isWeekend(x)) x = addDays(x, -1);
  return x;
}

function quarterStart(d: Date): Date {
  const q = Math.floor(d.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(d.getUTCFullYear(), q, 1));
}

function prettyRange(start: string, end: string): string {
  if (start === end) return start;
  return `${start} → ${end}`;
}

export function resolvePeriod(
  key: PeriodKey,
  asOf: string,
  customDays = 14,
): DateRange {
  const asOfD = parseYmd(asOf);
  const asOfS = fmt(asOfD);
  const n = Math.max(1, Math.min(3650, customDays || 14));

  switch (key) {
    case "today":
      return { start: asOfS, end: asOfS, label: `Today (${asOfS})` };
    case "previous_day": {
      const d = fmt(addDays(asOfD, -1));
      return { start: d, end: d, label: `Previous day (${d})` };
    }
    case "previous_business_day": {
      const d = fmt(previousBusinessDay(asOfD));
      return { start: d, end: d, label: `Previous business day (${d})` };
    }
    case "last_7_days": {
      const start = fmt(addDays(asOfD, -6));
      return { start, end: asOfS, label: `Last 7 days (${prettyRange(start, asOfS)})` };
    }
    case "week_to_date": {
      const start = fmt(startOfWeekMonday(asOfD));
      return { start, end: asOfS, label: `Week to date (${prettyRange(start, asOfS)})` };
    }
    case "previous_week": {
      const thisMon = startOfWeekMonday(asOfD);
      const start = fmt(addDays(thisMon, -7));
      const end = fmt(addDays(thisMon, -1));
      return { start, end, label: `Previous week (${prettyRange(start, end)})` };
    }
    case "month_to_date": {
      const start = fmt(startOfMonth(asOfD));
      return { start, end: asOfS, label: `Month to date (${prettyRange(start, asOfS)})` };
    }
    case "previous_month": {
      const prev = addMonths(startOfMonth(asOfD), -1);
      const start = fmt(prev);
      const end = fmt(endOfMonth(prev));
      return { start, end, label: `Previous month (${prettyRange(start, end)})` };
    }
    case "last_30_days": {
      const start = fmt(addDays(asOfD, -29));
      return { start, end: asOfS, label: `Last 30 days (${prettyRange(start, asOfS)})` };
    }
    case "quarter_to_date": {
      const start = fmt(quarterStart(asOfD));
      return { start, end: asOfS, label: `Quarter to date (${prettyRange(start, asOfS)})` };
    }
    case "previous_quarter": {
      const startD = addMonths(quarterStart(asOfD), -3);
      const endD = addDays(quarterStart(asOfD), -1);
      return {
        start: fmt(startD),
        end: fmt(endD),
        label: `Previous quarter (${prettyRange(fmt(startD), fmt(endD))})`,
      };
    }
    case "rolling_90_days": {
      const start = fmt(addDays(asOfD, -89));
      return { start, end: asOfS, label: `Rolling 90 days (${prettyRange(start, asOfS)})` };
    }
    case "year_to_date": {
      const start = `${asOfD.getUTCFullYear()}-01-01`;
      return { start, end: asOfS, label: `Year to date (${prettyRange(start, asOfS)})` };
    }
    case "previous_year": {
      const y = asOfD.getUTCFullYear() - 1;
      return {
        start: `${y}-01-01`,
        end: `${y}-12-31`,
        label: `Previous year (${y})`,
      };
    }
    case "custom": {
      const start = fmt(addDays(asOfD, -(n - 1)));
      return {
        start,
        end: asOfS,
        label: `Last ${n} days (${prettyRange(start, asOfS)})`,
      };
    }
  }
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Absolute from/to for a one-off run. Caller must already validate bounds. */
export function resolveAbsoluteRange(start: string, end: string): DateRange {
  const s = start.slice(0, 10);
  const e = end.slice(0, 10);
  if (!YMD.test(s) || !YMD.test(e)) {
    throw new Error("Date range must be YYYY-MM-DD.");
  }
  if (s > e) throw new Error("From date must be on or before To date.");
  return { start: s, end: e, label: prettyRange(s, e) };
}

export function isYmd(value: string): boolean {
  return YMD.test(value.slice(0, 10));
}

function inclusiveDays(range: DateRange): number {
  const a = parseYmd(range.start).getTime();
  const b = parseYmd(range.end).getTime();
  return Math.round((b - a) / 86400000) + 1;
}

export function resolveComparison(
  key: ComparisonKey,
  current: DateRange,
): DateRange {
  const start = parseYmd(current.start);
  const end = parseYmd(current.end);
  const days = inclusiveDays(current);

  const shift = (s: Date, e: Date, label: string): DateRange => ({
    start: fmt(s),
    end: fmt(e),
    label,
  });

  switch (key) {
    case "previous_equivalent": {
      const e = addDays(start, -1);
      const s = addDays(e, -(days - 1));
      return shift(s, e, `Previous equivalent (${prettyRange(fmt(s), fmt(e))})`);
    }
    case "prior_week":
      return shift(
        addDays(start, -7),
        addDays(end, -7),
        `Prior week (${prettyRange(fmt(addDays(start, -7)), fmt(addDays(end, -7)))})`,
      );
    case "prior_month":
      return shift(
        addMonths(start, -1),
        addMonths(end, -1),
        `Prior month (${prettyRange(fmt(addMonths(start, -1)), fmt(addMonths(end, -1)))})`,
      );
    case "prior_quarter":
      return shift(
        addMonths(start, -3),
        addMonths(end, -3),
        `Prior quarter (${prettyRange(fmt(addMonths(start, -3)), fmt(addMonths(end, -3)))})`,
      );
    case "prior_year":
    case "same_period_prior_year":
      return shift(
        addMonths(start, -12),
        addMonths(end, -12),
        `Same period prior year (${prettyRange(fmt(addMonths(start, -12)), fmt(addMonths(end, -12)))})`,
      );
  }
}
