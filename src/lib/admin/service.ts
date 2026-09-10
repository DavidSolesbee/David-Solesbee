import "server-only";
import { randomBytes } from "node:crypto";
import { getAppDb } from "@/lib/db/app";
import { hashPassword } from "@/lib/auth/password";
import { audit } from "@/lib/auth/audit";
import { loadUserById, type AuthUser } from "@/lib/auth/authz";
import { getRole, ROLES, PERMISSIONS, ACCOUNT_STATES, type AccountState } from "@/lib/auth/catalog";
import { PerseusError } from "@/lib/errors";

/**
 * User-governance service (Admin Console).
 *
 * Every mutation takes the acting admin (`actor`) and enforces guardrails
 * server-side:
 *   - actor must hold `feature.manage_users`,
 *   - actor may not manage a user who OUTRANKS them (higher role hierarchy),
 *   - actor may not assign a role above their own hierarchy level,
 *   - actor may only GRANT permissions they themselves hold (revokes are always
 *     allowed on manageable targets),
 *   - actor may not suspend/revoke/demote their own account.
 * All actions are audited. This is the operational half of the security model.
 */

/* ----------------------------- guardrails ------------------------------- */

function assertCanManageUsers(actor: AuthUser): void {
  if (!actor.permissions.has("feature.manage_users")) {
    throw new PerseusError("FORBIDDEN", "You cannot manage users.");
  }
}

function roleLevel(roleKey: string | null): number {
  if (!roleKey) return 0;
  return getRole(roleKey)?.hierarchyLevel ?? 0;
}

function assertOutranks(actor: AuthUser, targetRoleKey: string | null): void {
  const actorLevel = actor.hierarchyLevel ?? 0;
  if (roleLevel(targetRoleKey) > actorLevel) {
    throw new PerseusError(
      "FORBIDDEN",
      "You cannot manage a user who outranks you.",
    );
  }
}

function assertCanAssignRole(actor: AuthUser, roleKey: string): void {
  const role = getRole(roleKey);
  if (!role) throw new PerseusError("VALIDATION", "Unknown role.");
  if (role.hierarchyLevel > (actor.hierarchyLevel ?? 0)) {
    throw new PerseusError(
      "FORBIDDEN",
      "You cannot assign a role above your own authority.",
    );
  }
}

/* ------------------------------- reads ---------------------------------- */

export interface UserListRow {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  status: AccountState;
  role_key: string | null;
  role_name: string | null;
  department: string | null;
  location_name: string | null;
  last_login_at: string | null;
  locked_until: string | null;
}

export interface UserFilter {
  search?: string;
  status?: string;
  role?: string;
}

export function listUsers(filter: UserFilter = {}): UserListRow[] {
  const where: string[] = [];
  const params: string[] = [];
  if (filter.search) {
    where.push(
      "(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)",
    );
    const s = `%${filter.search}%`;
    params.push(s, s, s);
  }
  if (filter.status) {
    where.push("u.status = ?");
    params.push(filter.status);
  }
  if (filter.role) {
    where.push("r.key = ?");
    params.push(filter.role);
  }
  const sql = `
    SELECT u.id, u.first_name, u.last_name, u.email, u.status, u.department,
           u.location_name, u.last_login_at, u.locked_until,
           r.key AS role_key, r.name AS role_name
    FROM users u LEFT JOIN roles r ON r.id = u.role_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY r.hierarchy_level DESC, u.last_name, u.first_name
    LIMIT 500`;
  return getAppDb().prepare(sql).all(...params) as unknown as UserListRow[];
}

export interface UserCounts {
  total: number;
  byStatus: Record<string, number>;
}

export function getUserCounts(): UserCounts {
  const rows = getAppDb()
    .prepare("SELECT status, COUNT(*) c FROM users GROUP BY status")
    .all() as { status: string; c: number }[];
  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    byStatus[r.status] = r.c;
    total += r.c;
  }
  return { total, byStatus };
}

