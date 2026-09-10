import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { config } from "@/lib/config";
import { PerseusError } from "@/lib/errors";

/**
 * READ-ONLY dealership data-access layer.
 *
 * The dealership operational database (`perseus_equipment_database.db`) is the
 * source of truth and must NEVER be modified. This module:
 *   1. Opens the connection with `readOnly: true` (SQLite-enforced) using
 *      Node's built-in `node:sqlite` (no native addon — avoids the finalizer
 *      crash better-sqlite3 hits inside Next.js render workers).
 *   2. Adds `PRAGMA query_only = ON` as a second belt-and-braces guard.
 *   3. Adds an application-level guard that rejects any statement that is not a
 *      pure read (SELECT / WITH / EXPLAIN / read-only PRAGMA).
 *   4. Reuses a single connection across hot reloads in development.
 */

type GlobalWithDb = typeof globalThis & {
  __perseusDealershipDb__?: DatabaseSync;
};

const g = globalThis as GlobalWithDb;

function openConnection(): DatabaseSync {
  if (!fs.existsSync(config.dealershipDbPath)) {
    throw new PerseusError(
      "DB_UNAVAILABLE",
      `Dealership database not found at ${config.dealershipDbPath}`,
    );
  }
  const db = new DatabaseSync(config.dealershipDbPath, { readOnly: true });
  db.exec("PRAGMA query_only = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  return db;
}

export function getDealershipDb(): DatabaseSync {
  if (!g.__perseusDealershipDb__) {
    g.__perseusDealershipDb__ = openConnection();
  }
  return g.__perseusDealershipDb__;
}

/** Statements permitted against the read-only dealership database. */
const READ_ONLY_PREFIX =
  /^\s*(?:--[^\n]*\n|\/\*[\s\S]*?\*\/|\s)*(select|with|explain|pragma)\b/i;
// PRAGMA is allowed only for schema introspection (no assignment form `pragma x = y`).
const PRAGMA_WRITE = /^\s*pragma\b[^;]*=/i;

function assertReadOnly(sql: string): void {
  if (!READ_ONLY_PREFIX.test(sql) || PRAGMA_WRITE.test(sql)) {
    throw new PerseusError(
      "READ_ONLY_VIOLATION",
      "Only read-only statements (SELECT/WITH/EXPLAIN/PRAGMA introspection) are permitted against dealership data.",
      { details: { sql: sql.slice(0, 200) } },
    );
  }
}

// node:sqlite returns null-prototype row objects; normalize to plain objects.
function toPlain<T>(row: unknown): T {
  return { ...(row as Record<string, unknown>) } as T;
}

/** Run a read-only query returning all rows. */
export function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): T[] {
  assertReadOnly(sql);
  const stmt = getDealershipDb().prepare(sql);
  const rows = stmt.all(...(params as never[]));
  return rows.map((r) => toPlain<T>(r));
}

/** Run a read-only query returning a single row (or undefined). */
export function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): T | undefined {
  assertReadOnly(sql);
  const stmt = getDealershipDb().prepare(sql);
  const row = stmt.get(...(params as never[]));
  return row === undefined ? undefined : toPlain<T>(row);
}

/** Convenience scalar reader for single-value aggregates. */
export function queryScalar<T = number>(
  sql: string,
  params: unknown[] = [],
): T | undefined {
  const row = queryOne<Record<string, unknown>>(sql, params);
  if (!row) return undefined;
  const first = Object.values(row)[0];
  return (first ?? undefined) as T | undefined;
}
