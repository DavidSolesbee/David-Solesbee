"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/authz";
import { setFlash } from "@/lib/admin/flash";
import { toPerseusError } from "@/lib/errors";
import * as admin from "@/lib/admin/service";
import * as invitations from "@/lib/admin/invitations";
import { updateOrgAuthSettings } from "@/lib/tenant/orgAuth";
import type { AccountState } from "@/lib/auth/catalog";

/** Wrap a governance mutation with admin auth + uniform error flashing. */
async function run(fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    const err = toPerseusError(e);
    await setFlash({ kind: "error", message: err.message });
  }
}

export async function approveRequestAction(formData: FormData): Promise<void> {
  await run(async () => {
    const actor = await requireAdmin();
    const requestId = Number(formData.get("requestId"));
    const roleKey = String(formData.get("roleKey") ?? "");
    const department = String(formData.get("department") ?? "") || null;
    if (!roleKey) throw new Error("Select a role to approve this request.");
    const { tempPassword } = admin.approveAccessRequest(actor, requestId, {
      roleKey,
      department,
    });
    await setFlash({
      kind: "secret",
      message: `Approved. Temporary password: ${tempPassword}`,
    });
  });
  revalidatePath("/app/admin/requests");
  revalidatePath("/app/admin");
}

export async function decideRequestAction(formData: FormData): Promise<void> {
  await run(async () => {
    const actor = await requireAdmin();
    const requestId = Number(formData.get("requestId"));
    const decision = String(formData.get("decision")) as "denied" | "more_info";
    const note = String(formData.get("note") ?? "") || undefined;
    admin.decideAccessRequest(actor, requestId, decision, note);
    await setFlash({ kind: "success", message: `Request ${decision.replace("_", " ")}.` });
  });
  revalidatePath("/app/admin/requests");
  revalidatePath("/app/admin");
}

export async function assignRoleAction(formData: FormData): Promise<void> {
  const userId = Number(formData.get("userId"));
  await run(async () => {
    const actor = await requireAdmin();
    admin.assignRole(actor, userId, String(formData.get("roleKey") ?? ""));
    await setFlash({ kind: "success", message: "Role updated." });
  });
  revalidatePath(`/app/admin/users/${userId}`);
}

export async function setStatusAction(formData: FormData): Promise<void> {
  const userId = Number(formData.get("userId"));
  await run(async () => {
    const actor = await requireAdmin();
    admin.setStatus(actor, userId, String(formData.get("status")) as AccountState);
    await setFlash({ kind: "success", message: "Account status updated." });
  });
  revalidatePath(`/app/admin/users/${userId}`);
  revalidatePath("/app/admin/users");
}

export async function setOverrideAction(formData: FormData): Promise<void> {
  const userId = Number(formData.get("userId"));
  await run(async () => {
    const actor = await requireAdmin();
    admin.setPermissionOverride(
      actor,
      userId,
      String(formData.get("permissionKey") ?? ""),
      String(formData.get("value")) as "grant" | "revoke" | "clear",
    );
    await setFlash({ kind: "success", message: "Permission override updated." });
  });
  revalidatePath(`/app/admin/users/${userId}`);
}

export async function setDepartmentAction(formData: FormData): Promise<void> {
  const userId = Number(formData.get("userId"));
  await run(async () => {
    const actor = await requireAdmin();
    admin.setDepartment(actor, userId, String(formData.get("department") ?? "") || null);
    await setFlash({ kind: "success", message: "Department updated." });
  });
  revalidatePath(`/app/admin/users/${userId}`);
}

export async function resetPasswordAction(formData: FormData): Promise<void> {
  const userId = Number(formData.get("userId"));
  await run(async () => {
    const actor = await requireAdmin();
    const { tempPassword } = admin.resetPassword(actor, userId);
    await setFlash({
      kind: "secret",
      message: `Password reset. Temporary password: ${tempPassword}`,
    });
  });
  revalidatePath(`/app/admin/users/${userId}`);
}

export async function setPasswordAction(formData: FormData): Promise<void> {
  const userId = Number(formData.get("userId"));
  await run(async () => {
    const actor = await requireAdmin();
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");
    if (password !== confirm) {
      throw new Error("Password and confirmation do not match.");
    }
    admin.setPassword(actor, userId, password);
    await setFlash({ kind: "success", message: "Password updated. The user was signed out." });
  });
  revalidatePath(`/app/admin/users/${userId}`);
}

export async function deleteUserAction(formData: FormData): Promise<void> {
  const userId = Number(formData.get("userId"));
  try {
    const actor = await requireAdmin();
    admin.deleteUser(actor, userId);
    await setFlash({ kind: "success", message: "User removed." });
  } catch (e) {
    await setFlash({ kind: "error", message: toPerseusError(e).message });
    revalidatePath(`/app/admin/users/${userId}`);
    return;
  }
  redirect("/app/admin/users");
}

export async function forceLogoutAction(formData: FormData): Promise<void> {
  const userId = Number(formData.get("userId"));
  await run(async () => {
    const actor = await requireAdmin();
    const n = admin.forceLogout(actor, userId);
    await setFlash({ kind: "success", message: `Ended ${n} active session(s).` });
  });
  revalidatePath(`/app/admin/users/${userId}`);
}

export async function inviteUserAction(formData: FormData): Promise<void> {
  await run(async () => {
    const actor = await requireAdmin();
    const { token } = invitations.createInvitation(
      actor,
      String(formData.get("email") ?? ""),
      String(formData.get("roleKey") ?? ""),
    );
    await setFlash({
      kind: "secret",
      message: `Invitation created. Share this link: /invite/${token}`,
    });
  });
  revalidatePath("/app/admin/invitations");
}

export async function revokeInviteAction(formData: FormData): Promise<void> {
  await run(async () => {
    const actor = await requireAdmin();
    invitations.revokeInvitation(actor, Number(formData.get("invitationId")));
    await setFlash({ kind: "success", message: "Invitation revoked." });
  });
  revalidatePath("/app/admin/invitations");
}

export async function updateOrgAuthAction(formData: FormData): Promise<void> {
  await run(async () => {
    const actor = await requireAdmin();
    const organizationId = Number(formData.get("organizationId"));
    updateOrgAuthSettings(actor, organizationId, {
      requireMfa: formData.get("requireMfa") === "1",
      ssoEnabled: formData.get("ssoEnabled") === "1",
    });
    await setFlash({ kind: "success", message: "Organization auth settings updated." });
  });
  revalidatePath("/app/admin/organizations");
  revalidatePath("/app/admin/invitations");
}

export async function unlockAction(formData: FormData): Promise<void> {
  const userId = Number(formData.get("userId"));
  await run(async () => {
    const actor = await requireAdmin();
    admin.unlockUser(actor, userId);
    await setFlash({ kind: "success", message: "Account unlocked." });
  });
  revalidatePath(`/app/admin/users/${userId}`);
}
