"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export function AccountingSubnav({
  links,
}: {
  links: { label: string; href: string; soon?: boolean }[];
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/app/accounting" ? pathname === href : pathname.startsWith(href);

  return (
    <nav className="flex flex-wrap gap-1 border-b border-line pb-3">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            isActive(l.href)
              ? "bg-surface text-forest-600 shadow-subtle"
              : "text-ink-soft hover:bg-surface-tinted hover:text-ink",
          )}
        >
          {l.label}
          {l.soon && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
              Soon
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
