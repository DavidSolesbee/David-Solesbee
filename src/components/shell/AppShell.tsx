import * as React from "react";
import Link from "next/link";
import { PerseusLogo } from "@/components/brand/PerseusLogo";
import { config } from "@/lib/config";
import { cn } from "@/lib/utils/cn";

/**
 * AppShell — the top-level frame for Perseus. Milestone 1 provides a calm top
 * bar with the compact brand and the product journey. Navigation, auth, and
 * modules are intentionally NOT present yet (later milestones).
 */
export function AppShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: "home" | "design" | "discovery";
}) {
  const links: Array<{ href: string; label: string; key: string }> = [
    { href: "/", label: "Home", key: "home" },
    { href: "/design", label: "Design System", key: "design" },
    { href: "/data-discovery", label: "Data Discovery", key: "discovery" },
  ];
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between px-6">
          <Link href="/" className="flex items-center">
            <PerseusLogo size={28} />
          </Link>
          <nav className="flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.key}
                href={l.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                  active === l.key
                    ? "bg-surface-sunken text-ink"
                    : "text-ink-soft hover:bg-surface-tinted hover:text-ink",
                )}
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/login"
              className="ml-2 rounded-lg bg-forest-500 px-4 py-2 text-sm font-medium text-white shadow-subtle transition-colors duration-150 hover:bg-forest-600"
            >
              Sign In
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-content px-6 py-12">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-content flex-col gap-1 px-6 py-8 text-caption text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <span className="uppercase tracking-[0.2em]">
            {config.brand.name}
          </span>
          <span className="uppercase tracking-[0.2em]">
            {config.brand.tagline}
          </span>
        </div>
      </footer>
    </div>
  );
}
