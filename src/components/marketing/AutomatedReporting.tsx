import * as React from "react";
import { Container, Eyebrow, SectionHeading, Lead, Section } from "./primitives";
import { Reveal } from "./Reveal";
import { sampleReport } from "@/lib/marketing/demoData";
import { SolesbeeMark } from "@/components/brand/SolesbeeLogo";

/**
 * Automated reporting — a key differentiator. Configuration lives in the Admin
 * Console (inside the app); this section only markets it. Emphasizes that
 * delivery is permission-aware.
 */
const factors = ["User", "Role", "Security level", "Department", "Location", "Report permission"];

export function AutomatedReporting() {
  return (
    <Section id="reporting" tone="raised">
      <Container>
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <Reveal>
            <Eyebrow>Automated reporting</Eyebrow>
            <SectionHeading className="mt-4">
              The right report, to the right person, automatically.
            </SectionHeading>
            <Lead className="mt-5">
              Authorized administrators schedule reports that are delivered to
              each user&apos;s login email — on your cadence, with no manual
              assembly. Reporting is permission-aware, so a report never contains
              data the recipient isn&apos;t authorized to see.
            </Lead>
            <div className="mt-6">
              <div className="text-caption font-semibold uppercase tracking-wide text-white/40">
                Scheduled by
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {factors.map((f) => (
                  <span
                    key={f}
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/70"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
            <p className="mt-6 flex items-start gap-2 text-sm text-white/55">
              <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-azure-400" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M10 2 3 5v5c0 3.5 2.5 6.2 7 7 4.5-.8 7-3.5 7-7V5l-7-3Z" />
                <path d="M7.5 10l1.8 1.8L13 8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Users never receive data they are not authorized to access.
            </p>
          </Reveal>

          {/* Sample scheduled report card */}
          <Reveal delay={120}>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-night-800 shadow-[0_30px_90px_-40px_rgba(0,0,0,0.8)]">
              <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.02] px-5 py-4">
                <SolesbeeMark size={26} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">
                    {sampleReport.name}
                  </div>
                  <div className="text-caption text-white/45">Scheduled delivery</div>
                </div>
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-signal-up/10 px-2.5 py-1 text-caption font-medium text-signal-up">
                  <span className="h-1.5 w-1.5 rounded-full bg-signal-up" />
                  Active
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-px bg-white/[0.06]">
                {[
                  ["Cadence", sampleReport.cadence],
                  ["Time", sampleReport.time],
                  ["Format", sampleReport.format],
                  ["Scope", sampleReport.scope],
                  ["Period", sampleReport.period],
                  ["Recipients", `${sampleReport.recipients.length} roles`],
                ].map(([k, v]) => (
                  <div key={k} className="bg-night-800 px-5 py-4">
                    <dt className="text-caption text-white/40">{k}</dt>
                    <dd className="mt-1 text-sm font-medium text-white">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex items-center gap-2 border-t border-white/10 px-5 py-4 text-caption text-white/50">
                <svg viewBox="0 0 20 20" className="h-4 w-4 text-white/40" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2.5" y="4" width="15" height="12" rx="2" />
                  <path d="M3 6l7 5 7-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Delivered to each recipient&apos;s login email · PDF + interactive link
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
