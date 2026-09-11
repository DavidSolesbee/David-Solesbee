import { AppShell } from "@/components/shell/AppShell";
import { PerseusMark, PerseusLogo } from "@/components/brand/PerseusLogo";
import { SolesbeeLogo, SolesbeeMark } from "@/components/brand/SolesbeeLogo";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Field } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Stat } from "@/components/ui/Stat";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { Tooltip } from "@/components/ui/Tooltip";
import { EmptyState, Skeleton, KpiSkeleton } from "@/components/ui/States";
import { BarChart } from "@/components/charts/BarChart";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-ink-soft">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

const swatches: Array<{ name: string; className: string; hex: string }> = [
  { name: "Canvas", className: "bg-canvas border border-line", hex: "#F4F6F9" },
  { name: "Surface", className: "bg-surface border border-line", hex: "#FFFFFF" },
  { name: "Ink / Navy", className: "bg-ink", hex: "#0B1F44" },
  { name: "Ink Soft", className: "bg-ink-soft", hex: "#5B6578" },
  { name: "Electric Blue", className: "bg-sage-500", hex: "#1E6BFF" },
  { name: "Navy", className: "bg-forest-500", hex: "#0B1F44" },
  { name: "Amber", className: "bg-amber-500", hex: "#C98A2B" },
  { name: "Terracotta", className: "bg-terracotta-500", hex: "#C0684A" },
  { name: "Silver Blue", className: "bg-warm-blue-500", hex: "#4E7A9B" },
];

