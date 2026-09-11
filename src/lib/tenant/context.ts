import "server-only";
import { getAppDb } from "@/lib/db/app";
import { audit } from "@/lib/auth/audit";
import { PerseusError } from "@/lib/errors";
import {
  loadUserById,
  effectivePermissions,
  type AuthUser,
} from "@/lib/auth/authz";
import {
  getSessionFromCookie,
  setSessionActiveOrg,
  setSessionViewAs,
} from "@/lib/auth/session";
import {
  listUserOrganizations,
  getActiveMembership,
  getActiveMembershipByTenant,
  getOrganizationById,
  type OrgMembership,
} from "@/lib/tenant/organizations";

/**
 * Tenant context (Auth v2, Phase B) — the security-critical layer.
 *
 * A logged-in user is an IDENTITY. What that identity may see is decided by
 * the ACTIVE ORGANIZATION they are currently acting in, resolved from the
 * session and re-validated against a live membership on every request. The
 * effective role AND permissions are the membership's role for THAT org, not a
 * single global role — so the same person can be a Dealer Principal in one org
 * and a read-only viewer in another.
 *
 * Master rules encoded here:
 *   - Tenant/organization identifiers are NEVER trusted from the client. Any
 *     requested org/tenant is validated against an active membership before it
 *     is honored (`validateRequestedOrganization` / `validateRequestedTenant`).
 *   - Only ACTIVE memberships in ACTIVE organizations ever yield a context. If
 *     access is revoked or the org is suspended after a session was bound, the
 *     next request silently falls back to another accessible org (or none).
 *   - The session's bound org is authoritative for data access; there is no way
 *     to widen scope by editing a URL or cookie.
 */

export interface AuthContext extends AuthUser {
  /** The organization this request is acting in (validated). */
  activeOrganizationId: number;
  activeOrganizationName: string;
  activeOrganizationSlug: string;
  /** The tenant whose data source this request may read. */
  activeTenantId: string;
  /** Membership role for the active org (drives roleKey/permissions above). */
  activeMembershipRoleKey: string | null;
  /** How many organizations this identity may currently access (>1 = switcher). */
  availableOrganizationCount: number;
  /** Platform administrators operate across tenants. */
  isPlatformAdmin: boolean;
  /**
   * True when a platform admin is inspecting another organization without
   * being that user or a member of it (View-As). Permissions stay the admin's.
   */
  isViewingAs: boolean;
}

/** Look up hierarchy level for a role id (membership roles may differ from the
 * user's profile role). */
function roleHierarchy(roleId: number | null): number | null {
  if (!roleId) return null;
  const row = getAppDb()
    .prepare(`SELECT hierarchy_level FROM roles WHERE id = ?`)
    .get(roleId) as { hierarchy_level: number | null } | undefined;
  return row?.hierarchy_level ?? null;
}

/**
 * Build a full AuthContext from a validated membership. Permissions + role are
 * resolved FOR THE ACTIVE ORG (membership role + this user's overrides); the
 * data scope is recomputed from those permissions.
 */
function buildContext(
  user: AuthUser,
  membership: OrgMembership,
  availableOrganizationCount: number,
): AuthContext {
  const permissions = effectivePermissions(membership.roleId, user.id);
  const allLocations = permissions.has("data.cross_location");
  const allDepartments = permissions.has("data.cross_department");

  return {
    ...user,
    // Role reflects the ACTIVE organization, not the global profile role.
    roleKey: membership.roleKey,
    roleName: membership.roleName,
    hierarchyLevel: roleHierarchy(membership.roleId),
    permissions,
    scope: {
      allLocations,
      allDepartments,
      locationId: allLocations ? null : user.locationId,
      department: allDepartments ? null : user.department,
    },
    activeOrganizationId: membership.id,
    activeOrganizationName: membership.name,
    activeOrganizationSlug: membership.slug,
    activeTenantId: membership.tenantId,
    activeMembershipRoleKey: membership.roleKey,
    availableOrganizationCount,
    isPlatformAdmin: permissions.has("platform.admin"),
    isViewingAs: false,
  };
}

