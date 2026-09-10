import * as React from "react";
import Link from "next/link";
import { PerseusLogo } from "@/components/brand/PerseusLogo";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { logoutAction } from "@/app/app/actions";
import type { AuthUser } from "@/lib/auth/authz";

/**
 * Authenticated application shell. Role-aware navigation is derived from the
 * user's module permissions (modules the user is NOT authorized to see never
 * appear). Full module screens arrive in later milestones.
 */

const MODULE_NAV: Array<{ perm: string; label: string }> = [
  { perm: "module.overview", label: "Overview" },
  { perm: "module.customers", label: "Customers" },
  { perm: "module.sales", label: "Sales" },
  { perm: "module.parts", label: "Parts" },
  { perm: "module.inventory", label: "Inventory" },
  { perm: "module.service", label: "Service" },
  { perm: "module.payments", label: "Payments" },
  { perm: "module.ai_insights", label: "AI Insights" },
];

export function AuthedShell({
  user,
  children,
}: {
  user: AuthUser;
  children: React.ReactNode;
}) {
  const modules = MODULE_NAV.filter((m) => user.permissions.has(m.perm));
  const canAdmin = user.permissions.has("app.admin");

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-6">
          <Link href="/app">
            <PerseusLogo size={26} />
          </Link>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-ink">
                {user.firstName} {user.lastName}
              </div>
              <div className="text-caption text-ink-faint">
                {user.roleName ?? "No role"}
                {user.department ? ` · ${user.department}` : ""}
              </div>
            </div>
            <form action={logoutAction}>
              <Button variant="secondary" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
        {/* Role-aware module nav (preview; modules build out in later milestones) */}
        <div className="border-t border-line/70 bg-surface-tinted/60">
          <div className="mx-auto flex max-w-content flex-wrap items-center gap-1 px-6 py-2">
            {modules.map((m) =>
              m.perm === "module.overview" ? (
                <Link
                  key={m.perm}
                  href="/app"
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken"
                >
                  {m.label}
                </Link>
              ) : (
                <span
                  key={m.perm}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-faint"
                  title="Available in a later milestone"
                >
                  {m.label}
                </span>
              ),
            )}
            {canAdmin && (
              <Link href="/app/admin" className="ml-auto">
                <StatusBadge
                  intent="info"
                  dot={false}
                  className="cursor-pointer transition-opacity hover:opacity-80"
                >
                  Admin Console
                </StatusBadge>
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-content px-6 py-10">{children}</main>
    </div>
  );
}
