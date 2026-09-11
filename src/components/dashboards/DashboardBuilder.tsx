"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Visibility } from "@/lib/dashboards/service";

export interface BuilderWidget {
  key: string;
  label: string;
  description: string;
  category: string;
}

export interface BuilderRole {
  id: number;
  name: string;
}

export interface BuilderInitial {
  dashboardId?: number;
  name: string;
  description: string;
  visibility: Visibility;
  targetRoleId: number | null;
  widgetKeys: string[];
}

/**
 * Dashboard builder form. Posts to a server action (create or update). The
 * visibility choice conditionally reveals the target-role selector. Widget
 * choices are checkboxes grouped by category — note that a viewer will only see
 * a widget's data if they are individually authorized for it.
 */
export function DashboardBuilder({
  action,
  widgets,
  roles,
  initial,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  widgets: BuilderWidget[];
  roles: BuilderRole[];
  initial?: BuilderInitial;
  submitLabel: string;
}) {
  const [visibility, setVisibility] = React.useState<Visibility>(
    initial?.visibility ?? "personal",
  );
  const selected = new Set(initial?.widgetKeys ?? []);

  const categories = Array.from(new Set(widgets.map((w) => w.category)));

  return (
    <form action={action} className="space-y-6">
      {initial?.dashboardId != null && (
        <input type="hidden" name="dashboardId" value={initial.dashboardId} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Name your dashboard and choose who can see it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="name">
              Name
            </label>
            <Input id="name" name="name" required defaultValue={initial?.name ?? ""} placeholder="e.g. Sales Leadership Overview" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="description">
              Description <span className="text-ink-faint">(optional)</span>
            </label>
            <Input id="description" name="description" defaultValue={initial?.description ?? ""} placeholder="What this dashboard is for" />
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">Visibility</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["personal", "role", "org"] as Visibility[]).map((v) => (
                <label
                  key={v}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm transition-colors ${
                    visibility === v ? "border-forest-500 bg-forest-50" : "border-line hover:bg-surface-tinted"
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={v}
                    checked={visibility === v}
                    onChange={() => setVisibility(v)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-medium capitalize text-ink">{v}</span>
                    <span className="block text-caption text-ink-faint">
                      {v === "personal"
                        ? "Only you"
                        : v === "role"
                          ? "A specific role"
                          : "Everyone in the org"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {visibility === "role" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-ink" htmlFor="targetRoleId">
                Target role
              </label>
              <select
                id="targetRoleId"
                name="targetRoleId"
                defaultValue={initial?.targetRoleId ?? ""}
                className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-forest-500 focus:outline-none"
              >
                <option value="" disabled>
                  Select a role…
                </option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-caption text-ink-faint">
                You can only publish to roles at or below your level.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Widgets</CardTitle>
          <CardDescription>
            Choose the metrics to include. Each viewer only sees widgets they’re authorized
            for — restricted ones appear locked.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-2">
          {categories.map((cat) => (
            <div key={cat}>
              <div className="mb-2 text-caption uppercase tracking-wide text-ink-faint">{cat}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {widgets
                  .filter((w) => w.category === cat)
                  .map((w) => (
                    <label
                      key={w.key}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 text-sm hover:bg-surface-tinted"
                    >
                      <input
                        type="checkbox"
                        name="widget"
                        value={w.key}
                        defaultChecked={selected.has(w.key)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block font-medium text-ink">{w.label}</span>
                        <span className="block text-caption text-ink-faint">{w.description}</span>
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
