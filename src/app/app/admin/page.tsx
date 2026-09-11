import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/tenant/context";
import {
  getUserCounts,
  countPendingRequests,
  listAudit,
} from "@/lib/admin/service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AccountStatusBadge } from "@/components/admin/AccountStatusBadge";
import { ACCOUNT_STATES } from "@/lib/auth/catalog";

export const dynamic = "force-dynamic";

function timeAgo(iso: string): string {
  const then = new Date(iso.replace(" ", "T") + (iso.includes("Z") ? "" : "Z")).getTime();
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function AdminOverview() {
  const actor = await getActiveContext();
  if (!actor) redirect("/login");
  const counts = getUserCounts(actor);
  const pending = countPendingRequests(actor);
  const recent = listAudit(actor, 8);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="text-caption uppercase tracking-wide text-ink-faint">
            Total users
          </div>
          <div className="mt-1 text-3xl font-semibold text-ink">
            {counts.total}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-caption uppercase tracking-wide text-ink-faint">
            Active
          </div>
          <div className="mt-1 text-3xl font-semibold text-forest-600">
            {counts.byStatus.active ?? 0}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-caption uppercase tracking-wide text-ink-faint">
            Suspended / Revoked
          </div>
          <div className="mt-1 text-3xl font-semibold text-ink">
            {(counts.byStatus.suspended ?? 0) + (counts.byStatus.revoked ?? 0)}
          </div>
        </Card>
        <Link href="/app/admin/requests">
          <Card className="p-5 transition-shadow hover:shadow-card-hover">
            <div className="text-caption uppercase tracking-wide text-ink-faint">
              Pending requests
            </div>
            <div className="mt-1 flex items-center gap-2 text-3xl font-semibold text-amber-600">
              {pending}
              {pending > 0 && (
                <StatusBadge intent="attention" dot={false}>
                  Review
                </StatusBadge>
              )}
            </div>
          </Card>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Users by status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 pt-2">
            {ACCOUNT_STATES.map((s) => (
              <Link key={s} href={`/app/admin/users?status=${s}`}>
                <span className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm transition-colors hover:bg-surface-tinted">
                  <AccountStatusBadge status={s} />
                  <span className="font-semibold text-ink">
                    {counts.byStatus[s] ?? 0}
                  </span>
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            {recent.length === 0 ? (
              <p className="text-sm text-ink-soft">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {recent.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <span className="font-mono text-ink">{a.action}</span>
                    <span className="text-caption text-ink-faint">
                      {timeAgo(a.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/app/admin/audit"
              className="mt-3 inline-block text-sm font-medium text-forest-600 hover:text-forest-700"
            >
              View full audit log →
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
