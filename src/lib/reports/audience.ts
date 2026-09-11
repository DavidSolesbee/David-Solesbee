import "server-only";
import { getAppDb } from "@/lib/db/app";
import type { AuthUser } from "@/lib/auth/authz";

/**
 * Audience resolution. Recipients always resolve from approved application
 * users — never from an arbitrary email list. Combined rules AND across
 * kinds (role ∩ department ∩ location) and UNION explicit users.
 */

export type AudienceKind = "user" | "role" | "department" | "location";

export interface AudienceRule {
  kind: AudienceKind;
  value: string;
}

export interface ResolvedRecipient {
  userId: number;
  name: string;
  email: string;
  roleKey: string | null;
  roleName: string | null;
  department: string | null;
  locationName: string | null;
  hierarchyLevel: number | null;
  status: string;
}

function fullName(first: string, last: string): string {
  return `${first} ${last}`.trim() || "Unknown";
}

export function audienceOptions(): {
  roles: { key: string; name: string }[];
  departments: string[];
  locations: string[];
  users: {
    id: number;
    name: string;
    email: string;
    roleKey: string | null;
    roleName: string | null;
    department: string | null;
    locationName: string | null;
    hierarchyLevel: number | null;
  }[];
} {
  const db = getAppDb();
  const roles = db
    .prepare("SELECT key, name FROM roles ORDER BY hierarchy_level DESC")
    .all() as { key: string; name: string }[];
  const departments = (
    db
      .prepare(
        `SELECT DISTINCT department FROM users
         WHERE department IS NOT NULL AND TRIM(department) <> ''
         ORDER BY department`,
      )
      .all() as { department: string }[]
  ).map((r) => r.department);
  const locations = (
    db
      .prepare(
        `SELECT DISTINCT location_name FROM users
         WHERE location_name IS NOT NULL AND TRIM(location_name) <> ''
         ORDER BY location_name`,
      )
      .all() as { location_name: string }[]
  ).map((r) => r.location_name);
  const users = (
    db
      .prepare(
        `SELECT u.id, u.first_name, u.last_name, u.email, u.department, u.location_name,
                r.key AS role_key, r.name AS role_name, r.hierarchy_level
         FROM users u LEFT JOIN roles r ON r.id = u.role_id
         WHERE u.status = 'active'
         ORDER BY u.last_name, u.first_name`,
      )
      .all() as {
      id: number;
      first_name: string;
      last_name: string;
      email: string;
      department: string | null;
      location_name: string | null;
      role_key: string | null;
      role_name: string | null;
      hierarchy_level: number | null;
    }[]
  ).map((u) => ({
    id: u.id,
    name: fullName(u.first_name, u.last_name),
    email: u.email,
    roleKey: u.role_key,
    roleName: u.role_name,
    department: u.department,
    locationName: u.location_name,
    hierarchyLevel: u.hierarchy_level,
  }));
  return { roles, departments, locations, users };
}

interface UserRow {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  department: string | null;
  location_name: string | null;
  role_key: string | null;
  role_name: string | null;
  hierarchy_level: number | null;
}

function allActiveCandidates(): UserRow[] {
  return getAppDb()
    .prepare(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.status,
              u.department, u.location_name,
              r.key AS role_key, r.name AS role_name, r.hierarchy_level
       FROM users u LEFT JOIN roles r ON r.id = u.role_id
       ORDER BY u.last_name`,
    )
    .all() as unknown as UserRow[];
}

function toRecipient(r: UserRow): ResolvedRecipient {
  return {
    userId: r.id,
    name: fullName(r.first_name, r.last_name),
    email: r.email,
    roleKey: r.role_key,
    roleName: r.role_name,
    department: r.department,
    locationName: r.location_name,
    hierarchyLevel: r.hierarchy_level,
    status: r.status,
  };
}

/**
 * Resolve the expected recipient set from audience rules.
 * Includes inactive users so generation can suppress them (do not send).
 */
export function resolveAudience(rules: AudienceRule[]): ResolvedRecipient[] {
  if (rules.length === 0) return [];
  const users = allActiveCandidates();
  const byKind = {
    user: rules.filter((r) => r.kind === "user").map((r) => Number(r.value)),
    role: rules.filter((r) => r.kind === "role").map((r) => r.value),
    department: rules.filter((r) => r.kind === "department").map((r) => r.value),
    location: rules.filter((r) => r.kind === "location").map((r) => r.value),
  };

  const matched = users.filter((u) => {
    const userHit = byKind.user.includes(u.id);
    const hasFilter = byKind.role.length + byKind.department.length + byKind.location.length > 0;
    if (!hasFilter) return userHit;
    const roleOk = byKind.role.length === 0 || (u.role_key !== null && byKind.role.includes(u.role_key));
    const deptOk =
      byKind.department.length === 0 ||
      (u.department !== null && byKind.department.includes(u.department));
    const locOk =
      byKind.location.length === 0 ||
      (u.location_name !== null && byKind.location.includes(u.location_name));
    return (roleOk && deptOk && locOk) || userHit;
  });

  const seen = new Set<number>();
  const out: ResolvedRecipient[] = [];
  for (const u of matched) {
    if (seen.has(u.id)) continue;
    seen.add(u.id);
    out.push(toRecipient(u));
  }
  return out;
}

/** Recipients the actor may address (at or below their hierarchy). */
export function eligibleRecipients(
  actor: AuthUser,
  resolved: ResolvedRecipient[],
): ResolvedRecipient[] {
  const ceiling = actor.hierarchyLevel ?? 0;
  return resolved.filter(
    (r) => r.userId === actor.id || (r.hierarchyLevel ?? 0) <= ceiling,
  );
}

export function audienceSummary(rules: AudienceRule[]): string {
  if (!rules.length) return "No audience selected";
  const bits = rules.map((r) => {
    if (r.kind === "user") return `User #${r.value}`;
    if (r.kind === "role") return r.value.replace(/_/g, " ");
    return r.value;
  });
  return bits.join(" · ");
}
