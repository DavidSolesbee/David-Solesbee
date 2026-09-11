"use server";

import { redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/auth/authz";
import {
  beginMfaEnrollment,
  confirmMfaEnrollment,
  disableMfa,
} from "@/lib/auth/mfa";
import { setFlash } from "@/lib/admin/flash";

export async function startMfaEnrollAction(): Promise<void> {
  const user = await requireActiveUser();
  const started = beginMfaEnrollment(user.id, user.email);
  await setFlash({
    kind: "secret",
    message: `Authenticator URI: ${started.otpauth} · Backup code: ${started.backupCode}`,
  });
  redirect("/app/account");
}

export async function confirmMfaEnrollAction(formData: FormData): Promise<void> {
  const user = await requireActiveUser();
  try {
    confirmMfaEnrollment(user.id, String(formData.get("code") ?? ""));
    await setFlash({ kind: "success", message: "MFA is enabled on your account." });
  } catch (e) {
    await setFlash({
      kind: "error",
      message: e instanceof Error ? e.message : "Could not verify that code.",
    });
  }
  redirect("/app/account");
}

export async function disableMfaAction(): Promise<void> {
  const user = await requireActiveUser();
  disableMfa(user.id);
  await setFlash({ kind: "success", message: "MFA has been disabled." });
  redirect("/app/account");
}
