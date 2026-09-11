import "server-only";
import { getAppDb } from "@/lib/db/app";
import { PerseusError } from "@/lib/errors";
import type { AccountState } from "@/lib/auth/catalog";

/**
 * Server-side authorization.
 *
 * Implements the required request chain:
 *   Authenticate -> Resolve Role -> Resolve Permissions -> Resolve Department
 *   -> Resolve Location -> Apply Security.
 *
 * Front-end visibility is never trusted; every protected action calls into this
 * module. Effective permissions = base role permissions, plus individual grant
 * overrides, minus individual revoke overrides.
 */

export interface AuthUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  status: AccountState;
  roleKey: string | null;
  roleName: string | null;
  hierarchyLevel: number | null;
  department: string | null;
  jobTitle: string | null;
  locationId: number | null;
  locationName: string | null;
  dealership: string | null;
  mfaEnabled: boolean;
  /** Effective permission keys after role + overrides. */
  permissions: Set<string>;
  /** Data scope derived from permissions + assignment. */
  scope: {
    allLocations: boolean;
    allDepartments: boolean;
    locationId: number | null;
    department: string | null;
  };
}

interface UserRow {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  status: AccountState;
  department: string | null;
  job_title: string | null;
  location_id: number | null;
  location_name: string | null;
  dealership: string | null;
  mfa_enabled: number;
  role_id: number | null;
  role_key: string | null;
  role_name: string | null;
  hierarchy_level: number | null;
}

/**
 * Effective permission keys for a given role, adjusted by this user's
 * individual grant/revoke overrides. Shared by the global-role resolver
 * (`loadUserById`) and the per-organization tenant-context resolver so the
 * override semantics are identical everywhere.
 */
export function effectivePermissions(
  roleId: number | null,
  userId: number,
): Set<string> {
  const db = getAppDb();
  const base = roleId
    ? (db
        .prepare(
          `SELECT p.key FROM role_permissions rp
           JOIN permissions p ON p.id = rp.permission_id
           WHERE rp.role_id = ?`,
        )
        .all(roleId) as { key: string }[])
    : [];
  const perms = new Set(base.map((b) => b.key));

  const overrides = db
    .prepare(
      `SELECT p.key, o.granted FROM user_permission_overrides o
       JOIN permissions p ON p.id = o.permission_id
       WHERE o.user_id = ?`,
    )
    .all(userId) as { key: string; granted: number }[];
  for (const o of overrides) {
    if (o.granted === 1) perms.add(o.key);
    else perms.delete(o.key);
  }
  return perms;
}

export function loadUserById(userId: number): AuthUser | null {
  const db = getAppDb();
  const row = db
    .prepare(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.status, u.department,
              u.job_title, u.location_id, u.location_name, u.dealership, u.mfa_enabled,
              u.role_id, r.key AS role_key, r.name AS role_name, r.hierarchy_level
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
    )
    .get(userId) as UserRow | undefined;
  if (!row) return null;

  const perms = effectivePermissions(row.role_id ?? null, row.id);

  const allLocations = perms.has("data.cross_location");
  const allDepartments = perms.has("data.cross_department");

  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    status: row.status,
    roleKey: row.role_key,
    roleName: row.role_name,
    hierarchyLevel: row.hierarchy_level,
    department: row.department,
    jobTitle: row.job_title,
    locationId: row.location_id,
    locationName: row.location_name,
    dealership: row.dealership,
    mfaEnabled: row.mfa_enabled === 1,
    permissions: perms,
    scope: {
      allLocations,
      allDepartments,
      locationId: allLocations ? null : row.location_id,
      department: allDepartments ? null : row.department,
    },
  };
}

/** Authenticate the current request. Returns the user or null (no valid session). */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const { getSessionFromCookie } = await import("@/lib/auth/session");
  const session = await getSessionFromCookie();
  if (!session) return null;
  return loadUserById(session.user_id);
}

/** Require an authenticated, ACTIVE user with app access. Throws otherwise. */
export async function requireActiveUser(): Promise<AuthUser> {
  // Prefer the tenant-scoped context (membership role for the active org).
  const { getActiveContext } = await import("@/lib/tenant/context");
  const ctx = await getActiveContext();
  if (ctx) {
    if (ctx.status !== "active")
      throw new PerseusError("FORBIDDEN", `Account is ${ctx.status}.`);
    if (!ctx.permissions.has("app.access"))
      throw new PerseusError("FORBIDDEN", "No application access.");
    return ctx;
  }
  const user = await getCurrentUser();
  if (!user) throw new PerseusError("UNAUTHORIZED", "Not signed in.");
  if (user.status !== "active")
    throw new PerseusError("FORBIDDEN", `Account is ${user.status}.`);
  if (!user.permissions.has("app.access"))
    throw new PerseusError("FORBIDDEN", "No application access.");
  return user;
}

export function hasPermission(user: AuthUser, key: string): boolean {
  return user.permissions.has(key);
}

/** Require a specific permission. Throws FORBIDDEN if missing. */
export async function requirePermission(key: string): Promise<AuthUser> {
  const user = await requireActiveUser();
  if (!hasPermission(user, key))
    throw new PerseusError("FORBIDDEN", `Missing permission: ${key}`);
  return user;
}

/**
 * Require an administrator (Admin Console access). Governance mutations
 * additionally require `feature.manage_users` — enforced in the admin service.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const { getActiveContext } = await import("@/lib/tenant/context");
  const ctx = await getActiveContext();
  if (!ctx) throw new PerseusError("UNAUTHORIZED", "Not signed in.");
  if (ctx.status !== "active")
    throw new PerseusError("FORBIDDEN", `Account is ${ctx.status}.`);
  if (!ctx.permissions.has("app.admin"))
    throw new PerseusError("FORBIDDEN", "Missing permission: app.admin");
  return ctx;
}

/** Human-readable reason a non-active account cannot enter, for UI messaging. */
export function accountStateMessage(status: AccountState): string {
  switch (status) {
    case "pending":
      return "Your request is pending approval. Access will become available after an administrator approves it.";
    case "denied":
      return "Your access request was denied. Please contact your administrator.";
    case "suspended":
      return "Your account is suspended. Please contact your administrator.";
    case "revoked":
      return "Your access has been revoked. Please contact your administrator.";
    case "expired":
      return "Your access has expired. Please request renewal from your administrator.";
    default:
      return "";
  }
}
