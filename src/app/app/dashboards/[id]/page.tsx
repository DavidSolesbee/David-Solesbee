import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getActiveContext } from "@/lib/tenant/context";
import { getDashboardForViewer } from "@/lib/dashboards/service";
import { readFlash } from "@/lib/admin/flash";
import { FlashBanner } from "@/components/admin/FlashBanner";
import { WidgetCard } from "@/components/dashboards/WidgetCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { deleteDashboardAction } from "@/app/app/dashboards/actions";

export const dynamic = "force-dynamic";

const VIS_LABEL: Record<string, string> = { personal: "Personal", role: "Role", org: "Org-wide" };

export default async function DashboardViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getActiveContext();
  if (!user || user.status !== "active" || !user.permissions.has("app.access")) redirect("/login");

  const dashboard = getDashboardForViewer(user, Number(id));
  if (!dashboard) notFound();

  const flash = await readFlash();
  const kpis = dashboard.widgets.filter((w) => w.kind === "kpi");
  const blocks = dashboard.widgets.filter((w) => w.kind !== "kpi");
  const restrictedCount = dashboard.widgets.filter((w) => !w.authorized).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <StatusBadge
              intent={dashboard.visibility === "org" ? "info" : dashboard.visibility === "role" ? "attention" : "neutral"}
              dot={false}
            >
              {dashboard.visibility === "role" && dashboard.targetRoleName
                ? dashboard.targetRoleName
                : VIS_LABEL[dashboard.visibility]}
            </StatusBadge>
            {restrictedCount > 0 && (
              <StatusBadge intent="neutral" dot>
                {restrictedCount} widget{restrictedCount === 1 ? "" : "s"} restricted for you
              </StatusBadge>
            )}
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">{dashboard.name}</h1>
          {dashboard.description && <p className="mt-1 max-w-2xl text-ink-soft">{dashboard.description}</p>}
          <p className="mt-1 text-caption text-ink-faint">
            {dashboard.isOwner ? "Owned by you" : `Shared by ${dashboard.ownerName}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/app/dashboards"
            className="rounded-lg border border-line-strong px-3 py-2 text-sm font-medium text-ink-soft hover:bg-surface-tinted hover:text-ink"
          >
            ← All dashboards
          </Link>
          {dashboard.canEdit && (
            <>
              <Link href={`/app/dashboards/${dashboard.id}/edit`}>
                <Button variant="secondary" size="sm">Edit</Button>
              </Link>
              <form action={deleteDashboardAction}>
                <input type="hidden" name="dashboardId" value={dashboard.id} />
                <input type="hidden" name="returnTo" value="/app/dashboards" />
                <Button variant="danger" size="sm" type="submit">Delete</Button>
              </form>
            </>
          )}
        </div>
      </div>

      {flash && <FlashBanner flash={flash} />}

      {kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map((w) => (
            <WidgetCard key={w.key} widget={w} />
          ))}
        </div>
      )}

      {blocks.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {blocks.map((w) => (
            <WidgetCard key={w.key} widget={w} />
          ))}
        </div>
      )}
    </div>
  );
}
