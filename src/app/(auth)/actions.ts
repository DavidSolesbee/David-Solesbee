"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  login,
  completeAuthenticatedLogin,
  submitAccessRequest,
  requestPasswordReset,
} from "@/lib/auth/service";
import { switchActiveOrganization } from "@/lib/tenant/context";
import {
  confirmMfaEnrollment,
  consumeMfaChallenge,
  getMfaChallengeUserId,
  verifyMfaCode,
} from "@/lib/auth/mfa";
import { acceptInvitation } from "@/lib/admin/invitations";
import { getAppDb } from "@/lib/db/app";

/** Shared form-state shape for useActionState. */
export interface FormState {
  ok?: boolean;
  error?: string;
  message?: string;
}

async function requestContext() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: h.get("user-agent"),
  };
}

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Enter your email and password." };
  }
  const ctx = await requestContext();
  const result = await login(email, password, ctx);
  if (!result.ok) {
    return { error: result.message };
  }
  if (result.mfaRequired) {
    redirect(result.enrolled ? "/mfa" : "/mfa?enroll=1");
  }
  redirect(result.organizationCount > 1 ? "/select-organization" : "/app");
}

export async function verifyMfaAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await getMfaChallengeUserId();
  if (!userId) return { error: "Your verification session expired. Sign in again." };
  const code = String(formData.get("code") ?? "");
  if (!verifyMfaCode(userId, code)) {
    return { error: "That code is not valid." };
  }
  const consumed = await consumeMfaChallenge();
  if (!consumed) return { error: "Your verification session expired. Sign in again." };
  const row = getAppDb()
    .prepare("SELECT email, dealership FROM users WHERE id = ?")
    .get(userId) as { email: string; dealership: string | null };
  const ctx = await requestContext();
  const done = await completeAuthenticatedLogin(userId, row.email, row.dealership, ctx, "passed");
  redirect(done.organizationCount > 1 ? "/select-organization" : "/app");
}

export async function enrollMfaDuringLoginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const userId = await getMfaChallengeUserId();
  if (!userId) return { error: "Your verification session expired. Sign in again." };
  try {
    confirmMfaEnrollment(userId, String(formData.get("code") ?? ""));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not verify that code." };
  }
  const consumed = await consumeMfaChallenge();
  if (!consumed) return { error: "Your verification session expired. Sign in again." };
  const row = getAppDb()
    .prepare("SELECT email, dealership FROM users WHERE id = ?")
    .get(userId) as { email: string; dealership: string | null };
  const ctx = await requestContext();
  const done = await completeAuthenticatedLogin(userId, row.email, row.dealership, ctx, "enrolled");
  redirect(done.organizationCount > 1 ? "/select-organization" : "/app");
}

export async function acceptInviteAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  try {
    acceptInvitation(token, {
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "This invitation could not be accepted." };
  }
  return { ok: true, message: "Invitation accepted. Sign in to continue." };
}

export async function requestAccessAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = submitAccessRequest({
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? ""),
    dealership: String(formData.get("dealership") ?? ""),
    location: String(formData.get("location") ?? ""),
    department: String(formData.get("department") ?? ""),
    jobTitle: String(formData.get("jobTitle") ?? ""),
    requestedRole: String(formData.get("requestedRole") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!result.ok) return { error: result.message };
  return {
    ok: true,
    message:
      "Your request has been submitted for review. Access will become available after approval.",
  };
}

export async function selectOrganizationAction(
  formData: FormData,
): Promise<void> {
  const organizationId = Number(formData.get("organizationId"));
  if (!Number.isFinite(organizationId)) {
    redirect("/select-organization?error=1");
  }
  const result = await switchActiveOrganization(organizationId);
  if (!result.ok) {
    if (result.reason === "unauthenticated") redirect("/login");
    redirect("/select-organization?error=1");
  }
  redirect("/app");
}

export async function forgotPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  if (!email) return { error: "Enter your email address." };
  requestPasswordReset(email);
  return {
    ok: true,
    message:
      "If an account exists for that email, password reset instructions will be sent to that address.",
  };
}
