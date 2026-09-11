/**
 * Report templates and content sections — the client-safe catalog.
 * Resolution (queries + security) lives in resolve.ts and is server-only.
 */

import type { PeriodKey, ComparisonKey } from "@/lib/reports/periods";
import type { ScheduleKind, MonthlyMode } from "@/lib/reports/schedule";

export type SectionKey =
  | "executive_summary"
  | "kpi_scorecard"
  | "revenue_trend"
  | "business_pulse"
  | "customer_opportunities"
  | "parts_performance"
  | "inventory_aging"
  | "service_performance"
  | "needs_attention"
  | "detail_tables"
  | "accounting_snapshot"
  | "accounting_receivable"
  | "accounting_contribution"
  | "accounting_exceptions"
  | "accounting_close"
  | "accounting_health"
  | "accounting_gaps";

export type SectionBand = "performance" | "movement" | "attention" | "detail";

export interface SectionDef {
  key: SectionKey;
  label: string;
  description: string;
  band: SectionBand;
  /** Permission required to compute this section. null = any app user. */
  requiredPermission: string | null;
}

export const SECTIONS: SectionDef[] = [
  {
    key: "executive_summary",
    label: "Executive Summary",
    description: "A short, data-backed briefing of what changed.",
    band: "performance",
    requiredPermission: null,
  },
  {
    key: "kpi_scorecard",
    label: "KPI Scorecard",
    description: "Major authorized measures for the reporting period.",
    band: "performance",
    requiredPermission: null,
  },
  {
    key: "revenue_trend",
    label: "Revenue Trend",
    description: "Posted revenue movement across the period.",
    band: "movement",
    requiredPermission: "feature.view_revenue",
  },
  {
    key: "business_pulse",
    label: "Business Pulse",
    description: "Department contribution — Sales, Parts, Service.",
    band: "movement",
    requiredPermission: "data.cross_department",
  },
  {
    key: "customer_opportunities",
    label: "Customer Opportunities",
    description: "Top customers and recently inactive accounts.",
    band: "attention",
    requiredPermission: "feature.view_revenue",
  },
  {
    key: "parts_performance",
    label: "Parts Performance",
    description: "Parts revenue and margin for the period.",
    band: "performance",
    requiredPermission: "module.parts",
  },
  {
    key: "inventory_aging",
    label: "Inventory Aging",
    description: "In-stock units by age bucket.",
    band: "attention",
    requiredPermission: "module.inventory",
  },
  {
    key: "service_performance",
    label: "Service Performance",
    description: "Open work orders, labor, and shop load.",
    band: "performance",
    requiredPermission: "module.service",
  },
  {
    key: "needs_attention",
    label: "Needs Attention",
    description: "Exceptions that want a decision this cycle.",
    band: "attention",
    requiredPermission: null,
  },
  {
    key: "detail_tables",
    label: "Detail Tables",
    description: "Ranked supporting tables and methodology.",
    band: "detail",
    requiredPermission: null,
  },
  {
    key: "accounting_snapshot",
    label: "Accounting Snapshot",
    description: "Posted revenue, AR, and inventory for the period. Missing books measures are named.",
    band: "performance",
    requiredPermission: "module.accounting",
  },
  {
    key: "accounting_receivable",
    label: "Accounts Receivable",
    description: "Customer-net AR. Invoice aging is not included.",
    band: "performance",
    requiredPermission: "module.accounting",
  },
  {
    key: "accounting_contribution",
    label: "Departmental Contribution",
    description: "Sales / Service / Parts operating contribution — not a books P&L.",
    band: "movement",
    requiredPermission: "module.accounting",
  },
  {
    key: "accounting_exceptions",
    label: "Accounting Exceptions",
    description: "Live exception groups this extract can evaluate.",
    band: "attention",
    requiredPermission: "module.accounting",
  },
  {
    key: "accounting_close",
    label: "Month-End Close Status",
    description: "Source-backed close checks only. Completion % is not computed.",
    band: "attention",
    requiredPermission: "module.accounting",
  },
  {
    key: "accounting_health",
    label: "Accounting Health",
    description: "Partial health score from measurable components only.",
    band: "performance",
    requiredPermission: "module.accounting",
  },
  {
    key: "accounting_gaps",
    label: "Unavailable Accounting Measures",
    description: "Cash, AP, GL, and statements this extract cannot support.",
    band: "detail",
    requiredPermission: "module.accounting",
  },
];

