/** Shared, locale-aware formatters for analytics display. */

export function formatCurrency(n: number, compact = false): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  });
}

export function formatNumber(n: number, compact = false): string {
  return n.toLocaleString("en-US", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  });
}

export function formatHours(n: number): string {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 0 })} hrs`;
}

export function formatMonthLabel(ym: string): string {
  // ym = YYYY-MM
  const [y, m] = ym.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
