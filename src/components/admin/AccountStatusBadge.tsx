import { StatusBadge } from "@/components/ui/StatusBadge";
import type { AccountState } from "@/lib/auth/catalog";

const MAP: Record<
  AccountState,
  { intent: "neutral" | "positive" | "attention" | "critical" | "info"; label: string }
> = {
  active: { intent: "positive", label: "Active" },
  pending: { intent: "attention", label: "Pending" },
  denied: { intent: "critical", label: "Denied" },
  suspended: { intent: "critical", label: "Suspended" },
  revoked: { intent: "critical", label: "Revoked" },
  expired: { intent: "neutral", label: "Expired" },
};

export function AccountStatusBadge({ status }: { status: AccountState }) {
  const { intent, label } = MAP[status] ?? MAP.pending;
  return <StatusBadge intent={intent}>{label}</StatusBadge>;
}