const SECTION_MAP = new Map(SECTIONS.map((s) => [s.key, s]));

export function getSection(key: string): SectionDef | undefined {
  return SECTION_MAP.get(key as SectionKey);
}

export const BAND_COPY: Record<SectionBand, { title: string; question: string }> = {
  performance: { title: "Performance", question: "What is happening?" },
  movement: { title: "Movement", question: "What changed?" },
  attention: { title: "Attention", question: "What needs action?" },
  detail: { title: "Detail", question: "What supports the finding?" },
};

export type TemplateKey =
  | "executive_daily_brief"
  | "weekly_executive_performance"
  | "sales_performance"
  | "customer_opportunity"
  | "parts_performance"
  | "inventory_health"
  | "service_daily_shop_pulse"
  | "weekly_service_performance"
  | "payments_receivables"
  | "accounting_executive_summary"
  | "accounting_ar_review"
  | "accounting_exception_report"
  | "accounting_close_status"
  | "accounting_departmental"
  | "accounting_cash_position"
  | "accounting_ap_review"
  | "accounting_balance_sheet"
  | "custom";

export interface TemplateDef {
  key: TemplateKey;
  label: string;
  description: string;
  periodKey: PeriodKey;
  comparisonKey: ComparisonKey;
  scheduleKind: ScheduleKind;
  scheduleDays: number[];
  monthlyMode: MonthlyMode;
  deliveryTime: string;
  topN: 5 | 10 | 20;
  sections: SectionKey[];
  suggestedAudience: { kind: "role" | "department"; value: string; label: string }[];
}

