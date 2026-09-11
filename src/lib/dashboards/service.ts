import "server-only";
import { getAppDb } from "@/lib/db/app";
import { PerseusError } from "@/lib/errors";
import { loadUserById, type AuthUser } from "@/lib/auth/authz";
import { audit } from "@/lib/auth/audit";
import { getWidget, resolveWidgetForViewer, type ResolvedWidget } from "@/lib/dashboards/catalog";

/**
 * Dashboard governance service.
 *
 * Guardrails:
 *  - Creating / editing / deleting requires `feature.manage_dashboards`.
 *  - A dashboard may only be published to a role at or below the actor's
 *    hierarchy level (you cannot target a role that outranks you).
 *  - Only the owner or an administrator may edit or delete a dashboard.
 *
 * Discovery vs. security: `visibility` controls who can DISCOVER a dashboard.
 * The data inside is always re-authorized against the viewer via the widget
 * catalog, so visibility never grants access to restricted measures.
 */

export type Visibility = "personal" | "role" | "org";

export interface DashboardInput {
  name: string;
  description: string | null;
  visibility: Visibility;
  targetRoleId: number | null;
  widgetKeys: string[];
}

export interface DashboardListItem {
  id: number;
  name: string;
  description: string | null;
  visibility: Visibility;
  targetRoleName: string | null;
  ownerName: string;
  ownerUserId: number;
  widgetCount: number;
  updatedAt: string;
  isOwner: boolean;
}

interface DashboardRow {
  id: number;
  name: string;
  description: string | null;
  owner_user_id: number;
  visibility: Visibility;
  target_role_id: number | null;
  created_at: string;
  updated_at: string;
  owner_first: string;
  owner_last: string;
  target_role_name: string | null;
  widget_count: number;
}

function fullName(first: string, last: string): string {
  return `${first} ${last}`.trim() || "Unknown";
}

function getUserRoleId(userId: number): number | null {
  const row = getAppDb()
    .prepare("SELECT role_id FROM users WHERE id = ?")
    .get(userId) as { role_id: number | null } | undefined;
  return row?.role_id ?? null;
}

export function canManageDashboards(user: AuthUser): boolean {
  return user.permissions.has("feature.manage_dashboards");
}

function assertCanManage(user: AuthUser): void {
  if (!canManageDashboards(user))
    throw new PerseusError("FORBIDDEN", "You do not have permission to manage dashboards.");
}

/** Whether a viewer may discover/open a dashboard row. */
function canView(user: AuthUser, d: DashboardRow, viewerRoleId: number | null): boolean {
  if (user.permissions.has("app.admin")) return true;
  if (d.owner_user_id === user.id) return true;
  if (d.visibility === "org") return true;
  if (d.visibility === "role") return d.target_role_id !== null && d.target_role_id === viewerRoleId;
  return false; // personal, not owner
}

function canEdit(user: AuthUser, d: DashboardRow): boolean {
  return canManageDashboards(user) && (d.owner_user_id === user.id || user.permissions.has("app.admin"));
}

const SELECT_DASHBOARD = `
  SELECT d.id, d.name, d.description, d.owner_user_id, d.visibility, d.target_role_id,
         d.created_at, d.updated_at,
         ou.first_name AS owner_first, ou.last_name AS owner_last,
         r.name AS target_role_name,
         (SELECT COUNT(*) FROM dashboard_widgets w WHERE w.dashboard_id = d.id) AS widget_count
  FROM dashboards d
  JOIN users ou ON ou.id = d.owner_user_id
  LEFT JOIN roles r ON r.id = d.target_role_id`;

/** Dashboards the user may discover. Admins see all. */
export function listVisibleDashboards(user: AuthUser): DashboardListItem[] {
  const roleId = getUserRoleId(user.id);
  const rows = getAppDb()
    .prepare(`${SELECT_DASHBOARD} ORDER BY d.updated_at DESC`)
    .all() as unknown as DashboardRow[];
  return rows
    .filter((d) => canView(user, d, roleId))
    .map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      visibility: d.visibility,
      targetRoleName: d.target_role_name,
      ownerName: fullName(d.owner_first, d.owner_last),
      ownerUserId: d.owner_user_id,
      widgetCount: d.widget_count,
      updatedAt: d.updated_at,
      isOwner: d.owner_user_id === user.id,
    }));
}

