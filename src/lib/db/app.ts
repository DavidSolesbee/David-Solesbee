import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { config } from "@/lib/config";
import { APP_SCHEMA_SQL } from "@/lib/db/schema";
import { seedAppStore } from "@/lib/auth/seed";

/**
 * Perseus APPLICATION store (separate from dealership data).
 *
 * Read/write SQLite database holding Perseus's own state: users, roles,
 * permissions, access requests, sessions, password resets, and audit history.
 * Kept apart from the dealership operational database so source data is never
 * written to. Uses Node's built-in `node:sqlite`.
 *
 * On first open it creates the schema and seeds roles, permissions, and demo
 * accounts (idempotent).
 */

type GlobalWithAppDb = typeof globalThis & {
  __perseusAppDb__?: DatabaseSync;
};

const g = globalThis as GlobalWithAppDb;

function openConnection(): DatabaseSync {
  const dir = path.dirname(config.appDbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new DatabaseSync(config.appDbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(APP_SCHEMA_SQL);
  runMigrations(db);
  seedAppStore(db);
  return db;
}

/**
 * Idempotent, additive column migrations for tables that already existed before
 * a feature was added. SQLite ADD COLUMN is safe and cheap; we swallow the
 * "duplicate column" error so this is re-runnable.
 */
function runMigrations(db: DatabaseSync): void {
  const addColumn = (table: string, ddl: string) => {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    } catch {
      /* column already exists */
    }
  };
  // Security & Login Intelligence: correlate sessions with devices / MFA.
  addColumn("sessions", "device_id TEXT");
  addColumn("sessions", "mfa_status TEXT");
  addColumn("sessions", "last_activity_at TEXT");
  addColumn("sessions", "risk_level TEXT");

  // Auth v2 (Phase A): org-scoped custom roles. NULL = global/platform role.
  addColumn("roles", "organization_id INTEGER");

  // Auth v2 (Phase B): active tenant context bound to a session. Validated
  // server-side against an active membership on every request; never trusted
  // from the client.
  addColumn("sessions", "active_organization_id INTEGER");
  addColumn("sessions", "active_tenant_id TEXT");
  addColumn("sessions", "active_role_id INTEGER");
  addColumn("sessions", "viewing_as_organization_id INTEGER");

  // Milestone 7: replace the early draft report tables (widget/recipient lists)
  // with the admin-console schema (templates, audience rules, periods, deliveries).
  migrateReportSchema(db);

  // Milestone 8: optional AI executive summary on automated reports.
  addColumn("report_definitions", "ai_narrative INTEGER NOT NULL DEFAULT 0");

  // Auth v2 (Phase F): MFA secrets + backup hash on the user row.
  addColumn("users", "mfa_secret TEXT");
  addColumn("users", "mfa_backup_hash TEXT");
}

function migrateReportSchema(db: DatabaseSync): void {
  const cols = db
    .prepare("PRAGMA table_info(report_definitions)")
    .all() as { name: string }[];
  if (cols.length === 0) return;
  if (cols.some((c) => c.name === "template_key")) return;
  db.exec(`
    DROP TABLE IF EXISTS report_run_deliveries;
    DROP TABLE IF EXISTS report_runs;
    DROP TABLE IF EXISTS report_recipients;
    DROP TABLE IF EXISTS report_widgets;
    DROP TABLE IF EXISTS report_definitions;
  `);
  db.exec(APP_SCHEMA_SQL);
}

export function getAppDb(): DatabaseSync {
  if (!g.__perseusAppDb__) {
    g.__perseusAppDb__ = openConnection();
  }
  return g.__perseusAppDb__;
}
