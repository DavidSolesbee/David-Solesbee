import "server-only";
import { getAppDb } from "@/lib/db/app";

/**
 * Append-only audit log helper. Used across auth, admin, reporting, and AI to
 * record security-relevant events.
 */
export interface AuditEntry {
  actorUserId?: number | null;
  actorLabel?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | number | null;
  detail?: unknown;
  ip?: string | null;
}

export function audit(entry: AuditEntry): void {
  try {
    getAppDb()
      .prepare(
        `INSERT INTO audit_log (actor_user_id, actor_label, action, target_type, target_id, detail, ip)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.actorUserId ?? null,
        entry.actorLabel ?? null,
        entry.action,
        entry.targetType ?? null,
        entry.targetId != null ? String(entry.targetId) : null,
        entry.detail != null ? JSON.stringify(entry.detail) : null,
        entry.ip ?? null,
      );
  } catch {
    // auditing must never break the primary flow
  }
}
