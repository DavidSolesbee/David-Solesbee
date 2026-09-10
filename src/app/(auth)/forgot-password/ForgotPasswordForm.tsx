"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction, type FormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";

const initial: FormState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    forgotPasswordAction,
    initial,
  );

  if (state.ok) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-ink-soft">{state.message}</p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium text-forest-600 hover:text-forest-700"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div
          role="alert"
          className="rounded-lg border border-terracotta-300 bg-terracotta-50 px-4 py-3 text-sm text-terracotta-600"
        >
          {state.error}
        </div>
      )}
      <Field label="Business email" htmlFor="email">
        <Input id="email" name="email" type="email" placeholder="name@dealership.com" required />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send reset instructions"}
      </Button>
      <div className="pt-1 text-center text-sm">
        <Link href="/login" className="text-ink-soft hover:text-ink">
          Back to sign in
        </Link>
      </div>
    </form>
  );
}