export const TEMPLATES: TemplateDef[] = [
  {
    key: "executive_daily_brief",
    label: "Executive Daily Brief",
    description: "Yesterday’s dealership pulse for principals and GMs.",
    periodKey: "previous_day",
    comparisonKey: "prior_week",
    scheduleKind: "weekdays",
    scheduleDays: [1, 2, 3, 4, 5],
    monthlyMode: "calendar_day",
    deliveryTime: "07:00",
    topN: 5,
    sections: [
      "executive_summary",
      "kpi_scorecard",
      "revenue_trend",
      "needs_attention",
    ],
    suggestedAudience: [{ kind: "role", value: "dealer_principal", label: "Dealer Principal" }],
  },
  {
    key: "weekly_executive_performance",
    label: "Weekly Executive Performance",
    description: "A Monday leadership pack covering the prior week.",
    periodKey: "previous_week",
    comparisonKey: "prior_week",
    scheduleKind: "weekly",
    scheduleDays: [1],
    monthlyMode: "calendar_day",
    deliveryTime: "07:00",
    topN: 10,
    sections: [
      "executive_summary",
      "kpi_scorecard",
      "revenue_trend",
      "business_pulse",
      "customer_opportunities",
      "needs_attention",
      "detail_tables",
    ],
    suggestedAudience: [{ kind: "role", value: "general_manager", label: "General Manager" }],
  },
  {
    key: "sales_performance",
    label: "Sales Performance",
    description: "Unit and rental activity for the sales desk.",
    periodKey: "month_to_date",
    comparisonKey: "prior_month",
    scheduleKind: "weekly",
    scheduleDays: [1],
    monthlyMode: "calendar_day",
    deliveryTime: "07:00",
    topN: 10,
    sections: [
      "kpi_scorecard",
      "revenue_trend",
      "customer_opportunities",
      "detail_tables",
    ],
    suggestedAudience: [{ kind: "department", value: "Sales", label: "Sales" }],
  },
  {
    key: "customer_opportunity",
    label: "Customer Opportunity Report",
    description: "Who is growing, and who has gone quiet.",
    periodKey: "last_30_days",
    comparisonKey: "prior_month",
    scheduleKind: "weekly",
    scheduleDays: [2],
    monthlyMode: "calendar_day",
    deliveryTime: "07:30",
    topN: 20,
    sections: ["customer_opportunities", "kpi_scorecard", "needs_attention", "detail_tables"],
    suggestedAudience: [{ kind: "role", value: "sales_manager", label: "Sales Manager" }],
  },
  {
    key: "parts_performance",
    label: "Parts Performance",
    description: "Counter revenue, margin, and movers.",
    periodKey: "week_to_date",
    comparisonKey: "prior_week",
    scheduleKind: "weekdays",
    scheduleDays: [1, 2, 3, 4, 5],
    monthlyMode: "calendar_day",
    deliveryTime: "06:45",
    topN: 10,
    sections: ["parts_performance", "kpi_scorecard", "needs_attention", "detail_tables"],
    suggestedAudience: [{ kind: "department", value: "Parts", label: "Parts" }],
  },
  {
    key: "inventory_health",
    label: "Inventory Health",
    description: "In-stock aging and value at risk.",
    periodKey: "month_to_date",
    comparisonKey: "prior_month",
    scheduleKind: "weekly",
    scheduleDays: [3],
    monthlyMode: "calendar_day",
    deliveryTime: "07:00",
    topN: 10,
    sections: ["inventory_aging", "kpi_scorecard", "needs_attention", "detail_tables"],
    suggestedAudience: [{ kind: "role", value: "operations_manager", label: "Operations Manager" }],
  },
  {
    key: "service_daily_shop_pulse",
    label: "Service Daily Shop Pulse",
    description: "Open work, aging, and technician load for the shop floor.",
    periodKey: "previous_day",
    comparisonKey: "prior_week",
    scheduleKind: "weekdays",
    scheduleDays: [1, 2, 3, 4, 5],
    monthlyMode: "calendar_day",
    deliveryTime: "06:30",
    topN: 10,
    sections: [
      "service_performance",
      "needs_attention",
      "kpi_scorecard",
      "detail_tables",
    ],
    suggestedAudience: [{ kind: "role", value: "service_manager", label: "Service Manager" }],
  },
  {
    key: "weekly_service_performance",
    label: "Weekly Service Performance",
    description: "A weekly shop review: labor, aging, and exceptions.",
    periodKey: "previous_week",
    comparisonKey: "prior_week",
    scheduleKind: "weekly",
    scheduleDays: [1],
    monthlyMode: "calendar_day",
    deliveryTime: "06:30",
    topN: 10,
    sections: [
      "executive_summary",
      "service_performance",
      "needs_attention",
      "detail_tables",
    ],
    suggestedAudience: [{ kind: "department", value: "Service", label: "Service" }],
  },
  {
    key: "payments_receivables",
    label: "Payments / Receivables",
    description: "Receipts in the period for finance and ownership.",
    periodKey: "week_to_date",
    comparisonKey: "prior_week",
    scheduleKind: "weekdays",
    scheduleDays: [1, 2, 3, 4, 5],
    monthlyMode: "calendar_day",
    deliveryTime: "07:15",
    topN: 10,
    sections: ["kpi_scorecard", "needs_attention", "detail_tables"],
    suggestedAudience: [{ kind: "role", value: "general_manager", label: "General Manager" }],
  },
  {
    key: "accounting_executive_summary",
    label: "Executive Financial Summary",
    description: "Weekly accounting pack: posted results, contribution, exceptions, and a partial health score.",
    periodKey: "previous_week",
    comparisonKey: "prior_week",
    scheduleKind: "weekly",
    scheduleDays: [1],
    monthlyMode: "calendar_day",
    deliveryTime: "08:00",
    topN: 10,
    sections: [
      "accounting_snapshot",
      "accounting_contribution",
      "accounting_exceptions",
      "accounting_health",
      "accounting_gaps",
    ],
    suggestedAudience: [{ kind: "role", value: "dealer_principal", label: "Dealer Principal" }],
  },
  {
    key: "accounting_ar_review",
    label: "Weekly AR Review",
    description: "Customer-net receivables and AR exceptions. Not invoice aging — payments often hit a different document.",
    periodKey: "week_to_date",
    comparisonKey: "prior_week",
    scheduleKind: "weekly",
    scheduleDays: [1],
    monthlyMode: "calendar_day",
    deliveryTime: "08:00",
    topN: 10,
    sections: ["accounting_receivable", "accounting_exceptions"],
    suggestedAudience: [{ kind: "role", value: "general_manager", label: "General Manager" }],
  },
  {
    key: "accounting_exception_report",
    label: "Accounting Exception Report",
    description: "Weekday digest of live accounting exceptions. Rules without a source are omitted, not zeroed.",
    periodKey: "previous_day",
    comparisonKey: "prior_week",
    scheduleKind: "weekdays",
    scheduleDays: [1, 2, 3, 4, 5],
    monthlyMode: "calendar_day",
    deliveryTime: "07:00",
    topN: 10,
    sections: ["accounting_exceptions", "accounting_gaps"],
    suggestedAudience: [{ kind: "role", value: "operations_manager", label: "Operations Manager" }],
  },
  {
    key: "accounting_close_status",
    label: "Month-End Close Status",
    description: "First-business-day close map. Completion % and target date stay unavailable.",
    periodKey: "month_to_date",
    comparisonKey: "prior_month",
    scheduleKind: "monthly",
    scheduleDays: [],
    monthlyMode: "first_business",
    deliveryTime: "07:00",
    topN: 10,
    sections: ["accounting_close", "accounting_exceptions"],
    suggestedAudience: [{ kind: "role", value: "general_manager", label: "General Manager" }],
  },
  {
    key: "accounting_departmental",
    label: "Departmental Operating Contribution",
    description: "Monthly Sales / Service / Parts contribution. Not a books P&L.",
    periodKey: "previous_month",
    comparisonKey: "prior_year",
    scheduleKind: "monthly",
    scheduleDays: [],
    monthlyMode: "first_business",
    deliveryTime: "08:00",
    topN: 10,
    sections: ["accounting_contribution", "accounting_snapshot"],
    suggestedAudience: [{ kind: "role", value: "general_manager", label: "General Manager" }],
  },
  {
    key: "accounting_cash_position",
    label: "Daily Cash Position",
    description: "Reserved weekday send. No bank tables in this extract — the pack states Data Unavailable, not a zero cash balance.",
    periodKey: "previous_day",
    comparisonKey: "prior_week",
    scheduleKind: "weekdays",
    scheduleDays: [1, 2, 3, 4, 5],
    monthlyMode: "calendar_day",
    deliveryTime: "07:00",
    topN: 5,
    sections: ["accounting_gaps"],
    suggestedAudience: [{ kind: "role", value: "dealer_principal", label: "Dealer Principal" }],
  },
  {
    key: "accounting_ap_review",
    label: "Weekly AP Review",
    description: "Reserved. No vendor AP ledger — the pack states Data Unavailable, not a zero payable total.",
    periodKey: "week_to_date",
    comparisonKey: "prior_week",
    scheduleKind: "weekly",
    scheduleDays: [1],
    monthlyMode: "calendar_day",
    deliveryTime: "08:00",
    topN: 5,
    sections: ["accounting_gaps"],
    suggestedAudience: [{ kind: "role", value: "general_manager", label: "General Manager" }],
  },
  {
    key: "accounting_balance_sheet",
    label: "Balance Sheet",
    description: "Reserved. No chart of accounts — the pack states Data Unavailable.",
    periodKey: "month_to_date",
    comparisonKey: "prior_month",
    scheduleKind: "monthly",
    scheduleDays: [],
    monthlyMode: "first_business",
    deliveryTime: "08:00",
    topN: 5,
    sections: ["accounting_gaps"],
    suggestedAudience: [{ kind: "role", value: "dealer_principal", label: "Dealer Principal" }],
  },
  {
    key: "custom",
    label: "Custom Management Report",
    description: "Build your own mix of period, audience, and content.",
    periodKey: "last_7_days",
    comparisonKey: "previous_equivalent",
    scheduleKind: "weekly",
    scheduleDays: [1],
    monthlyMode: "calendar_day",
    deliveryTime: "07:00",
    topN: 10,
    sections: ["executive_summary", "kpi_scorecard", "needs_attention"],
    suggestedAudience: [],
  },
];

export function getTemplate(key: string): TemplateDef | undefined {
  return TEMPLATES.find((t) => t.key === key);
}

export function isAccountingTemplate(key: string): boolean {
  return key.startsWith("accounting_");
}

/** Permissions a viewer must hold to run every section of a template. */
export function templateRequiredPermissions(template: TemplateDef): string[] {
  const seen = new Set<string>();
  for (const key of template.sections) {
    const perm = getSection(key)?.requiredPermission;
    if (perm) seen.add(perm);
  }
  return [...seen];
}

/**
 * Self-serve runner gate. Accounting packs need module.accounting. Custom
 * builds stay in Admin. Remaining templates require every section permission.
 */
export function canRunTemplate(permissions: Set<string>, template: TemplateDef): boolean {
  if (!permissions.has("feature.export")) return false;
  if (template.key === "custom") return false;
  if (isAccountingTemplate(template.key) && !permissions.has("module.accounting")) return false;
  return templateRequiredPermissions(template).every((p) => permissions.has(p));
}

export function runnableTemplates(permissions: Set<string>): TemplateDef[] {
  return TEMPLATES.filter((t) => canRunTemplate(permissions, t));
}
