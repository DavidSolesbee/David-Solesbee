import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { networkKey } from "@/lib/security/geo";

/**
 * Login risk engine.
 *
 * Computes a risk level (LOW / MEDIUM / HIGH / CRITICAL) for an authentication
 * attempt from REAL signals in the login history. Every elevated level carries
 * human-readable reasons so the score is never a black box. Geo-dependent rules
 * (new region / country, impossible travel) use a coarse network key as a
 * privacy-respecting proxy since no geo provider is configured.
 */

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskAssessment {
  level: RiskLevel;
  reasons: string[];
  score: number;
}

export interface RiskInput {
  userId: number | null;
  email: string;
  ip: string | null;
  deviceKnown: boolean;
  success: boolean;
  failureReason?: string | null;
  mfaStatus?: string | null;
  /** true when this attempt hit the lockout threshold */
  lockedOut?: boolean;
  nowIso?: string;
}

const WEIGHTS = {
  repeatedFail3: 3,
  repeatedFail5: 5,
  mfaFail: 3,
  newDevice: 2,
  newNetwork: 2,
  multiIp: 3,
  unusualTime: 1,
  impossibleTravel: 4,
  lockout: 4,
};

function scalar(db: DatabaseSync, sql: string, params: (string | number)[]): number {
  const row = db.prepare(sql).get(...params) as { v: number } | undefined;
  return row?.v ?? 0;
}

export function assessLoginRisk(db: DatabaseSync, input: RiskInput): RiskAssessment {
  const reasons: string[] = [];
  let score = 0;
  const now = input.nowIso ? new Date(input.nowIso) : new Date();
  const net = networkKey(input.ip);

  // Identify the subject for history lookups (prefer user_id, else email).
  const idClause = input.userId ? "user_id = ?" : "email = ?";
  const idParam = input.userId ?? input.email.toLowerCase();

  // 1) Repeated failed attempts in the last 15 minutes.
  const recentFails = scalar(
    db,
    `SELECT COUNT(*) v FROM login_events
     WHERE ${idClause} AND success = 0 AND created_at >= datetime('now','-15 minutes')`,
    [idParam],
  );
  if (recentFails + (input.success ? 0 : 1) >= 5) {
    score += WEIGHTS.repeatedFail5;
    reasons.push(`${recentFails + 1} failed attempts in 15 minutes`);
  } else if (recentFails + (input.success ? 0 : 1) >= 3) {
    score += WEIGHTS.repeatedFail3;
    reasons.push(`${recentFails + 1} failed attempts in 15 minutes`);
  }

  // 2) MFA failure.
  if (input.mfaStatus === "failed") {
    score += WEIGHTS.mfaFail;
    reasons.push("MFA verification failed");
  }

  // 3) Account lockout triggered by this attempt.
  if (input.lockedOut) {
    score += WEIGHTS.lockout;
    reasons.push("Account lockout threshold reached");
  }

  // History-based rules only meaningful once we know the user.
  if (input.userId) {
    const priorLogins = scalar(
      db,
      `SELECT COUNT(*) v FROM login_events WHERE user_id = ? AND success = 1`,
      [input.userId],
    );

    // 4) New device (only flag when the user has prior successful history).
    if (!input.deviceKnown && priorLogins > 0) {
      score += WEIGHTS.newDevice;
      reasons.push("Sign-in from a new device");
    }

    // 5) New network / region proxy.
    if (net !== "unknown" && priorLogins > 0) {
      const seenNet = scalar(
        db,
        `SELECT COUNT(*) v FROM login_events WHERE user_id = ? AND ip IS NOT NULL
         AND (substr(ip,1,length(ip)) IS NOT NULL) AND ip LIKE ?`,
        [input.userId, netLikePrefix(input.ip)],
      );
      if (seenNet === 0) {
        score += WEIGHTS.newNetwork;
        reasons.push("Sign-in from a new network / region (approx.)");
      }
    }

    // 6) Multiple distinct IPs in a short timeframe (last 10 minutes).
    const distinctIps = scalar(
      db,
      `SELECT COUNT(DISTINCT ip) v FROM login_events
       WHERE user_id = ? AND ip IS NOT NULL AND created_at >= datetime('now','-10 minutes')`,
      [input.userId],
    );
    if (distinctIps >= 3) {
      score += WEIGHTS.multiIp;
      reasons.push(`${distinctIps} different IP addresses in 10 minutes`);
    }

    // 7) Impossible travel proxy: two distinct PUBLIC networks within 30 min.
    if (!isPrivate(input.ip)) {
      const distinctPublicNets = scalar(
        db,
        `SELECT COUNT(DISTINCT substr(ip,1,7)) v FROM login_events
         WHERE user_id = ? AND ip IS NOT NULL AND ip NOT LIKE '127.%' AND ip NOT LIKE '192.168.%'
           AND ip NOT LIKE '10.%' AND ip <> '::1'
           AND created_at >= datetime('now','-30 minutes')`,
        [input.userId],
      );
      if (distinctPublicNets >= 2) {
        score += WEIGHTS.impossibleTravel;
        reasons.push("Potential impossible travel (approx.)");
      }
    }
  }

  // 8) Unusual login time (00:00–05:00 local server time).
  const hour = now.getHours();
  if (hour >= 0 && hour < 5) {
    score += WEIGHTS.unusualTime;
    reasons.push("Unusual login time (overnight)");
  }

  const level: RiskLevel =
    score >= 6 ? "CRITICAL" : score >= 4 ? "HIGH" : score >= 2 ? "MEDIUM" : "LOW";
  return { level, reasons, score };
}

function netLikePrefix(ip: string | null | undefined): string {
  const addr = (ip ?? "").trim();
  if (addr.includes(".")) return addr.split(".").slice(0, 2).join(".") + ".%";
  if (addr.includes(":")) return addr.split(":").slice(0, 3).join(":") + ":%";
  return addr + "%";
}

function isPrivate(ip: string | null | undefined): boolean {
  const a = (ip ?? "").trim();
  return (
    !a ||
    a === "::1" ||
    a.startsWith("127.") ||
    a.startsWith("10.") ||
    a.startsWith("192.168.") ||
    a.startsWith("172.")
  );
}
