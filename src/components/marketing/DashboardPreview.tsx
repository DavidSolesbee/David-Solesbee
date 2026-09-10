import * as React from "react";
import {
  heroKpis,
  heroRevenueSeries,
  heroRevenueMonths,
  heroChannelMix,
} from "@/lib/marketing/demoData";
import { DeltaPill, Donut, MiniBars } from "./primitives";
import { SolesbeeMark } from "@/components/brand/SolesbeeLogo";

/**
 * A believable, self-contained preview of the Solesbee Analytics product,
 * rendered as an app window with realistic FICTIONAL demo data. Pure markup +
 * SVG — no screenshots, no external requests.
 */
export function DashboardPreview() {
  const nav = ["Overview", "Sales", "Financial", "Inventory", "Operations", "Forecast"];
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-night-800 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.8)]">
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.02] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <div className="ml-3 flex items-center gap-2 rounded-md bg-white/[0.04] px-2.5 py-1 text-caption text-white/40">
          <SolesbeeMark size={14} />
          app.solesbeeanalytics.com
        </div>
        <div className="ml-auto hidden items-center gap-1.5 text-caption text-white/40 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-signal-up" />
          Live · All Locations
        </div>
      </div>

      <div className="flex">
        {/* sidebar */}
        <aside className="hidden w-44 shrink-0 border-r border-white/10 p-3 md:block">
          <div className="px-2 pb-2 text-caption uppercase tracking-widest text-white/30">
            Executive
          </div>
          {nav.map((n, i) => (
            <div
              key={n}
              className={
                "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm " +
                (i === 0 ? "bg-azure-500/15 text-white" : "text-white/55")
              }
            >
              <span
                className={
                  "h-1.5 w-1.5 rounded-full " +
                  (i === 0 ? "bg-azure-400" : "bg-white/20")
                }
              />
              {n}
            </div>
          ))}
        </aside>

        {/* main */}
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-white">Executive Overview</div>
              <div className="text-caption text-white/40">Trailing 12 months · consolidated</div>
            </div>
            <div className="rounded-md border border-white/10 px-2.5 py-1 text-caption text-white/50">
              FY 2026
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {heroKpis.map((k) => (
              <div key={k.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="text-caption text-white/45">{k.label}</div>
                <div className="mt-1 text-lg font-semibold text-white">{k.value}</div>
                <DeltaPill delta={k.delta} direction={k.direction} className="mt-1.5" />
              </div>
            ))}
          </div>

          {/* charts */}
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-white/80">Revenue</span>
                <DeltaPill delta="+12.4%" direction="up" />
              </div>
              <div className="h-28">
                <MiniBars values={heroRevenueSeries} />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-white/30">
                {heroRevenueMonths.map((m, i) => (
                  <span key={i}>{m}</span>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-2 text-sm font-medium text-white/80">Channel mix</div>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Donut segments={heroChannelMix} size={104} thickness={13} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-sm font-semibold text-white">$48.2M</span>
                    <span className="text-[10px] text-white/40">total</span>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {heroChannelMix.map((s) => (
                    <li key={s.label} className="flex items-center gap-2 text-caption text-white/60">
                      <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                      {s.label}
                      <span className="ml-auto text-white/40">{s.value}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
