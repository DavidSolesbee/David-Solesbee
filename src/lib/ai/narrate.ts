import type { Finding } from "@/lib/ai/findings";
import type { ResolvedSection } from "@/lib/reports/resolve";

/**
 * Narrative layer. Interpolates structured findings only — never invents
 * a number, name, or direction that is not already in the findings.
 */

function movement(deltaPct: number | null | undefined): string {
  if (deltaPct === null || deltaPct === undefined) return "no prior-period baseline";
  if (deltaPct === 0) return "unchanged versus the comparison period";
  return `${deltaPct > 0 ? "up" : "down"} ${Math.abs(deltaPct).toFixed(1)}% versus the comparison period`;
}

export function narrateFindings(findings: Finding[]): string {
  if (!findings.length) {
    return "No authorized findings are available for this question in your current scope.";
  }
  const parts: string[] = [];
  for (const f of findings) {
    if (f.id === "rev_30" && f.value) {
      parts.push(`Posted revenue was ${f.value} over the last 30 days, ${movement(f.deltaPct)}.`);
    } else if (f.id === "rev_depts" && f.items?.length) {
      const lead = f.items[0];
      parts.push(
        `The largest departmental contribution was ${lead.label} at ${lead.value}.`,
      );
    } else if (f.id === "grow" && f.items?.length) {
      parts.push(
        `${f.items[0].label} posted the largest increase (${f.items[0].value}). ${f.items.length} customer${f.items.length === 1 ? "" : "s"} are shown from the authorized list.`,
      );
    } else if (f.id === "quiet") {
      const n = f.items?.length ?? 0;
      parts.push(
        n
          ? `${n} previously active customer${n === 1 ? "" : "s"} recorded no purchase in the past 90 days.`
          : "No previously active customers have gone quiet in the past 90 days.",
      );
    } else if (f.id === "parts_rev" && f.value) {
      parts.push(`Posted parts revenue is ${f.value}.`);
    } else if (f.id === "parts_top" && f.items?.[0]) {
      parts.push(`The top-selling part is ${f.items[0].label} at ${f.items[0].value}.`);
    } else if (f.id === "wo_long" && f.items?.[0]) {
      parts.push(`The longest open work order is ${f.items[0].label}, open ${f.items[0].value}.`);
    } else if (f.id === "wo_buckets" && f.items?.length) {
      const stale = f.items.find((i) => i.label === "15+ days");
      if (stale) parts.push(`${stale.value} work orders have been open 15 days or more.`);
    } else if (f.id === "inv_old" && f.items?.length) {
      const n = f.items.reduce((s, i) => s + (Number(i.value.replace(/,/g, "")) || 0), 0);
      parts.push(`${n} in-stock unit${n === 1 ? "" : "s"} are older than 180 days.`);
    } else if (f.id === "tech" && f.items?.[0]) {
      parts.push(`${f.items[0].label} currently holds the largest active workload at ${f.items[0].value}.`);
    } else if (f.id === "ytd" && f.value) {
      parts.push(`Year-to-date posted revenue is ${f.value}, ${movement(f.deltaPct)} against the prior calendar year.`);
    } else if (f.id === "brief_quiet" && f.value) {
      parts.push(`${f.value} previously active customers have recorded no purchase in the past 90 days.`);
    } else if (f.id === "brief_wo" && f.value) {
      parts.push(`Work-order aging includes ${f.value} orders open 15 days or more.`);
    }
  }
  if (!parts.length) {
    return findings
      .filter((f) => f.value)
      .map((f) => `${f.label}: ${f.value}.`)
      .join(" ");
  }
  return parts.join(" ");
}

/** Explain a recipient's authorized report sections. Uses only those values. */
export function narrateReport(sections: ResolvedSection[]): string {
  const authorized = sections.filter((s) => s.authorized);
  if (!authorized.length) {
    return "No authorized measures were included in this copy.";
  }
  const parts: string[] = [];
  const summary = authorized.find((s) => s.key === "executive_summary")?.narrative;
  if (summary) parts.push(summary);
  const kpis = authorized.flatMap((s) => s.kpis ?? []).slice(0, 4);
  if (kpis.length && !summary) {
    parts.push(
      kpis
        .map((k) =>
          k.deltaLabel ? `${k.label} is ${k.value} (${k.deltaLabel})` : `${k.label} is ${k.value}`,
        )
        .join("; ") + ".",
    );
  }
  const alerts = authorized.flatMap((s) => s.alerts ?? []).slice(0, 3);
  for (const a of alerts) {
    if (a.severity !== "info") parts.push(a.text);
  }
  return parts.join(" ") || "Authorized sections are included below; no additional narrative was derived.";
}
