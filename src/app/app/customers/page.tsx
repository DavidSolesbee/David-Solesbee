import { guardModule } from "@/lib/auth/guards";
import { resolveScope, scopeLabel } from "@/lib/analytics/scope";
import { getCustomersModule } from "@/lib/analytics/modules";
import {
  ModuleHeader,
  KpiCard,
  YearBars,
  RankedList,
  Section,
} from "@/components/analytics/Primitives";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatNumber } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const user = await guardModule("module.customers");
  const scope = resolveScope(user);
  const data = getCustomersModule({
    access: {
      userId: user.id,
      tenantId: user.activeTenantId,
      platformViewAs: user.isViewingAs && user.isPlatformAdmin,
    },
    canContacts: scope.canViewContacts,
  });

  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Customers"
        subtitle="Customer base composition, engagement, and value."
        scopeLabel={scopeLabel(scope)}
        crossDept={scope.allDepartments}
      />

      {data.contactsMasked && (
        <StatusBadge intent="attention" dot>
          Customer identities are masked — contact-detail permission required
        </StatusBadge>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total Customers" value={formatNumber(data.total)} />
        <KpiCard label="Active (12 mo)" value={formatNumber(data.active12mo)} tone="revenue" />
        <KpiCard label="Business" value={formatNumber(data.business)} />
        <KpiCard label="Individual" value={formatNumber(data.individual)} />
      </div>

      <Section title="New customers by year" description="First-added customer records per year.">
        <YearBars data={data.newByYear} format="count" tone="service" />
      </Section>

      <Section title="Top customers by lifetime revenue" description="Highest posted invoice totals.">
        <RankedList
          items={data.topCustomers.map((c) => ({ label: c.name, value: c.revenue }))}
          format="currency"
          tone="revenue"
        />
      </Section>
    </div>
  );
}
