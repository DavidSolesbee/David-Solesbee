import "server-only";
import type { AuthUser } from "@/lib/auth/authz";

/**
 * Analytics security scope.
 *
 * Translates a user's resolved permissions + department/location into the
 * concrete data filters that EVERY analytics query must apply. This is where
 * the master security rule is turned into SQL constraints: a scoped user can
 * never receive data outside their department, and feature-level gates decide
 * which measures (cost, margin, payments, technician performance, contacts) are
 * ever computed or returned.
 *
 * Department → line ItemType mapping (validated against the dealership data):
 *   Sales   → UN (unit sale), TR (trade-in), RU/RE (rental)
 *   Parts   → PA (parts line)
 *   Service → SL (service labor segment)
 * Cross-department users have no ItemType restriction (see everything).
 */

export const DEPARTMENT_ITEM_TYPES: Record<string, string[]> = {
  Sales: ["UN", "TR", "RU", "RE"],
  Parts: ["PA"],
  Service: ["SL"],
};

export interface AnalyticsScope {
  /** True when the user may see across all departments. */
  allDepartments: boolean;
  /** The single department the user is limited to (null when allDepartments). */
  department: string | null;
  /** Line ItemTypes the user may see; null = no restriction. */
  itemTypes: string[] | null;
  /** Location scope (single-location dataset, but enforced generically). */
  allLocations: boolean;
  locationId: number | null;

  /** Tenant context (Auth v2, Phase B). The validated tenant whose data source
   * this scope may read, and the organization it belongs to. Null when the
   * caller pre-dates tenant context (e.g. a global-role AuthUser). */
  userId: number;
  tenantId: string | null;
  organizationId: number | null;
  /** Platform-admin View-As: tenant is inspected without membership. */
  platformViewAs: boolean;

  /** Feature gates — whether a measure may EVER be computed/returned. */
  canViewRevenue: boolean;
  canViewCost: boolean;
  canViewMargin: boolean;
  canViewPayments: boolean;
  canViewTechnician: boolean;
  canViewContacts: boolean;
  canExport: boolean;
}

/** Optional tenant fields present when the caller is a full AuthContext. */
type MaybeTenantAware = AuthUser & {
  activeTenantId?: string;
  activeOrganizationId?: number;
  isViewingAs?: boolean;
  isPlatformAdmin?: boolean;
};

export function resolveScope(user: AuthUser): AnalyticsScope {
  const allDepartments = user.scope.allDepartments;
  const department = allDepartments ? null : user.department;
  const itemTypes =
    allDepartments || !department
      ? null
      : (DEPARTMENT_ITEM_TYPES[department] ?? null);

  const ctx = user as MaybeTenantAware;

  return {
    allDepartments,
    department,
    itemTypes,
    allLocations: user.scope.allLocations,
    locationId: user.scope.allLocations ? null : user.locationId,
    userId: user.id,
    tenantId: ctx.activeTenantId ?? null,
    organizationId: ctx.activeOrganizationId ?? null,
    platformViewAs: ctx.isViewingAs === true && ctx.isPlatformAdmin === true,
    canViewRevenue: user.permissions.has("feature.view_revenue"),
    canViewCost: user.permissions.has("feature.view_cost"),
    canViewMargin: user.permissions.has("feature.view_margin"),
    canViewPayments: user.permissions.has("feature.view_payments"),
    canViewTechnician: user.permissions.has("feature.view_technician_performance"),
    canViewContacts: user.permissions.has("feature.view_customer_contacts"),
    canExport: user.permissions.has("feature.export"),
  };
}

/**
 * SQL fragment + params for the ItemType restriction on a table aliased `d`.
 * Returns an always-true fragment when unrestricted, so callers can always
 * splice it into a WHERE clause safely.
 */
export function itemTypeClause(
  scope: AnalyticsScope,
  alias = "d",
): { sql: string; params: string[] } {
  if (!scope.itemTypes || scope.itemTypes.length === 0) {
    return { sql: "1=1", params: [] };
  }
  const placeholders = scope.itemTypes.map(() => "?").join(",");
  return {
    sql: `${alias}.ItemType IN (${placeholders})`,
    params: scope.itemTypes,
  };
}

/** Human label for the current scope, for the dashboard banner. */
export function scopeLabel(scope: AnalyticsScope): string {
  if (scope.allDepartments) return "All departments";
  return scope.department ? `${scope.department} department` : "Limited scope";
}
