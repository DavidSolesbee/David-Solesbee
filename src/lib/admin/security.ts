import "server-only";
import { getAppDb } from "@/lib/db/app";
import { audit } from "@/lib/auth/audit";
import { getRole } from "@/lib/auth/catalog";
import type { AuthUser } from "@/lib/auth/authz";
import { PerseusError } from "@/lib/errors";

/**
 * Security & Login Intelligence service (Admin Command Center, Feature Set 1).
 *
 * Read models for login intelligence, active sessions, device registry, and IP
 * rules — plus the security-specific admin actions (terminate a session, manage
 * trusted devices, manage IP rules). All reads/writes are gated server-side by
 * `feature.manage_users`; user-targeted writes also enforce role hierarchy.
 *
 * NOTE (tenancy): the platform is currently single-tenant. When an organization
 * model is introduced, every query here must additionally scope by the actor's
 * organization unless they hold a platform-level cross-client permission.
 */

/* ----------------------------- guardrails ------------------------------- */

function assertCanManage(actor: AuthUser): void {
  if (!actor.permissions.has("feature.manage_users")) {
    throw new PerseusError("FORBIDDEN", "You cannot manage security settings.");
  }
}

function assertOutranksUser(actor: AuthUser, userId: number): void {
  const row = getAppDb()
    .prepare("SELECT r.key k FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE u.id=?")
    .get(userId) as { k: string | null } | undefined;
  if (!row) throw new PerseusError("NOT_FOUND", "User not found.");
  const targetLevel = row.k ? getRole(row.k)?.hierarchyLevel ?? 0 : 0;
  if (targetLevel > (actor.hierarchyLevel ?? 0)) {
    throw new PerseusError("FORBIDDEN", "You cannot manage a user who outranks you.");
  }
}

function actorLabel(actor: AuthUser): string {
  return `${actor.firstName} ${actor.lastName} <${actor.email}>`;
}

/* ------------------------------- reads ---------------------------------- */

export interface SecuritySummary {
  failedLogins24h: number;
  elevatedRisk24h: number; // HIGH or CRITICAL login events
  activeSessions: number;
  lockedAccounts: number;
  newDevices24h: number;
  blockedIps: number;
}

export function getSecuritySummary(actor: AuthUser): SecuritySummary {
  assertCanManage(actor);
  const db = getAppDb();
  const one = (sql: string): number =>
    (db.prepare(sql).get() as { v: number } | undefined)?.v ?? 0;
  return {
    failedLogins24h: one(
      "SELECT COUNT(*) v FROM login_events WHERE success=0 AND created_at >= datetime('now','-24 hours')",
    ),
    elevatedRisk24h: one(
      "SELECT COUNT(*) v FROM login_events WHERE risk_level IN ('HIGH','CRITICAL') AND created_at >= datetime('now','-24 hours')",
    ),
    activeSessions: one(
      "SELECT COUNT(*) v FROM sessions WHERE revoked_at IS NULL AND expires_at > datetime('now')",
    ),
    lockedAccounts: one(
      "SELECT COUNT(*) v FROM users WHERE locked_until IS NOT NULL AND locked_until > datetime('now')",
    ),
    newDevices24h: one(
      "SELECT COUNT(*) v FROM trusted_devices WHERE first_seen >= datetime('now','-24 hours')",
    ),
    blockedIps: one("SELECT COUNT(*) v FROM ip_rules WHERE rule='block'"),
  };
}

export interface LoginEventRow {
  id: number;
  user_id: number | null;
  email: string | null;
  organization: string | null;
  user_name: string | null;
  success: number;
  failure_reason: string | null;
  ip: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  device_known: number;
  mfa_status: string | null;
  geo_approx: string | null;
  risk_level: string;
  risk_reasons: string | null;
  created_at: string;
}

export interface LoginEventFilter {
  search?: string;
  result?: "success" | "fail";
  risk?: string;
  limit?: number;
}

