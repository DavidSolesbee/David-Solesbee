import { listAudit } from "@/lib/admin/service";
import { Card, CardContent } from "@/components/ui/Card";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/States";

export const dynamic = "force-dynamic";

function fmt(iso: string): string {
  return new Date(iso.replace(" ", "T") + "Z").toLocaleString();
}

export default function AuditPage() {
  const rows = listAudit(300);
  return (
    <Card>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            title="No audit entries"
            description="Security events (logins, approvals, permission changes) will appear here."
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>When</TH>
                <TH>Actor</TH>
                <TH>Action</TH>
                <TH>Target</TH>
                <TH>Detail</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap text-ink-faint">
                    {fmt(r.created_at)}
                  </TD>
                  <TD className="text-ink-soft">
                    {r.actor_label ?? (r.actor_user_id ? `#${r.actor_user_id}` : "system")}
                  </TD>
                  <TD>
                    <span className="font-mono text-ink">{r.action}</span>
                  </TD>
                  <TD className="text-ink-soft">
                    {r.target_type ? `${r.target_type}:${r.target_id ?? ""}` : "—"}
                  </TD>
                  <TD className="max-w-xs truncate text-caption text-ink-faint">
                    {r.detail ?? ""}
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
