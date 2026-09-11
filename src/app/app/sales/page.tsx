import { guardModule } from "@/lib/auth/guards";
import { resolveScope, scopeLabel } from "@/lib/analytics/scope";
import { getSalesModule } from "@/lib/analytics/modules";
import {
  ModuleHeader,
  KpiCard,
  YearBars,
  RankedList,
  Section,
} from "@/components/analytics/Primitives";
import { formatCurrency, formatNumber } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const user = await guardModule("module.sales");
  const scope = resolveScope(user);
  const data = getSalesModule({
    access: {
      userId: user.id,
      tenantId: user.activeTenantId,
      platformViewAs: user.isViewingAs && user.isPlatformAdmin,
    },
    canCost: scope.canViewCost,
    canMargin: scope.canViewMargin,
  });

  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Sales"
        subtitle="Equipment unit sales, rentals, and salesperson performance."
        scopeLabel={scopeLabel(scope)}
        crossDept={scope.allDepartments}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Unit Sales Revenue" value={formatCurrency(data.unitRevenue)} tone="revenue" />
        <KpiCard label="Units Sold" value={formatNumber(data.unitsSold)} />
        <KpiCard label="Avg Unit Price" value={formatCurrency(data.avgUnitPrice)} />
        <KpiCard label="Rental Revenue" value={formatCurrency(data.rentalRevenue)} tone="service" />
        {data.unitCost !== null && (
          <KpiCard label="Unit Cost" value={formatCurrency(data.unitCost)} tone="cost" />
        )}
        {data.unitMargin !== null && (
          <KpiCard
            label="Gross Margin"
            value={formatCurrency(data.unitMargin)}
            tone="margin"
            sublabel={
              data.unitRevenue
                ? `${((data.unitMargin / data.unitRevenue) * 100).toFixed(1)}% of revenue`
                : undefined
            }
          />
        )}
      </div>

      <Section title="Unit sales by year" description="Posted unit-sale revenue.">
        <YearBars data={data.byYear} format="currency" tone="revenue" />
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Top categories" description="Unit-sale revenue by equipment category.">
          <RankedList items={data.topCategories} format="currency" tone="revenue" />
        </Section>
        <Section title="Salesperson performance" description="Unit-sale revenue by salesperson.">
          <RankedList items={data.topSalespeople} format="currency" tone="neutral" />
        </Section>
      </div>
    </div>
  );
}
