import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getActiveContext } from "@/lib/tenant/context";
import {
  canManageDashboards,
  publishableRoles,
  getDashboardForEdit,
  type DashboardForEdit,
} from "@/lib/dashboards/service";
import { WIDGETS } from "@/lib/dashboards/catalog";
import { readFlash } from "@/lib/admin/flash";
import { FlashBanner } from "@/components/admin/FlashBanner";
import { DashboardBuilder } from "@/components/dashboards/DashboardBuilder";
import { updateDashboardAction } from "@/app/app/dashboards/actions";

export const dynamic = "force-dynamic";

export default async function EditDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getActiveContext();
  if (!user || user.status !== "active" || !user.permissions.has("app.access")) redirect("/login");
  if (!canManageDashboards(user)) redirect("/app/dashboards");

  let initial: DashboardForEdit | null = null;
  try {
    initial = getDashboardForEdit(user, Number(id));
  } catch {
    notFound();
  }
  if (!initial) notFound();

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
        <Link href={`/app/dashboards/${id}`} className="text-sm text-ink-soft hover:text-ink">
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Edit dashboard</h1>
      </div>
      {flash && <FlashBanner flash={flash} />}
      <DashboardBuilder
        action={updateDashboardAction}
        widgets={widgets}
        roles={roles}
        initial={{
          dashboardId: initial.id,
          name: initial.name,
          description: initial.description ?? "",
          visibility: initial.visibility,
          targetRoleId: initial.targetRoleId,
          widgetKeys: initial.widgetKeys,
        }}
        submitLabel="Save changes"
      />
    </div>
  );
}
