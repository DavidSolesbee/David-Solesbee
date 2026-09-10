import Link from "next/link";
import { listUsers } from "@/lib/admin/service";
import { ROLES, ACCOUNT_STATES } from "@/lib/auth/catalog";
import { Card, CardContent } from "@/components/ui/Card";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/Table";
import { AccountStatusBadge } from "@/components/admin/AccountStatusBadge";
import { EmptyState } from "@/components/ui/States";

export const dynamic = "force-dynamic";

interface SearchParams {
  search?: string;
  status?: string;
  role?: string;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const users = listUsers({
    search: sp.search,
    status: sp.status,
    role: sp.role,
  });

  return (
    <Card>
      <CardContent className="space-y-4">
        {/* Filters */}
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex flex-1 flex-col gap-1" style={{ minWidth: 220 }}>
            <span className="text-caption font-medium text-ink-soft">Search</span>
            <input
              type="text"
              name="search"
              defaultValue={sp.search ?? ""}
              placeholder="Name or email…"
              className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3.5 text-sm text-ink placeholder:text-ink-faint shadow-subtle hover:border-sage-300 focus:border-sage-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-caption font-medium text-ink-soft">Status</span>
            <select
              name="status"
              defaultValue={sp.status ?? ""}
              className="h-10 rounded-lg border border-line-strong bg-surface px-3.5 pr-8 text-sm text-ink shadow-subtle focus:border-sage-500 focus:outline-none"
            >
              <option value="">All statuses</option>
              {ACCOUNT_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-caption font-medium text-ink-soft">Role</span>
            <select
              name="role"
              defaultValue={sp.role ?? ""}
              className="h-10 rounded-lg border border-line-strong bg-surface px-3.5 pr-8 text-sm text-ink shadow-subtle focus:border-sage-500 focus:outline-none"
            >
              <option value="">All roles</option>
              {ROLES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="h-10 rounded-lg bg-forest-500 px-4 text-sm font-medium text-white shadow-subtle hover:bg-forest-600"
          >
            Filter
          </button>
          <Link
            href="/app/admin/users"
            className="h-10 rounded-lg px-3 py-2 text-sm text-ink-soft hover:text-ink"
          >
            Clear
          </Link>
        </form>

        <div className="text-caption text-ink-faint">
          {users.length} user{users.length === 1 ? "" : "s"}
        </div>

        {users.length === 0 ? (
          <EmptyState title="No users match" description="Try adjusting your filters." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Email</TH>
                <TH>Role</TH>
                <TH>Department</TH>
                <TH>Status</TH>
                <TH>Last login</TH>
              </tr>
            </THead>
            <TBody>
              {users.map((u) => (
                <TR key={u.id} className="cursor-pointer">
                  <TD className="font-medium">
                    <Link
                      href={`/app/admin/users/${u.id}`}
                      className="block hover:text-forest-600"
                    >
                      {u.first_name} {u.last_name}
                    </Link>
                  </TD>
                  <TD className="text-ink-soft">{u.email}</TD>
                  <TD>{u.role_name ?? "—"}</TD>
                  <TD>{u.department ?? "—"}</TD>
                  <TD>
                    <AccountStatusBadge status={u.status} />
                  </TD>
                  <TD className="text-ink-faint">
                    {u.last_login_at
                      ? new Date(
                          u.last_login_at.replace(" ", "T") + "Z",
                        ).toLocaleDateString()
                      : "Never"}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
