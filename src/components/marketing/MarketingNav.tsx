"use client";

import * as React from "react";
import Link from "next/link";
import { SolesbeeLogo } from "@/components/brand/SolesbeeLogo";
import { cn } from "@/lib/utils/cn";

const NAV_LINKS: { label: string; href: string }[] = [
  { label: "Product", href: "#platform" },
  { label: "Solutions", href: "#roles" },
  { label: "Customers", href: "#customers" },
  { label: "Resources", href: "#reporting" },
  { label: "Company", href: "#company" },
];

const DEMO_HREF = "#request-demo";

export function MarketingNav() {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on Escape
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled || open
          ? "border-b border-white/10 bg-night-950/85 backdrop-blur-lg"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <nav
        className="mx-auto flex h-16 max-w-content items-center justify-between px-6 sm:px-8"
        aria-label="Primary"
      >
        <Link href="/" className="rounded-lg" aria-label="Solesbee Analytics home">
          <SolesbeeLogo size={30} tone="dark" />
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:text-white"
          >
            Login
          </Link>
          <a
            href={DEMO_HREF}
            className="rounded-lg bg-azure-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_1px_0_0_rgba(255,255,255,0.15)_inset,0_8px_24px_-8px_rgba(59,120,240,0.6)] transition-colors hover:bg-azure-400"
          >
            Request Demo
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/5 lg:hidden"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div id="mobile-menu" className="border-t border-white/10 bg-night-950/95 px-6 py-4 lg:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-base font-medium text-white/80 hover:bg-white/5 hover:text-white"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href="/login"
                className="rounded-lg border border-white/15 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-white/5"
              >
                Login
              </Link>
              <a
                href={DEMO_HREF}
                onClick={() => setOpen(false)}
                className="rounded-lg bg-azure-500 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-azure-400"
              >
                Request Demo
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