/** Persist the active-org binding + stamp membership access time. */
function bindSession(
  sessionId: number,
  userId: number,
  membership: OrgMembership,
): void {
  setSessionActiveOrg(sessionId, membership.id, membership.tenantId, membership.roleId);
  getAppDb()
    .prepare(
      `UPDATE user_organization_memberships
         SET last_accessed_at = datetime('now')
       WHERE user_id = ? AND organization_id = ?`,
    )
    .run(userId, membership.id);
}

/**
 * Resolve the current request's tenant context, or null if not authenticated /
 * no accessible organization / multi-org user who has not selected yet.
 *
 * Single-org identities are auto-bound. Multi-org identities are NOT auto-bound
 * — they must pick on /select-organization. A previously bound org that is no
 * longer accessible falls back only when the user has exactly one remaining
 * org; otherwise they return to the selector.
 */
export async function getActiveContext(): Promise<AuthContext | null> {
  const session = await getSessionFromCookie();
  if (!session) return null;
  const user = loadUserById(session.user_id);
  if (!user) return null;

  const orgs = listUserOrganizations(user.id);
  if (orgs.length === 0) return null;

  let active = session.active_organization_id
    ? orgs.find((o) => o.id === session.active_organization_id) ?? null
    : null;

  if (!active) {
    if (orgs.length > 1) return null;
    active = orgs[0];
    bindSession(session.id, user.id, active);
    audit({
      actorUserId: user.id,
      action: "organization.context_established",
      targetType: "organization",
      targetId: active.id,
      detail: { tenantId: active.tenantId, roleKey: active.roleKey, auto: true },
    });
  }

  return applyViewAs(buildContext(user, active, orgs.length), session);
}

function applyViewAs(
  ctx: AuthContext,
  session: { id: number; viewing_as_organization_id: number | null },
): AuthContext {
  if (!ctx.isPlatformAdmin || !session.viewing_as_organization_id) return ctx;
  const viewed = getOrganizationById(session.viewing_as_organization_id);
  if (!viewed || viewed.accountStatus !== "active") {
    setSessionViewAs(session.id, null);
    return ctx;
  }
  return {
    ...ctx,
    activeOrganizationId: viewed.id,
    activeOrganizationName: viewed.name,
    activeOrganizationSlug: viewed.slug,
    activeTenantId: viewed.tenantId,
    isViewingAs: true,
  };
}

export interface EstablishResult {
  membership: OrgMembership | null;
  organizationCount: number;
}

/**
 * Bind tenant context at login. One accessible org → bind it. Several → leave
 * the session unbound so the selector is required. Zero → no context.
 */
export function establishTenantContext(
  sessionId: number,
  userId: number,
): EstablishResult {
  const orgs = listUserOrganizations(userId);
  if (orgs.length === 0) return { membership: null, organizationCount: 0 };
  if (orgs.length > 1) {
    return { membership: null, organizationCount: orgs.length };
  }
  const only = orgs[0];
  bindSession(sessionId, userId, only);
  audit({
    actorUserId: userId,
    action: "organization.context_established",
    targetType: "organization",
    targetId: only.id,
    detail: {
      tenantId: only.tenantId,
      roleKey: only.roleKey,
      atLogin: true,
      availableOrganizations: 1,
    },
  });
  return { membership: only, organizationCount: 1 };
}

/**
 * Where a signed-in identity should go next. Multi-org users without a bound
 * organization must select; everyone else proceeds to /app (which then
 * enforces membership / no-org).
 */
export async function postAuthPath(): Promise<"/app" | "/select-organization" | "/login"> {
  const session = await getSessionFromCookie();
  if (!session) return "/login";
  const orgs = listUserOrganizations(session.user_id);
  if (orgs.length > 1 && !session.active_organization_id) {
    return "/select-organization";
  }
  return "/app";
}

export type SwitchResult =
  | { ok: true; context: AuthContext }
  | { ok: false; reason: "unauthenticated" | "forbidden" };

/**
 * Switch the current session to another organization the user is a member of.
 * The requested org id is VALIDATED against a live membership — an id the user
 * is not a member of is rejected (never trusted). Used by the in-app org
 * switcher (Phase D) and platform tooling; the secure server function lives
 * here so isolation cannot be bypassed by any caller.
 */
