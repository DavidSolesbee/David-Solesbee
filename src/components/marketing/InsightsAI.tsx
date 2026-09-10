import * as React from "react";
import { Container, Eyebrow, SectionHeading, Lead, Section } from "./primitives";
import { Reveal } from "./Reveal";
import { aiPrompts } from "@/lib/marketing/demoData";
import { SolesbeeMark } from "@/components/brand/SolesbeeLogo";

/**
 * Solesbee Intelligence — an assistant for understanding business data.
 * Presented as a product preview / forward-looking module (labeled), not wired
 * to any live capability here.
 */
export function InsightsAI() {
  return (
    <Section id="intelligence" tone="raised">
      <Container>
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <div className="flex items-center gap-2">
              <Eyebrow>Solesbee Intelligence</Eyebrow>
              <span className="rounded-full border border-azure-500/30 bg-azure-500/10 px-2.5 py-0.5 text-[11px] font-medium text-azure-300">
                Preview
              </span>
            </div>
            <SectionHeading className="mt-4">
              Ask your business a question.
            </SectionHeading>
            <Lead className="mt-5">
              Solesbee Intelligence helps leaders interpret what the data is
              saying — in plain language, grounded in the metrics they already
              trust. Answers respect each user&apos;s permissions.
            </Lead>
            <p className="mt-4 text-caption text-white/40">
              Shown as a product preview. Availability may vary by environment.
            </p>
          </Reveal>

          {/* Chat-style preview */}
          <Reveal delay={120}>
            <div className="rounded-2xl border border-white/10 bg-night-800 p-5 shadow-[0_30px_90px_-40px_rgba(0,0,0,0.8)]">
              <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                <SolesbeeMark size={22} />
                <span className="text-sm font-medium text-white/80">Solesbee Intelligence</span>
                <span className="ml-auto text-caption text-white/35">Permission-aware</span>
              </div>
              <div className="space-y-3 pt-4">
                {aiPrompts.slice(0, 3).map((q) => (
                  <div key={q} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-azure-500/15 px-3.5 py-2 text-sm text-white/85">
                      {q}
                    </div>
                  </div>
                ))}
                <div className="flex justify-start">
                  <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.03] px-3.5 py-3 text-sm text-white/70">
                    Gross margin declined 1.2 pts, driven mainly by the Parts
                    department at two locations. Northstar and Meridian account
                    for most of the change.
                    <div className="mt-2 flex gap-1.5">
                      <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50">Parts</span>
                      <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50">2 locations</span>
                      <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] text-white/50">-1.2 pts</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-2.5 text-caption text-white/35">
                Ask about performance, risk, or what changed…
                <span className="ml-auto rounded-md bg-azure-500/20 px-2 py-1 text-azure-200">Ask</span>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
