import Link from "next/link";
import { requireAdmin } from "@/lib/auth/authz";
import { listAllDashboards, seedRoleDashboards } from "@/lib/dashboards/service";
import { Card } from "@/components/ui/Card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { deleteDashboardAction } from "@/app/app/dashboards/actions";

export const dynamic = "force-dynamic";

const VIS_LABEL: Record<string, string> = { personal: "Personal", role: "Role", org: "Org-wide" };

export default async function AdminDashboardsPage() {
  const actor = await requireAdmin();
  seedRoleDashboards(actor);
  const dashboards = listAllDashboards(actor);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-ink">Dashboard governance</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Every dashboard across the organization. Data inside each is always re-authorized against
          the viewer, so visibility never grants access to restricted metrics.
        </p>
      </div>

      {dashboards.length === 0 ? (
        <EmptyState title="No dashboards" description="No dashboards have been created yet." />
      ) : (
        <Card className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Owner</TH>
                <TH>Visibility</TH>
                <TH className="text-right">Widgets</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {dashboards.map((d) => (
                <TR key={d.id}>
                  <TD>
                    <Link href={`/app/dashboards/${d.id}`} className="font-medium text-ink hover:text-forest-600">
                      {d.name}
                    </Link>
                    {d.description && <div className="text-caption text-ink-faint">{d.description}</div>}
                  </TD>
                  <TD className="text-ink-soft">{d.ownerName}</TD>
                  <TD>
                    <StatusBadge
                      intent={d.visibility === "org" ? "info" : d.visibility === "role" ? "attention" : "neutral"}
                      dot={false}
                    >
                      {d.visibility === "role" && d.targetRoleName ? d.targetRoleName : VIS_LABEL[d.visibility]}
                    </StatusBadge>
                  </TD>
                  <TD className="text-right tabular-nums">{d.widgetCount}</TD>
                  <TD className="text-right">
                    <form action={deleteDashboardAction} className="inline">
                      <input type="hidden" name="dashboardId" value={d.id} />
                      <input type="hidden" name="returnTo" value="/app/admin/dashboards" />
                      <Button variant="danger" size="sm" type="submit">Delete</Button>
                    </form>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