export async function switchActiveOrganization(
  organizationId: number,
): Promise<SwitchResult> {
  const session = await getSessionFromCookie();
  if (!session) return { ok: false, reason: "unauthenticated" };
  const user = loadUserById(session.user_id);
  if (!user) return { ok: false, reason: "unauthenticated" };

  const membership = getActiveMembership(user.id, organizationId);
  if (!membership) {
    audit({
      actorUserId: user.id,
      action: "organization.switch_denied",
      targetType: "organization",
      targetId: organizationId,
      detail: { reason: "not_a_member" },
    });
    return { ok: false, reason: "forbidden" };
  }

  const fromOrganizationId = session.active_organization_id;
  setSessionViewAs(session.id, null);
  bindSession(session.id, user.id, membership);
  audit({
    actorUserId: user.id,
    action: "organization.switch",
    targetType: "organization",
    targetId: membership.id,
    detail: {
      tenantId: membership.tenantId,
      roleKey: membership.roleKey,
      fromOrganizationId,
      via: "switcher",
    },
  });
  const orgs = listUserOrganizations(user.id);
  return { ok: true, context: buildContext(user, membership, orgs.length) };
}

export type ViewAsResult =
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "forbidden" | "not_found" };

/**
 * Platform-admin View-As. The caller stays themselves — we do not impersonate
 * another user. Only `platform.admin` may enter; the org must be active.
 * Membership is not required.
 */
export async function enterViewAs(organizationId: number): Promise<ViewAsResult> {
  const session = await getSessionFromCookie();
  if (!session) return { ok: false, reason: "unauthenticated" };
  const ctx = await getActiveContext();
  if (!ctx) return { ok: false, reason: "unauthenticated" };
  if (!ctx.isPlatformAdmin) {
    audit({
      actorUserId: ctx.id,
      action: "organization.view_as_denied",
      targetType: "organization",
      targetId: organizationId,
      detail: { reason: "not_platform_admin" },
    });
    return { ok: false, reason: "forbidden" };
  }
  const org = getOrganizationById(organizationId);
  if (!org || org.accountStatus !== "active") {
    return { ok: false, reason: "not_found" };
  }
  setSessionViewAs(session.id, org.id);
  audit({
    actorUserId: ctx.id,
    action: "organization.view_as_enter",
    targetType: "organization",
    targetId: org.id,
    detail: { tenantId: org.tenantId, fromOrganizationId: ctx.activeOrganizationId },
  });
  return { ok: true };
}

/** Leave View-As and return to the admin's own membership tenant. */
export async function exitViewAs(): Promise<ViewAsResult> {
  const session = await getSessionFromCookie();
  if (!session) return { ok: false, reason: "unauthenticated" };
  const ctx = await getActiveContext();
  if (!ctx) return { ok: false, reason: "unauthenticated" };
  if (!ctx.isPlatformAdmin) return { ok: false, reason: "forbidden" };
  const viewedId = session.viewing_as_organization_id;
  setSessionViewAs(session.id, null);
  audit({
    actorUserId: ctx.id,
    action: "organization.view_as_exit",
    targetType: "organization",
    targetId: viewedId,
  });
  return { ok: true };
}

/**
 * DEFENSIVE server-side validators for any tenant/org id that arrives from the
 * client (URL param, query string, request body). These NEVER return data for
 * an org the user is not an active member of — the answer to `?tenant=48` when
 * you are not in tenant 48 is always `null`.
 */
export function validateRequestedOrganization(
  userId: number,
  organizationId: number,
): OrgMembership | null {
  return getActiveMembership(userId, organizationId);
}

export function validateRequestedTenant(
  userId: number,
  tenantId: string,
): OrgMembership | null {
  return getActiveMembershipByTenant(userId, tenantId);
}

/** Require a validated tenant context. Throws if the identity has no accessible org. */
export async function requireActiveContext(): Promise<AuthContext> {
  const ctx = await getActiveContext();
  if (!ctx) {
    const session = await getSessionFromCookie();
    if (!session) throw new PerseusError("UNAUTHORIZED", "Not signed in.");
    throw new PerseusError("FORBIDDEN", "No accessible organization.");
  }
  if (ctx.status !== "active")
    throw new PerseusError("FORBIDDEN", `Account is ${ctx.status}.`);
  if (!ctx.permissions.has("app.access"))
    throw new PerseusError("FORBIDDEN", "No application access.");
  return ctx;
}