export function listLoginEvents(actor: AuthUser, filter: LoginEventFilter = {}): LoginEventRow[] {
  assertCanManage(actor);
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (filter.search) {
    where.push("(e.email LIKE ? OR e.ip LIKE ? OR (u.first_name || ' ' || u.last_name) LIKE ?)");
    const s = `%${filter.search}%`;
    params.push(s, s, s);
  }
  if (filter.result === "success") where.push("e.success = 1");
  if (filter.result === "fail") where.push("e.success = 0");
  if (filter.risk) {
    where.push("e.risk_level = ?");
    params.push(filter.risk);
  }
  const sql = `
    SELECT e.id, e.user_id, e.email, e.organization,
           (u.first_name || ' ' || u.last_name) AS user_name,
           e.success, e.failure_reason, e.ip, e.browser, e.os, e.device_type,
           e.device_known, e.mfa_status, e.geo_approx, e.risk_level, e.risk_reasons, e.created_at
    FROM login_events e
    LEFT JOIN users u ON u.id = e.user_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT ?`;
  params.push(filter.limit ?? 100);
  return getAppDb().prepare(sql).all(...params) as unknown as LoginEventRow[];
}

export interface ActiveSessionRow {
  id: number;
  user_id: number;
  user_name: string;
  email: string;
  organization: string | null;
  role_name: string | null;
  ip: string | null;
  device_id: string | null;
  device_label: string | null;
  device_trusted: number | null;
  mfa_status: string | null;
  risk_level: string | null;
  created_at: string;
  last_activity_at: string | null;
  expires_at: string;
}

export function listActiveSessions(actor: AuthUser): ActiveSessionRow[] {
  assertCanManage(actor);
  const sql = `
    SELECT s.id, s.user_id,
           (u.first_name || ' ' || u.last_name) AS user_name,
           u.email, u.dealership AS organization, r.name AS role_name,
           s.ip, s.device_id, td.label AS device_label, td.trusted AS device_trusted,
           s.mfa_status, s.risk_level, s.created_at,
           COALESCE(s.last_activity_at, s.last_seen_at, s.created_at) AS last_activity_at,
           s.expires_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN roles r ON r.id = u.role_id
    LEFT JOIN trusted_devices td ON td.user_id = s.user_id AND td.device_id = s.device_id
    WHERE s.revoked_at IS NULL AND s.expires_at > datetime('now')
    ORDER BY last_activity_at DESC`;
  return getAppDb().prepare(sql).all() as unknown as ActiveSessionRow[];
}

export interface DeviceRow {
  id: number;
  user_id: number;
  user_name: string;
  email: string;
  device_id: string;
  label: string | null;
  device_type: string | null;
  trusted: number;
  login_count: number;
  first_seen: string;
  last_seen: string;
}

export function listDevices(actor: AuthUser, limit = 100): DeviceRow[] {
  assertCanManage(actor);
  const sql = `
    SELECT td.id, td.user_id,
           (u.first_name || ' ' || u.last_name) AS user_name, u.email,
           td.device_id, td.label, td.device_type, td.trusted, td.login_count,
           td.first_seen, td.last_seen
    FROM trusted_devices td JOIN users u ON u.id = td.user_id
    ORDER BY td.last_seen DESC
    LIMIT ?`;
  return getAppDb().prepare(sql).all(limit) as unknown as DeviceRow[];
}

export interface IpRuleRow {
  id: number;
  ip: string;
  rule: "allow" | "block";
  note: string | null;
  created_at: string;
}

export function listIpRules(actor: AuthUser): IpRuleRow[] {
  assertCanManage(actor);
  return getAppDb()
    .prepare("SELECT id, ip, rule, note, created_at FROM ip_rules ORDER BY created_at DESC")
    .all() as unknown as IpRuleRow[];
}

/* ------------------------------ mutations ------------------------------- */

