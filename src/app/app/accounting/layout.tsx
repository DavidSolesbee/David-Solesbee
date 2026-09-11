import { guardModule } from "@/lib/auth/guards";
import { accountingNav } from "@/lib/accounting/permissions";
import { AccountingSubnav } from "@/components/accounting/AccountingSubnav";

export const dynamic = "force-dynamic";

export default async function AccountingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await guardModule("module.accounting");
  const links = accountingNav(user).map((l) => ({
    label: l.label,
    href: l.href,
    soon: l.soon,
  }));

  return (
    <div className="space-y-6">
      {links.length > 0 && <AccountingSubnav links={links} />}
      {children}
    </div>
  );
}
