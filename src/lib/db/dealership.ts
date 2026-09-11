import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { config } from "@/lib/config";
import { PerseusError } from "@/lib/errors";
import {
  getActiveMembershipByTenant,
  getTenantDataSource,
} from "@/lib/tenant/organizations";
import { loadUserById } from "@/lib/auth/authz";

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

/**
 * Tenant-aware data-source resolver (Auth v2, Phase B).
 *
 * Every tenant declares its data source in the `tenants` table. Today all
 * tenants bind to the single `dealership_sqlite` dataset (the Perseus
 * operational database; client tenants reuse it), so this returns the one read-only
 * connection. This is the SEAM where, when datasets diverge per tenant, the
 * routing to a per-tenant connection will happen — callers already pass the
 * validated `activeTenantId` from the request's tenant context, never a
 * client-supplied id.
 */
export function getDealershipDbForTenant(tenantId?: string | null): DatabaseSync {
  if (tenantId) {
    const src = getTenantDataSource(tenantId);
    if (!src || src.status !== "active") {
      throw new PerseusError("FORBIDDEN", "Tenant is not available.");
    }
  }
  // Single shared dealership dataset for all current tenants.
  return getDealershipDb();
}

/**
 * Access token for tenant-scoped dealership queries. Both fields must come
 * from a server-validated AuthContext — never from a URL/body/cookie the
 * client supplied without membership re-check.
 */
export interface TenantAccess {
  userId: number;
  tenantId: string;
  /** Set only from a platform-admin View-As AuthContext — never from the client. */
  platformViewAs?: boolean;
}

/**
 * Re-validate membership, then run a read. A client-supplied tenant id that
 * the user is not an active member of is rejected here — this is the last
 * line of defense for every dealership query.
 */
function assertTenantAccess(access: TenantAccess | null | undefined): TenantAccess {
  if (!access?.userId || !access.tenantId) {
    throw new PerseusError(
      "FORBIDDEN",
      "Dealership data requires a validated tenant context.",
    );
  }
  const membership = getActiveMembershipByTenant(access.userId, access.tenantId);
  const platformOk =
    !membership &&
    access.platformViewAs === true &&
    !!loadUserById(access.userId)?.permissions.has("platform.admin");
  if (!membership && !platformOk) {
    throw new PerseusError("FORBIDDEN", "You are not authorized for this tenant.");
  }
  const src = getTenantDataSource(access.tenantId);
  if (!src || src.status !== "active") {
    throw new PerseusError("FORBIDDEN", "Tenant is not available.");
  }
  return access;
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

/** Tenant-scoped read — membership is re-validated on every call. */
export function queryForTenant<T = Record<string, unknown>>(
  access: TenantAccess,
  sql: string,
  params: unknown[] = [],
): T[] {
  const ok = assertTenantAccess(access);
  assertReadOnly(sql);
  const stmt = getDealershipDbForTenant(ok.tenantId).prepare(sql);
  const rows = stmt.all(...(params as never[]));
  return rows.map((r) => toPlain<T>(r));
}

export function queryScalarForTenant<T = number>(
  access: TenantAccess,
  sql: string,
  params: unknown[] = [],
): T | undefined {
  const rows = queryForTenant<Record<string, unknown>>(access, sql, params);
  if (!rows[0]) return undefined;
  const first = Object.values(rows[0])[0];
  return (first ?? undefined) as T | undefined;
}
