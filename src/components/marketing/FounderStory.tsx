import * as React from "react";
import Image from "next/image";
import { Container, Eyebrow, SectionHeading, Section } from "./primitives";
import { Reveal } from "./Reveal";

/**
 * Condensed company / founder story. Photo lives in /public.
 */
export function FounderStory() {
  return (
    <Section id="company" tone="deep">
      <Container>
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <Reveal className="order-2 lg:order-1">
            <Eyebrow>Our story</Eyebrow>
            <SectionHeading className="mt-4">
              Built from the operational side of business.
            </SectionHeading>
            <div className="mt-5 space-y-4 text-white/60">
              <p>
                Founder David Solesbee spent nearly two decades working with
                businesses, technology platforms, operational teams, and complex
                reporting environments.
              </p>
              <p>
                Again and again he met companies that had enormous amounts of
                data but struggled to turn it into useful information — the
                answers were there, buried across systems and spreadsheets.
              </p>
              <p>
                Solesbee Analytics began with simple reporting tools, exported
                datasets, and a single goal:{" "}
                <span className="text-white/85">
                  make business information easier to understand.
                </span>
              </p>
            </div>
            <a
              href="#request-demo"
              className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-azure-300 hover:text-azure-200"
            >
              Read Our Story
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 10h11M11 5l5 5-5 5" />
              </svg>
            </a>
          </Reveal>

          <Reveal delay={120} className="order-1 lg:order-2">
            <figure className="relative mx-auto max-w-md">
              <div
                aria-hidden
                className="absolute -inset-4 rounded-[2rem] bg-azure-500/10 blur-2xl"
              />
              <div className="relative overflow-hidden rounded-2xl border border-white/10">
                <Image
                  src="/founder-david-solesbee.jpg"
                  alt="David Solesbee, founder of Solesbee Analytics"
                  width={819}
                  height={1024}
                  className="h-full w-full object-cover"
                  sizes="(max-width: 1024px) 100vw, 448px"
                  priority={false}
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night-950/70 via-transparent to-transparent" />
                <figcaption className="absolute inset-x-0 bottom-0 p-5">
                  <div className="text-sm font-semibold text-white">David Solesbee</div>
                  <div className="text-caption text-white/60">Founder, Solesbee Analytics</div>
                </figcaption>
              </div>
            </figure>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
