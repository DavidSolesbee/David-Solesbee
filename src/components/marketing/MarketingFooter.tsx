import * as React from "react";
import Link from "next/link";
import { Container } from "./primitives";
import { SolesbeeLogo } from "@/components/brand/SolesbeeLogo";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Platform", href: "#platform" },
      { label: "Executive Intelligence", href: "#executive" },
      { label: "Automated Reporting", href: "#reporting" },
      { label: "Solesbee Intelligence", href: "#intelligence" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Role-Based Analytics", href: "#roles" },
      { label: "Data Consolidation", href: "#solutions" },
      { label: "Security", href: "#security" },
      { label: "Customers", href: "#customers" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Our Story", href: "#company" },
      { label: "Request a Demo", href: "#request-demo" },
      { label: "Client Login", href: "/login" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/10 bg-night-950 py-14">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <SolesbeeLogo size={30} tone="dark" />
            <p className="mt-4 max-w-xs text-sm text-white/50">
              Your data. One view. Better decisions. Centralized analytics and
              automated reporting for multi-location organizations.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <div className="text-caption font-semibold uppercase tracking-wide text-white/40">
                {col.title}
              </div>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) =>
                  l.href.startsWith("#") ? (
                    <li key={l.label}>
                      <a href={l.href} className="text-sm text-white/60 hover:text-white">
                        {l.label}
                      </a>
                    </li>
                  ) : (
                    <li key={l.label}>
                      <Link href={l.href} className="text-sm text-white/60 hover:text-white">
                        {l.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
          <p className="text-caption text-white/40">
            © {new Date().getFullYear()} Solesbee Analytics. All rights reserved.
          </p>
          <div className="flex items-center gap-5 text-caption text-white/40">
            <span>Privacy</span>
            <span>Terms</span>
            <Link href="/login" className="hover:text-white">
              Client Login
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
