import { guardModule } from "@/lib/auth/guards";
import { resolveScope, scopeLabel } from "@/lib/analytics/scope";
import { getPartsModule } from "@/lib/analytics/modules";
import {
  ModuleHeader,
  KpiCard,
  YearBars,
  RankedList,
  Section,
} from "@/components/analytics/Primitives";
import { formatCurrency, formatNumber } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function PartsPage() {
  const user = await guardModule("module.parts");
  const scope = resolveScope(user);
  const data = getPartsModule({ canCost: scope.canViewCost, canMargin: scope.canViewMargin });

  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Parts"
        subtitle="Parts counter sales, top movers, and manufacturer mix."
        scopeLabel={scopeLabel(scope)}
        crossDept={scope.allDepartments}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Parts Revenue" value={formatCurrency(data.revenue)} tone="revenue" />
        <KpiCard label="Lines Sold" value={formatNumber(data.lines)} />
        <KpiCard label="Units (Qty)" value={formatNumber(data.qty)} />
        {data.cost !== null && (
          <KpiCard label="Parts Cost" value={formatCurrency(data.cost)} tone="cost" />
        )}
        {data.margin !== null && (
          <KpiCard
            label="Gross Margin"
            value={formatCurrency(data.margin)}
            tone="margin"
            sublabel={
              data.revenue ? `${((data.margin / data.revenue) * 100).toFixed(1)}% of revenue` : undefined
            }
          />
        )}
      </div>

      <Section title="Parts revenue by year" description="Posted parts-line revenue.">
        <YearBars data={data.byYear} format="currency" tone="revenue" />
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Top manufacturers" description="Parts revenue by manufacturer.">
          <RankedList items={data.topManufacturers} format="currency" tone="revenue" />
        </Section>
        <Section title="Top parts" description="Highest-revenue part numbers.">
          <RankedList items={data.topParts} format="currency" tone="neutral" />
        </Section>
      </div>
    </div>
  );
}