/** Full detail for one user: their resolved auth plus raw override rows. */
export function getUserDetail(userId: number) {
  const auth = loadUserById(userId);
  if (!auth) throw new PerseusError("NOT_FOUND", "User not found.");
  const overrides = getAppDb()
    .prepare(
      `SELECT p.key, o.granted FROM user_permission_overrides o
       JOIN permissions p ON p.id = o.permission_id WHERE o.user_id = ?`,
    )
    .all(userId) as { key: string; granted: number }[];
  const overrideMap = new Map(overrides.map((o) => [o.key, o.granted === 1]));
  const sessions = getAppDb()
    .prepare(
      `SELECT COUNT(*) c FROM sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > datetime('now')`,
    )
    .get(userId) as { c: number };
  return { auth, overrideMap, activeSessions: sessions.c };
}

export interface AccessRequestRow {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  dealership: string | null;
  location_name: string | null;
  department: string | null;
  job_title: string | null;
  requested_role: string | null;
  reason: string | null;
  status: string;
  created_at: string;
  decision_note: string | null;
}

export function listAccessRequests(status?: string): AccessRequestRow[] {
  const sql = status
    ? "SELECT * FROM access_requests WHERE status = ? ORDER BY created_at DESC"
    : "SELECT * FROM access_requests ORDER BY created_at DESC";
  const db = getAppDb();
  return (status ? db.prepare(sql).all(status) : db.prepare(sql).all()) as unknown as AccessRequestRow[];
}

export function countPendingRequests(): number {
  return (
    getAppDb()
      .prepare("SELECT COUNT(*) c FROM access_requests WHERE status = 'pending'")
      .get() as { c: number }
  ).c;
}

export interface AuditRow {
  id: number;
  actor_user_id: number | null;
  actor_label: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: string | null;
  ip: string | null;
  created_at: string;
}

export function listAudit(limit = 200): AuditRow[] {
  return getAppDb()
    .prepare(
      `SELECT * FROM audit_log ORDER BY created_at DESC, id DESC LIMIT ?`,
    )
    .all(limit) as unknown as AuditRow[];
}

/* ------------------------------ mutations ------------------------------- */

function genTempPassword(): string {
  // Readable-ish temporary password for the demo.
  return "Perseus-" + randomBytes(4).toString("hex").toUpperCase();
}

function actorLabel(actor: AuthUser): string {
  return `${actor.firstName} ${actor.lastName} <${actor.email}>`;
}

/** Approve a pending access request → provision an active user. */
export function approveAccessRequest(
  actor: AuthUser,
  requestId: number,
  opts: { roleKey: string; department?: string | null; note?: string },
): { tempPassword: string } {
  assertCanManageUsers(actor);
  assertCanAssignRole(actor, opts.roleKey);
  const db = getAppDb();
  const req = db
    .prepare("SELECT * FROM access_requests WHERE id = ?")
    .get(requestId) as AccessRequestRow | undefined;
  if (!req) throw new PerseusError("NOT_FOUND", "Request not found.");
  if (req.status !== "pending" && req.status !== "more_info")
    throw new PerseusError("VALIDATION", "Request is already decided.");

  const exists = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(req.email.toLowerCase());
  if (exists)
    throw new PerseusError("VALIDATION", "A user with that email already exists.");

  const role = getRole(opts.roleKey)!;
  const temp = genTempPassword();
  const pw = hashPassword(temp);
  db.prepare(
    `INSERT INTO users
      (first_name, last_name, email, password_hash, password_salt, role_id,
       department, job_title, location_id, location_name, dealership, status, source, activated_at)
     VALUES (?, ?, ?, ?, ?, (SELECT id FROM roles WHERE key = ?), ?, ?, 1, ?, ?, 'active', 'approved', datetime('now'))`,
  ).run(
    req.first_name,
    req.last_name,
    req.email.toLowerCase(),
    pw.hash,
    pw.salt,
    opts.roleKey,
    opts.department ?? role.defaultDepartment,
    req.job_title,
    req.location_name ?? "Main Location",
    req.dealership,
  );
  db.prepare(
    `UPDATE access_requests SET status='approved', decided_by=?, decided_at=datetime('now'), decision_note=? WHERE id=?`,
  ).run(actor.id, opts.note ?? null, requestId);

  audit({
    actorUserId: actor.id,
    actorLabel: actorLabel(actor),
    action: "access_request.approved",
    targetType: "email",
    targetId: req.email,
    detail: { role: opts.roleKey, requestId },
  });
  return { tempPassword: temp };
}