/** Terminate a single active session (by id), enforcing role hierarchy. */
export function terminateSession(actor: AuthUser, sessionId: number): void {
  assertCanManage(actor);
  const db = getAppDb();
  const row = db
    .prepare("SELECT user_id FROM sessions WHERE id=? AND revoked_at IS NULL")
    .get(sessionId) as { user_id: number } | undefined;
  if (!row) throw new PerseusError("NOT_FOUND", "Session not found or already ended.");
  assertOutranksUser(actor, row.user_id);
  db.prepare("UPDATE sessions SET revoked_at=datetime('now') WHERE id=?").run(sessionId);
  audit({
    actorUserId: actor.id,
    actorLabel: actorLabel(actor),
    action: "session.terminated",
    targetType: "user",
    targetId: row.user_id,
    detail: { sessionId },
  });
}

/** Mark or unmark a user's device as trusted. */
export function setDeviceTrust(
  actor: AuthUser,
  deviceRowId: number,
  trusted: boolean,
): void {
  assertCanManage(actor);
  const db = getAppDb();
  const row = db
    .prepare("SELECT user_id FROM trusted_devices WHERE id=?")
    .get(deviceRowId) as { user_id: number } | undefined;
  if (!row) throw new PerseusError("NOT_FOUND", "Device not found.");
  assertOutranksUser(actor, row.user_id);
  db.prepare("UPDATE trusted_devices SET trusted=? WHERE id=?").run(trusted ? 1 : 0, deviceRowId);
  audit({
    actorUserId: actor.id,
    actorLabel: actorLabel(actor),
    action: trusted ? "device.trusted" : "device.untrusted",
    targetType: "user",
    targetId: row.user_id,
    detail: { deviceRowId },
  });
}

/** Remove a device from a user's registry. */
export function removeDevice(actor: AuthUser, deviceRowId: number): void {
  assertCanManage(actor);
  const db = getAppDb();
  const row = db
    .prepare("SELECT user_id FROM trusted_devices WHERE id=?")
    .get(deviceRowId) as { user_id: number } | undefined;
  if (!row) throw new PerseusError("NOT_FOUND", "Device not found.");
  assertOutranksUser(actor, row.user_id);
  db.prepare("DELETE FROM trusted_devices WHERE id=?").run(deviceRowId);
  audit({
    actorUserId: actor.id,
    actorLabel: actorLabel(actor),
    action: "device.removed",
    targetType: "user",
    targetId: row.user_id,
    detail: { deviceRowId },
  });
}

const IP_RE = /^[0-9a-fA-F:.]{3,45}$/;

/** Add an IP allow/block rule (enforced server-side at login for blocks). */
export function addIpRule(
  actor: AuthUser,
  ip: string,
  rule: "allow" | "block",
  note?: string | null,
): void {
  assertCanManage(actor);
  const addr = ip.trim();
  if (!IP_RE.test(addr)) throw new PerseusError("VALIDATION", "Enter a valid IP address.");
  if (rule !== "allow" && rule !== "block")
    throw new PerseusError("VALIDATION", "Invalid rule type.");
  getAppDb()
    .prepare(
      `INSERT INTO ip_rules (ip, rule, note, created_by) VALUES (?, ?, ?, ?)
       ON CONFLICT(ip, rule) DO UPDATE SET note=excluded.note`,
    )
    .run(addr, rule, note?.trim() || null, actor.id);
  audit({
    actorUserId: actor.id,
    actorLabel: actorLabel(actor),
    action: "ip_rule.added",
    targetType: "ip",
    targetId: addr,
    detail: { rule, note },
  });
}

export function removeIpRule(actor: AuthUser, ruleId: number): void {
  assertCanManage(actor);
  const db = getAppDb();
  const row = db.prepare("SELECT ip, rule FROM ip_rules WHERE id=?").get(ruleId) as
    | { ip: string; rule: string }
    | undefined;
  if (!row) throw new PerseusError("NOT_FOUND", "Rule not found.");
  db.prepare("DELETE FROM ip_rules WHERE id=?").run(ruleId);
  audit({
    actorUserId: actor.id,
    actorLabel: actorLabel(actor),
    action: "ip_rule.removed",
    targetType: "ip",
    targetId: row.ip,
    detail: { rule: row.rule },
  });
}
