import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/tenant/context";
import { countPendingRequests } from "@/lib/admin/service";
import { readFlash } from "@/lib/admin/flash";
import { AdminNav } from "@/components/admin/AdminNav";
import { FlashBanner } from "@/components/admin/FlashBanner";

export const dynamic = "force-dynamic";

/**
 * Admin Console gate. Requires an active user with `app.admin`. Governance
 * mutations additionally require `feature.manage_users` (enforced server-side in
 * the admin service, so read-only admins can view but not change).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getActiveContext();
  if (!user || user.status !== "active") redirect("/login");
  if (!user.permissions.has("app.admin")) redirect("/app");

  const pending = countPendingRequests(user);
  const flash = await readFlash();

  return (
    <div className="space-y-6">
      <div>
        <div className="text-caption font-semibold uppercase tracking-[0.22em] text-warm-blue-600">
          Admin Console
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">
          Administration
        </h1>
        <p className="mt-1 text-ink-soft">
          Access, dashboards, automated reporting, and audit. Every action is
          enforced server-side — security always overrides configuration.
        </p>
      </div>

      <AdminNav pendingCount={pending} platformAdmin={user.isPlatformAdmin} />
      <FlashBanner flash={flash} />

      <div>{children}</div>
    </div>
  );
}
