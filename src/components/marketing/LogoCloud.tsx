import * as React from "react";
import { Container } from "./primitives";
import { demoCustomers } from "@/lib/marketing/demoData";
import { SolesbeeMark } from "@/components/brand/SolesbeeLogo";

/**
 * Social-proof strip. Uses clearly fictional demonstration organizations
 * (see marketingDemoData) — not real customers.
 */
export function LogoCloud() {
  return (
    <div className="border-y border-white/[0.06] bg-night-950 py-12">
      <Container>
        <p className="text-center text-caption font-medium uppercase tracking-[0.24em] text-white/40">
          Built for multi-location organizations across industries
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {demoCustomers.map((c) => (
            <div
              key={c.name}
              className="flex items-center gap-2.5 text-white/45 grayscale transition hover:text-white/70"
              title={`${c.name} — illustrative demo organization`}
            >
              <SolesbeeMark size={20} className="opacity-70" />
              <span className="text-sm font-semibold tracking-tight">
                {c.name}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-[11px] text-white/25">
          Organizations shown are illustrative examples for demonstration.
        </p>
      </Container>
    </div>
  );
}
