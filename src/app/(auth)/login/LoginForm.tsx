"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type FormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/Button";
import { Input, Field } from "@/components/ui/Input";

const initial: FormState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initial);

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
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="name@dealership.com"
          required
        />
      </Field>

      <Field label="Password" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign In"}
      </Button>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-line" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-surface px-3 text-caption uppercase tracking-wide text-ink-faint">
            or
          </span>
        </div>
      </div>

      <Button type="button" variant="secondary" size="lg" className="w-full" disabled>
        Sign in with SSO
      </Button>
      <p className="text-center text-caption text-ink-faint">
        Single sign-on is configured per organization. Coming soon.
      </p>

      <div className="flex items-center justify-between pt-1 text-sm">
        <Link href="/forgot-password" className="text-ink-soft hover:text-ink">
          Forgot password?
        </Link>
        <Link
          href="/request-access"
          className="font-medium text-forest-600 hover:text-forest-700"
        >
          Request access
        </Link>
      </div>
    </form>
  );
}
