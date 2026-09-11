/** Named gaps in the dealership extract — never rendered as $0. */

export interface UnavailableMeasure {
  key: string;
  label: string;
  reason: string;
  missing: string;
}

export const UNAVAILABLE: UnavailableMeasure[] = [
  {
    key: "opex",
    label: "Operating Expenses",
    reason: "Data Unavailable",
    missing: "No general-ledger expense accounts or operating-expense register.",
  },
  {
    key: "opinc",
    label: "Operating Income",
    reason: "Data Unavailable",
    missing: "Requires operating expenses from a general ledger.",
  },
  {
    key: "netinc",
    label: "Net Income",
    reason: "Data Unavailable",
    missing: "No books P&L (no GL, tax, or below-the-line accounts).",
  },
  {
    key: "cash",
    label: "Cash Position",
    reason: "Data Unavailable",
    missing: "No bank, deposit, or reconciliation tables.",
  },
  {
    key: "ap",
    label: "Accounts Payable",
    reason: "Data Unavailable",
    missing: "No vendor master, bills, or AP aging ledger. Payment type apvouch is a customer-invoice tender.",
  },
  {
    key: "budget",
    label: "Budget / Forecast",
    reason: "Not in source",
    missing: "No budget or forecast tables in the dealership extract.",
  },
  {
    key: "close",
    label: "Month-End Close",
    reason: "Partial",
    missing: "No close-task register. AR, inventory age, and freshness can be reviewed; completion % is not computed.",
  },
  {
    key: "health",
    label: "Accounting Health Score",
    reason: "Partial",
    missing: "Overall averages only measurable components. AP, bank rec, GL, and close remain unavailable.",
  },
  {
    key: "balance_sheet",
    label: "Balance Sheet",
    reason: "Data Unavailable",
    missing: "No chart of accounts, assets, or liabilities.",
  },
  {
    key: "cash_flow",
    label: "Cash Flow Statement",
    reason: "Data Unavailable",
    missing: "No cash ledger or financing/investing activity.",
  },
  {
    key: "gl",
    label: "General Ledger",
    reason: "Coming in a newer release",
    missing: "No chart of accounts or journal entries in this extract.",
  },
  {
    key: "inventory_acct",
    label: "Inventory Accounting",
    reason: "Coming in a newer release",
    missing: "Dedicated valuation, turns, and floor-plan analytics need sources beyond in-stock unit value.",
  },
  {
    key: "dept_perf",
    label: "Department Performance",
    reason: "Coming in a newer release",
    missing: "Budget variance and allocated expense are not in this extract. Contribution is live on Statements.",
  },
];

export function unavailable(key: string): UnavailableMeasure {
  return UNAVAILABLE.find((u) => u.key === key) ?? {
    key,
    label: key,
    reason: "Data Unavailable",
    missing: "This measure is not present in the source database.",
  };
}
