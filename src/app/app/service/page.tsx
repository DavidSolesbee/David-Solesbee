import { guardModule } from "@/lib/auth/guards";
import { resolveScope, scopeLabel } from "@/lib/analytics/scope";
import { getServiceModule } from "@/lib/analytics/modules";
import {
  ModuleHeader,
  KpiCard,
  YearBars,
  RankedList,
  Section,
} from "@/components/analytics/Primitives";
import { EmptyState } from "@/components/ui/States";
import { formatCurrency, formatNumber, formatHours } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function ServicePage() {
  const user = await guardModule("module.service");
  const scope = resolveScope(user);
  const data = getServiceModule({ canTechnician: scope.canViewTechnician });

  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Service"
        subtitle="Work orders, shop throughput, and technician performance."
        scopeLabel={scopeLabel(scope)}
        crossDept={scope.allDepartments}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Labor Revenue" value={formatCurrency(data.laborRevenue)} tone="revenue" />
        <KpiCard label="Work Orders" value={formatNumber(data.workOrders)} />
        <KpiCard label="Open Work Orders" value={formatNumber(data.openWorkOrders)} tone="service" />
        {data.laborHours !== null && (
          <KpiCard label="Technician Hours" value={formatHours(data.laborHours)} tone="cost" />
        )}
      </div>

      <Section title="Labor revenue by year" description="Posted service-labor revenue.">
        <YearBars data={data.byYear} format="currency" tone="revenue" />
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Open work orders by status" description="Current shop pipeline.">
          <RankedList items={data.statusBreakdown} format="count" tone="service" />
        </Section>
        <Section
          title="Technician performance"
          description="Logged labor hours by technician."
        >
          {data.topTechnicians ? (
            <RankedList items={data.topTechnicians} format="hours" tone="neutral" />
          ) : (
            <EmptyState
              title="Restricted"
              description="Technician performance requires additional permission."
            />
          )}
        </Section>
      </div>
    </div>
  );
}
