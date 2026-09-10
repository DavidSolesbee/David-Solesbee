import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { getAppDb } from "@/lib/db/app";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroyCurrentSession } from "@/lib/auth/session";
import { audit } from "@/lib/auth/audit";
import { accountStateMessage, type AuthUser } from "@/lib/auth/authz";
import type { AccountState } from "@/lib/auth/catalog";
import { recordLoginEvent, isIpBlocked, buildDeviceContext } from "@/lib/security/events";

/**
 * Authentication service: login, logout, request access, password reset.
 *
 * Includes login-failure protection (lockout after repeated failures) and
 * account-state enforcement (only ACTIVE accounts may sign in). All outcomes are
 * audited. Architected so MFA can be inserted between password verification and
 * session creation later.
 */

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export type LoginResult =
  | { ok: true; userId: number }
  | { ok: false; code: LoginFailureCode; message: string };

export type LoginFailureCode =
  | "INVALID_CREDENTIALS"
  | "LOCKED"
  | "NOT_ACTIVE"
  | "IP_BLOCKED";

interface LoginUserRow {
  id: number;
  password_hash: string | null;
  password_salt: string | null;
  status: AccountState;
  failed_attempts: number;
  locked_until: string | null;
  dealership: string | null;
  mfa_enabled: number;
}

