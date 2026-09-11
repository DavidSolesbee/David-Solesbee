"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/authz";
import { setFlash } from "@/lib/admin/flash";
import { toPerseusError } from "@/lib/errors";
import * as security from "@/lib/admin/security";
import * as admin from "@/lib/admin/service";

/** Wrap a security mutation with admin auth + uniform error flashing. */
async function run(fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    const err = toPerseusError(e);
    await setFlash({ kind: "error", message: err.message });
  }
}

const SEC = "/app/admin/security";

export async function terminateSessionAction(formData: FormData): Promise<void> {
  await run(async () => {
    const actor = await requireAdmin();
    security.terminateSession(actor, Number(formData.get("sessionId")));
    await setFlash({ kind: "success", message: "Session terminated." });
  });
  revalidatePath(SEC);
}

export async function terminateAllSessionsAction(formData: FormData): Promise<void> {
  await run(async () => {
    const actor = await requireAdmin();
    const n = admin.forceLogout(actor, Number(formData.get("userId")));
    await setFlash({ kind: "success", message: `Ended ${n} active session(s) for this user.` });
  });
  revalidatePath(SEC);
}

export async function lockUserAction(formData: FormData): Promise<void> {
  await run(async () => {
    const actor = await requireAdmin();
    admin.lockUser(actor, Number(formData.get("userId")));
    await setFlash({ kind: "success", message: "Account locked and sessions ended." });
  });
  revalidatePath(SEC);
}

export async function unlockUserAction(formData: FormData): Promise<void> {
  await run(async () => {
    const actor = await requireAdmin();
    admin.unlockUser(actor, Number(formData.get("userId")));
    await setFlash({ kind: "success", message: "Account unlocked." });
  });
  revalidatePath(SEC);
}

export async function forcePasswordResetAction(formData: FormData): Promise<void> {
  await run(async () => {
    const actor = await requireAdmin();
    const { tempPassword } = admin.resetPassword(actor, Number(formData.get("userId")));
    await setFlash({ kind: "secret", message: `Password reset. Temporary password: ${tempPassword}` });
  });
  revalidatePath(SEC);
}

export async function resetMfaAction(formData: FormData): Promise<void> {
  await run(async () => {
    const actor = await requireAdmin();
    admin.resetMfa(actor, Number(formData.get("userId")));
    await setFlash({ kind: "success", message: "MFA reset for this user." });
  });
  revalidatePath(SEC);
}

export async function setDeviceTrustAction(formData: FormData): Promise<void> {
  await run(async () => {
    const actor = await requireAdmin();
    security.setDeviceTrust(
      actor,
      Number(formData.get("deviceRowId")),
      String(formData.get("trusted")) === "1",
    );
    await setFlash({ kind: "success", message: "Device updated." });
  });
  revalidatePath(SEC);
}

export async function removeDeviceAction(formData: FormData): Promise<void> {
  await run(async () => {
    const actor = await requireAdmin();
    security.removeDevice(actor, Number(formData.get("deviceRowId")));
    await setFlash({ kind: "success", message: "Device removed." });
  });
  revalidatePath(SEC);
}

export async function addIpRuleAction(formData: FormData): Promise<void> {
  await run(async () => {
    const actor = await requireAdmin();
    security.addIpRule(
      actor,
      String(formData.get("ip") ?? ""),
      String(formData.get("rule")) as "allow" | "block",
      String(formData.get("note") ?? "") || null,
    );
    await setFlash({ kind: "success", message: "IP rule saved." });
  });
  revalidatePath(SEC);
}

export async function removeIpRuleAction(formData: FormData): Promise<void> {
  await run(async () => {
    const actor = await requireAdmin();
    security.removeIpRule(actor, Number(formData.get("ruleId")));
    await setFlash({ kind: "success", message: "IP rule removed." });
  });
  revalidatePath(SEC);
}