export function decideAccessRequest(
  actor: AuthUser,
  requestId: number,
  decision: "denied" | "more_info",
  note?: string,
): void {
  assertCanManageUsers(actor);
  const db = getAppDb();
  const req = db
    .prepare("SELECT email, status FROM access_requests WHERE id = ?")
    .get(requestId) as { email: string; status: string } | undefined;
  if (!req) throw new PerseusError("NOT_FOUND", "Request not found.");
  db.prepare(
    `UPDATE access_requests SET status=?, decided_by=?, decided_at=datetime('now'), decision_note=? WHERE id=?`,
  ).run(decision, actor.id, note ?? null, requestId);
  audit({
    actorUserId: actor.id,
    actorLabel: actorLabel(actor),
    action: `access_request.${decision}`,
    targetType: "email",
    targetId: req.email,
    detail: { requestId, note },
  });
}

function loadTargetRoleKey(userId: number): string | null {
  const row = getAppDb()
    .prepare(
      "SELECT r.key k FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE u.id=?",
    )
    .get(userId) as { k: string | null } | undefined;
  if (row === undefined) throw new PerseusError("NOT_FOUND", "User not found.");
  return row.k;
}

export function assignRole(actor: AuthUser, userId: number, roleKey: string): void {
  assertCanManageUsers(actor);
  assertOutranks(actor, loadTargetRoleKey(userId));
  assertCanAssignRole(actor, roleKey);
  getAppDb()
    .prepare(
      "UPDATE users SET role_id=(SELECT id FROM roles WHERE key=?), updated_at=datetime('now') WHERE id=?",
    )
    .run(roleKey, userId);
  audit({
    actorUserId: actor.id,
    actorLabel: actorLabel(actor),
    action: "user.role_changed",
    targetType: "user",
    targetId: userId,
    detail: { roleKey },
  });
}

export function setStatus(
  actor: AuthUser,
  userId: number,
  status: AccountState,
): void {
  assertCanManageUsers(actor);
  if (!ACCOUNT_STATES.includes(status))
    throw new PerseusError("VALIDATION", "Invalid status.");
  if (userId === actor.id && status !== "active")
    throw new PerseusError("FORBIDDEN", "You cannot deactivate your own account.");
  assertOutranks(actor, loadTargetRoleKey(userId));
  const activatedAt = status === "active" ? "datetime('now')" : "activated_at";
  getAppDb()
    .prepare(
      `UPDATE users SET status=?, activated_at=${activatedAt}, updated_at=datetime('now') WHERE id=?`,
    )
    .run(status, userId);
  // Deactivating a user should also end their sessions.
  if (status !== "active") {
    getAppDb()
      .prepare(
        "UPDATE sessions SET revoked_at=datetime('now') WHERE user_id=? AND revoked_at IS NULL",
      )
      .run(userId);
  }
  audit({
    actorUserId: actor.id,
    actorLabel: actorLabel(actor),
    action: "user.status_changed",
    targetType: "user",
    targetId: userId,
    detail: { status },
  });
}

export function setPermissionOverride(
  actor: AuthUser,
  userId: number,
  permissionKey: string,
  value: "grant" | "revoke" | "clear",
): void {
  assertCanManageUsers(actor);
  assertOutranks(actor, loadTargetRoleKey(userId));
  if (!PERMISSIONS.some((p) => p.key === permissionKey))
    throw new PerseusError("VALIDATION", "Unknown permission.");
  // Can only GRANT a permission the actor holds themselves.
  if (value === "grant" && !actor.permissions.has(permissionKey))
    throw new PerseusError(
      "FORBIDDEN",
      "You cannot grant a permission you do not hold.",
    );
  const db = getAppDb();
  if (value === "clear") {
    db.prepare(
      "DELETE FROM user_permission_overrides WHERE user_id=? AND permission_id=(SELECT id FROM permissions WHERE key=?)",
    ).run(userId, permissionKey);
  } else {
    db.prepare(
      `INSERT INTO user_permission_overrides (user_id, permission_id, granted, note)
       VALUES (?, (SELECT id FROM permissions WHERE key=?), ?, ?)
       ON CONFLICT(user_id, permission_id) DO UPDATE SET granted=excluded.granted`,
    ).run(userId, permissionKey, value === "grant" ? 1 : 0, `by ${actor.email}`);
  }
  audit({
    actorUserId: actor.id,
    actorLabel: actorLabel(actor),
    action: "user.permission_override",
    targetType: "user",
    targetId: userId,
    detail: { permissionKey, value },
  });
}