export async function login(
  emailRaw: string,
  password: string,
  ctx?: { ip?: string | null; userAgent?: string | null },
): Promise<LoginResult> {
  const email = emailRaw.trim().toLowerCase();
  const db = getAppDb();

  // Server-side IP blocklist enforcement (runs before credential checks).
  if (isIpBlocked(ctx?.ip, db)) {
    recordLoginEvent(
      { userId: null, email, success: false, failureReason: "ip_blocked", ip: ctx?.ip, userAgent: ctx?.userAgent },
      db,
    );
    audit({ action: "login.blocked", targetType: "email", targetId: email, detail: { reason: "ip_blocked" }, ip: ctx?.ip });
    return { ok: false, code: "IP_BLOCKED", message: "Sign-in from your network has been blocked. Contact your administrator." };
  }

  const user = db
    .prepare(
      `SELECT id, password_hash, password_salt, status, failed_attempts, locked_until, dealership, mfa_enabled
       FROM users WHERE email = ?`,
    )
    .get(email) as LoginUserRow | undefined;

  // Uniform failure for unknown email (avoid user enumeration).
  if (!user) {
    recordLoginEvent(
      { userId: null, email, success: false, failureReason: "unknown_email", ip: ctx?.ip, userAgent: ctx?.userAgent },
      db,
    );
    audit({ action: "login.failed", targetType: "email", targetId: email, detail: { reason: "unknown_email" }, ip: ctx?.ip });
    return { ok: false, code: "INVALID_CREDENTIALS", message: "Incorrect email or password." };
  }

  // Lockout check
  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    recordLoginEvent(
      { userId: user.id, email, organization: user.dealership, success: false, failureReason: "locked", ip: ctx?.ip, userAgent: ctx?.userAgent, lockedOut: true },
      db,
    );
    audit({ actorUserId: user.id, action: "login.locked", targetType: "user", targetId: user.id, ip: ctx?.ip });
    return { ok: false, code: "LOCKED", message: `Too many attempts. Try again in ${LOCKOUT_MINUTES} minutes.` };
  }

  const valid = verifyPassword(password, { hash: user.password_hash, salt: user.password_salt });
  if (!valid) {
    const attempts = user.failed_attempts + 1;
    const lockedOut = attempts >= MAX_FAILED_ATTEMPTS;
    const lockUntil = lockedOut
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
      : null;
    db.prepare(
      `UPDATE users SET failed_attempts = ?, locked_until = ?, updated_at = datetime('now') WHERE id = ?`,
    ).run(attempts, lockUntil, user.id);
    recordLoginEvent(
      { userId: user.id, email, organization: user.dealership, success: false, failureReason: "invalid_credentials", ip: ctx?.ip, userAgent: ctx?.userAgent, lockedOut },
      db,
    );
    audit({ actorUserId: user.id, action: "login.failed", targetType: "user", targetId: user.id, detail: { attempts }, ip: ctx?.ip });
    return { ok: false, code: "INVALID_CREDENTIALS", message: "Incorrect email or password." };
  }

  // Password OK — enforce account state (only active may enter).
  if (user.status !== "active") {
    recordLoginEvent(
      { userId: user.id, email, organization: user.dealership, success: false, failureReason: `not_active:${user.status}`, ip: ctx?.ip, userAgent: ctx?.userAgent },
      db,
    );
    audit({ actorUserId: user.id, action: "login.blocked", targetType: "user", targetId: user.id, detail: { status: user.status }, ip: ctx?.ip });
    return { ok: false, code: "NOT_ACTIVE", message: accountStateMessage(user.status) };
  }

  // (MFA challenge would be inserted here in a future milestone.)
  const mfaStatus = user.mfa_enabled ? "enabled" : "disabled";

  // Reset failure counters, stamp last login, create session.
  db.prepare(
    `UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
  ).run(user.id);
  const device = buildDeviceContext(user.id, ctx?.userAgent ?? null);
  const session = await createSession({ userId: user.id, ip: ctx?.ip, userAgent: ctx?.userAgent });
  recordLoginEvent(
    {
      userId: user.id,
      email,
      organization: user.dealership,
      success: true,
      ip: ctx?.ip,
      userAgent: ctx?.userAgent,
      deviceId: device.deviceId,
      deviceInfo: device.info,
      mfaStatus,
      sessionId: session.id,
    },
    db,
  );
  audit({ actorUserId: user.id, action: "login.success", targetType: "user", targetId: user.id, ip: ctx?.ip });
  return { ok: true, userId: user.id };
}

export async function logout(user?: AuthUser | null): Promise<void> {
  await destroyCurrentSession();
  if (user) audit({ actorUserId: user.id, action: "logout", targetType: "user", targetId: user.id });
}

export interface AccessRequestInput {
  firstName: string;
  lastName: string;
  email: string;
  dealership?: string;
  location?: string;
  department?: string;
  jobTitle?: string;
  requestedRole?: string;
  reason?: string;
}

export type RequestAccessResult =
  | { ok: true }
  | { ok: false; message: string };

export function submitAccessRequest(input: AccessRequestInput): RequestAccessResult {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.firstName.trim() || !input.lastName.trim()) {
    return { ok: false, message: "Please complete the required fields." };
  }
  const db = getAppDb();

  // Do not reveal whether an account already exists; record the request either way.
  db.prepare(
    `INSERT INTO access_requests
      (first_name, last_name, email, dealership, location_name, department, job_title, requested_role, reason, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
  ).run(
    input.firstName.trim(),
    input.lastName.trim(),
    email,
    input.dealership?.trim() || null,
    input.location?.trim() || null,
    input.department?.trim() || null,
    input.jobTitle?.trim() || null,
    input.requestedRole?.trim() || null,
    input.reason?.trim() || null,
  );
  audit({ action: "access_request.submitted", targetType: "email", targetId: email, detail: { requestedRole: input.requestedRole } });
  return { ok: true };
}

/**
 * Password reset architecture: create a single-use, time-limited token.
 * (Email delivery is out of scope for this milestone; the token is generated and
 * stored so the flow and schema exist.) Always returns ok to avoid enumeration.
 */
export function requestPasswordReset(emailRaw: string): { ok: true } {
  const email = emailRaw.trim().toLowerCase();
  const db = getAppDb();
  const user = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email) as
    | { id: number }
    | undefined;
  if (user) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    db.prepare(
      `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)`,
    ).run(user.id, tokenHash, expires);
    audit({ actorUserId: user.id, action: "password_reset.requested", targetType: "user", targetId: user.id });
  }
  return { ok: true };
}
