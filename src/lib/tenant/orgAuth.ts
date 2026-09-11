import "server-only";
import { getAppDb } from "@/lib/db/app";
import { audit } from "@/lib/auth/audit";
import type { AuthUser } from "@/lib/auth/authz";
import { PerseusError } from "@/lib/errors";
import type { AuthContext } from "@/lib/tenant/context";

export interface OrgAuthSettings {
  organizationId: number;
  requireMfa: boolean;
  ssoEnabled: boolean;
  ssoProvider: string | null;
  allowPassword: boolean;
}

function rowToSettings(organizationId: number, row?: {
  require_mfa: number;
  sso_enabled: number;
  sso_provider: string | null;
  allow_password: number;
}): OrgAuthSettings {
  return {
    organizationId,
    requireMfa: row?.require_mfa === 1,
    ssoEnabled: row?.sso_enabled === 1,
    ssoProvider: row?.sso_provider ?? null,
    allowPassword: row?.allow_password !== 0,
  };
}

export function ensureOrgAuthSettings(organizationId: number): OrgAuthSettings {
  const db = getAppDb();
  db.prepare(
    `INSERT INTO organization_auth_settings (organization_id)
     VALUES (?) ON CONFLICT(organization_id) DO NOTHING`,
  ).run(organizationId);
  const row = db
    .prepare(
      `SELECT require_mfa, sso_enabled, sso_provider, allow_password
       FROM organization_auth_settings WHERE organization_id = ?`,
    )
    .get(organizationId) as
    | { require_mfa: number; sso_enabled: number; sso_provider: string | null; allow_password: number }
    | undefined;
  return rowToSettings(organizationId, row);
}

export function getOrgAuthSettings(organizationId: number): OrgAuthSettings {
  return ensureOrgAuthSettings(organizationId);
}

/** True when any of the user's active memberships belongs to an org that requires MFA. */
export function userRequiresMfaByOrg(userId: number): boolean {
  const row = getAppDb()
    .prepare(
      `SELECT 1 AS ok
       FROM user_organization_memberships m
       JOIN organization_auth_settings s ON s.organization_id = m.organization_id
       JOIN organizations o ON o.id = m.organization_id
       WHERE m.user_id = ? AND m.status = 'active' AND o.account_status = 'active'
         AND s.require_mfa = 1
       LIMIT 1`,
    )
    .get(userId) as { ok: number } | undefined;
  return !!row;
}

export function updateOrgAuthSettings(
  actor: AuthUser,
  organizationId: number,
  patch: { requireMfa?: boolean; ssoEnabled?: boolean },
): OrgAuthSettings {
  if (!actor.permissions.has("app.admin")) {
    throw new PerseusError("FORBIDDEN", "You cannot change organization auth settings.");
  }
  const ctx = actor as AuthContext;
  const platform = actor.permissions.has("platform.admin");
  if (!platform && ctx.activeOrganizationId !== organizationId) {
    throw new PerseusError("FORBIDDEN", "You can only change auth settings for your organization.");
  }
  ensureOrgAuthSettings(organizationId);
  const current = getOrgAuthSettings(organizationId);
  const requireMfa = patch.requireMfa ?? current.requireMfa;
  const ssoEnabled = patch.ssoEnabled ?? current.ssoEnabled;
  getAppDb()
    .prepare(
      `UPDATE organization_auth_settings
          SET require_mfa = ?, sso_enabled = ?, sso_provider = CASE WHEN ? = 1 THEN COALESCE(sso_provider, 'oidc') ELSE sso_provider END,
              updated_at = datetime('now')
        WHERE organization_id = ?`,
    )
    .run(requireMfa ? 1 : 0, ssoEnabled ? 1 : 0, ssoEnabled ? 1 : 0, organizationId);
  audit({
    actorUserId: actor.id,
    actorLabel: actor.email,
    action: "organization.auth_settings",
    targetType: "organization",
    targetId: organizationId,
    detail: { requireMfa, ssoEnabled },
  });
  return getOrgAuthSettings(organizationId);
}
