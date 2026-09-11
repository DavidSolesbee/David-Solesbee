import { getActiveContext } from "@/lib/tenant/context";
import { listAccessRequests, assignableRoles } from "@/lib/admin/service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/States";
import { approveRequestAction, decideRequestAction } from "../actions";

export const dynamic = "force-dynamic";

const DEPARTMENTS = ["Sales", "Parts", "Service", "Operations"];

export default async function RequestsPage() {
  const actor = (await getActiveContext())!;
  const roles = assignableRoles(actor);
  const all = listAccessRequests(actor);
  const open = all.filter(
    (r) => r.status === "pending" || r.status === "more_info",
  );
  const decided = all.filter(
    (r) => r.status !== "pending" && r.status !== "more_info",
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Open access requests</CardTitle>
          <CardDescription>
            Approving provisions an active account and generates a one-time
            temporary password to share with the requester.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          {open.length === 0 ? (
            <EmptyState
              title="No open requests"
              description="New access requests will appear here for review."
            />
          ) : (
            open.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-line bg-surface-tinted p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-ink">
                        {r.first_name} {r.last_name}
                      </span>
                      {r.status === "more_info" && (
                        <StatusBadge intent="info" dot={false}>
                          Info requested
                        </StatusBadge>
                      )}
                    </div>
                    <div className="text-sm text-ink-soft">{r.email}</div>
                    <div className="mt-1 text-caption text-ink-faint">
                      {[r.dealership, r.location_name, r.department, r.job_title]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    {r.reason && (
                      <p className="mt-2 max-w-xl text-sm text-ink">
                        “{r.reason}”
                      </p>
                    )}
                  </div>
                  <span className="text-caption text-ink-faint">
                    Requested{" "}
                    {r.requested_role
                      ? roles.find((x) => x.key === r.requested_role)?.name ??
                        r.requested_role
                      : "—"}
                  </span>
                </div>

                {/* Approve */}
                <form
                  action={approveRequestAction}
                  className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4"
                >
                  <input type="hidden" name="requestId" value={r.id} />
                  <label className="flex flex-col gap-1">
                    <span className="text-caption font-medium text-ink-soft">
                      Assign role
                    </span>
                    <Select
                      name="roleKey"
                      defaultValue={
                        roles.find((x) => x.key === r.requested_role)?.key ?? ""
                      }
                      className="w-56"
                    >
                      <option value="" disabled>
                        Select role…
                      </option>
                      {roles.map((role) => (
                        <option key={role.key} value={role.key}>
                          {role.name}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-caption font-medium text-ink-soft">
                      Department
                    </span>
                    <Select
                      name="department"
                      defaultValue={r.department ?? ""}
                      className="w-44"
                    >
                      <option value="">Role default</option>
                      {DEPARTMENTS.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </Select>
                  </label>
                  <Button type="submit">Approve</Button>
                </form>

                {/* Deny / more info */}
                <form
                  action={decideRequestAction}
                  className="mt-3 flex flex-wrap items-end gap-3"
                >
                  <input type="hidden" name="requestId" value={r.id} />
                  <Input
                    name="note"
                    placeholder="Optional note to requester"
                    className="w-72"
                  />
                  <Button type="submit" name="decision" value="more_info" variant="secondary">
                    Request info
                  </Button>
                  <Button type="submit" name="decision" value="denied" variant="danger">
                    Deny
                  </Button>
                </form>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {decided.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Decided</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <ul className="divide-y divide-line">
              {decided.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"
                >
                  <span className="text-ink">
                    {r.first_name} {r.last_name}{" "}
                    <span className="text-ink-faint">· {r.email}</span>
                  </span>
                  <StatusBadge
                    intent={r.status === "approved" ? "positive" : "critical"}
                    dot={false}
                  >
                    {r.status}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
