/**
 * Perseus role hierarchy + permission catalog.
 *
 * This is the authoritative definition of WHO exists (roles) and WHAT can be
 * controlled (permissions), plus the DEFAULT permission set each role receives.
 *
 * Access is ultimately resolved server-side from: role -> base permissions ->
 * individual overrides, combined with the user's department and location scope.
 * Security always overrides UI and configuration.
 */

export type PermissionCategory = "application" | "module" | "feature" | "data";

export interface PermissionDef {
  key: string;
  category: PermissionCategory;
  label: string;
  description: string;
}

/** Every permission Perseus understands. */
export const PERMISSIONS: PermissionDef[] = [
  // Application
  {
    key: "app.access",
    category: "application",
    label: "Access application",
    description: "Sign in and use the Perseus analytics application.",
  },
  {
    key: "app.admin",
    category: "application",
    label: "Access Admin Console",
    description: "Enter the administrative console (governance & configuration).",
  },
  // Modules
  { key: "module.overview", category: "module", label: "Overview", description: "View the executive overview module." },
  { key: "module.customers", category: "module", label: "Customers", description: "View the customers module." },
  { key: "module.sales", category: "module", label: "Sales", description: "View the sales module." },
  { key: "module.parts", category: "module", label: "Parts", description: "View the parts module." },
  { key: "module.inventory", category: "module", label: "Inventory", description: "View the equipment inventory module." },
  { key: "module.service", category: "module", label: "Service", description: "View the service / work-order module." },
  { key: "module.payments", category: "module", label: "Payments", description: "View the payments module." },
  { key: "module.ai_insights", category: "module", label: "AI Insights", description: "View the AI insights module." },
  // Features
  { key: "feature.view_revenue", category: "feature", label: "View revenue", description: "See revenue figures." },
  { key: "feature.view_cost", category: "feature", label: "View cost", description: "See cost figures." },
  { key: "feature.view_margin", category: "feature", label: "View margin", description: "See margin / profitability figures." },
  { key: "feature.view_customer_contacts", category: "feature", label: "View customer contacts", description: "See customer contact details (names, phones, emails)." },
  { key: "feature.view_payments", category: "feature", label: "View payments", description: "See payment activity and receivables." },
  { key: "feature.view_technician_performance", category: "feature", label: "View technician performance", description: "See technician labor hours and performance." },
  { key: "feature.export", category: "feature", label: "Export", description: "Export data and reports." },
  { key: "feature.use_ai", category: "feature", label: "Use AI", description: "Ask Perseus and use AI features." },
  { key: "feature.manage_dashboards", category: "feature", label: "Manage dashboards", description: "Configure dashboard experiences for others." },
  { key: "feature.manage_reports", category: "feature", label: "Manage reports", description: "Configure automated reporting." },
  { key: "feature.manage_users", category: "feature", label: "Manage users", description: "Manage users, roles, and access." },
  // Data scope
  { key: "data.cross_location", category: "data", label: "All locations", description: "See data across all locations (bypass location scope)." },
  { key: "data.cross_department", category: "data", label: "All departments", description: "See data across all departments (bypass department scope)." },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export interface RoleDef {
  key: string;
  name: string;
  /** Higher = more senior. Supplies default permissions down the hierarchy. */
  hierarchyLevel: number;
  description: string;
  /** Default department scope (null = all departments). */
  defaultDepartment: string | null;
  permissions: string[];
}

// Convenience bundles
const ALL_MODULES = [
  "module.overview",
  "module.customers",
  "module.sales",
  "module.parts",
  "module.inventory",
  "module.service",
  "module.payments",
  "module.ai_insights",
];
const ALL_FEATURES = [
  "feature.view_revenue",
  "feature.view_cost",
  "feature.view_margin",
  "feature.view_customer_contacts",
  "feature.view_payments",
  "feature.view_technician_performance",
  "feature.export",
  "feature.use_ai",
  "feature.manage_dashboards",
  "feature.manage_reports",
];

/**
 * The seven roles, senior -> junior, with default permission sets.
 * These defaults are meaningfully differentiated so permission enforcement is
 * demonstrable (e.g., a Sales Manager cannot see cost or payments).
 */
export const ROLES: RoleDef[] = [
  {
    key: "system_administrator",
    name: "System Administrator",
    hierarchyLevel: 100,
    description: "Full platform and governance control.",
    defaultDepartment: null,
    permissions: [
      "app.access",
      "app.admin",
      ...ALL_MODULES,
      ...ALL_FEATURES,
      "feature.manage_users",
      "data.cross_location",
      "data.cross_department",
    ],
  },
  {
    key: "dealer_principal",
    name: "Dealer Principal / Owner",
    hierarchyLevel: 90,
    description: "Owner-level visibility across the entire dealership.",
    defaultDepartment: null,
    permissions: [
      "app.access",
      "app.admin",
      ...ALL_MODULES,
      ...ALL_FEATURES,
      "feature.manage_users",
      "data.cross_location",
      "data.cross_department",
    ],
  },
  {
    key: "general_manager",
    name: "General Manager",
    hierarchyLevel: 80,
    description: "Full operational visibility across departments.",
    defaultDepartment: null,
    permissions: [
      "app.access",
      ...ALL_MODULES,
      ...ALL_FEATURES,
      "data.cross_location",
      "data.cross_department",
    ],
  },
  {
    key: "operations_manager",
    name: "Operations Manager",
    hierarchyLevel: 70,
    description: "Cross-department operations, without owner-level financials.",
    defaultDepartment: null,
    permissions: [
      "app.access",
      "module.overview",
      "module.customers",
      "module.sales",
      "module.parts",
      "module.inventory",
      "module.service",
      "module.payments",
      "module.ai_insights",
      "feature.view_revenue",
      "feature.view_margin",
      "feature.view_customer_contacts",
      "feature.view_payments",
      "feature.view_technician_performance",
      "feature.export",
      "feature.use_ai",
      "data.cross_department",
    ],
  },
  {
    key: "sales_manager",
    name: "Sales Manager",
    hierarchyLevel: 50,
    description: "Sales performance and customer relationships.",
    defaultDepartment: "Sales",
    permissions: [
      "app.access",
      "module.overview",
      "module.customers",
      "module.sales",
      "module.inventory",
      "module.ai_insights",
      "feature.view_revenue",
      "feature.view_customer_contacts",
      "feature.export",
      "feature.use_ai",
    ],
  },
  {
    key: "parts_manager",
    name: "Parts Manager",
    hierarchyLevel: 50,
    description: "Parts sales, margin, and inventory health.",
    defaultDepartment: "Parts",
    permissions: [
      "app.access",
      "module.overview",
      "module.parts",
      "module.inventory",
      "module.ai_insights",
      "feature.view_revenue",
      "feature.view_cost",
      "feature.view_margin",
      "feature.export",
      "feature.use_ai",
    ],
  },
  {
    key: "service_manager",
    name: "Service Manager",
    hierarchyLevel: 50,
    description: "Work orders, technician performance, and shop throughput.",
    defaultDepartment: "Service",
    permissions: [
      "app.access",
      "module.overview",
      "module.customers",
      "module.service",
      "module.ai_insights",
      "feature.view_revenue",
      "feature.view_technician_performance",
      "feature.export",
      "feature.use_ai",
    ],
  },
];

export const ROLE_KEYS = ROLES.map((r) => r.key);
export type RoleKey = (typeof ROLE_KEYS)[number];

export function getRole(key: string): RoleDef | undefined {
  return ROLES.find((r) => r.key === key);
}

/** Account lifecycle states. Only "active" may enter the analytics app. */
export const ACCOUNT_STATES = [
  "pending",
  "active",
  "denied",
  "suspended",
  "revoked",
  "expired",
] as const;
export type AccountState = (typeof ACCOUNT_STATES)[number];

export const ACCESS_REQUEST_STATES = [
  "pending",
  "approved",
  "denied",
  "more_info",
] as const;
export type AccessRequestState = (typeof ACCESS_REQUEST_STATES)[number];
