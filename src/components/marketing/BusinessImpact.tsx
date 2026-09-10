import * as React from "react";
import { Container } from "./primitives";
import { Reveal } from "./Reveal";
import { impactStats } from "@/lib/marketing/demoData";

/**
 * Business impact — illustrative marketing statistics (fictional demo data).
 */
export function BusinessImpact() {
  return (
    <section className="border-y border-white/[0.06] bg-night-950 py-16 sm:py-20">
      <Container>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {impactStats.map((s, i) => (
            <Reveal key={s.label} delay={i * 80}>
              <div className="text-center sm:text-left">
                <div className="bg-gradient-to-r from-white to-azure-300 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl">
                  {s.value}
                </div>
                <div className="mt-2 text-sm text-white/55">{s.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-10 text-center text-[11px] text-white/25 sm:text-left">
          Illustrative demonstration figures. Not verified customer results.
        </p>
      </Container>
    </section>
  );
}
