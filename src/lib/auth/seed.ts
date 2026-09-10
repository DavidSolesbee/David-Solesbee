import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { PERMISSIONS, ROLES } from "@/lib/auth/catalog";
import { hashPassword, type PasswordRecord } from "@/lib/auth/password";
import { query } from "@/lib/db/dealership";

/**
 * One-time seed of the Perseus application store.
 *
 * Populates permissions, roles, and role defaults, then creates:
 *   - one demo account per role (active),
 *   - one demo account per non-active account state,
 *   - users derived from the dealership's real AppUser records (for realistic
 *     user management in later milestones),
 *   - a couple of pending access requests.
 *
 * The shared demo password is intentionally simple and printed on the login
 * screen for the hackathon. Real accounts created via the approval flow get
 * unique hashes.
 */

export const DEMO_PASSWORD = "Perseus#2026";

interface SeedUser {
  first: string;
  last: string;
  email: string;
  roleKey: string | null;
  department: string | null;
  jobTitle: string;
  status: string;
  source: string;
  expiresAt?: string | null;
}

export function seedAppStore(db: DatabaseSync): void {
  const already = db.prepare("SELECT COUNT(*) c FROM users").get() as {
    c: number;
  };
  const usersExist = (already?.c ?? 0) > 0;

  // 1) Permissions
  const insPerm = db.prepare(
    `INSERT INTO permissions (key, category, label, description)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET category=excluded.category, label=excluded.label, description=excluded.description`,
  );
  for (const p of PERMISSIONS) insPerm.run(p.key, p.category, p.label, p.description);

  // 2) Roles + role_permissions
  const insRole = db.prepare(
    `INSERT INTO roles (key, name, hierarchy_level, description, default_department)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET name=excluded.name, hierarchy_level=excluded.hierarchy_level,
       description=excluded.description, default_department=excluded.default_department`,
  );
  for (const r of ROLES)
    insRole.run(r.key, r.name, r.hierarchyLevel, r.description, r.defaultDepartment);

  const roleId = (key: string) =>
    (db.prepare("SELECT id FROM roles WHERE key=?").get(key) as { id: number }).id;
  const permId = (key: string) =>
    (db.prepare("SELECT id FROM permissions WHERE key=?").get(key) as { id: number }).id;

  db.exec("DELETE FROM role_permissions");
  const insRP = db.prepare(
    "INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)",
  );
  for (const r of ROLES) {
    const rid = roleId(r.key);
    for (const pk of r.permissions) insRP.run(rid, permId(pk));
  }

  if (usersExist) return; // users only seeded once

  // Shared demo password hash (reused across demo/seed accounts).
  const demo: PasswordRecord = hashPassword(DEMO_PASSWORD);

  const insUser = db.prepare(
    `INSERT INTO users
      (first_name, last_name, email, password_hash, password_salt, role_id,
       department, job_title, location_id, location_name, dealership, status,
       source, activated_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const addUser = (u: SeedUser) => {
    const rid = u.roleKey ? roleId(u.roleKey) : null;
    const activatedAt = u.status === "active" ? new Date().toISOString() : null;
    insUser.run(
      u.first,
      u.last,
      u.email.toLowerCase(),
      demo.hash,
      demo.salt,
      rid,
      u.department,
      u.jobTitle,
      1,
      "Main Location",
      "Sioux City Equipment",
      u.status,
      u.source,
      activatedAt,
      u.expiresAt ?? null,
    );
  };

  // 3a) One demo account per role (active)
  const roleDemos: SeedUser[] = [
    { first: "Alex", last: "Stone", email: "admin@perseus.app", roleKey: "system_administrator", department: null, jobTitle: "System Administrator", status: "active", source: "demo" },
    { first: "Doug", last: "Muilenburg", email: "owner@perseus.app", roleKey: "dealer_principal", department: null, jobTitle: "Dealer Principal", status: "active", source: "demo" },
    { first: "Grace", last: "Nolan", email: "gm@perseus.app", roleKey: "general_manager", department: null, jobTitle: "General Manager", status: "active", source: "demo" },
    { first: "Omar", last: "Reyes", email: "ops@perseus.app", roleKey: "operations_manager", department: null, jobTitle: "Operations Manager", status: "active", source: "demo" },
    { first: "Sara", last: "Lindqvist", email: "sales@perseus.app", roleKey: "sales_manager", department: "Sales", jobTitle: "Sales Manager", status: "active", source: "demo" },
    { first: "Pete", last: "Novak", email: "parts@perseus.app", roleKey: "parts_manager", department: "Parts", jobTitle: "Parts Manager", status: "active", source: "demo" },
    { first: "Sam", last: "Whitfield", email: "service@perseus.app", roleKey: "service_manager", department: "Service", jobTitle: "Service Manager", status: "active", source: "demo" },
  ];
  roleDemos.forEach(addUser);

  // 3b) One demo account per non-active account state
  const stateDemos: SeedUser[] = [
    { first: "Priya", last: "Kapoor", email: "pending@perseus.app", roleKey: "sales_manager", department: "Sales", jobTitle: "Sales Manager", status: "pending", source: "demo" },
    { first: "Dana", last: "Cole", email: "denied@perseus.app", roleKey: "sales_manager", department: "Sales", jobTitle: "Sales Associate", status: "denied", source: "demo" },
    { first: "Sue", last: "Barrett", email: "suspended@perseus.app", roleKey: "parts_manager", department: "Parts", jobTitle: "Parts Manager", status: "suspended", source: "demo" },
    { first: "Rick", last: "Vance", email: "revoked@perseus.app", roleKey: "service_manager", department: "Service", jobTitle: "Service Advisor", status: "revoked", source: "demo" },
    { first: "Ed", last: "Frank", email: "expired@perseus.app", roleKey: "operations_manager", department: null, jobTitle: "Operations Manager", status: "expired", source: "demo", expiresAt: "2026-01-01T00:00:00.000Z" },
  ];
  stateDemos.forEach(addUser);

  // 3c) Users derived from the dealership's real AppUser records
  seedFromDealershipAppUsers(db, addUser);

  // 4) A couple of pending access requests for the Admin console (Milestone 3)
  const insReq = db.prepare(
    `INSERT INTO access_requests
      (first_name, last_name, email, dealership, location_name, department, job_title, requested_role, reason, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
  );
  insReq.run("Maria", "Gonzalez", "maria.gonzalez@siouxcity.example.com", "Sioux City Equipment", "Main Location", "Sales", "Sales Manager", "sales_manager", "Need visibility into my team's sales performance.");
  insReq.run("Tom", "Becker", "tom.becker@siouxcity.example.com", "Sioux City Equipment", "Main Location", "Service", "Service Manager", "service_manager", "Managing the shop and need work-order visibility.");

  db.prepare(
    `INSERT INTO meta (key, value) VALUES ('schema_version','2')
     ON CONFLICT(key) DO UPDATE SET value='2', updated_at=datetime('now')`,
  ).run();
}

/** Map dealership AppUser flags to a Perseus role + status, and seed them. */
function seedFromDealershipAppUsers(
  db: DatabaseSync,
  addUser: (u: SeedUser) => void,
): void {
  let appUsers: Array<{
    FirstName: string;
    LastName: string;
    UserName: string;
    IsSales: number;
    IsServiceTech: number;
    IsSystem: number;
    AllowLogin: number;
    IsActive: number;
  }> = [];
  try {
    appUsers = query(
      `SELECT FirstName, LastName, UserName, IsSales, IsServiceTech, IsSystem, AllowLogin, IsActive
       FROM AppUser ORDER BY AppUserId`,
    );
  } catch {
    return; // dealership DB unavailable — skip realistic seed, demos still work
  }

  const seenEmails = new Set<string>();
  const existing = db.prepare("SELECT email FROM users").all() as {
    email: string;
  }[];
  existing.forEach((e) => seenEmails.add(e.email.toLowerCase()));

  for (const a of appUsers) {
    const first = (a.FirstName || "").trim() || "User";
    const last = (a.LastName || "").trim() || a.UserName;
    const base = `${first}.${last}`.toLowerCase().replace(/[^a-z0-9.]+/g, "");
    let email = `${base}@siouxcity.perseus.app`;
    let n = 2;
    while (seenEmails.has(email)) email = `${base}${n++}@siouxcity.perseus.app`;
    seenEmails.add(email);

    const roleKey = a.IsSystem
      ? "system_administrator"
      : a.IsSales
        ? "sales_manager"
        : a.IsServiceTech
          ? "service_manager"
          : "operations_manager";
    const department = a.IsSales
      ? "Sales"
      : a.IsServiceTech
        ? "Service"
        : null;
    const status = a.AllowLogin === 1 && a.IsActive === 1 ? "active" : "suspended";
    const jobTitle = a.IsSales
      ? "Salesperson"
      : a.IsServiceTech
        ? "Service Technician"
        : "Staff";

    addUser({ first, last, email, roleKey, department, jobTitle, status, source: "dealership" });
  }
}
