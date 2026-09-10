"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export interface ModuleLink {
  label: string;
  href: string | null; // null = not yet available (preview)
}

/**
 * Role-aware module navigation. Links are provided by the server (already
 * filtered to the user's module permissions); this client component only adds
 * the active-tab highlight. A null href renders as a non-navigable preview.
 */
export function ModuleNav({ links }: { links: ModuleLink[] }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {links.map((m) =>
        m.href ? (
          <Link
            key={m.label}
            href={m.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive(m.href)
                ? "bg-surface text-forest-600 shadow-subtle"
                : "text-ink hover:bg-surface-sunken",
            )}
          >
            {m.label}
          </Link>
        ) : (
          <span
            key={m.label}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-faint"
            title="Available in a later milestone"
          >
            {m.label}
          </span>
        ),
      )}
    </div>
  );
}
