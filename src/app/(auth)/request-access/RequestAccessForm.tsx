"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestAccessAction, type FormState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/Button";
import { Input, Select, Field } from "@/components/ui/Input";

const initial: FormState = {};

const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "dealer_principal", label: "Dealer Principal / Owner" },
  { value: "general_manager", label: "General Manager" },
  { value: "operations_manager", label: "Operations Manager" },
  { value: "sales_manager", label: "Sales Manager" },
  { value: "parts_manager", label: "Parts Manager" },
  { value: "service_manager", label: "Service Manager" },
];

export function RequestAccessForm() {
  const [state, formAction, pending] = useActionState(
    requestAccessAction,
    initial,
  );

  if (state.ok) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sage-50 text-forest-600">
          ✓
        </div>
        <div>
          <h2 className="text-lg font-semibold text-ink">Request submitted</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
            {state.message}
          </p>
        </div>
        <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-caption font-medium text-amber-600 ring-1 ring-inset ring-amber-300">
          Pending Approval
        </span>
        <div>
          <Link
            href="/login"
            className="text-sm font-medium text-forest-600 hover:text-forest-700"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div
          role="alert"
          className="rounded-lg border border-terracotta-300 bg-terracotta-50 px-4 py-3 text-sm text-terracotta-600"
        >
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="First name" htmlFor="firstName">
          <Input id="firstName" name="firstName" required />
        </Field>
        <Field label="Last name" htmlFor="lastName">
          <Input id="lastName" name="lastName" required />
        </Field>
      </div>

      <Field label="Business email" htmlFor="email">
        <Input id="email" name="email" type="email" placeholder="name@dealership.com" required />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Dealership" htmlFor="dealership">
          <Input id="dealership" name="dealership" placeholder="Dealership name" />
        </Field>
        <Field label="Location" htmlFor="location">
          <Input id="location" name="location" placeholder="Location" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Department" htmlFor="department">
          <Select id="department" name="department" defaultValue="">
            <option value="" disabled>Select…</option>
            <option>Sales</option>
            <option>Parts</option>
            <option>Service</option>
            <option>Operations</option>
          </Select>
        </Field>
        <Field label="Job title" htmlFor="jobTitle">
          <Input id="jobTitle" name="jobTitle" placeholder="e.g. Sales Manager" />
        </Field>
      </div>

      <Field label="Requested role" htmlFor="requestedRole">
        <Select id="requestedRole" name="requestedRole" defaultValue="">
          <option value="" disabled>Select a role…</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Reason for access" htmlFor="reason">
        <textarea
          id="reason"
          name="reason"
          rows={3}
          placeholder="Briefly describe why you need access."
          className="w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint shadow-subtle transition-colors hover:border-sage-300 focus:border-sage-500 focus:outline-none"
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Submitting…" : "Submit request"}
      </Button>

      <div className="pt-1 text-center text-sm">
        <Link href="/login" className="text-ink-soft hover:text-ink">
          Back to sign in
        </Link>
      </div>
    </form>
  );
}
