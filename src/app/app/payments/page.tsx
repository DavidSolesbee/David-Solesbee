import { redirect } from "next/navigation";
import { guardModule } from "@/lib/auth/guards";
import { resolveScope, scopeLabel } from "@/lib/analytics/scope";
import { getPaymentsModule } from "@/lib/analytics/modules";
import {
  ModuleHeader,
  KpiCard,
  YearBars,
  RankedList,
  Section,
} from "@/components/analytics/Primitives";
import { formatCurrency, formatNumber } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const user = await guardModule("module.payments");
  const scope = resolveScope(user);
  // Payments data is doubly gated: the module permission AND the view_payments
  // feature. A user with the module but without the feature never sees amounts.
  if (!scope.canViewPayments) redirect("/app");

  const data = getPaymentsModule();

  return (
    <div className="space-y-8">
      <ModuleHeader
        title="Payments"
        subtitle="Payment receipts, methods, and collection trends."
        scopeLabel={scopeLabel(scope)}
        crossDept={scope.allDepartments}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total Payments" value={formatCurrency(data.total, true)} tone="revenue" />
        <KpiCard label="Transactions" value={formatNumber(data.count)} />
      </div>

      <Section title="Payments by year" description="Total receipts per year.">
        <YearBars data={data.byYear} format="currency" tone="revenue" />
      </Section>

      <Section title="By payment method" description="Receipts by tender type.">
        <RankedList items={data.byMethod} format="currency" tone="neutral" />
      </Section>
    </div>
  );
}
