"use client";

import * as React from "react";
import { Container, Eyebrow, SectionHeading, Lead, DeltaPill, MiniBars } from "./primitives";
import { platformTabs } from "@/lib/marketing/demoData";

/**
 * Interactive product tour. Tabs switch between product areas with live-updating
 * KPIs and a chart — communicating that the product is interactive, not static
 * screenshots. Keyboard-accessible tablist.
 */
export function PlatformOverview() {
  const [active, setActive] = React.useState(0);
  const tab = platformTabs[active];
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = (active + dir + platformTabs.length) % platformTabs.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section id="platform" className="scroll-mt-24 bg-night-900 py-20 sm:py-28">
      <Container>
        <div className="max-w-2xl">
          <Eyebrow>The platform</Eyebrow>
          <SectionHeading className="mt-4">
            One platform. Every part of the business.
          </SectionHeading>
          <Lead className="mt-5">
            Move from the executive summary down to the detail — across sales,
            finance, inventory, operations, customers, and the forecast.
          </Lead>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Platform areas"
          onKeyDown={onKeyDown}
          className="mt-9 flex flex-wrap gap-2"
        >
          {platformTabs.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`ptab-${t.id}`}
              aria-selected={i === active}
              aria-controls={`ppanel-${t.id}`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
              className={
                "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors " +
                (i === active
                  ? "bg-azure-500 text-white"
                  : "border border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.07] hover:text-white")
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Panel */}
        <div
          role="tabpanel"
          id={`ppanel-${tab.id}`}
          aria-labelledby={`ptab-${tab.id}`}
          className="mt-6 grid gap-6 rounded-2xl border border-white/10 bg-night-800 p-6 sm:p-8 lg:grid-cols-5"
        >
          <div className="lg:col-span-2">
            <h3 className="text-xl font-semibold text-white">{tab.headline}</h3>
            <p className="mt-3 text-white/60">{tab.description}</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {tab.kpis.map((k) => (
                <div key={k.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-caption text-white/45">{k.label}</div>
                  <div className="mt-1 text-lg font-semibold text-white">{k.value}</div>
                  <DeltaPill delta={k.delta} direction={k.direction} className="mt-1.5" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-medium text-white/80">{tab.seriesLabel}</span>
              <span className="text-caption text-white/40">Trailing 12 months</span>
            </div>
            <div className="h-48">
              <MiniBars key={tab.id} values={tab.series} />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
