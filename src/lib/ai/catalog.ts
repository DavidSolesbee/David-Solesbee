/**
 * Ask Perseus question catalog — client-safe.
 * Resolution (queries + security) lives in findings.ts and is server-only.
 */

export type QuestionKey =
  | "revenue_change"
  | "growing_customers"
  | "inactive_customers"
  | "top_parts"
  | "aging_work_orders"
  | "aged_inventory"
  | "technician_workload"
  | "revenue_vs_year";

export interface QuestionDef {
  key: QuestionKey;
  label: string;
  prompt: string;
  aliases?: string[];
  /** Every listed permission must be present or the question is withheld. */
  requiredPermissions: string[];
  followUps: QuestionKey[];
}

export const QUESTIONS: QuestionDef[] = [
  {
    key: "revenue_change",
    label: "Why did revenue change?",
    prompt: "Why did revenue decline?",
    aliases: ["why did revenue change", "revenue change", "what happened to revenue"],
    requiredPermissions: ["feature.view_revenue"],
    followUps: ["growing_customers", "inactive_customers", "revenue_vs_year"],
  },
  {
    key: "growing_customers",
    label: "Fastest-growing customers",
    prompt: "Who are our fastest-growing customers?",
    aliases: ["growing customers", "which customers are growing"],
    requiredPermissions: ["feature.view_revenue"],
    followUps: ["inactive_customers", "revenue_change"],
  },
  {
    key: "inactive_customers",
    label: "Customers going quiet",
    prompt: "Which customers are becoming inactive?",
    aliases: ["quiet customers", "inactive accounts", "customers going quiet"],
    requiredPermissions: ["feature.view_revenue"],
    followUps: ["growing_customers", "revenue_change"],
  },
  {
    key: "top_parts",
    label: "Top-selling parts",
    prompt: "What are our top-selling parts?",
    aliases: ["top parts", "best selling parts", "parts sales"],
    requiredPermissions: ["module.parts", "feature.view_revenue"],
    followUps: ["revenue_change", "aged_inventory"],
  },
  {
    key: "aging_work_orders",
    label: "Oldest open work orders",
    prompt: "Which work orders have been open longest?",
    aliases: ["aging work orders", "oldest work orders", "open wo"],
    requiredPermissions: ["module.service"],
    followUps: ["technician_workload", "revenue_change"],
  },
  {
    key: "aged_inventory",
    label: "Units older than 180 days",
    prompt: "Which units are older than 180 days?",
    aliases: ["aged inventory", "old units", "units on the lot"],
    requiredPermissions: ["module.inventory"],
    followUps: ["revenue_change", "top_parts"],
  },
  {
    key: "technician_workload",
    label: "Technician workload",
    prompt: "Which technicians have the largest workload?",
    aliases: ["tech workload", "technician hours", "who is busiest in the shop"],
    requiredPermissions: ["module.service", "feature.view_technician_performance"],
    followUps: ["aging_work_orders"],
  },
  {
    key: "revenue_vs_year",
    label: "Compare with last year",
    prompt: "How does this compare with last year?",
    aliases: ["versus last year", "prior year revenue", "year over year"],
    requiredPermissions: ["feature.view_revenue"],
    followUps: ["revenue_change", "growing_customers"],
  },
];

export function getQuestion(key: string): QuestionDef | undefined {
  return QUESTIONS.find((q) => q.key === key);
}

export function canAsk(permissions: Set<string>, q: QuestionDef): boolean {
  return q.requiredPermissions.every((p) => permissions.has(p));
}

const STOP = new Set([
  "the",
  "and",
  "our",
  "are",
  "was",
  "what",
  "which",
  "who",
  "how",
  "did",
  "does",
  "for",
  "with",
  "from",
  "this",
  "that",
  "have",
  "been",
  "than",
  "why",
]);

export function normalizeAsk(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensOf(s: string): string[] {
  return normalizeAsk(s)
    .split(" ")
    .filter((t) => t.length > 2 && !STOP.has(t));
}

/**
 * Resolve a submitted question. Exact catalog key, prompt, or label only —
 * never token-overlap or alias remap. Suggestions are opt-in via the picker.
 */
export function matchQuestion(raw: string, questions: QuestionDef[]): QuestionDef | null {
  const trimmed = raw.trim();
  if (!trimmed || questions.length === 0) return null;
  const byKey = questions.find((q) => q.key === trimmed);
  if (byKey) return byKey;
  const qn = normalizeAsk(trimmed);
  return (
    questions.find((d) => normalizeAsk(d.prompt) === qn || normalizeAsk(d.label) === qn) ?? null
  );
}

export function filterQuestionSuggestions(raw: string, questions: QuestionDef[]): QuestionDef[] {
  const qn = normalizeAsk(raw);
  if (!qn) return questions;
  const scored = questions
    .map((d) => {
      const hay = normalizeAsk([d.label, d.prompt, ...(d.aliases ?? [])].join(" "));
      const hit = hay.includes(qn) || tokensOf(raw).some((t) => hay.includes(t));
      return { d, hit };
    })
    .filter((x) => x.hit);
  return (scored.length ? scored.map((x) => x.d) : questions).slice(0, 8);
}
