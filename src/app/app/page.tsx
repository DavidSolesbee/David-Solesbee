import { requireActiveUser } from "@/lib/auth/authz";
import { PERMISSIONS, type PermissionCategory } from "@/lib/auth/catalog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<PermissionCategory, string> = {
  application: "Application",
  module: "Modules",
  feature: "Features",
  data: "Data scope",
};

export default async function AppHome() {
  const user = await requireActiveUser();

  const byCategory = (Object.keys(CATEGORY_LABEL) as PermissionCategory[]).map(
    (cat) => ({
      cat,
      items: PERMISSIONS.filter((p) => p.category === cat).map((p) => ({
        ...p,
        granted: user.permissions.has(p.key),
      })),
    }),
  );

  return (
    <div className="space-y-8">
      <section>
        <StatusBadge intent="positive">Signed in · secure session</StatusBadge>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">
          Welcome, {user.firstName}.
        </h1>
        <p className="mt-2 text-ink-soft">
          You are authenticated. Your access below is resolved{" "}
          <span className="font-medium text-ink">server-side</span> from your
          role, permissions, department, and location. Analytics dashboards
          arrive in Milestone 4.
        </p>
      </section>

      {/* Identity & scope */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="text-caption uppercase tracking-wide text-ink-faint">
            Role
          </div>
          <div className="mt-1 text-lg font-semibold text-ink">
            {user.roleName ?? "—"}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-caption uppercase tracking-wide text-ink-faint">
            Department
          </div>
          <div className="mt-1 text-lg font-semibold text-ink">
            {user.scope.allDepartments ? "All departments" : user.department ?? "—"}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-caption uppercase tracking-wide text-ink-faint">
            Location
          </div>
          <div className="mt-1 text-lg font-semibold text-ink">
            {user.scope.allLocations
              ? "All locations"
              : user.locationName ?? "—"}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-caption uppercase tracking-wide text-ink-faint">
            Login email
          </div>
          <div className="mt-1 truncate text-lg font-semibold text-ink">
            {user.email}
          </div>
        </Card>
      </section>

      {/* Resolved permissions */}
      <Card>
        <CardHeader>
          <CardTitle>Your effective permissions</CardTitle>
          <CardDescription>
            Base role permissions combined with any individual overrides.
            Security overrides UI and configuration everywhere in Perseus.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 pt-2 sm:grid-cols-2">
          {byCategory.map(({ cat, items }) => (
            <div key={cat}>
              <div className="mb-3 text-caption font-semibold uppercase tracking-wide text-ink-faint">
                {CATEGORY_LABEL[cat]}
              </div>
              <ul className="space-y-1.5">
                {items.map((p) => (
                  <li
                    key={p.key}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span
                      className={p.granted ? "text-ink" : "text-ink-faint line-through"}
                    >
                      {p.label}
                    </span>
                    {p.granted ? (
                      <span className="text-sage-600">✓</span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
