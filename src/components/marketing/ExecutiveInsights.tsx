import * as React from "react";
import { Container, Eyebrow, SectionHeading, Lead, Section, KpiCard } from "./primitives";
import { Reveal } from "./Reveal";
import { executiveKpis } from "@/lib/marketing/demoData";

/**
 * Executive intelligence — leadership KPIs at a glance.
 */
export function ExecutiveInsights() {
  return (
    <Section id="executive" tone="deep">
      <Container>
        <div className="max-w-2xl">
          <Eyebrow>Executive intelligence</Eyebrow>
          <SectionHeading className="mt-4">
            Know what needs your attention before the meeting starts.
          </SectionHeading>
          <Lead className="mt-5">
            The numbers leadership cares about — revenue, profitability, cash,
            forecast, and risk — consolidated and current, with the movement that
            matters surfaced automatically.
          </Lead>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {executiveKpis.map((k, i) => (
            <Reveal key={k.label} delay={(i % 4) * 70}>
              <KpiCard kpi={k} />
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}
