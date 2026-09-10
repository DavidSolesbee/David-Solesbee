import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { PerseusLogo, PerseusMark } from "@/components/brand/PerseusLogo";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { config } from "@/lib/config";

/* ---- Minimal inline glyphs (kept restrained per design direction) -------- */
type IconProps = { className?: string };
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
function IconObserve({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M4 18V9M10 18V5M16 18v-7M22 18H2" />
    </svg>
  );
}
function IconInvestigate({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
function IconUnderstand({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.2V16h6v-.3c0-.8.4-1.6 1-2.2A6 6 0 0 0 12 3Z" />
    </svg>
  );
}
function IconAct({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 1v3M12 20v3M1 12h3M20 12h3" />
    </svg>
  );
}
function IconSecurity({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M12 3 5 6v5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Z" />
      <path d="M9.5 12.5 11.5 14.5 15 10.5" />
    </svg>
  );
}
function IconRoles({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="18" cy="9" r="2.2" />
      <path d="M16 20c0-2.2 1-4 3-4.6" />
    </svg>
  );
}
function IconReporting({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}
function IconAI({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" />
    </svg>
  );
}
function IconImpact({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M4 19h16M6 19v-6M11 19V8M16 19v-9" />
      <path d="m5 10 4-4 3 2 5-5" />
    </svg>
  );
}

const journey = [
  { step: "OBSERVE", copy: "See what is happening.", Icon: IconObserve },
  { step: "INVESTIGATE", copy: "Explore the details.", Icon: IconInvestigate },
  { step: "UNDERSTAND", copy: "Find the story.", Icon: IconUnderstand },
  { step: "ACT", copy: "Make better decisions.", Icon: IconAct },
];

const pillars = [
  {
    title: "Security First",
    copy: "Approval-only access, role-based permissions, and data protection at every level.",
    Icon: IconSecurity,
  },
  {
    title: "Role-Based Experience",
    copy: "A personalized dashboard for every dealership leader, shaped by their role.",
    Icon: IconRoles,
  },
  {
    title: "Automated Reporting",
    copy: "Scheduled reports delivered to the right people, at the right time.",
    Icon: IconReporting,
  },
  {
    title: "AI Insights",
    copy: "Plain-English analysis to help you understand what changed and why.",
    Icon: IconAI,
  },
  {
    title: "Real Business Impact",
    copy: "Turn data into clarity, and clarity into action.",
    Icon: IconImpact,
  },
];

const valueProps = [
  ["Schedule automatically", "Daily, weekly, or monthly."],
  ["Send to the right people", "Based on role and permissions."],
  ["Multiple report types", "Executive, Sales, Parts, Service, and more."],
  ["Filter & customize", "Dates, locations, departments, metrics."],
  ["Set it and forget it", "Reliable delivery to each user's login email."],
];

export default function HomePage() {
  return (
    <AppShell active="home">
      <div className="space-y-16">
        {/* Hero — premium dark summit panel, echoing the brand poster */}
        <section className="relative overflow-hidden rounded-2xl bg-forest-700 px-8 py-14 text-surface shadow-card-hover sm:px-14 sm:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.14]"
            style={{
              background:
                "radial-gradient(120% 90% at 80% 0%, #ffffff 0%, transparent 55%)",
            }}
          />
          <div className="relative">
            <PerseusLogo size={40} tone="inverse" />
            <h1 className="mt-10 max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              {config.brand.promise}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-sage-100/90">
              A secure, role-aware analytics and automated reporting platform
              that helps dealership leaders see what changed, why, and what
              deserves their attention.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/login">
                <Button
                  size="lg"
                  className="bg-surface text-forest-700 hover:bg-sage-50"
                >
                  Sign In
                </Button>
              </Link>
              <Link href="/data-discovery">
                <Button
                  size="lg"
                  variant="secondary"
                  className="border-white/25 bg-white/10 text-surface hover:bg-white/20"
                >
                  Explore the data foundation
                </Button>
              </Link>
              <Link href="/design">
                <Button
                  size="lg"
                  variant="secondary"
                  className="border-white/25 bg-white/10 text-surface hover:bg-white/20"
                >
                  View the design system
                </Button>
              </Link>
            </div>
            <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 text-caption font-medium uppercase tracking-[0.28em] text-sage-100/80">
              <span>People</span>
              <span className="text-sage-300">·</span>
              <span>Insights</span>
              <span className="text-sage-300">·</span>
              <span>Performance</span>
              <span className="text-sage-300">·</span>
              <span>Together</span>
            </div>
          </div>
        </section>

        {/* Journey row: OBSERVE → INVESTIGATE → UNDERSTAND → ACT */}
        <section>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
            <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {journey.map(({ step, copy, Icon }) => (
                <Card key={step} className="p-5">
                  <Icon className="h-6 w-6 text-forest-500" />
                  <div className="mt-4 text-sm font-semibold uppercase tracking-wide text-ink">
                    {step}
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">{copy}</p>
                </Card>
              ))}
            </div>
            <Card className="flex flex-col justify-center bg-surface-tinted p-6 lg:w-64">
              <span className="text-caption font-semibold uppercase tracking-[0.25em] text-ink-faint">
                Built for
              </span>
              <span className="mt-2 text-xl font-semibold text-ink">
                Dealership Leaders
              </span>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <StatusBadge intent="positive" dot={false}>
                  Secure
                </StatusBadge>
                <StatusBadge intent="info" dot={false}>
                  Intuitive
                </StatusBadge>
                <StatusBadge intent="attention" dot={false}>
                  Actionable
                </StatusBadge>
              </div>
            </Card>
          </div>
        </section>

        {/* Why Perseus — the five pillars */}
        <section>
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-ink">
                Why Perseus
              </h2>
              <p className="mt-1 text-ink-soft">
                {config.brand.tagline}
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pillars.map(({ title, copy, Icon }) => (
              <Card key={title} className="p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sage-50 text-forest-600">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-ink">
                  {title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                  {copy}
                </p>
              </Card>
            ))}
          </div>
        </section>

        {/* Foundation status — milestone honesty */}
        <section>
          <Card className="p-8">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge intent="positive">
                Milestone 1 — Foundation, Brand &amp; Data
              </StatusBadge>
              <span className="text-caption text-ink-faint">
                Milestone-gated build · later stages add auth, dashboards,
                reporting, and AI
              </span>
            </div>
            <h2 className="mt-4 text-xl font-semibold text-ink">
              What is in place today
            </h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                "Read-only dealership data layer (43 tables, opened read-only)",
                "Separate application store for Perseus configuration & security",
                "Semantic metric layer with validated definitions",
                "Perseus brand, logo marks, and design system",
                "Data discovery documentation & limitations",
                "Calm, premium application shell",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm text-ink"
                >
                  <span className="mt-0.5 text-sage-600">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* Value strip — automated reporting promise (future milestone preview) */}
        <section className="rounded-2xl border border-line bg-surface-tinted px-6 py-8">
          <div className="mb-6 flex items-center gap-3">
            <PerseusMark size={22} />
            <span className="text-caption font-semibold uppercase tracking-[0.25em] text-ink-faint">
              The Perseus promise
            </span>
          </div>
          <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-5">
            {valueProps.map(([title, copy]) => (
              <div key={title}>
                <h4 className="text-sm font-semibold text-ink">{title}</h4>
                <p className="mt-1 text-caption leading-relaxed text-ink-soft">
                  {copy}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
