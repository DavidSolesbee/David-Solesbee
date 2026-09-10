"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  login,
  submitAccessRequest,
  requestPasswordReset,
} from "@/lib/auth/service";

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
  redirect("/app");
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
