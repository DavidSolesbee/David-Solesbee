import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/tenant/context";
import { listInvitations } from "@/lib/admin/invitations";
import { assignableRoles } from "@/lib/admin/service";
import { getOrgAuthSettings } from "@/lib/tenant/orgAuth";
import { inviteUserAction, revokeInviteAction, updateOrgAuthAction } from "../actions";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/Table";

export const dynamic = "force-dynamic";

export default async function InvitationsPage() {
  const actor = await getActiveContext();
  if (!actor) redirect("/login");
  if (!actor.permissions.has("feature.manage_users")) redirect("/app/admin");

  const invites = listInvitations(actor);
  const roles = assignableRoles(actor);
  const auth = getOrgAuthSettings(actor.activeOrganizationId);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              Invite to {actor.activeOrganizationName}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              Email identifies the person. Membership in this organization is
              granted only after they accept.
            </p>
          </div>
          <form action={inviteUserAction} className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[220px] flex-1 flex-col gap-1">
              <span className="text-caption font-medium text-ink-soft">Email</span>
              <Input name="email" type="email" required placeholder="name@dealership.com" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-caption font-medium text-ink-soft">Role</span>
              <select
                name="roleKey"
                required
                className="h-10 rounded-lg border border-line-strong bg-surface px-3.5 pr-8 text-sm text-ink shadow-subtle focus:border-sage-500 focus:outline-none"
              >
                {roles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit">Send invitation</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Authentication policy</h2>
          <form action={updateOrgAuthAction} className="space-y-3">
            <input type="hidden" name="organizationId" value={actor.activeOrganizationId} />
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="requireMfa" value="1" defaultChecked={auth.requireMfa} />
              Require MFA for members of this organization
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" name="ssoEnabled" value="1" defaultChecked={auth.ssoEnabled} />
              Enable SSO (placeholder — discovery only)
            </label>
            <Button type="submit" variant="secondary" size="sm">
              Save policy
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Email</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {invites.map((i) => {
                const open = !i.accepted_at && !i.revoked_at;
                return (
                  <TR key={i.id}>
                    <TD>{i.email}</TD>
                    <TD>{i.role_name ?? "—"}</TD>
                    <TD>
                      {i.accepted_at ? (
                        <StatusBadge intent="positive" dot={false}>Accepted</StatusBadge>
                      ) : i.revoked_at ? (
                        <StatusBadge intent="neutral" dot={false}>Revoked</StatusBadge>
                      ) : (
                        <StatusBadge intent="attention" dot={false}>Open</StatusBadge>
                      )}
                    </TD>
                    <TD className="text-right">
                      {open && (
                        <form action={revokeInviteAction}>
                          <input type="hidden" name="invitationId" value={i.id} />
                          <Button type="submit" size="sm" variant="ghost">
                            Revoke
                          </Button>
                        </form>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
