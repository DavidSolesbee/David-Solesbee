import { StatusBadge } from "@/components/ui/StatusBadge";

const MAP: Record<string, { intent: "neutral" | "positive" | "attention" | "critical" | "info"; label: string }> = {
  LOW: { intent: "positive", label: "Low" },
  MEDIUM: { intent: "info", label: "Medium" },
  HIGH: { intent: "attention", label: "High" },
  CRITICAL: { intent: "critical", label: "Critical" },
};

/** Consistent LOW/MEDIUM/HIGH/CRITICAL risk indicator. */
export function RiskBadge({ level }: { level: string | null | undefined }) {
  const m = MAP[(level ?? "LOW").toUpperCase()] ?? MAP.LOW;
  return <StatusBadge intent={m.intent}>{m.label}</StatusBadge>;
}
