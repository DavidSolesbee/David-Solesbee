import type { ResolvedSection } from "@/lib/reports/resolve";

export interface DeliverySnapshot {
  reportName: string;
  periodLabel: string;
  comparisonLabel: string;
  recipientName: string;
  recipientEmail: string;
  recipientRole: string | null;
  scopeNote: string;
  test: boolean;
  sections: ResolvedSection[];
  aiNarrative?: string | null;
}
