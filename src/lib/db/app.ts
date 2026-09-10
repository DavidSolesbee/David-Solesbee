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
  seedAppStore(db);
  return db;
}

export function getAppDb(): DatabaseSync {
  if (!g.__perseusAppDb__) {
    g.__perseusAppDb__ = openConnection();
  }
  return g.__perseusAppDb__;
}
