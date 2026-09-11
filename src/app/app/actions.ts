"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/authz";
import { logout } from "@/lib/auth/service";
import {
  enterViewAs,
  exitViewAs,
  switchActiveOrganization,
} from "@/lib/tenant/context";

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  await logout(user);
  redirect("/login");
}

/** In-app org switch. Membership is re-validated server-side; never trust the id. */
export async function switchOrganizationAction(formData: FormData): Promise<void> {
  const organizationId = Number(formData.get("organizationId"));
  if (!Number.isFinite(organizationId)) redirect("/app");
  const result = await switchActiveOrganization(organizationId);
  if (!result.ok && result.reason === "unauthenticated") redirect("/login");
  revalidatePath("/app");
  redirect("/app");
}

export async function enterViewAsAction(formData: FormData): Promise<void> {
  const organizationId = Number(formData.get("organizationId"));
  if (!Number.isFinite(organizationId)) redirect("/app/admin/organizations");
  const result = await enterViewAs(organizationId);
  if (!result.ok && result.reason === "unauthenticated") redirect("/login");
  if (!result.ok) redirect("/app/admin/organizations");
  revalidatePath("/app");
  redirect("/app");
}

export async function exitViewAsAction(): Promise<void> {
  const result = await exitViewAs();
  if (!result.ok && result.reason === "unauthenticated") redirect("/login");
  revalidatePath("/app");
  redirect("/app");
}
