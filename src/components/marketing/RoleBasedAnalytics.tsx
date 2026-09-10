"use client";

import * as React from "react";
import { Container, Eyebrow, SectionHeading, Lead } from "./primitives";
import { roleViews } from "@/lib/marketing/demoData";

/**
 * Role-based experience — the same platform shows each person exactly what they
 * should see. Interactive role selector.
 */
export function RoleBasedAnalytics() {
  const [active, setActive] = React.useState(0);
  const view = roleViews[active];

  return (
    <section id="roles" className="scroll-mt-24 bg-night-900 py-20 sm:py-28">
      <Container>
        <div className="max-w-2xl">
          <Eyebrow>Role-based analytics</Eyebrow>
          <SectionHeading className="mt-4">
            Everyone sees what matters to them — and only what they should.
          </SectionHeading>
          <Lead className="mt-5">
            Access is shaped by role, department, and location. The same platform
            presents a tailored, secure view to each person.
          </Lead>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-[280px_1fr]">
          {/* Role selector */}
          <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {roleViews.map((r, i) => (
              <button
                key={r.role}
                onClick={() => setActive(i)}
                aria-pressed={i === active}
                className={
                  "shrink-0 rounded-xl border px-4 py-3 text-left transition-colors lg:shrink " +
                  (i === active
                    ? "border-azure-500/40 bg-azure-500/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]")
                }
              >
                <div className={"text-sm font-semibold " + (i === active ? "text-white" : "text-white/75")}>
                  {r.role}
                </div>
                <div className="mt-0.5 hidden text-caption text-white/45 lg:block">
                  {r.blurb}
                </div>
              </button>
            ))}
          </div>

          {/* Role panel */}
          <div className="rounded-2xl border border-white/10 bg-night-800 p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-caption uppercase tracking-widest text-azure-400">
                  {view.role} view
                </div>
                <h3 className="mt-1 text-xl font-semibold text-white">{view.blurb}</h3>
              </div>
              <span className="hidden rounded-full border border-white/10 px-3 py-1 text-caption text-white/50 sm:inline">
                Permission-aware
              </span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {view.metrics.map((m) => (
                <div
                  key={m}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white/75"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-azure-400" />
                  {m}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
