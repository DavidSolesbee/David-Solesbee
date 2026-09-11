import { guardModule } from "@/lib/auth/guards";
import { resolveScope, scopeLabel } from "@/lib/analytics/scope";
import { getInventoryModule } from "@/lib/analytics/modules";
import {
  ModuleHeader,
  KpiCard,
  RankedList,
  Section,
} from "@/components/analytics/Primitives";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { formatCurrency, formatNumber } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const user = await guardModule("module.inventory");
  const scope = resolveScope(user);
  const data = getInventoryModule({
    access: {
      userId: user.id,
      tenantId: user.activeTenantId,
      platformViewAs: user.isViewingAs && user.isPlatformAdmin,
    },
    canCost: scope.canViewCost,
  });

  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Inventory"
        subtitle="Equipment on hand — value, mix, condition, and aging."
        scopeLabel={scopeLabel(scope)}
        crossDept={scope.allDepartments}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Units In Stock" value={formatNumber(data.units)} />
        <KpiCard
          label="Retail Value"
          value={formatCurrency(data.retailValue, true)}
          tone="revenue"
          sublabel={`${formatNumber(data.retailPricedUnits)} of ${formatNumber(data.units)} units priced`}
        />
        {data.costValue !== null && (
          <KpiCard
            label="Cost Value"
            value={formatCurrency(data.costValue, true)}
            tone="cost"
            sublabel={`${formatNumber(data.costValuedUnits)} of ${formatNumber(data.units)} units valued`}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Aging" description="Days in stock for current inventory.">
          <RankedList items={data.agingBuckets} format="count" tone="cost" />
        </Section>
        <Section title="Condition" description="New vs. used mix.">
          <RankedList items={data.byCondition} format="count" tone="service" />
        </Section>
      </div>

      <Section title="By category" description="Unit count and retail value by equipment category.">
        <Table>
          <THead>
            <TR>
              <TH>Category</TH>
              <TH className="text-right">Units</TH>
              <TH className="text-right">Retail Value</TH>
            </TR>
          </THead>
          <TBody>
            {data.byCategory.map((c) => (
              <TR key={c.label}>
                <TD>{c.label}</TD>
                <TD className="text-right tabular-nums">{formatNumber(c.units)}</TD>
                <TD className="text-right tabular-nums">{formatCurrency(c.retail)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Section>

      <Section title="Top makes" description="Inventory count by manufacturer.">
        <RankedList items={data.topMakes} format="count" tone="neutral" />
      </Section>
    </div>
  );
}
