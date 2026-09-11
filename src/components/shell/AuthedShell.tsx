import * as React from "react";
import Link from "next/link";
import { AppBrand } from "@/components/brand/AppBrand";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { logoutAction } from "@/app/app/actions";
import type { AuthContext } from "@/lib/tenant/context";
import type { OrgMembership } from "@/lib/tenant/organizations";
import { ModuleNav } from "@/components/shell/ModuleNav";
import { OrgSwitcher } from "@/components/shell/OrgSwitcher";
import { ViewAsBanner } from "@/components/shell/ViewAsBanner";

/**
 * Authenticated application shell. Role-aware navigation is derived from the
 * user's module permissions (modules the user is NOT authorized to see never
 * appear). Each authorized module links to its analytics page.
 */

const MODULE_NAV: Array<{ perm: string; label: string; href: string | null }> = [
  { perm: "module.overview", label: "Overview", href: "/app" },
  { perm: "module.customers", label: "Customers", href: "/app/customers" },
  { perm: "module.sales", label: "Sales", href: "/app/sales" },
  { perm: "module.parts", label: "Parts", href: "/app/parts" },
  { perm: "module.inventory", label: "Inventory", href: "/app/inventory" },
  { perm: "module.service", label: "Service", href: "/app/service" },
  { perm: "module.payments", label: "Payments", href: "/app/payments" },
  { perm: "module.accounting", label: "Accounting", href: "/app/accounting" },
  { perm: "module.ai_insights", label: "Ask AI", href: "/app/ask" },
];

export function AuthedShell({
  user,
  organizations,
  children,
}: {
  user: AuthContext;
  organizations: OrgMembership[];
  children: React.ReactNode;
}) {
  const modules = MODULE_NAV.filter((m) => user.permissions.has(m.perm));
  const canAdmin = user.permissions.has("app.admin");

  return (
    <div className="min-h-screen bg-canvas">
      {user.isViewingAs && (
        <ViewAsBanner organizationName={user.activeOrganizationName} />
      )}
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <AppBrand href="/app" size={26} />
            <OrgSwitcher
              label={user.activeOrganizationName}
              activeOrganizationId={user.activeOrganizationId}
              organizations={organizations}
              viewingAs={user.isViewingAs}
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <Link href="/app/account" className="text-sm font-medium text-ink hover:text-forest-700">
                {user.firstName} {user.lastName}
              </Link>
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
        {/* Role-aware module nav — each authorized module links to its page */}
        <div className="border-t border-line/70 bg-surface-tinted/60">
          <div className="mx-auto flex max-w-content flex-wrap items-center gap-1 px-6 py-2">
            <ModuleNav
              links={[
                ...modules.map((m) => ({ label: m.label, href: m.href })),
                { label: "Dashboards", href: "/app/dashboards" },
                ...(user.permissions.has("feature.export")
                  ? [{ label: "Reports", href: "/app/reports" }]
                  : []),
              ]}
            />
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