export default function DesignPage() {
  return (
    <AppShell active="design">
      <div className="space-y-14">
        <header>
          <StatusBadge intent="positive">Design System</StatusBadge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">
            Perseus Design Reference
          </h1>
          <p className="mt-2 max-w-2xl text-ink-soft">
            Cool, minimal, spacious, premium. Navy, electric blue, and silver
            from the Solesbee Analytics lockup.
          </p>
        </header>

        <Section title="Brand marks" description="Primary logo, compact icon, and tones.">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-10">
              <div className="flex flex-col items-center gap-3">
                <SolesbeeLogo size={40} tone="light" />
                <span className="text-caption text-ink-faint">Solesbee lockup</span>
              </div>
              <div className="flex flex-col items-center gap-3">
                <SolesbeeMark size={48} />
                <span className="text-caption text-ink-faint">Solesbee mark</span>
              </div>
              <div className="flex flex-col items-center gap-3">
                <PerseusLogo size={40} />
                <span className="text-caption text-ink-faint">Perseus lockup</span>
              </div>
              <div className="flex flex-col items-center gap-3">
                <PerseusMark size={48} />
                <span className="text-caption text-ink-faint">Compact icon</span>
              </div>
              <div className="flex flex-col items-center gap-3 rounded-xl bg-ink px-8 py-6">
                <PerseusLogo size={36} tone="inverse" />
                <span className="text-caption text-line">Inverse</span>
              </div>
              <div className="flex items-end gap-3">
                <PerseusMark size={16} />
                <PerseusMark size={24} />
                <PerseusMark size={32} />
                <PerseusMark size={48} />
              </div>
            </CardContent>
          </Card>
        </Section>

        <Section title="Color" description="Cool neutrals with navy and electric blue. No neon, no rainbow.">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {swatches.map((s) => (
              <div key={s.name}>
                <div className={`h-16 w-full rounded-lg ${s.className} shadow-subtle`} />
                <div className="mt-2 text-sm font-medium text-ink">{s.name}</div>
                <div className="text-caption text-ink-faint">{s.hex}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Typography" description="Quiet, highly readable type scale.">
          <Card>
            <CardContent className="space-y-3">
              <p className="text-4xl font-semibold tracking-tight text-ink">
                Display · Dealerships with Direction
              </p>
              <p className="text-2xl font-semibold text-ink">Heading · Business Pulse</p>
              <p className="text-lg text-ink">Subheading · What deserves my attention?</p>
              <p className="text-base text-ink">
                Body · Revenue increased compared with the previous period,
                primarily due to service activity.
              </p>
              <p className="text-sm text-ink-soft">
                Secondary · Supporting detail in soft gray.
              </p>
              <p className="text-caption uppercase tracking-wide text-ink-faint">
                Caption · Metric label
              </p>
            </CardContent>
          </Card>
        </Section>

        <Section title="Buttons">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button disabled>Disabled</Button>
              <Button size="sm">Small</Button>
              <Button size="lg">Large</Button>
            </CardContent>
          </Card>
        </Section>

        <Section title="Inputs">
          <Card>
            <CardContent className="grid max-w-xl gap-4 sm:grid-cols-2">
              <Field label="Business email" hint="Your login identity.">
                <Input type="email" placeholder="name@dealership.com" />
              </Field>
              <Field label="Location">
                <Select defaultValue="">
                  <option value="" disabled>
                    Select location
                  </option>
                  <option>Main Location</option>
                </Select>
              </Field>
            </CardContent>
          </Card>
        </Section>

        <Section title="KPI cards" description="Every KPI can explain its own calculation.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Total Revenue"
              value="$1.28M"
              delta={{ value: "12% vs. last period", direction: "up" }}
              explanation="Sum of TotalInvoice on finalized and archived invoices."
            />
            <Stat
              label="Invoices"
              value="247"
              delta={{ value: "8%", direction: "up" }}
              explanation="Count of posted invoices in the period."
            />
            <Stat
              label="Avg Invoice"
              value="$5,202"
              delta={{ value: "flat", direction: "flat" }}
              explanation="Posted revenue divided by invoice count."
            />
          </div>
        </Section>

        <Section title="Status badges">
          <Card>
            <CardContent className="flex flex-wrap gap-3">
              <StatusBadge intent="positive">Active</StatusBadge>
              <StatusBadge intent="attention">Pending</StatusBadge>
              <StatusBadge intent="critical">Suspended</StatusBadge>
              <StatusBadge intent="info">Preview</StatusBadge>
              <StatusBadge intent="neutral">Archived</StatusBadge>
            </CardContent>
          </Card>
        </Section>

        <Section title="Table">
          <Card>
            <CardContent className="pt-2">
              <Table>
                <THead>
                  <TR>
                    <TH>Customer</TH>
                    <TH className="text-right">Revenue</TH>
                    <TH className="text-right">Invoices</TH>
                    <TH>Trend</TH>
                  </TR>
                </THead>
                <TBody>
                  {[
                    ["Anderson Farms", "$142,320", "38", "positive"],
                    ["Ridgeview Ag", "$98,450", "27", "positive"],
                    ["Carter Equipment", "$57,210", "19", "neutral"],
                    ["Larkin Construction", "$76,540", "22", "critical"],
                  ].map((r) => (
                    <TR key={r[0]}>
                      <TD className="font-medium">{r[0]}</TD>
                      <TD className="text-right tabular-nums">{r[1]}</TD>
                      <TD className="text-right tabular-nums">{r[2]}</TD>
                      <TD>
                        <StatusBadge intent={r[3] as "positive" | "neutral" | "critical"}>
                          {r[3] === "positive" ? "Growing" : r[3] === "critical" ? "Declining" : "Stable"}
                        </StatusBadge>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </Section>

        <Section title="Chart styling" description="Single-hued, calm, gridless.">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
              <CardDescription>Sample monthly figures</CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart
                data={[
                  { label: "May", value: 820 },
                  { label: "Jun", value: 910 },
                  { label: "Jul", value: 760 },
                  { label: "Aug", value: 1040 },
                  { label: "Sep", value: 980 },
                  { label: "Oct", value: 1280 },
                ]}
                format={(n) => `$${n}k`}
              />
            </CardContent>
          </Card>
        </Section>

        <Section title="Tooltips">
          <Card>
            <CardContent className="flex items-center gap-3">
              <Tooltip content="Security always overrides filters and configuration.">
                <Button variant="secondary">Hover me</Button>
              </Tooltip>
              <span className="text-sm text-ink-soft">
                Used to explain calculations and security behavior.
              </span>
            </CardContent>
          </Card>
        </Section>

        <Section title="Empty & loading states">
          <div className="grid gap-6 lg:grid-cols-2">
            <EmptyState
              title="No findings right now"
              description="Business Pulse surfaces items that deserve attention. Nothing needs your attention at the moment."
              icon={<span className="text-lg">✳</span>}
              action={<Button variant="secondary" size="sm">Refresh</Button>}
            />
            <Card>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <KpiSkeleton />
                  <KpiSkeleton />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
