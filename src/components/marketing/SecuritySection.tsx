import * as React from "react";
import { Container, Eyebrow, SectionHeading, Lead, Section } from "./primitives";
import { Reveal } from "./Reveal";
import { securityPoints } from "@/lib/marketing/demoData";

/**
 * Enterprise security. Highlights real capabilities of the platform (role-based
 * access, permissions, sessions, segmentation, auditability). No compliance
 * certifications are claimed.
 */
export function SecuritySection() {
  return (
    <Section id="security" tone="raised">
      <Container>
        <div className="max-w-2xl">
          <Eyebrow>Enterprise security</Eyebrow>
          <SectionHeading className="mt-4">
            Security is the foundation, not a feature.
          </SectionHeading>
          <Lead className="mt-5">
            Access is enforced on the server and scoped to each user. A person, a
            dashboard, a report, or an answer can never expose more than that user
            is authorized to see.
          </Lead>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {securityPoints.map((p, i) => (
            <Reveal key={p.title} delay={(i % 4) * 70}>
              <div className="h-full rounded-2xl border border-white/10 bg-night-800 p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-azure-500/15 text-azure-300">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M10 2 3 5v5c0 3.5 2.5 6.2 7 7 4.5-.8 7-3.5 7-7V5l-7-3Z" />
                  </svg>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-white">{p.title}</h3>
                <p className="mt-1.5 text-caption leading-relaxed text-white/55">
                  {p.copy}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
