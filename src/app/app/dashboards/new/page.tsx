import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/tenant/context";
import { canManageDashboards, publishableRoles } from "@/lib/dashboards/service";
import { WIDGETS } from "@/lib/dashboards/catalog";
import { readFlash } from "@/lib/admin/flash";
import { FlashBanner } from "@/components/admin/FlashBanner";
import { DashboardBuilder } from "@/components/dashboards/DashboardBuilder";
import { createDashboardAction } from "@/app/app/dashboards/actions";

export const dynamic = "force-dynamic";

export default async function NewDashboardPage() {
  const user = await getActiveContext();
  if (!user || user.status !== "active" || !user.permissions.has("app.access")) redirect("/login");
  if (!canManageDashboards(user)) redirect("/app/dashboards");

  const widgets = WIDGETS.map((w) => ({
    key: w.key,
    label: w.label,
    description: w.description,
    category: w.category,
  }));
  const roles = publishableRoles(user).map((r) => ({ id: r.id, name: r.name }));
  const flash = await readFlash();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/app/dashboards" className="text-sm text-ink-soft hover:text-ink">
          ← Dashboards
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">New dashboard</h1>
      </div>
      {flash && <FlashBanner flash={flash} />}
      <DashboardBuilder
        action={createDashboardAction}
        widgets={widgets}
        roles={roles}
        submitLabel="Create dashboard"
      />
    </div>
  );
}
