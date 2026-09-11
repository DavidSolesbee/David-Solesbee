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
  default_department TEXT,
  -- Auth v2: NULL = global/platform role (reusable by any org);
  -- a value scopes a custom role to one organization. Global roles only in Phase A.
  organization_id INTEGER
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
  mfa_secret TEXT,
  mfa_backup_hash TEXT,
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

-- =====================================================================
-- Multi-tenant identity (Auth v2, Phase A) — organizations, tenants, and
-- the many-to-many user<->organization membership. These are ADDITIVE: the
-- existing single-role users model is untouched; memberships mirror it and
-- become authoritative for tenant routing in later phases.
-- =====================================================================

-- A client organization (the customer-facing entity shown in the selector).
CREATE TABLE IF NOT EXISTS organizations (
  id INTEGER PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active','suspended','disabled')),
  subscription_status TEXT NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active','trial','past_due','canceled')),
  -- Convenience metadata only. primary_domain is used for login-time BRANDING /
  -- SSO discovery HINTS — never for authorization.
  primary_domain TEXT,
  location TEXT,
  logo_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_org_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_org_tenant ON organizations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_org_domain ON organizations(primary_domain);

-- The data-source binding for a tenant. The tenant-aware resolver (Phase B)
-- maps tenant_id -> a concrete data source. In Phase A every tenant points at
-- the Perseus operational dataset (platform test tenant; client tenants reuse it).
CREATE TABLE IF NOT EXISTS tenants (
  tenant_id TEXT PRIMARY KEY,
  data_source_kind TEXT NOT NULL DEFAULT 'dealership_sqlite',
  data_source_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','suspended','disabled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Many-to-many: a user may belong to zero, one, or many organizations, with a
-- role that can differ PER organization (role lives on the membership).
CREATE TABLE IF NOT EXISTS user_organization_memberships (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role_id INTEGER REFERENCES roles(id),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','invited','suspended','removed')),
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_accessed_at TEXT,
  UNIQUE(user_id, organization_id)
);
CREATE INDEX IF NOT EXISTS idx_uom_user ON user_organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_uom_org ON user_organization_memberships(organization_id);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip TEXT,
  user_agent TEXT,
  revoked_at TEXT,
  -- Auth v2 (Phase B): the tenant context this session is currently acting in.
  -- Bound + validated server-side against an active membership; NEVER trusted
  -- from the client. NULL until a membership is established at login/selection.
  active_organization_id INTEGER REFERENCES organizations(id),
  active_tenant_id TEXT,
  active_role_id INTEGER REFERENCES roles(id),
  -- Auth v2 (Phase E): platform-admin View-As. The admin remains themselves;
  -- this only overrides which tenant's data they are inspecting. NULL = off.
  viewing_as_organization_id INTEGER REFERENCES organizations(id)
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

-- =====================================================================
-- Dashboard Governance (Milestone 6)
-- =====================================================================
-- A dashboard is a named, ordered set of widgets owned by a user. Visibility
-- is 'personal' (owner only), 'role' (shared with a target role), or 'org'
-- (all app users). NOTE: visibility governs DISCOVERY only — every widget is
-- re-authorized against the VIEWER at render time, so a dashboard can never
-- expose data the viewer is not entitled to see.
CREATE TABLE IF NOT EXISTS dashboards (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal','role','org')),
  target_role_id INTEGER REFERENCES roles(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dashboards_owner ON dashboards(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_visibility ON dashboards(visibility);

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id INTEGER PRIMARY KEY,
  dashboard_id INTEGER NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  widget_key TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_dash ON dashboard_widgets(dashboard_id);

-- =====================================================================
-- Automated Reporting (Milestone 7)
-- =====================================================================
-- Admin-console reporting. Recipients are resolved from approved app users
-- (never arbitrary emails). Content is ALWAYS re-authorized against EACH
-- recipient at generation time — a schedule never grants access.
CREATE TABLE IF NOT EXISTS report_definitions (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL DEFAULT 'custom',
  period_key TEXT NOT NULL DEFAULT 'last_7_days',
  comparison_key TEXT NOT NULL DEFAULT 'previous_equivalent',
  custom_days INTEGER NOT NULL DEFAULT 14,
  schedule_kind TEXT NOT NULL DEFAULT 'weekdays',
  schedule_days TEXT,
  monthly_mode TEXT NOT NULL DEFAULT 'calendar_day',
  monthly_day INTEGER,
  custom_interval_days INTEGER NOT NULL DEFAULT 14,
  delivery_time TEXT NOT NULL DEFAULT '06:30',
  timezone TEXT NOT NULL DEFAULT 'America/Chicago',
  top_n INTEGER NOT NULL DEFAULT 10 CHECK (top_n IN (5, 10, 20)),
  format_html INTEGER NOT NULL DEFAULT 1,
  format_pdf INTEGER NOT NULL DEFAULT 1,
  format_link INTEGER NOT NULL DEFAULT 1,
  ai_narrative INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused')),
  next_run_at TEXT,
  last_run_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reports_owner ON report_definitions(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON report_definitions(status);
CREATE INDEX IF NOT EXISTS idx_reports_next ON report_definitions(next_run_at);

CREATE TABLE IF NOT EXISTS report_audience_rules (
  id INTEGER PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES report_definitions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('user','role','department','location')),
  value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_report_audience ON report_audience_rules(report_id);

CREATE TABLE IF NOT EXISTS report_sections (
  id INTEGER PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES report_definitions(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_report_sections ON report_sections(report_id);

CREATE TABLE IF NOT EXISTS report_runs (
  id INTEGER PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES report_definitions(id) ON DELETE CASCADE,
  run_at TEXT NOT NULL DEFAULT (datetime('now')),
  triggered_by INTEGER REFERENCES users(id),
  trigger_kind TEXT NOT NULL DEFAULT 'manual'
    CHECK (trigger_kind IN ('manual','scheduled','test')),
  period_start TEXT,
  period_end TEXT,
  period_label TEXT,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  suppressed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'generating'
);
CREATE INDEX IF NOT EXISTS idx_report_runs_report ON report_runs(report_id);
CREATE INDEX IF NOT EXISTS idx_report_runs_at ON report_runs(run_at);

CREATE TABLE IF NOT EXISTS report_deliveries (
  id INTEGER PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES report_runs(id) ON DELETE CASCADE,
  report_id INTEGER NOT NULL REFERENCES report_definitions(id) ON DELETE CASCADE,
  recipient_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_role TEXT,
  recipient_name TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','generating','delivered','failed','suppressed','cancelled')),
  generated_at TEXT,
  delivered_at TEXT,
  error_message TEXT,
  sections_total INTEGER NOT NULL DEFAULT 0,
  sections_authorized INTEGER NOT NULL DEFAULT 0,
  sections_restricted INTEGER NOT NULL DEFAULT 0,
  snapshot TEXT,
  email_html TEXT
);
CREATE INDEX IF NOT EXISTS idx_report_deliveries_run ON report_deliveries(run_id);
CREATE INDEX IF NOT EXISTS idx_report_deliveries_user ON report_deliveries(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_report_deliveries_report ON report_deliveries(report_id);

-- Auth v2 (Phase F): per-organization authentication policy.
CREATE TABLE IF NOT EXISTS organization_auth_settings (
  organization_id INTEGER PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  require_mfa INTEGER NOT NULL DEFAULT 0,
  sso_enabled INTEGER NOT NULL DEFAULT 0,
  sso_provider TEXT,
  allow_password INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS organization_invitations (
  id INTEGER PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role_id INTEGER REFERENCES roles(id),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by INTEGER REFERENCES users(id),
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_invites_org ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invites_email ON organization_invitations(email);

CREATE TABLE IF NOT EXISTS mfa_challenges (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mfa_challenges_user ON mfa_challenges(user_id);
`;
