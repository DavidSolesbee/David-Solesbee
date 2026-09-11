import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { getAppDb } from "@/lib/db/app";
import { hashPassword } from "@/lib/auth/password";
import { audit } from "@/lib/auth/audit";
import type { AuthUser } from "@/lib/auth/authz";
import { getRole } from "@/lib/auth/catalog";
import { PerseusError } from "@/lib/errors";
import type { AuthContext } from "@/lib/tenant/context";
import { getOrganizationById } from "@/lib/tenant/organizations";

const INVITE_TTL_DAYS = 7;

export interface InvitationRow {
  id: number;
  organization_id: number;
  organization_name: string;
  email: string;
  role_key: string | null;
  role_name: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function actorOrgId(actor: AuthUser): number {
  const orgId = (actor as AuthContext).activeOrganizationId;
  if (typeof orgId !== "number") {
    throw new PerseusError("FORBIDDEN", "No organization context.");
  }
  return orgId;
}

export function listInvitations(actor: AuthUser): InvitationRow[] {
  if (!actor.permissions.has("feature.manage_users")) {
    throw new PerseusError("FORBIDDEN", "You cannot manage invitations.");
  }
  const orgId = actorOrgId(actor);
  return getAppDb()
    .prepare(
      `SELECT i.id, i.organization_id, o.name AS organization_name, i.email,
              r.key AS role_key, r.name AS role_name,
              i.expires_at, i.accepted_at, i.revoked_at, i.created_at
         FROM organization_invitations i
         JOIN organizations o ON o.id = i.organization_id
         LEFT JOIN roles r ON r.id = i.role_id
        WHERE i.organization_id = ?
        ORDER BY i.created_at DESC
        LIMIT 100`,
    )
    .all(orgId) as unknown as InvitationRow[];
}

export function createInvitation(
  actor: AuthUser,
  emailRaw: string,
  roleKey: string,
): { token: string; expiresAt: string } {
  if (!actor.permissions.has("feature.manage_users")) {
    throw new PerseusError("FORBIDDEN", "You cannot invite users.");
  }
  const orgId = actorOrgId(actor);
  const email = emailRaw.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new PerseusError("VALIDATION", "Enter a valid email address.");
  }
  const role = getRole(roleKey);
  if (!role) throw new PerseusError("VALIDATION", "Unknown role.");
  if (role.hierarchyLevel > (actor.hierarchyLevel ?? 0)) {
    throw new PerseusError("FORBIDDEN", "You cannot invite a role above your own authority.");
  }
  const existing = getAppDb()
    .prepare(
      `SELECT 1 FROM user_organization_memberships m
       JOIN users u ON u.id = m.user_id
       WHERE u.email = ? AND m.organization_id = ? AND m.status != 'removed'`,
    )
    .get(email, orgId);
  if (existing) {
    throw new PerseusError("VALIDATION", "That person is already a member of this organization.");
  }
  getAppDb()
    .prepare(
      `UPDATE organization_invitations SET revoked_at = datetime('now')
        WHERE organization_id = ? AND email = ? AND accepted_at IS NULL AND revoked_at IS NULL`,
    )
    .run(orgId, email);

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400 * 1000).toISOString();
  const roleRow = getAppDb()
    .prepare("SELECT id FROM roles WHERE key = ?")
    .get(roleKey) as { id: number };
  getAppDb()
    .prepare(
      `INSERT INTO organization_invitations
         (organization_id, email, role_id, token_hash, invited_by, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(orgId, email, roleRow.id, hashToken(token), actor.id, expiresAt);
  audit({
    actorUserId: actor.id,
    actorLabel: actor.email,
    action: "organization.invite",
    targetType: "organization",
    targetId: orgId,
    detail: { email, roleKey },
  });
  return { token, expiresAt };
}

export function revokeInvitation(actor: AuthUser, invitationId: number): void {
  if (!actor.permissions.has("feature.manage_users")) {
    throw new PerseusError("FORBIDDEN", "You cannot manage invitations.");
  }
  const orgId = actorOrgId(actor);
  const info = getAppDb()
    .prepare(
      `UPDATE organization_invitations SET revoked_at = datetime('now')
        WHERE id = ? AND organization_id = ? AND accepted_at IS NULL AND revoked_at IS NULL`,
    )
    .run(invitationId, orgId);
  if (!Number(info.changes)) {
    throw new PerseusError("NOT_FOUND", "Invitation is not open.");
  }
  audit({
    actorUserId: actor.id,
    action: "organization.invite_revoked",
    targetType: "invitation",
    targetId: invitationId,
  });
}

export interface OpenInvitation {
  id: number;
  organizationId: number;
  organizationName: string;
  email: string;
  roleKey: string | null;
  roleName: string | null;
}

export function getOpenInvitation(rawToken: string): OpenInvitation | null {
  const row = getAppDb()
    .prepare(
      `SELECT i.id, i.organization_id, o.name AS organization_name, i.email,
              r.key AS role_key, r.name AS role_name
         FROM organization_invitations i
         JOIN organizations o ON o.id = i.organization_id
         LEFT JOIN roles r ON r.id = i.role_id
        WHERE i.token_hash = ?
          AND i.accepted_at IS NULL AND i.revoked_at IS NULL
          AND i.expires_at > datetime('now')
          AND o.account_status = 'active'`,
    )
    .get(hashToken(rawToken)) as
    | {
        id: number;
        organization_id: number;
        organization_name: string;
        email: string;
        role_key: string | null;
        role_name: string | null;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    email: row.email,
    roleKey: row.role_key,
    roleName: row.role_name,
  };
}

export function acceptInvitation(
  rawToken: string,
  input: { firstName?: string; lastName?: string; password?: string },
): { userId: number; organizationId: number } {
  const invite = getOpenInvitation(rawToken);
  if (!invite) throw new PerseusError("NOT_FOUND", "This invitation is not valid.");

  const db = getAppDb();
  let user = db
    .prepare("SELECT id, status FROM users WHERE email = ?")
    .get(invite.email) as { id: number; status: string } | undefined;

  if (!user) {
    const first = (input.firstName ?? "").trim();
    const last = (input.lastName ?? "").trim();
    const password = input.password ?? "";
    if (!first || !last || password.length < 8) {
      throw new PerseusError("VALIDATION", "Enter your name and a password of at least 8 characters.");
    }
    const org = getOrganizationById(invite.organizationId);
    const pw = hashPassword(password);
    db.prepare(
      `INSERT INTO users
         (first_name, last_name, email, password_hash, password_salt, role_id,
          dealership, status, source, activated_at)
       VALUES (?, ?, ?, ?, ?, (SELECT id FROM roles WHERE key = ?), ?, 'active', 'invited', datetime('now'))`,
    ).run(
      first,
      last,
      invite.email,
      pw.hash,
      pw.salt,
      invite.roleKey,
      org?.name ?? null,
    );
    user = db.prepare("SELECT id, status FROM users WHERE email = ?").get(invite.email) as {
      id: number;
      status: string;
    };
  }

  if (user.status !== "active") {
    db.prepare(
      `UPDATE users SET status='active', activated_at=datetime('now'), updated_at=datetime('now') WHERE id=?`,
    ).run(user.id);
  }

  db.prepare(
    `INSERT INTO user_organization_memberships
       (user_id, organization_id, role_id, status, is_primary)
     VALUES (?, ?, (SELECT role_id FROM organization_invitations WHERE id = ?), 'active',
             CASE WHEN NOT EXISTS (
               SELECT 1 FROM user_organization_memberships WHERE user_id = ? AND is_primary = 1
             ) THEN 1 ELSE 0 END)
     ON CONFLICT(user_id, organization_id) DO UPDATE SET
       role_id=excluded.role_id, status='active'`,
  ).run(user.id, invite.organizationId, invite.id, user.id);

  db.prepare(
    `UPDATE organization_invitations SET accepted_at = datetime('now') WHERE id = ?`,
  ).run(invite.id);

  audit({
    actorUserId: user.id,
    action: "organization.invite_accepted",
    targetType: "organization",
    targetId: invite.organizationId,
    detail: { invitationId: invite.id, email: invite.email },
  });
  return { userId: user.id, organizationId: invite.organizationId };
}
