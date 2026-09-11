import "server-only";
import { getAppDb } from "@/lib/db/app";
import type { AuthUser } from "@/lib/auth/authz";

/**
 * Organization / tenant read model (Auth v2, Phase A).
 *
 * READ-ONLY helpers over the new multi-tenant tables. These are the primitives
 * later phases use to establish and VALIDATE tenant context server-side. Two
 * invariants encoded here:
 *   - Only ACTIVE memberships in ACTIVE organizations are ever returned as
 *     accessible (a suspended/disabled org is inaccessible even to an otherwise
 *     valid user).
 *   - The email domain is a convenience HINT only (branding / SSO discovery);
 *     it never grants membership. Authorization always flows from the
 *     authenticated user's validated membership records.
 */

export interface OrganizationSummary {
  id: number;
  tenantId: string;
  name: string;
  slug: string;
  accountStatus: string;
  subscriptionStatus: string;
  primaryDomain: string | null;
  location: string | null;
  logoText: string | null;
}

export interface OrgMembership extends OrganizationSummary {
  roleId: number | null;
  roleKey: string | null;
  roleName: string | null;
  membershipStatus: string;
  isPrimary: boolean;
}

export interface TenantDataSource {
  tenantId: string;
  dataSourceKind: string;
  dataSourceRef: string;
  status: string;
}

const ORG_COLS = `o.id, o.tenant_id AS tenantId, o.name, o.slug,
  o.account_status AS accountStatus, o.subscription_status AS subscriptionStatus,
  o.primary_domain AS primaryDomain, o.location, o.logo_text AS logoText`;

const MEMBERSHIP_SELECT = `
  SELECT ${ORG_COLS},
         m.role_id AS roleId, r.key AS roleKey, r.name AS roleName,
         m.status AS membershipStatus, m.is_primary AS isPrimary
  FROM user_organization_memberships m
  JOIN organizations o ON o.id = m.organization_id
  LEFT JOIN roles r ON r.id = m.role_id
`;

function toMembership(row: Record<string, unknown>): OrgMembership {
  return {
    id: row.id as number,
    tenantId: row.tenantId as string,
    name: row.name as string,
    slug: row.slug as string,
    accountStatus: row.accountStatus as string,
    subscriptionStatus: row.subscriptionStatus as string,
    primaryDomain: (row.primaryDomain as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    logoText: (row.logoText as string | null) ?? null,
    roleId: (row.roleId as number | null) ?? null,
    roleKey: (row.roleKey as string | null) ?? null,
    roleName: (row.roleName as string | null) ?? null,
    membershipStatus: row.membershipStatus as string,
    isPrimary: (row.isPrimary as number) === 1,
  };
}

/**
 * Every organization the user may currently ACCESS: active membership AND
 * active organization. Ordered with the primary org first. This is the
 * authoritative set for the login-time routing decision.
 */
export function listUserOrganizations(userId: number): OrgMembership[] {
  const rows = getAppDb()
    .prepare(
      `${MEMBERSHIP_SELECT}
       WHERE m.user_id = ? AND m.status = 'active' AND o.account_status = 'active'
       ORDER BY m.is_primary DESC, o.name`,
    )
    .all(userId) as unknown as Record<string, unknown>[];
  return rows.map(toMembership);
}

/**
 * Server-side membership validation for a single organization. Returns the
 * membership ONLY when the user has an active membership in an active org.
 * This is the check every tenant-scoped request must perform — never trust a
 * tenant/org id supplied by the browser.
 */
export function getActiveMembership(
  userId: number,
  organizationId: number,
): OrgMembership | null {
  const row = getAppDb()
    .prepare(
      `${MEMBERSHIP_SELECT}
       WHERE m.user_id = ? AND m.organization_id = ?
         AND m.status = 'active' AND o.account_status = 'active'`,
    )
    .get(userId, organizationId) as Record<string, unknown> | undefined;
  return row ? toMembership(row) : null;
}

/** Validate by tenant_id (used when routing carries a tenant/slug). */
export function getActiveMembershipByTenant(
  userId: number,
  tenantId: string,
): OrgMembership | null {
  const row = getAppDb()
    .prepare(
      `${MEMBERSHIP_SELECT}
       WHERE m.user_id = ? AND o.tenant_id = ?
         AND m.status = 'active' AND o.account_status = 'active'`,
    )
    .get(userId, tenantId) as Record<string, unknown> | undefined;
  return row ? toMembership(row) : null;
}

export function getOrganizationById(id: number): OrganizationSummary | null {
  const row = getAppDb()
    .prepare(`SELECT ${ORG_COLS} FROM organizations o WHERE o.id = ?`)
    .get(id) as Record<string, unknown> | undefined;
  return row ? (row as unknown as OrganizationSummary) : null;
}

export function listAllOrganizations(): OrganizationSummary[] {
  const rows = getAppDb()
    .prepare(
      `SELECT ${ORG_COLS} FROM organizations o
       WHERE o.account_status = 'active'
       ORDER BY o.name`,
    )
    .all() as unknown as Record<string, unknown>[];
  return rows as unknown as OrganizationSummary[];
}

export function getOrganizationBySlug(slug: string): OrganizationSummary | null {
  const row = getAppDb()
    .prepare(`SELECT ${ORG_COLS} FROM organizations o WHERE o.slug = ?`)
    .get(slug) as Record<string, unknown> | undefined;
  return row ? (row as unknown as OrganizationSummary) : null;
}

/** Resolve the concrete data source for a tenant (tenant-aware resolver seed). */
export function getTenantDataSource(tenantId: string): TenantDataSource | null {
  const row = getAppDb()
    .prepare(
      `SELECT tenant_id AS tenantId, data_source_kind AS dataSourceKind,
              data_source_ref AS dataSourceRef, status
       FROM tenants WHERE tenant_id = ?`,
    )
    .get(tenantId) as Record<string, unknown> | undefined;
  return row ? (row as unknown as TenantDataSource) : null;
}

/** Platform administrators manage across tenants (distinct from customer admin). */
export function isPlatformAdmin(user: AuthUser): boolean {
  return user.permissions.has("platform.admin");
}

/**
 * CONVENIENCE ONLY: suggest an organization from an email domain for branding /
 * SSO discovery. This MUST NOT be used for authorization — it never confers
 * membership. Returns null if no organization advertises that domain.
 */
export function suggestOrganizationByDomain(email: string): OrganizationSummary | null {
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain) return null;
  const row = getAppDb()
    .prepare(
      `SELECT ${ORG_COLS} FROM organizations o
       WHERE lower(o.primary_domain) = ? AND o.account_status = 'active'`,
    )
    .get(domain) as Record<string, unknown> | undefined;
  return row ? (row as unknown as OrganizationSummary) : null;
}
