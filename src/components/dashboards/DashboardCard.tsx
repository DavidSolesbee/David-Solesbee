import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { DashboardListItem } from "@/lib/dashboards/service";

const VIS_LABEL: Record<string, string> = {
  personal: "Personal",
  role: "Role",
  org: "Org-wide",
};

export function DashboardCard({ d }: { d: DashboardListItem }) {
  return (
    <Link href={`/app/dashboards/${d.id}`} className="group block">
      <Card className="h-full p-5 transition-shadow group-hover:shadow-card-hover">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-ink group-hover:text-forest-600">{d.name}</h3>
          <StatusBadge intent={d.visibility === "org" ? "info" : d.visibility === "role" ? "attention" : "neutral"} dot={false}>
            {d.visibility === "role" && d.targetRoleName ? d.targetRoleName : VIS_LABEL[d.visibility]}
          </StatusBadge>
        </div>
        {d.description && <p className="mt-1 text-sm text-ink-soft">{d.description}</p>}
        <div className="mt-4 flex items-center gap-3 text-caption text-ink-faint">
          <span>{d.widgetCount} widget{d.widgetCount === 1 ? "" : "s"}</span>
          <span>·</span>
          <span>{d.isOwner ? "Owned by you" : d.ownerName}</span>
        </div>
      </Card>
    </Link>
  );
}
