import * as React from "react";
import { Container, Eyebrow, SectionHeading, Lead, Section } from "./primitives";
import { Reveal } from "./Reveal";
import { customerStories } from "@/lib/marketing/demoData";

/**
 * Customer stories — polished cards using fictional demonstration organizations.
 */
export function CustomerStories() {
  return (
    <Section id="customers" tone="base">
      <Container>
        <div className="max-w-2xl">
          <Eyebrow>Customer stories</Eyebrow>
          <SectionHeading className="mt-4">
            From fragmented reports to shared clarity.
          </SectionHeading>
          <Lead className="mt-5">
            How organizations use Solesbee Analytics to bring leadership onto the
            same numbers.
          </Lead>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {customerStories.map((s, i) => (
            <Reveal key={s.org} delay={i * 90}>
              <article className="flex h-full flex-col rounded-2xl border border-white/10 bg-night-800 p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-azure-500/15 text-sm font-semibold text-azure-200">
                    {s.initials}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-white">{s.org}</div>
                    <div className="text-caption text-white/45">
                      {s.industry} · {s.locations}
                    </div>
                  </div>
                </div>

                <dl className="mt-5 space-y-4">
                  <div>
                    <dt className="text-caption font-semibold uppercase tracking-wide text-white/35">
                      Challenge
                    </dt>
                    <dd className="mt-1 text-sm text-white/65">{s.challenge}</dd>
                  </div>
                  <div>
                    <dt className="text-caption font-semibold uppercase tracking-wide text-white/35">
                      Result
                    </dt>
                    <dd className="mt-1 text-sm text-white/65">{s.result}</dd>
                  </div>
                </dl>

                {s.quote && (
                  <blockquote className="mt-auto border-l-2 border-azure-500/50 pl-4 pt-5 text-sm italic text-white/75">
                    “{s.quote}”
                  </blockquote>
                )}
              </article>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 text-[11px] text-white/25">
          Stories depict illustrative demonstration organizations.
        </p>
      </Container>
    </Section>
  );
}
