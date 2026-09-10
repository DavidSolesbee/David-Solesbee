import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/authz";
import { getUserDetail, assignableRoles } from "@/lib/admin/service";
import {
  PERMISSIONS,
  ACCOUNT_STATES,
  getRole,
  type PermissionCategory,
  type AccountState,
} from "@/lib/auth/catalog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { AccountStatusBadge } from "@/components/admin/AccountStatusBadge";
import {
  assignRoleAction,
  setStatusAction,
  setOverrideAction,
  setDepartmentAction,
  resetPasswordAction,
  forceLogoutAction,
  unlockAction,
} from "../../actions";

export const dynamic = "force-dynamic";

const DEPARTMENTS = ["Sales", "Parts", "Service", "Operations"];
const CATEGORY_LABEL: Record<PermissionCategory, string> = {
  application: "Application",
  module: "Modules",
  feature: "Features",
  data: "Data scope",
};
const STATUS_ACTIONS: { status: AccountState; label: string; variant: "primary" | "secondary" | "danger" }[] = [
  { status: "active", label: "Activate", variant: "primary" },
  { status: "suspended", label: "Suspend", variant: "secondary" },
  { status: "revoked", label: "Revoke", variant: "danger" },
  { status: "expired", label: "Expire", variant: "secondary" },
];

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isFinite(userId)) notFound();

  const actor = (await getCurrentUser())!;
  let detail;
  try {
    detail = getUserDetail(userId);
  } catch {
    notFound();
  }
  const { auth, overrideMap, activeSessions } = detail;

  const actorLevel = actor.hierarchyLevel ?? 0;
  const targetLevel = auth.hierarchyLevel ?? 0;
  const canManage = targetLevel <= actorLevel;
  const isSelf = actor.id === auth.id;
  const roles = assignableRoles(actor);
  const rolePerms = new Set(auth.roleKey ? getRole(auth.roleKey)?.permissions ?? [] : []);

  const byCategory = (Object.keys(CATEGORY_LABEL) as PermissionCategory[]).map(
    (cat) => ({
      cat,
      items: PERMISSIONS.filter((p) => p.category === cat),
    }),
  );

  return (
    <div className="space-y-6">
      <Link
        href="/app/admin/users"
        className="text-sm text-ink-soft hover:text-ink"
      >
        ← All users
      </Link>

      {/* Header */}
      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-semibold text-ink">
                {auth.firstName} {auth.lastName}
              </h2>
              <AccountStatusBadge status={auth.status} />
              {isSelf && (
                <span className="text-caption text-ink-faint">(you)</span>
              )}
            </div>
            <div className="mt-1 text-sm text-ink-soft">{auth.email}</div>
            <div className="mt-1 text-caption text-ink-faint">
              {auth.roleName ?? "No role"} ·{" "}
              {auth.scope.allDepartments ? "All departments" : auth.department ?? "—"} ·{" "}
              {auth.scope.allLocations ? "All locations" : auth.locationName ?? "—"} ·{" "}
              {activeSessions} active session{activeSessions === 1 ? "" : "s"}
            </div>
          </div>
        </CardContent>
      </Card>

      {!canManage && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-600">
          This user’s role outranks yours, so you can view but not modify their
          access.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Role & department */}
        <Card>
          <CardHeader>
            <CardTitle>Role & scope</CardTitle>
            <CardDescription>
              Role sets base permissions; department and location define data
              scope.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <form action={assignRoleAction} className="flex items-end gap-3">
              <input type="hidden" name="userId" value={auth.id} />
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-caption font-medium text-ink-soft">Role</span>
                <Select
                  name="roleKey"
                  defaultValue={auth.roleKey ?? ""}
                  disabled={!canManage}
                >
                  {roles.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.name}
                    </option>
                  ))}
                  {auth.roleKey &&
                    !roles.some((r) => r.key === auth.roleKey) && (
                      <option value={auth.roleKey}>{auth.roleName} (locked)</option>
                    )}
                </Select>
              </label>
              <Button type="submit" disabled={!canManage}>
                Save
              </Button>
            </form>

            <form action={setDepartmentAction} className="flex items-end gap-3">
              <input type="hidden" name="userId" value={auth.id} />
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-caption font-medium text-ink-soft">
                  Department
                </span>
                <Select
                  name="department"
                  defaultValue={auth.department ?? ""}
                  disabled={!canManage}
                >
                  <option value="">None / all</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </Select>
              </label>
              <Button type="submit" variant="secondary" disabled={!canManage}>
                Save
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Account lifecycle & security */}
        <Card>
          <CardHeader>
            <CardTitle>Account & security</CardTitle>
            <CardDescription>
              Lifecycle state, password, and sessions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div>
              <div className="mb-2 text-caption font-medium text-ink-soft">
                Set status
              </div>
              <div className="flex flex-wrap gap-2">
                {STATUS_ACTIONS.map((s) => (
                  <form key={s.status} action={setStatusAction}>
                    <input type="hidden" name="userId" value={auth.id} />
                    <input type="hidden" name="status" value={s.status} />
                    <Button
                      type="submit"
                      size="sm"
                      variant={s.variant}
                      disabled={
                        !canManage ||
                        auth.status === s.status ||
                        (isSelf && s.status !== "active")
                      }
                    >
                      {s.label}
                    </Button>
                  </form>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              <form action={resetPasswordAction}>
                <input type="hidden" name="userId" value={auth.id} />
                <Button type="submit" size="sm" variant="secondary" disabled={!canManage}>
                  Reset password
                </Button>
              </form>
              <form action={forceLogoutAction}>
                <input type="hidden" name="userId" value={auth.id} />
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  disabled={!canManage || activeSessions === 0}
                >
                  Force logout ({activeSessions})
                </Button>
              </form>
              <form action={unlockAction}>
                <input type="hidden" name="userId" value={auth.id} />
                <Button type="submit" size="sm" variant="secondary" disabled={!canManage}>
                  Unlock
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Permission overrides */}
      <Card>
        <CardHeader>
          <CardTitle>Permissions</CardTitle>
          <CardDescription>
            Effective = role default ± individual override. You can only grant
            permissions you hold yourself.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 pt-2 lg:grid-cols-2">
          {byCategory.map(({ cat, items }) => (
            <div key={cat}>
              <div className="mb-3 text-caption font-semibold uppercase tracking-wide text-ink-faint">
                {CATEGORY_LABEL[cat]}
              </div>
              <ul className="space-y-2">
                {items.map((p) => {
                  const inRole = rolePerms.has(p.key);
                  const override = overrideMap.get(p.key);
                  const effective = auth.permissions.has(p.key);
                  const actorHas = actor.permissions.has(p.key);
                  let source = "—";
                  if (override === true) source = "Granted (override)";
                  else if (override === false) source = "Revoked (override)";
                  else if (inRole) source = "Role default";
                  return (
                    <li
                      key={p.key}
                      className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div
                          className={
                            effective
                              ? "text-sm font-medium text-ink"
                              : "text-sm text-ink-faint"
                          }
                        >
                          {p.label}
                        </div>
                        <div className="text-caption text-ink-faint">{source}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {!effective && (
                          <OverrideBtn
                            userId={auth.id}
                            permissionKey={p.key}
                            value="grant"
                            label="Grant"
                            disabled={!canManage || !actorHas}
                          />
                        )}
                        {effective && (
                          <OverrideBtn
                            userId={auth.id}
                            permissionKey={p.key}
                            value="revoke"
                            label="Revoke"
                            disabled={!canManage}
                          />
                        )}
                        {override !== undefined && (
                          <OverrideBtn
                            userId={auth.id}
                            permissionKey={p.key}
                            value="clear"
                            label="Reset"
                            disabled={!canManage}
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function OverrideBtn({
  userId,
  permissionKey,
  value,
  label,
  disabled,
}: {
  userId: number;
  permissionKey: string;
  value: "grant" | "revoke" | "clear";
  label: string;
  disabled?: boolean;
}) {
  return (
    <form action={setOverrideAction}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="permissionKey" value={permissionKey} />
      <input type="hidden" name="value" value={value} />
      <button
        type="submit"
        disabled={disabled}
        className={
          "rounded-md px-2 py-1 text-caption font-medium transition-colors disabled:opacity-40 " +
          (value === "grant"
            ? "bg-sage-50 text-forest-700 hover:bg-sage-100"
            : value === "revoke"
              ? "bg-terracotta-50 text-terracotta-600 hover:opacity-80"
              : "bg-surface-sunken text-ink-soft hover:text-ink")
        }
      >
        {label}
      </button>
    </form>
  );
}
