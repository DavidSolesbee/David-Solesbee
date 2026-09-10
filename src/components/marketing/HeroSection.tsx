import * as React from "react";
import { Container } from "./primitives";
import { DashboardPreview } from "./DashboardPreview";

/**
 * Hero — product-first. Strong headline, clear value message, two CTAs, and a
 * premium dashboard preview. Login lives in the nav; the primary CTA requests a
 * demo, the secondary explores the platform sections below.
 */
export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-night-900 pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* ambient background: fine grid + soft azure glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #6f8bd1 1px, transparent 1px), linear-gradient(to bottom, #6f8bd1 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage:
              "radial-gradient(120% 80% at 50% 0%, #000 40%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(120% 80% at 50% 0%, #000 40%, transparent 75%)",
          }}
        />
        <div
          className="absolute -top-32 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, rgba(59,120,240,0.45), transparent)",
          }}
        />
      </div>

      <Container className="relative">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-caption font-medium text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-azure-400" />
            Your data. One view. Better decisions.
          </span>
          <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl">
            See your entire business{" "}
            <span className="bg-gradient-to-r from-azure-300 to-azure-500 bg-clip-text text-transparent">
              clearly
            </span>
            .
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-white/60 sm:text-xl">
            Connect your systems, eliminate fragmented reporting, and give every
            leader access to the information they need to make better decisions.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#request-demo"
              className="w-full rounded-lg bg-azure-500 px-6 py-3 text-center text-base font-semibold text-white shadow-[0_1px_0_0_rgba(255,255,255,0.15)_inset,0_12px_32px_-10px_rgba(59,120,240,0.7)] transition-colors hover:bg-azure-400 sm:w-auto"
            >
              Request a Demo
            </a>
            <a
              href="#platform"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-6 py-3 text-center text-base font-medium text-white transition-colors hover:bg-white/[0.07] sm:w-auto"
            >
              Explore the Platform
              <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 10h11M11 5l5 5-5 5" />
              </svg>
            </a>
          </div>
        </div>

        {/* dashboard preview */}
        <div className="relative mx-auto mt-14 max-w-5xl animate-fade-up sm:mt-16">
          <div
            aria-hidden
            className="absolute -inset-x-8 -top-6 bottom-0 rounded-[2rem] bg-azure-500/10 blur-2xl"
          />
          <div className="relative">
            <DashboardPreview />
          </div>
        </div>
      </Container>
    </section>
  );
}
