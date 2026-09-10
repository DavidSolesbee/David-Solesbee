/**
 * marketingDemoData — FICTIONAL demonstration content for the PUBLIC homepage.
 *
 * IMPORTANT: Everything in this file is fabricated marketing/sample data used
 * only to illustrate the product on the public landing page. It is NOT real
 * customer data and must never be mixed with production client information
 * (which lives behind authentication and is scoped per user). Replace with
 * real, approved content before making any of these claims externally.
 */

export interface KpiTile {
  label: string;
  value: string;
  delta: string;
  direction: "up" | "down";
  /** demo sparkline values (0-100 scale) */
  spark: number[];
}

export interface PlatformTab {
  id: string;
  label: string;
  headline: string;
  description: string;
  kpis: KpiTile[];
  /** demo bar series 0-100 */
  series: number[];
  seriesLabel: string;
}

export interface RoleView {
  role: string;
  blurb: string;
  metrics: string[];
}

export interface CustomerStory {
  org: string;
  locations: string;
  industry: string;
  challenge: string;
  result: string;
  quote?: string;
  initials: string;
}

/* ------------------------------------------------------------------ */
/* Fictional demo customers (logo cloud)                               */
/* ------------------------------------------------------------------ */
export const demoCustomers: { name: string; sector: string }[] = [
  { name: "Summit Marine Group", sector: "Marine" },
  { name: "Horizon Automotive Partners", sector: "Automotive" },
  { name: "Bluewater Recreation", sector: "Recreation" },
  { name: "Meridian Equipment Group", sector: "Equipment" },
  { name: "Northstar Holdings", sector: "Multi-Location" },
];

/* ------------------------------------------------------------------ */
/* Hero dashboard preview                                              */
/* ------------------------------------------------------------------ */
export const heroKpis: KpiTile[] = [
  { label: "Revenue", value: "$48.2M", delta: "+12.4%", direction: "up", spark: [40, 44, 42, 50, 55, 61, 68] },
  { label: "Gross Profit", value: "$11.7M", delta: "+8.1%", direction: "up", spark: [30, 35, 33, 40, 43, 47, 52] },
  { label: "Operating Margin", value: "18.9%", delta: "+1.6 pts", direction: "up", spark: [50, 52, 51, 55, 57, 58, 62] },
  { label: "Active Customers", value: "6,341", delta: "+214", direction: "up", spark: [45, 47, 49, 52, 56, 59, 63] },
];

export const heroRevenueSeries = [42, 48, 45, 53, 58, 55, 64, 69, 66, 74, 79, 86];
export const heroRevenueMonths = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export const heroChannelMix = [
  { label: "Sales", value: 46, color: "#3B78F0" },
  { label: "Parts", value: 24, color: "#5A8BF7" },
  { label: "Service", value: 20, color: "#3FD09B" },
  { label: "Rental", value: 10, color: "#F0B454" },
];

