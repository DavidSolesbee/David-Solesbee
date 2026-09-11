"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

/** Sub-navigation for the Admin Console, with active-tab highlighting. */
export function AdminNav({
  pendingCount,
  platformAdmin = false,
}: {
  pendingCount: number;
  platformAdmin?: boolean;
}) {
  const pathname = usePathname();
  const tabs = [
    { href: "/app/admin", label: "Overview", exact: true },
    ...(platformAdmin
      ? [{ href: "/app/admin/organizations", label: "Organizations" }]
      : []),
    { href: "/app/admin/security", label: "Security" },
    { href: "/app/admin/requests", label: "Access Requests", badge: pendingCount },
    { href: "/app/admin/users", label: "Users" },
    { href: "/app/admin/invitations", label: "Invitations" },
    { href: "/app/admin/dashboards", label: "Dashboards" },
    { href: "/app/admin/reports", label: "Reporting" },
    { href: "/app/admin/audit", label: "Audit Log" },
  ];
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {tabs.map((t) => {
        const active = t.exact
          ? pathname === t.href
          : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-150",
              active
                ? "bg-forest-500 text-white shadow-subtle"
                : "text-ink-soft hover:bg-surface-tinted hover:text-ink",
            )}
          >
            {t.label}
            {typeof t.badge === "number" && t.badge > 0 && (
              <span
                className={cn(
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-caption font-semibold",
                  active ? "bg-white/25 text-white" : "bg-amber-500 text-white",
                )}
              >
                {t.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
