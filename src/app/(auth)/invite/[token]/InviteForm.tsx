"use client";

import { useActionState } from "react";
import Link from "next/link";
import { acceptInviteAction, type FormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";

const initial: FormState = {};

export function InviteForm({
  token,
  email,
  existingUser,
}: {
  token: string;
  email: string;
  existingUser: boolean;
}) {
  const [state, formAction, pending] = useActionState(acceptInviteAction, initial);

  if (state.ok) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-forest-700">{state.message}</p>
        <Link href="/login" className="text-sm font-medium text-forest-600 hover:text-forest-700">
          Sign in →
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      {state.error && (
        <div role="alert" className="rounded-lg border border-terracotta-300 bg-terracotta-50 px-4 py-3 text-sm text-terracotta-600">
          {state.error}
        </div>
      )}
      {!existingUser && (
        <>
          <Field label="First name" htmlFor="firstName">
            <Input id="firstName" name="firstName" required />
          </Field>
          <Field label="Last name" htmlFor="lastName">
            <Input id="lastName" name="lastName" required />
          </Field>
          <Field label="Create a password" htmlFor="password">
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          </Field>
        </>
      )}
      <p className="text-caption text-ink-faint">Accepting as {email}</p>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Accepting…" : "Accept invitation"}
      </Button>
    </form>
  );
}