/* ------------------------------------------------------------------ */
/* Platform overview tabs                                              */
/* ------------------------------------------------------------------ */
export const platformTabs: PlatformTab[] = [
  {
    id: "executive",
    label: "Executive Overview",
    headline: "The whole business on one screen",
    description:
      "Enterprise revenue, profitability, and momentum across every location — updated continuously.",
    seriesLabel: "Revenue by month",
    series: [42, 48, 45, 53, 58, 55, 64, 69, 66, 74, 79, 86],
    kpis: [
      { label: "Revenue", value: "$48.2M", delta: "+12.4%", direction: "up", spark: [] },
      { label: "EBITDA", value: "$7.9M", delta: "+9.2%", direction: "up", spark: [] },
      { label: "Operating Margin", value: "18.9%", delta: "+1.6 pts", direction: "up", spark: [] },
      { label: "Forecast vs Actual", value: "102%", delta: "On track", direction: "up", spark: [] },
    ],
  },
  {
    id: "sales",
    label: "Sales Performance",
    headline: "See what's closing and what's stalling",
    description:
      "Pipeline, conversion, and rep performance with drill-down to the deal and the location.",
    seriesLabel: "Units sold by month",
    series: [30, 38, 41, 36, 44, 52, 49, 58, 61, 55, 67, 72],
    kpis: [
      { label: "Bookings", value: "$14.6M", delta: "+15.1%", direction: "up", spark: [] },
      { label: "Win Rate", value: "34.2%", delta: "+2.4 pts", direction: "up", spark: [] },
      { label: "Avg Deal Size", value: "$42.1K", delta: "+3.8%", direction: "up", spark: [] },
      { label: "Pipeline", value: "$29.3M", delta: "+6.7%", direction: "up", spark: [] },
    ],
  },
  {
    id: "financial",
    label: "Financial Performance",
    headline: "Margins and cash, without the spreadsheet drills",
    description:
      "Consolidated financials across locations with variance to budget and prior period.",
    seriesLabel: "Gross margin % by month",
    series: [55, 54, 57, 56, 59, 58, 61, 60, 62, 63, 62, 64],
    kpis: [
      { label: "Gross Profit", value: "$11.7M", delta: "+8.1%", direction: "up", spark: [] },
      { label: "Operating Expense", value: "$6.2M", delta: "-2.3%", direction: "up", spark: [] },
      { label: "Cash Position", value: "$9.4M", delta: "+$1.1M", direction: "up", spark: [] },
      { label: "Budget Variance", value: "+3.1%", delta: "Favorable", direction: "up", spark: [] },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    headline: "Know your exposure before it ages",
    description:
      "Inventory value, turns, and aging by location and category — with exposure alerts.",
    seriesLabel: "Inventory turns by month",
    series: [38, 40, 42, 41, 44, 46, 45, 48, 50, 49, 52, 54],
    kpis: [
      { label: "Inventory Value", value: "$22.8M", delta: "-4.6%", direction: "up", spark: [] },
      { label: "Turns", value: "4.2x", delta: "+0.3", direction: "up", spark: [] },
      { label: "Aged > 180d", value: "$1.9M", delta: "-11.2%", direction: "up", spark: [] },
      { label: "Fill Rate", value: "96.4%", delta: "+1.1 pts", direction: "up", spark: [] },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    headline: "Throughput, capacity, and the backlog",
    description:
      "Productivity and cycle time across the shop floor, with exception surfacing.",
    seriesLabel: "Productivity index by month",
    series: [60, 58, 62, 64, 63, 66, 68, 67, 70, 72, 71, 74],
    kpis: [
      { label: "Productivity", value: "88.1%", delta: "+2.9 pts", direction: "up", spark: [] },
      { label: "Cycle Time", value: "2.4 days", delta: "-0.5", direction: "up", spark: [] },
      { label: "Capacity Used", value: "82%", delta: "+4 pts", direction: "up", spark: [] },
      { label: "Open Backlog", value: "312", delta: "-7.8%", direction: "up", spark: [] },
    ],
  },
  {
    id: "customer",
    label: "Customer Intelligence",
    headline: "Retention, value, and who's at risk",
    description:
      "Customer value, retention, and churn risk unified across sales, parts, and service.",
    seriesLabel: "Active customers by month",
    series: [45, 47, 49, 52, 54, 56, 58, 60, 61, 63, 65, 67],
    kpis: [
      { label: "Active Customers", value: "6,341", delta: "+214", direction: "up", spark: [] },
      { label: "Retention", value: "91.3%", delta: "+1.2 pts", direction: "up", spark: [] },
      { label: "Lifetime Value", value: "$18.4K", delta: "+5.6%", direction: "up", spark: [] },
      { label: "At-Risk", value: "148", delta: "-9.4%", direction: "up", spark: [] },
    ],
  },
  {
    id: "forecast",
    label: "Forecasting",
    headline: "Where the next quarter is heading",
    description:
      "Forward-looking revenue and demand projections with confidence bands.",
    seriesLabel: "Forecast vs actual by month",
    series: [50, 54, 58, 60, 63, 66, 70, 73, 77, 80, 84, 88],
    kpis: [
      { label: "Q Forecast", value: "$51.6M", delta: "+7.1%", direction: "up", spark: [] },
      { label: "Confidence", value: "High", delta: "±4.2%", direction: "up", spark: [] },
      { label: "Demand Index", value: "112", delta: "+6", direction: "up", spark: [] },
      { label: "Pipeline Cover", value: "1.9x", delta: "+0.2", direction: "up", spark: [] },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Executive intelligence KPIs                                         */
/* ------------------------------------------------------------------ */
export const executiveKpis: KpiTile[] = [
  { label: "Revenue", value: "$48.2M", delta: "+12.4%", direction: "up", spark: [40, 46, 44, 52, 58, 63, 69] },
  { label: "Gross Profit", value: "$11.7M", delta: "+8.1%", direction: "up", spark: [32, 36, 35, 41, 45, 49, 54] },
  { label: "EBITDA", value: "$7.9M", delta: "+9.2%", direction: "up", spark: [28, 31, 33, 38, 41, 45, 49] },
  { label: "Operating Margin", value: "18.9%", delta: "+1.6 pts", direction: "up", spark: [50, 52, 53, 56, 58, 60, 63] },
  { label: "Cash", value: "$9.4M", delta: "+$1.1M", direction: "up", spark: [42, 44, 47, 49, 53, 56, 60] },
  { label: "Forecast vs Actual", value: "102%", delta: "On track", direction: "up", spark: [55, 57, 56, 60, 62, 64, 66] },
  { label: "Customer Retention", value: "91.3%", delta: "+1.2 pts", direction: "up", spark: [60, 61, 63, 64, 66, 68, 70] },
  { label: "Inventory Exposure", value: "$1.9M", delta: "-11.2%", direction: "down", spark: [60, 57, 55, 52, 48, 45, 41] },
];

/* ------------------------------------------------------------------ */
/* Role-based experience                                               */
/* ------------------------------------------------------------------ */
export const roleViews: RoleView[] = [
  {
    role: "Executive",
    blurb: "Enterprise performance and where to focus.",
    metrics: ["Enterprise KPIs", "Financial performance", "Forecasting", "Location comparisons", "Risk alerts"],
  },
  {
    role: "Sales Manager",
    blurb: "Pipeline health and team performance.",
    metrics: ["Pipeline", "Conversion", "Revenue", "Salesperson performance", "Inventory availability"],
  },
  {
    role: "Operations Manager",
    blurb: "Throughput, capacity, and exceptions.",
    metrics: ["Productivity", "Cycle time", "Capacity", "Backlog", "Exceptions"],
  },
  {
    role: "Finance",
    blurb: "Margins, cash, and budget variance.",
    metrics: ["Revenue", "Margins", "Expenses", "AR", "AP", "Cash", "Budget variance"],
  },
];

/* ------------------------------------------------------------------ */
/* Solesbee Intelligence (AI) sample prompts                           */
/* ------------------------------------------------------------------ */
export const aiPrompts: string[] = [
  "Why did gross margin decline this month?",
  "Which locations have the highest inventory exposure?",
  "What changed compared with last quarter?",
  "Which KPIs require attention?",
  "Summarize this week's operating performance.",
];

/* ------------------------------------------------------------------ */
/* Automated reporting example                                         */
/* ------------------------------------------------------------------ */
export const sampleReport = {
  name: "Executive Operating Summary",
  cadence: "Every Monday",
  time: "6:00 AM",
  format: "PDF + Interactive Link",
  scope: "All Locations",
  period: "Previous Week",
  recipients: ["Executive", "Finance", "Operations"],
};

/* ------------------------------------------------------------------ */
/* Business impact (fictional marketing stats)                         */
/* ------------------------------------------------------------------ */
export const impactStats: { value: string; label: string }[] = [
  { value: "46%", label: "reduction in manual reporting" },
  { value: "31%", label: "faster management decision cycle" },
  { value: "62%", label: "less recurring spreadsheet prep" },
  { value: "18%", label: "improvement in inventory visibility" },
];

/* ------------------------------------------------------------------ */
/* Customer stories                                                    */
/* ------------------------------------------------------------------ */
export const customerStories: CustomerStory[] = [
  {
    org: "Summit Marine Group",
    locations: "11 locations",
    industry: "Marine",
    initials: "SM",
    challenge: "More than 40 separate weekly reports across departments.",
    result:
      "Centralized executive reporting across sales, inventory, service, and financial performance.",
    quote:
      "For the first time, our leadership team is looking at the same numbers at the same time.",
  },
  {
    org: "Horizon Automotive Partners",
    locations: "23 locations",
    industry: "Automotive",
    initials: "HA",
    challenge:
      "Leadership lacked consistent profitability and inventory visibility across dealerships.",
    result: "Unified executive dashboards and location-level performance reporting.",
  },
  {
    org: "Bluewater Recreation",
    locations: "8 locations",
    industry: "Recreation",
    initials: "BR",
    challenge: "Department managers relied heavily on manually assembled spreadsheets.",
    result: "Role-based dashboards created shared accountability across departments.",
  },
];

/* ------------------------------------------------------------------ */
/* Data sources consolidated (value prop)                              */
/* ------------------------------------------------------------------ */
export const dataSources: string[] = [
  "CRM",
  "ERP",
  "Accounting",
  "Sales systems",
  "Inventory systems",
  "Service systems",
  "Spreadsheets",
  "Marketing systems",
  "Cloud applications",
];

/* ------------------------------------------------------------------ */
/* Security highlights                                                 */
/* ------------------------------------------------------------------ */
export const securityPoints: { title: string; copy: string }[] = [
  { title: "Role-based access", copy: "Every user sees only what their role permits." },
  { title: "User & location permissions", copy: "Scope data by person, department, and location." },
  { title: "Department segmentation", copy: "Sales, Parts, Service, and Finance stay separated." },
  { title: "Secure sessions", copy: "Hardened sessions with server-side enforcement." },
  { title: "Data segmentation", copy: "Client environments are isolated from one another." },
  { title: "Auditability", copy: "Security-relevant actions are recorded for review." },
  { title: "Report permissions", copy: "Scheduled reports never exceed the recipient's access." },
  { title: "Least privilege", copy: "Access is approval-only and granted deliberately." },
];
