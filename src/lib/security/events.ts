import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { getAppDb } from "@/lib/db/app";
import { parseUserAgent, deviceFingerprint, type DeviceInfo } from "@/lib/security/useragent";
import { approximateGeo } from "@/lib/security/geo";
import { assessLoginRisk, type RiskLevel } from "@/lib/security/risk";

/**
 * Login-event recorder and IP-rule enforcement — the bridge between the auth
 * flow and the Security & Login Intelligence area. Records one row per attempt,
 * maintains the per-user device registry, and computes risk from real history.
 */

export interface DeviceContext {
  info: DeviceInfo;
  deviceId: string;
}

/** Compute the device fingerprint for a (user, user-agent) pair. */
export function buildDeviceContext(userId: number, userAgent: string | null): DeviceContext {
  const info = parseUserAgent(userAgent);
  return { info, deviceId: deviceFingerprint(userId, info) };
}

export function isIpBlocked(ip: string | null | undefined, db: DatabaseSync = getAppDb()): boolean {
  const addr = (ip ?? "").trim();
  if (!addr) return false;
  const row = db
    .prepare("SELECT COUNT(*) v FROM ip_rules WHERE rule='block' AND ip = ?")
    .get(addr) as { v: number };
  return (row?.v ?? 0) > 0;
}

export interface RecordLoginInput {
  userId: number | null;
  email: string;
  organization?: string | null;
  success: boolean;
  failureReason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
  deviceInfo?: DeviceInfo | null;
  mfaStatus?: string | null;
  sessionId?: number | null;
  lockedOut?: boolean;
}

export interface RecordLoginResult {
  eventId: number;
  riskLevel: RiskLevel;
  riskReasons: string[];
  deviceKnown: boolean;
}

export function recordLoginEvent(
  input: RecordLoginInput,
  db: DatabaseSync = getAppDb(),
): RecordLoginResult {
  const info = input.deviceInfo ?? parseUserAgent(input.userAgent);
  const deviceId =
    input.deviceId ??
    (input.userId ? deviceFingerprint(input.userId, info) : null);

  // Has this device been seen for this user before? (recognized vs new)
  let deviceKnown = false;
  if (input.userId && deviceId) {
    const row = db
      .prepare(
        "SELECT COUNT(*) v FROM trusted_devices WHERE user_id = ? AND device_id = ?",
      )
      .get(input.userId, deviceId) as { v: number };
    deviceKnown = (row?.v ?? 0) > 0;
  }

  const risk = assessLoginRisk(db, {
    userId: input.userId,
    email: input.email,
    ip: input.ip ?? null,
    deviceKnown,
    success: input.success,
    failureReason: input.failureReason,
    mfaStatus: input.mfaStatus,
    lockedOut: input.lockedOut,
  });

  const geo = approximateGeo(input.ip);

  const info2 = db
    .prepare(
      `INSERT INTO login_events
        (user_id, email, organization, success, failure_reason, ip, user_agent,
         browser, os, device_type, device_id, device_known, mfa_status, session_id,
         geo_approx, risk_level, risk_reasons)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.userId,
      input.email.toLowerCase(),
      input.organization ?? null,
      input.success ? 1 : 0,
      input.failureReason ?? null,
      input.ip ?? null,
      info.raw || null,
      info.browser,
      info.os,
      info.deviceType,
      deviceId,
      deviceKnown ? 1 : 0,
      input.mfaStatus ?? null,
      input.sessionId ?? null,
      geo.label,
      risk.level,
      JSON.stringify(risk.reasons),
    );
  const eventId = Number(info2.lastInsertRowid);

  // Maintain the per-user device registry.
  if (input.userId && deviceId) {
    db.prepare(
      `INSERT INTO trusted_devices (user_id, device_id, label, browser, os, device_type, login_count, first_seen, last_seen)
       VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
       ON CONFLICT(user_id, device_id) DO UPDATE SET
         login_count = login_count + 1,
         last_seen = datetime('now')`,
    ).run(
      input.userId,
      deviceId,
      `${info.browser} on ${info.os}`,
      info.browser,
      info.os,
      info.deviceType,
    );
  }

  // Correlate the session with this device / risk / MFA status.
  if (input.sessionId) {
    db.prepare(
      "UPDATE sessions SET device_id = ?, mfa_status = ?, risk_level = ?, last_activity_at = datetime('now') WHERE id = ?",
    ).run(deviceId, input.mfaStatus ?? null, risk.level, input.sessionId);
  }

  return {
    eventId,
    riskLevel: risk.level,
    riskReasons: risk.reasons,
    deviceKnown,
  };
}
