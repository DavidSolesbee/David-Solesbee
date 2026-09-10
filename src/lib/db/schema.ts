/**
 * Perseus application store schema (SQLite via node:sqlite).
 *
 * This is the security/config database, entirely separate from the read-only
 * dealership data. All identity, roles, permissions, sessions, access requests,
 * and audit history live here.
 */
export const APP_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  hierarchy_level INTEGER NOT NULL,
  description TEXT NOT NULL,
  default_department TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  password_salt TEXT,
  role_id INTEGER REFERENCES roles(id),
  department TEXT,
  job_title TEXT,
  location_id INTEGER,
  location_name TEXT,
  dealership TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','denied','suspended','revoked','expired')),
  source TEXT NOT NULL DEFAULT 'seed',
  mfa_enabled INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  activated_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Individual permission overrides layered on top of the base role.
-- granted = 1 grants a permission the role lacks; granted = 0 revokes one it has.
CREATE TABLE IF NOT EXISTS user_permission_overrides (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted INTEGER NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, permission_id)
);

CREATE TABLE IF NOT EXISTS access_requests (
  id INTEGER PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  dealership TEXT,
  location_name TEXT,
  department TEXT,
  job_title TEXT,
  requested_role TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','denied','more_info')),
  decided_by INTEGER REFERENCES users(id),
  decided_at TEXT,
  decision_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_requests_status ON access_requests(status);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip TEXT,
  user_agent TEXT,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at TEXT
);

-- =====================================================================
-- Security & Login Intelligence (Admin Command Center, Feature Set 1)
-- =====================================================================

-- One row per authentication attempt (success or failure). Richer than the
-- audit log: carries device, approximate geo, MFA status, and computed risk.
CREATE TABLE IF NOT EXISTS login_events (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  email TEXT,
  organization TEXT,
  success INTEGER NOT NULL,
  failure_reason TEXT,
  ip TEXT,
  user_agent TEXT,
  browser TEXT,
  os TEXT,
  device_type TEXT,
  device_id TEXT,
  device_known INTEGER NOT NULL DEFAULT 0,
  mfa_status TEXT,
  session_id INTEGER REFERENCES sessions(id),
  geo_approx TEXT,
  risk_level TEXT NOT NULL DEFAULT 'LOW',
  risk_reasons TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_login_events_user ON login_events(user_id);
CREATE INDEX IF NOT EXISTS idx_login_events_ip ON login_events(ip);
CREATE INDEX IF NOT EXISTS idx_login_events_created ON login_events(created_at);
CREATE INDEX IF NOT EXISTS idx_login_events_success ON login_events(success);
CREATE INDEX IF NOT EXISTS idx_login_events_risk ON login_events(risk_level);

-- Devices seen for a user; may be explicitly trusted by an administrator.
CREATE TABLE IF NOT EXISTS trusted_devices (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  label TEXT,
  browser TEXT,
  os TEXT,
  device_type TEXT,
  trusted INTEGER NOT NULL DEFAULT 0,
  login_count INTEGER NOT NULL DEFAULT 1,
  first_seen TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices(user_id);

-- IP allowlist / blocklist rules (enforced server-side at login).
CREATE TABLE IF NOT EXISTS ip_rules (
  id INTEGER PRIMARY KEY,
  ip TEXT NOT NULL,
  rule TEXT NOT NULL CHECK (rule IN ('allow','block')),
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(ip, rule)
);
CREATE INDEX IF NOT EXISTS idx_ip_rules_ip ON ip_rules(ip);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  actor_user_id INTEGER REFERENCES users(id),
  actor_label TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  detail TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
`;
