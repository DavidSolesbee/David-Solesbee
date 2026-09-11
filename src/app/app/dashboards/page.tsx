import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/tenant/context";
import { listVisibleDashboards, canManageDashboards, seedRoleDashboards } from "@/lib/dashboards/service";
import { readFlash } from "@/lib/admin/flash";
import { FlashBanner } from "@/components/admin/FlashBanner";
import { DashboardCard } from "@/components/dashboards/DashboardCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";

export const dynamic = "force-dynamic";

export default async function DashboardsPage() {
  const user = await getActiveContext();
  if (!user || user.status !== "active" || !user.permissions.has("app.access")) redirect("/login");

  seedRoleDashboards(user);
  const dashboards = listVisibleDashboards(user);
  const canManage = canManageDashboards(user);
  const flash = await readFlash();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Dashboards</h1>
          <p className="mt-1 max-w-2xl text-ink-soft">
            Curated views shared with you. Every widget is filtered to what you’re authorized to see.
          </p>
        </div>
        {canManage && (
          <Link href="/app/dashboards/new">
            <Button>New dashboard</Button>
          </Link>
        )}
      </div>

      {flash && <FlashBanner flash={flash} />}

      {dashboards.length === 0 ? (
        <EmptyState
          title="No dashboards yet"
          description={
            canManage
              ? "Create your first dashboard to share a curated set of metrics."
              : "No dashboards have been shared with you yet."
          }
          action={
            canManage ? (
              <Link href="/app/dashboards/new">
                <Button>New dashboard</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dashboards.map((d) => (
            <DashboardCard key={d.id} d={d} />
          ))}
        </div>
      )}
    </div>
  );
}