export function setDepartment(
  actor: AuthUser,
  userId: number,
  department: string | null,
): void {
  assertCanManageUsers(actor);
  assertOutranks(actor, loadTargetRoleKey(userId));
  getAppDb()
    .prepare("UPDATE users SET department=?, updated_at=datetime('now') WHERE id=?")
    .run(department || null, userId);
  audit({
    actorUserId: actor.id,
    actorLabel: actorLabel(actor),
    action: "user.department_changed",
    targetType: "user",
    targetId: userId,
    detail: { department },
  });
}

export function resetPassword(actor: AuthUser, userId: number): { tempPassword: string } {
  assertCanManageUsers(actor);
  assertOutranks(actor, loadTargetRoleKey(userId));
  const temp = genTempPassword();
  const pw = hashPassword(temp);
  getAppDb()
    .prepare(
      "UPDATE users SET password_hash=?, password_salt=?, failed_attempts=0, locked_until=NULL, updated_at=datetime('now') WHERE id=?",
    )
    .run(pw.hash, pw.salt, userId);
  audit({
    actorUserId: actor.id,
    actorLabel: actorLabel(actor),
    action: "user.password_reset",
    targetType: "user",
    targetId: userId,
  });
  return { tempPassword: temp };
}

export function forceLogout(actor: AuthUser, userId: number): number {
  assertCanManageUsers(actor);
  assertOutranks(actor, loadTargetRoleKey(userId));
  const info = getAppDb()
    .prepare(
      "UPDATE sessions SET revoked_at=datetime('now') WHERE user_id=? AND revoked_at IS NULL",
    )
    .run(userId);
  audit({
    actorUserId: actor.id,
    actorLabel: actorLabel(actor),
    action: "user.force_logout",
    targetType: "user",
    targetId: userId,
    detail: { revoked: Number(info.changes) },
  });
  return Number(info.changes);
}

export function unlockUser(actor: AuthUser, userId: number): void {
  assertCanManageUsers(actor);
  assertOutranks(actor, loadTargetRoleKey(userId));
  getAppDb()
    .prepare(
      "UPDATE users SET failed_attempts=0, locked_until=NULL, updated_at=datetime('now') WHERE id=?",
    )
    .run(userId);
  audit({
    actorUserId: actor.id,
    actorLabel: actorLabel(actor),
    action: "user.unlocked",
    targetType: "user",
    targetId: userId,
  });
}

/** Administratively lock an account (indefinite) and end its sessions. */
export function lockUser(actor: AuthUser, userId: number): void {
  assertCanManageUsers(actor);
  if (userId === actor.id)
    throw new PerseusError("FORBIDDEN", "You cannot lock your own account.");
  assertOutranks(actor, loadTargetRoleKey(userId));
  // Far-future lock timestamp = held until an admin unlocks.
  const until = new Date(Date.now() + 100 * 365 * 24 * 3600 * 1000).toISOString();
  const db = getAppDb();
  db.prepare(
    "UPDATE users SET locked_until=?, updated_at=datetime('now') WHERE id=?",
  ).run(until, userId);
  db.prepare(
    "UPDATE sessions SET revoked_at=datetime('now') WHERE user_id=? AND revoked_at IS NULL",
  ).run(userId);
  audit({
    actorUserId: actor.id,
    actorLabel: actorLabel(actor),
    action: "user.locked",
    targetType: "user",
    targetId: userId,
  });
}

/** Reset (disable) a user's MFA enrollment. */
export function resetMfa(actor: AuthUser, userId: number): void {
  assertCanManageUsers(actor);
  assertOutranks(actor, loadTargetRoleKey(userId));
  getAppDb()
    .prepare("UPDATE users SET mfa_enabled=0, updated_at=datetime('now') WHERE id=?")
    .run(userId);
  audit({
    actorUserId: actor.id,
    actorLabel: actorLabel(actor),
    action: "user.mfa_reset",
    targetType: "user",
    targetId: userId,
  });
}

/** Roles the actor is allowed to assign (at or below their authority). */
export function assignableRoles(actor: AuthUser) {
  const level = actor.hierarchyLevel ?? 0;
  return ROLES.filter((r) => r.hierarchyLevel <= level);
}
