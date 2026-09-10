import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { SolesbeeLogo } from "@/components/brand/SolesbeeLogo";
import {
  Container,
  Eyebrow,
  SectionHeading,
  Lead,
  Section,
} from "@/components/marketing/primitives";
import { Reveal } from "@/components/marketing/Reveal";

export const metadata: Metadata = {
  title: "Our Story — Solesbee Analytics",
  description:
    "Solesbee Analytics was built from the operational side of business — to make business information easier to understand.",
};

const beliefs: { title: string; copy: string }[] = [
  {
    title: "Start with the operator",
    copy: "The best analytics come from understanding how a business actually runs, not just how its data is stored.",
  },
  {
    title: "One version of the truth",
    copy: "Leadership should look at the same numbers at the same time — consolidated, consistent, and current.",
  },
  {
    title: "Security is the foundation",
    copy: "People see only what their role permits. Clarity should never come at the cost of control.",
  },
  {
    title: "Clarity over clutter",
    copy: "Turn scattered data into a small number of decisions that actually move the business.",
  },
];

/**
 * Public "Our Story" page. Linked from the homepage founder section. Uses the
 * same dark marketing shell; no client data. Narrative kept to the provided
 * company story with no fabricated achievements.
 */
export default function AboutPage() {
  return (
    <div className="min-h-screen bg-night-950 text-white antialiased">
      <MarketingNav />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-night-900 pt-32 pb-16 sm:pt-40 sm:pb-20">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(59,120,240,0.4), transparent)",
            }}
          />
          <Container className="relative">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-8 flex justify-center">
                <SolesbeeLogo size={40} tone="dark" />
              </div>
              <Eyebrow className="justify-center">Our story</Eyebrow>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Built from the operational side of business.
              </h1>
              <Lead className="mx-auto mt-6 max-w-2xl">
                Solesbee Analytics began with a simple observation: businesses are
                full of data, but starved of clear information.
              </Lead>
            </div>
          </Container>
        </section>

        {/* Narrative + photo */}
        <Section tone="base">
          <Container>
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <Reveal>
                <div className="space-y-4 text-white/65">
                  <p>
                    Founder David Solesbee spent nearly two decades working with
                    businesses, technology platforms, operational teams, and
                    complex reporting environments.
                  </p>
                  <p>
                    Again and again he met companies that had enormous amounts of
                    data but struggled to turn it into useful information. The
                    answers were there — buried across CRMs, ERPs, accounting
                    systems, and an endless trail of spreadsheets.
                  </p>
                  <p>
                    Leaders were spending their time assembling reports instead of
                    acting on them. Every department had its own version of the
                    numbers, and no one was quite sure which one to trust.
                  </p>
                  <p>
                    Solesbee Analytics started with simple reporting tools,
                    exported datasets, and a single goal:{" "}
                    <span className="text-white/90">
                      make business information easier to understand.
                    </span>{" "}
                    That goal still drives everything we build.
                  </p>
                </div>
              </Reveal>

              <Reveal delay={120}>
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
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night-950/70 via-transparent to-transparent" />
                    <figcaption className="absolute inset-x-0 bottom-0 p-5">
                      <div className="text-sm font-semibold text-white">
                        David Solesbee
                      </div>
                      <div className="text-caption text-white/60">
                        Founder, Solesbee Analytics
                      </div>
                    </figcaption>
                  </div>
                </figure>
              </Reveal>
            </div>
          </Container>
        </Section>

        {/* What we believe */}
        <Section tone="raised">
          <Container>
            <div className="max-w-2xl">
              <Eyebrow>What we believe</Eyebrow>
              <SectionHeading className="mt-4">
                Principles behind the platform.
              </SectionHeading>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {beliefs.map((b, i) => (
                <Reveal key={b.title} delay={(i % 2) * 80}>
                  <div className="h-full rounded-2xl border border-white/10 bg-night-800 p-6">
                    <h3 className="text-base font-semibold text-white">
                      {b.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/60">
                      {b.copy}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </Container>
        </Section>

        {/* CTA */}
        <Section tone="base">
          <Container>
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-night-800 to-night-850 px-6 py-14 text-center sm:px-12">
              <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                See what Solesbee Analytics can do for your business.
              </h2>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <a
                  href="mailto:demo@solesbeeanalytics.com?subject=Solesbee%20Analytics%20Demo%20Request"
                  className="w-full rounded-lg bg-azure-500 px-7 py-3 text-base font-semibold text-white transition-colors hover:bg-azure-400 sm:w-auto"
                >
                  Request a Demo
                </a>
                <Link
                  href="/"
                  className="w-full rounded-lg border border-white/15 bg-white/[0.03] px-7 py-3 text-base font-medium text-white transition-colors hover:bg-white/[0.07] sm:w-auto"
                >
                  Back to Home
                </Link>
              </div>
            </div>
          </Container>
        </Section>
      </main>
      <MarketingFooter />
    </div>
  );
}