/** All dashboards, for admin oversight. */
export function listAllDashboards(actor: AuthUser): DashboardListItem[] {
  if (!actor.permissions.has("app.admin"))
    throw new PerseusError("FORBIDDEN", "Admin only.");
  const rows = getAppDb()
    .prepare(`${SELECT_DASHBOARD} ORDER BY d.updated_at DESC`)
    .all() as unknown as DashboardRow[];
  return rows.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    visibility: d.visibility,
    targetRoleName: d.target_role_name,
    ownerName: fullName(d.owner_first, d.owner_last),
    ownerUserId: d.owner_user_id,
    widgetCount: d.widget_count,
    updatedAt: d.updated_at,
    isOwner: d.owner_user_id === actor.id,
  }));
}

function loadRow(id: number): DashboardRow | null {
  const row = getAppDb()
    .prepare(`${SELECT_DASHBOARD} WHERE d.id = ?`)
    .get(id) as unknown as DashboardRow | undefined;
  return row ?? null;
}

function loadWidgetKeys(dashboardId: number): string[] {
  const rows = getAppDb()
    .prepare("SELECT widget_key FROM dashboard_widgets WHERE dashboard_id = ? ORDER BY position, id")
    .all(dashboardId) as { widget_key: string }[];
  return rows.map((r) => r.widget_key);
}

export interface DashboardDetail {
  id: number;
  name: string;
  description: string | null;
  visibility: Visibility;
  targetRoleName: string | null;
  ownerName: string;
  isOwner: boolean;
  canEdit: boolean;
  widgets: ResolvedWidget[];
}

/**
 * Resolve a dashboard for a specific VIEWER. Returns null if the viewer cannot
 * discover it. Every widget is re-authorized against the viewer (security
 * boundary) — restricted widgets come back as locked with no data.
 */
export function getDashboardForViewer(user: AuthUser, id: number): DashboardDetail | null {
  const d = loadRow(id);
  if (!d) return null;
  const roleId = getUserRoleId(user.id);
  if (!canView(user, d, roleId)) return null;

  const keys = loadWidgetKeys(id);
  const widgets = keys
    .map((k) => resolveWidgetForViewer(k, user))
    .filter((w): w is ResolvedWidget => w !== null);

  return {
    id: d.id,
    name: d.name,
    description: d.description,
    visibility: d.visibility,
    targetRoleName: d.target_role_name,
    ownerName: fullName(d.owner_first, d.owner_last),
    isOwner: d.owner_user_id === user.id,
    canEdit: canEdit(user, d),
    widgets,
  };
}

export interface DashboardForEdit {
  id: number;
  name: string;
  description: string | null;
  visibility: Visibility;
  targetRoleId: number | null;
  widgetKeys: string[];
}

/** Load a dashboard for editing (owner or admin + manage permission). */
export function getDashboardForEdit(user: AuthUser, id: number): DashboardForEdit {
  const d = loadRow(id);
  if (!d) throw new PerseusError("NOT_FOUND", "Dashboard not found.");
  if (!canEdit(user, d))
    throw new PerseusError("FORBIDDEN", "You cannot edit this dashboard.");
  return {
    id: d.id,
    name: d.name,
    description: d.description,
    visibility: d.visibility,
    targetRoleId: d.target_role_id,
    widgetKeys: loadWidgetKeys(id),
  };
}

/** Validate + normalize input, enforcing hierarchy on the target role. */
function validate(actor: AuthUser, input: DashboardInput): {
  name: string;
  description: string | null;
  visibility: Visibility;
  targetRoleId: number | null;
  widgetKeys: string[];
} {
  const name = input.name.trim();
  if (!name) throw new PerseusError("VALIDATION", "Dashboard name is required.");
  if (!["personal", "role", "org"].includes(input.visibility))
    throw new PerseusError("VALIDATION", "Invalid visibility.");

  let targetRoleId: number | null = null;
  if (input.visibility === "role") {
    if (!input.targetRoleId)
      throw new PerseusError("VALIDATION", "Select a target role for a role-shared dashboard.");
    const role = getAppDb()
      .prepare("SELECT id, name, hierarchy_level FROM roles WHERE id = ?")
      .get(input.targetRoleId) as { id: number; name: string; hierarchy_level: number } | undefined;
    if (!role) throw new PerseusError("VALIDATION", "Unknown target role.");
    // Hierarchy guardrail: cannot publish to a role that outranks the actor.
    if (actor.hierarchyLevel !== null && role.hierarchy_level > actor.hierarchyLevel)
      throw new PerseusError(
        "FORBIDDEN",
        `You cannot publish a dashboard to ${role.name} (higher than your level).`,
      );
    targetRoleId = role.id;
  }

  // Keep only known widgets, preserve order, de-duplicate.
  const seen = new Set<string>();
  const widgetKeys = input.widgetKeys.filter((k) => {
    if (seen.has(k) || !getWidget(k)) return false;
    seen.add(k);
    return true;
  });
  if (widgetKeys.length === 0)
    throw new PerseusError("VALIDATION", "Add at least one widget.");

  return { name, description: input.description?.trim() || null, visibility: input.visibility, targetRoleId, widgetKeys };
}

