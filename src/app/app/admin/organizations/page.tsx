import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/tenant/context";
import { listAllOrganizations } from "@/lib/tenant/organizations";
import { getOrgAuthSettings } from "@/lib/tenant/orgAuth";
import { enterViewAsAction } from "@/app/app/actions";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/Table";

export const dynamic = "force-dynamic";

/**
 * Platform-admin organization directory + View-As. Customer admins cannot
 * see this page. View-As inspects a tenant; it does not become another user.
 */
export default async function OrganizationsPage() {
  const actor = await getActiveContext();
  if (!actor) redirect("/login");
  if (!actor.isPlatformAdmin) redirect("/app/admin");

  const orgs = listAllOrganizations();

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Organizations</h2>
          <p className="mt-1 text-sm text-ink-soft">
            View-As lets you inspect a client tenant while remaining yourself.
            It is audited and is not user impersonation.
          </p>
        </div>
        <Table>
          <THead>
            <TR>
              <TH>Organization</TH>
              <TH>Location</TH>
              <TH>Subscription</TH>
              <TH>Auth</TH>
              <TH></TH>
            </TR>
          </THead>
          <TBody>
            {orgs.map((org) => {
              const viewing = actor.isViewingAs && actor.activeOrganizationId === org.id;
              const auth = getOrgAuthSettings(org.id);
              return (
                <TR key={org.id}>
                  <TD>
                    <div className="font-medium text-ink">{org.name}</div>
                    <div className="text-caption text-ink-faint">{org.slug}</div>
                  </TD>
                  <TD>{org.location ?? "—"}</TD>
                  <TD>
                    <StatusBadge
                      intent={org.subscriptionStatus === "active" ? "positive" : "attention"}
                      dot={false}
                    >
                      {org.subscriptionStatus}
                    </StatusBadge>
                  </TD>
                  <TD>
                    <span className="text-caption text-ink-faint">
                      {auth.requireMfa ? "MFA required" : "MFA optional"}
                      {auth.ssoEnabled ? " · SSO on" : ""}
                    </span>
                  </TD>
                  <TD className="text-right">
                    {viewing ? (
                      <StatusBadge intent="attention" dot={false}>
                        Viewing
                      </StatusBadge>
                    ) : (
                      <form action={enterViewAsAction}>
                        <input type="hidden" name="organizationId" value={org.id} />
                        <Button type="submit" size="sm" variant="secondary">
                          View as
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
  );
}
