"use client";

import { useActionState } from "react";
import { verifyMfaAction, enrollMfaDuringLoginAction, type FormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";

const initial: FormState = {};

export function MfaVerifyForm() {
  const [state, formAction, pending] = useActionState(verifyMfaAction, initial);
  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div role="alert" className="rounded-lg border border-terracotta-300 bg-terracotta-50 px-4 py-3 text-sm text-terracotta-600">
          {state.error}
        </div>
      )}
      <Field label="Authentication code" htmlFor="code">
        <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" required />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Verifying…" : "Verify"}
      </Button>
    </form>
  );
}

export function MfaEnrollForm({ backupCode, otpauth }: { backupCode: string; otpauth: string }) {
  const [state, formAction, pending] = useActionState(enrollMfaDuringLoginAction, initial);
  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div role="alert" className="rounded-lg border border-terracotta-300 bg-terracotta-50 px-4 py-3 text-sm text-terracotta-600">
          {state.error}
        </div>
      )}
      <p className="text-sm text-ink-soft">
        Add this key to your authenticator app, then enter the 6-digit code.
      </p>
      <code className="block break-all rounded-lg bg-surface-tinted px-3 py-2 text-caption text-ink">
        {otpauth}
      </code>
      <p className="text-caption text-ink-faint">
        Backup code (store it): <span className="font-mono text-ink">{backupCode}</span>
      </p>
      <Field label="Verification code" htmlFor="code">
        <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Enabling…" : "Enable MFA and continue"}
      </Button>
    </form>
  );
}
