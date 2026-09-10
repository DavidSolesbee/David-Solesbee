import * as React from "react";
import { Container, Eyebrow, SectionHeading, Lead, Section } from "./primitives";
import { Reveal } from "./Reveal";
import { dataSources } from "@/lib/marketing/demoData";
import { SolesbeeMark } from "@/components/brand/SolesbeeLogo";

/**
 * "All your data. One operating view." — shows fragmented sources converging
 * into a single Solesbee view.
 */
export function ValueProposition() {
  return (
    <Section id="solutions" tone="raised">
      <Container>
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <Eyebrow>Data consolidation</Eyebrow>
            <SectionHeading className="mt-4">
              All your data. One operating view.
            </SectionHeading>
            <Lead className="mt-5">
              Information is scattered across the tools your teams use every day.
              Solesbee Analytics brings it together into a single, trustworthy
              view — so everyone works from the same numbers.
            </Lead>
            <div className="mt-7 flex flex-wrap gap-2">
              {dataSources.map((s) => (
                <span
                  key={s}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/70"
                >
                  {s}
                </span>
              ))}
            </div>
          </Reveal>

          {/* Convergence visual */}
          <Reveal delay={120}>
            <div className="relative rounded-2xl border border-white/10 bg-night-800 p-6">
              <div className="grid grid-cols-3 gap-3">
                {dataSources.slice(0, 9).map((s, i) => (
                  <div
                    key={s}
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-3 text-center text-[11px] text-white/50"
                    style={{ opacity: 0.55 + (i % 3) * 0.15 }}
                  >
                    {s}
                  </div>
                ))}
              </div>
              <div className="my-5 flex items-center justify-center gap-2 text-white/30">
                <span className="h-px w-16 bg-gradient-to-r from-transparent to-white/20" />
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 4v16M6 14l6 6 6-6" />
                </svg>
                <span className="h-px w-16 bg-gradient-to-l from-transparent to-white/20" />
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-azure-500/30 bg-azure-500/10 p-4">
                <SolesbeeMark size={34} />
                <div>
                  <div className="text-sm font-semibold text-white">
                    Solesbee Analytics
                  </div>
                  <div className="text-caption text-white/55">
                    One consolidated, permission-aware view
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
