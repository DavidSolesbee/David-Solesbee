import "server-only";
import { cookies } from "next/headers";
import { randomBytes, createHash } from "node:crypto";
import { getAppDb } from "@/lib/db/app";

/**
 * Session management.
 *
 * A session is a random opaque token stored in an httpOnly cookie. Only the
 * SHA-256 hash of the token is persisted, so a leaked database cannot be used to
 * mint valid cookies. Sessions have a fixed expiry and are validated fully
 * server-side on every request.
 */

export const SESSION_COOKIE = "perseus_session";
const SESSION_TTL_HOURS = 8;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface CreateSessionInput {
  userId: number;
  ip?: string | null;
  userAgent?: string | null;
}

/** Create a session row and set the httpOnly cookie. Returns token + row id. */
export async function createSession(
  input: CreateSessionInput,
): Promise<{ token: string; id: number }> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000);
  const info = getAppDb()
    .prepare(
      `INSERT INTO sessions (token_hash, user_id, expires_at, ip, user_agent, last_activity_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    )
    .run(hashToken(token), input.userId, expires.toISOString(), input.ip ?? null, input.userAgent ?? null);

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
  return { token, id: Number(info.lastInsertRowid) };
}

export interface SessionRow {
  id: number;
  user_id: number;
  expires_at: string;
  revoked_at: string | null;
  /** Auth v2 (Phase B): the tenant context this session is acting in. */
  active_organization_id: number | null;
  active_tenant_id: string | null;
  active_role_id: number | null;
  viewing_as_organization_id: number | null;
}

/** Resolve the current valid session row from the cookie, or null. */
export async function getSessionFromCookie(): Promise<SessionRow | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = getAppDb()
    .prepare(
      `SELECT id, user_id, expires_at, revoked_at,
              active_organization_id, active_tenant_id, active_role_id,
              viewing_as_organization_id
       FROM sessions WHERE token_hash = ?`,
    )
    .get(hashToken(token)) as SessionRow | undefined;

  if (!row) return null;
  if (row.revoked_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  // Sliding "last seen" touch (does not extend expiry).
  getAppDb()
    .prepare(`UPDATE sessions SET last_seen_at = datetime('now') WHERE id = ?`)
    .run(row.id);
  return row;
}

/**
 * Bind an active tenant context to a session. The caller MUST have already
 * validated the membership server-side (see `establishTenantContext`); this is
 * a low-level persistence primitive and performs no authorization itself.
 */
export function setSessionActiveOrg(
  sessionId: number,
  organizationId: number,
  tenantId: string,
  roleId: number | null,
): void {
  getAppDb()
    .prepare(
      `UPDATE sessions
         SET active_organization_id = ?, active_tenant_id = ?, active_role_id = ?
       WHERE id = ?`,
    )
    .run(organizationId, tenantId, roleId, sessionId);
}

/** Persist or clear platform-admin View-As. Performs no authorization itself. */
export function setSessionViewAs(
  sessionId: number,
  organizationId: number | null,
): void {
  getAppDb()
    .prepare(`UPDATE sessions SET viewing_as_organization_id = ? WHERE id = ?`)
    .run(organizationId, sessionId);
}

/** Destroy the current session (logout). */
export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    getAppDb()
      .prepare(`UPDATE sessions SET revoked_at = datetime('now') WHERE token_hash = ?`)
      .run(hashToken(token));
  }
  jar.delete(SESSION_COOKIE);
}
