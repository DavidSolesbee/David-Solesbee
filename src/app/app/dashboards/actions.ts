"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission, requireActiveUser } from "@/lib/auth/authz";
import { setFlash } from "@/lib/admin/flash";
import { toPerseusError } from "@/lib/errors";
import * as dash from "@/lib/dashboards/service";
import type { Visibility } from "@/lib/dashboards/service";

function parseInput(formData: FormData): dash.DashboardInput {
  const visibility = String(formData.get("visibility") ?? "personal") as Visibility;
  const targetRoleRaw = formData.get("targetRoleId");
  const targetRoleId =
    visibility === "role" && targetRoleRaw ? Number(targetRoleRaw) : null;
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? "") || null,
    visibility,
    targetRoleId,
    widgetKeys: formData.getAll("widget").map((w) => String(w)),
  };
}

export async function createDashboardAction(formData: FormData): Promise<void> {
  let newId: number | null = null;
  try {
    const actor = await requirePermission("feature.manage_dashboards");
    newId = dash.createDashboard(actor, parseInput(formData));
    await setFlash({ kind: "success", message: "Dashboard created." });
  } catch (e) {
    await setFlash({ kind: "error", message: toPerseusError(e).message });
  }
  if (newId) {
    revalidatePath("/app/dashboards");
    redirect(`/app/dashboards/${newId}`);
  }
  redirect("/app/dashboards/new");
}

export async function updateDashboardAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("dashboardId"));
  let ok = false;
  try {
    const actor = await requirePermission("feature.manage_dashboards");
    dash.updateDashboard(actor, id, parseInput(formData));
    ok = true;
    await setFlash({ kind: "success", message: "Dashboard updated." });
  } catch (e) {
    await setFlash({ kind: "error", message: toPerseusError(e).message });
  }
  revalidatePath("/app/dashboards");
  revalidatePath(`/app/dashboards/${id}`);
  redirect(ok ? `/app/dashboards/${id}` : `/app/dashboards/${id}/edit`);
}

export async function deleteDashboardAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("dashboardId"));
  const returnTo = String(formData.get("returnTo") ?? "/app/dashboards");
  try {
    const actor = await requireActiveUser();
    dash.deleteDashboard(actor, id);
    await setFlash({ kind: "success", message: "Dashboard deleted." });
  } catch (e) {
    await setFlash({ kind: "error", message: toPerseusError(e).message });
  }
  revalidatePath("/app/dashboards");
  revalidatePath("/app/admin/dashboards");
  redirect(returnTo);
}
