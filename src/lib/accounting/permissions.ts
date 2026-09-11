import type { AuthUser } from "@/lib/auth/authz";

export const ACCOUNTING_PERMS = {
  module: "module.accounting",
  overview: "feature.accounting_overview",
  statements: "feature.accounting_statements",
  ar: "feature.view_ar",
  arDetail: "feature.view_ar_detail",
  ap: "feature.view_ap",
  gl: "feature.view_gl",
  cash: "feature.view_cash",
  inventory: "feature.view_inventory_accounting",
  departments: "feature.view_dept_performance",
  close: "feature.view_close",
  exceptions: "feature.view_exceptions",
  health: "feature.view_health",
} as const;

export interface AccountingLink {
  key: string;
  label: string;
  href: string;
  perm: string;
  soon?: boolean;
}

export const ACCOUNTING_LINKS: AccountingLink[] = [
  { key: "overview", label: "Overview", href: "/app/accounting", perm: ACCOUNTING_PERMS.overview },
  { key: "statements", label: "Statements", href: "/app/accounting/statements", perm: ACCOUNTING_PERMS.statements },
  { key: "receivable", label: "Receivable", href: "/app/accounting/receivable", perm: ACCOUNTING_PERMS.ar },
  { key: "payable", label: "Payable", href: "/app/accounting/payable", perm: ACCOUNTING_PERMS.ap },
  { key: "exceptions", label: "Exceptions", href: "/app/accounting/exceptions", perm: ACCOUNTING_PERMS.exceptions },
  { key: "close", label: "Month-End Close", href: "/app/accounting/close", perm: ACCOUNTING_PERMS.close },
  { key: "health", label: "Health", href: "/app/accounting/health", perm: ACCOUNTING_PERMS.health },
  { key: "reports", label: "Reports", href: "/app/accounting/reports", perm: ACCOUNTING_PERMS.overview },
  { key: "ledger", label: "General Ledger", href: "/app/accounting/ledger", perm: ACCOUNTING_PERMS.gl, soon: true },
  { key: "cash", label: "Cash & Banking", href: "/app/accounting/cash", perm: ACCOUNTING_PERMS.cash, soon: true },
  { key: "inventory", label: "Inventory Accounting", href: "/app/accounting/inventory", perm: ACCOUNTING_PERMS.inventory, soon: true },
  { key: "departments", label: "Departments", href: "/app/accounting/departments", perm: ACCOUNTING_PERMS.departments, soon: true },
];

export function accountingNav(user: AuthUser): AccountingLink[] {
  return ACCOUNTING_LINKS.filter((l) => user.permissions.has(l.perm));
}

export function hasAccountingFeature(user: AuthUser, key: string): boolean {
  return user.permissions.has(ACCOUNTING_PERMS.module) && user.permissions.has(key);
}