function writeWidgets(dashboardId: number, widgetKeys: string[]): void {
  const db = getAppDb();
  db.prepare("DELETE FROM dashboard_widgets WHERE dashboard_id = ?").run(dashboardId);
  const ins = db.prepare(
    "INSERT INTO dashboard_widgets (dashboard_id, widget_key, position) VALUES (?, ?, ?)",
  );
  widgetKeys.forEach((k, i) => ins.run(dashboardId, k, i));
}

export function createDashboard(actor: AuthUser, input: DashboardInput): number {
  assertCanManage(actor);
  const v = validate(actor, input);
  const db = getAppDb();
  const info = db
    .prepare(
      `INSERT INTO dashboards (name, description, owner_user_id, visibility, target_role_id)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(v.name, v.description, actor.id, v.visibility, v.targetRoleId);
  const id = Number(info.lastInsertRowid);
  writeWidgets(id, v.widgetKeys);
  audit({
    actorUserId: actor.id,
    actorLabel: actor.email,
    action: "dashboard.create",
    targetType: "dashboard",
    targetId: String(id),
    detail: `${v.name} (${v.visibility})`,
  });
  return id;
}

export function updateDashboard(actor: AuthUser, id: number, input: DashboardInput): void {
  assertCanManage(actor);
  const existing = loadRow(id);
  if (!existing) throw new PerseusError("NOT_FOUND", "Dashboard not found.");
  if (!canEdit(actor, existing))
    throw new PerseusError("FORBIDDEN", "You cannot edit this dashboard.");
  const v = validate(actor, input);
  getAppDb()
    .prepare(
      `UPDATE dashboards SET name = ?, description = ?, visibility = ?, target_role_id = ?,
              updated_at = datetime('now') WHERE id = ?`,
    )
    .run(v.name, v.description, v.visibility, v.targetRoleId, id);
  writeWidgets(id, v.widgetKeys);
  audit({
    actorUserId: actor.id,
    actorLabel: actor.email,
    action: "dashboard.update",
    targetType: "dashboard",
    targetId: String(id),
    detail: `${v.name} (${v.visibility})`,
  });
}

export function deleteDashboard(actor: AuthUser, id: number): void {
  const existing = loadRow(id);
  if (!existing) throw new PerseusError("NOT_FOUND", "Dashboard not found.");
  // Owner (with manage) or admin may delete.
  const isOwnerManager = canManageDashboards(actor) && existing.owner_user_id === actor.id;
  if (!isOwnerManager && !actor.permissions.has("app.admin"))
    throw new PerseusError("FORBIDDEN", "You cannot delete this dashboard.");
  getAppDb().prepare("DELETE FROM dashboards WHERE id = ?").run(id);
  audit({
    actorUserId: actor.id,
    actorLabel: actor.email,
    action: "dashboard.delete",
    targetType: "dashboard",
    targetId: String(id),
    detail: existing.name,
  });
}

const EXEC_WIDGETS = [
  "kpi.revenue",
  "kpi.invoices",
  "kpi.active_customers",
  "kpi.parts_margin",
  "kpi.payments",
  "kpi.open_wo",
  "kpi.inventory_value",
  "bars.revenue_by_year",
  "split.revenue_by_department",
  "list.top_customers",
];

const ROLE_BOARD_SEEDS: {
  name: string;
  description: string;
  roleKey: string;
  widgetKeys: string[];
}[] = [
  {
    name: "Executive Metrics",
    description: "Owner-level operating view. Shared with the Dealer Principal role.",
    roleKey: "dealer_principal",
    widgetKeys: EXEC_WIDGETS,
  },
  {
    name: "General Manager",
    description: "Dealership-wide operating metrics for the GM role.",
    roleKey: "general_manager",
    widgetKeys: EXEC_WIDGETS,
  },
  {
    name: "Operations",
    description: "Cross-department pulse: revenue, payments, inventory, and open work.",
    roleKey: "operations_manager",
    widgetKeys: ["kpi.revenue", "kpi.payments", "kpi.inventory_value", "kpi.open_wo"],
  },
  {
    name: "Sales Desk",
    description: "Revenue, invoices, customers, and inventory for the sales desk.",
    roleKey: "sales_manager",
    widgetKeys: [
      "kpi.revenue",
      "kpi.invoices",
      "kpi.active_customers",
      "kpi.inventory_value",
      "list.top_customers",
    ],
  },
  {
    name: "Parts Counter",
    description: "Parts margin, revenue, invoices, and inventory for the counter.",
    roleKey: "parts_manager",
    widgetKeys: ["kpi.parts_margin", "kpi.revenue", "kpi.invoices", "kpi.inventory_value"],
  },
  {
    name: "Service Shop",
    description: "Open work, revenue, and invoices for the shop.",
    roleKey: "service_manager",
    widgetKeys: ["kpi.open_wo", "kpi.revenue", "kpi.invoices"],
  },
];

function roleIdByKey(key: string): number | null {
  const row = getAppDb()
    .prepare("SELECT id FROM roles WHERE key = ?")
    .get(key) as { id: number } | undefined;
  return row?.id ?? null;
}

function firstAdminOwnerId(): number | null {
  const row = getAppDb()
    .prepare(
      `SELECT u.id FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.status = 'active' AND r.key IN ('system_administrator', 'dealer_principal')
       ORDER BY r.hierarchy_level DESC, u.id LIMIT 1`,
    )
    .get() as { id: number } | undefined;
  return row?.id ?? null;
}

/**
 * Idempotent role-scoped default boards. Executive Metrics is role-visible to
 * dealer_principal only (admins still discover every board). Other working
 * roles get a board whose widgets match that role's permissions.
 */
export function seedRoleDashboards(actor: AuthUser): void {
  const ownerId = actor.permissions.has("app.admin") ? actor.id : firstAdminOwnerId();
  if (!ownerId) return;
  const db = getAppDb();
  for (const seed of ROLE_BOARD_SEEDS) {
    const roleId = roleIdByKey(seed.roleKey);
    if (!roleId) continue;
    const existing = db
      .prepare("SELECT id, visibility, target_role_id FROM dashboards WHERE name = ? ORDER BY id LIMIT 1")
      .get(seed.name) as { id: number; visibility: Visibility; target_role_id: number | null } | undefined;
    if (existing) {
      if (existing.visibility !== "role" || existing.target_role_id !== roleId) {
        db.prepare(
          `UPDATE dashboards SET visibility = 'role', target_role_id = ?, updated_at = datetime('now')
           WHERE id = ?`,
        ).run(roleId, existing.id);
      }
      if (loadWidgetKeys(existing.id).length === 0) writeWidgets(existing.id, seed.widgetKeys);
      continue;
    }
    const info = db
      .prepare(
        `INSERT INTO dashboards (name, description, owner_user_id, visibility, target_role_id)
         VALUES (?, ?, ?, 'role', ?)`,
      )
      .run(seed.name, seed.description, ownerId, roleId);
    writeWidgets(Number(info.lastInsertRowid), seed.widgetKeys);
  }
}

/** Roles the actor may publish a dashboard to (at or below their level). */
export function publishableRoles(
  actor: AuthUser,
): { id: number; name: string; hierarchyLevel: number }[] {
  const rows = getAppDb()
    .prepare("SELECT id, name, hierarchy_level FROM roles ORDER BY hierarchy_level DESC")
    .all() as { id: number; name: string; hierarchy_level: number }[];
  const ceiling = actor.hierarchyLevel ?? 0;
  return rows
    .filter((r) => r.hierarchy_level <= ceiling)
    .map((r) => ({ id: r.id, name: r.name, hierarchyLevel: r.hierarchy_level }));
}
