import * as React from "react";
import Link from "next/link";
import { Container } from "./primitives";

/**
 * Closing conversion section. Primary action requests a demo; the secondary
 * action routes existing clients to the real login (/login).
 */
export function FinalCTA() {
  return (
    <section id="request-demo" className="scroll-mt-24 bg-night-900 py-24 sm:py-32">
      <Container>
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-night-800 to-night-850 px-6 py-16 text-center sm:px-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-64 w-[680px] rounded-full opacity-50 blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, rgba(59,120,240,0.45), transparent)",
            }}
          />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              Your business already has the answers.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/60">
              Solesbee Analytics helps you find them.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="mailto:demo@solesbeeanalytics.com?subject=Solesbee%20Analytics%20Demo%20Request"
                className="w-full rounded-lg bg-azure-500 px-7 py-3 text-base font-semibold text-white shadow-[0_1px_0_0_rgba(255,255,255,0.15)_inset,0_12px_32px_-10px_rgba(59,120,240,0.7)] transition-colors hover:bg-azure-400 sm:w-auto"
              >
                Request a Demo
              </a>
              <Link
                href="/login"
                className="w-full rounded-lg border border-white/15 bg-white/[0.03] px-7 py-3 text-base font-medium text-white transition-colors hover:bg-white/[0.07] sm:w-auto"
              >
                Client Login
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
