import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getAppDb } from "@/lib/db/app";
import { audit } from "@/lib/auth/audit";
import { PerseusError } from "@/lib/errors";
import { generateTotpSecret, otpauthUrl, verifyTotp } from "@/lib/auth/totp";
import { userRequiresMfaByOrg } from "@/lib/tenant/orgAuth";

export const MFA_COOKIE = "perseus_mfa";
const MFA_TTL_MINUTES = 5;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function hashBackup(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

export function loginNeedsMfaChallenge(userId: number, mfaEnabled: boolean): boolean {
  return mfaEnabled || userRequiresMfaByOrg(userId);
}

export async function startMfaChallenge(userId: number): Promise<void> {
  const token = randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + MFA_TTL_MINUTES * 60 * 1000).toISOString();
  getAppDb()
    .prepare(
      `INSERT INTO mfa_challenges (user_id, token_hash, expires_at) VALUES (?, ?, ?)`,
    )
    .run(userId, hashToken(token), expires);
  const jar = await cookies();
  jar.set(MFA_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expires),
  });
}

export async function getMfaChallengeUserId(): Promise<number | null> {
  const jar = await cookies();
  const token = jar.get(MFA_COOKIE)?.value;
  if (!token) return null;
  const row = getAppDb()
    .prepare(
      `SELECT user_id FROM mfa_challenges
        WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > datetime('now')`,
    )
    .get(hashToken(token)) as { user_id: number } | undefined;
  return row?.user_id ?? null;
}

export async function consumeMfaChallenge(): Promise<number | null> {
  const jar = await cookies();
  const token = jar.get(MFA_COOKIE)?.value;
  if (!token) return null;
  const db = getAppDb();
  const row = db
    .prepare(
      `SELECT id, user_id FROM mfa_challenges
        WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > datetime('now')`,
    )
    .get(hashToken(token)) as { id: number; user_id: number } | undefined;
  if (!row) return null;
  db.prepare(`UPDATE mfa_challenges SET consumed_at = datetime('now') WHERE id = ?`).run(row.id);
  jar.delete(MFA_COOKIE);
  return row.user_id;
}

export function beginMfaEnrollment(userId: number, email: string): {
  secret: string;
  otpauth: string;
  backupCode: string;
} {
  const secret = generateTotpSecret();
  const backupCode = randomBytes(4).toString("hex").toUpperCase();
  getAppDb()
    .prepare(
      `UPDATE users SET mfa_secret = ?, mfa_backup_hash = ?, mfa_enabled = 0, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(secret, hashBackup(backupCode), userId);
  return { secret, otpauth: otpauthUrl(email, secret), backupCode };
}

export function confirmMfaEnrollment(userId: number, code: string): void {
  const row = getAppDb()
    .prepare(`SELECT mfa_secret FROM users WHERE id = ?`)
    .get(userId) as { mfa_secret: string | null } | undefined;
  if (!row?.mfa_secret || !verifyTotp(row.mfa_secret, code)) {
    throw new PerseusError("VALIDATION", "That verification code is not valid.");
  }
  getAppDb()
    .prepare(`UPDATE users SET mfa_enabled = 1, updated_at = datetime('now') WHERE id = ?`)
    .run(userId);
  audit({
    actorUserId: userId,
    action: "user.mfa_enrolled",
    targetType: "user",
    targetId: userId,
  });
}

export function verifyMfaCode(userId: number, code: string): boolean {
  const row = getAppDb()
    .prepare(`SELECT mfa_secret, mfa_backup_hash, mfa_enabled FROM users WHERE id = ?`)
    .get(userId) as
    | { mfa_secret: string | null; mfa_backup_hash: string | null; mfa_enabled: number }
    | undefined;
  if (!row) return false;
  if (row.mfa_secret && verifyTotp(row.mfa_secret, code)) return true;
  if (row.mfa_backup_hash) {
    const provided = Buffer.from(hashBackup(code));
    const stored = Buffer.from(row.mfa_backup_hash);
    if (provided.length === stored.length && timingSafeEqual(provided, stored)) {
      getAppDb()
        .prepare(`UPDATE users SET mfa_backup_hash = NULL, updated_at = datetime('now') WHERE id = ?`)
        .run(userId);
      return true;
    }
  }
  return false;
}

export function disableMfa(userId: number): void {
  getAppDb()
    .prepare(
      `UPDATE users SET mfa_enabled = 0, mfa_secret = NULL, mfa_backup_hash = NULL, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(userId);
  audit({
    actorUserId: userId,
    action: "user.mfa_disabled",
    targetType: "user",
    targetId: userId,
  });
}

export function isMfaEnrolled(userId: number): boolean {
  const row = getAppDb()
    .prepare(`SELECT mfa_enabled FROM users WHERE id = ?`)
    .get(userId) as { mfa_enabled: number } | undefined;
  return row?.mfa_enabled === 1;
}
