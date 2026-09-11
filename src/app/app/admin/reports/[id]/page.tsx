import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/authz";
import {
  loadReport,
  reportContext,
  expectedRecipients,
  listDeliveriesForReport,
} from "@/lib/reports/service";
import { periodLabel, comparisonLabel } from "@/lib/reports/periods";
import { getTemplate, SECTIONS } from "@/lib/reports/catalog";
import { previewForRecipient, previewForRole } from "@/lib/reports/generate";
import { reportAiNarrative } from "@/lib/ai/service";
import { audienceOptions } from "@/lib/reports/audience";
import { ReportDocument } from "@/components/reports/ReportDocument";
import { ConfirmSubmit } from "@/components/admin/ConfirmSubmit";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  deleteReportAction,
  runReportAction,
  setReportStatusAction,
  testReportAction,
} from "@/app/app/admin/reports/actions";

export const dynamic = "force-dynamic";

export default async function ReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string; asRole?: string }>;
}) {
  const actor = await requireAdmin();
  const { id: idRaw } = await params;
  const q = await searchParams;
  const id = Number(idRaw);
  const report = loadReport(id);
  if (!report) notFound();

  const ctx = reportContext(report);
  const recipients = expectedRecipients(actor, report.audience);
  const activeRecipients = recipients.filter((r) => r.status === "active");
  const inactiveRecipients = recipients.length - activeRecipients.length;
  const history = listDeliveriesForReport(id, 25);
  const options = audienceOptions();
  const template = getTemplate(report.templateKey);

  let preview = null;
  if (q.preview) {
    try {
      preview = previewForRecipient(actor, id, Number(q.preview));
    } catch {
      preview = null;
    }
  } else if (q.asRole) {
    try {
      preview = previewForRole(actor, id, q.asRole);
    } catch {
      preview = null;
    }
  }

  const previewSnap = preview
    ? {
        reportName: report.name,
        periodLabel: preview.periodLabel,
        comparisonLabel: preview.comparisonLabel,
        recipientName: preview.recipientName,
        recipientEmail: preview.recipientEmail,
        recipientRole: preview.recipientRole,
        scopeNote: "PREVIEW — NOT SENT",
        test: true,
        sections: preview.cells.map((c) =>
          c.cell.state === "shown"
            ? c.cell.section
            : {
                key: c.key as (typeof SECTIONS)[number]["key"],
                label: c.label,
                description: "",
                band: SECTIONS.find((s) => s.key === c.key)?.band ?? "detail",
                authorized: false,
              },
        ),
        aiNarrative: report.aiNarrative
          ? reportAiNarrative(
              preview.cells
                .filter((c) => c.cell.state === "shown")
                .map((c) => (c.cell.state === "shown" ? c.cell.section : null))
                .filter((s): s is NonNullable<typeof s> => !!s),
            )
          : null,
      }
    : null;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/app/admin/reports" className="text-sm text-ink-soft hover:text-ink">
          ← Automated Reporting
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-ink">{report.name}</h2>
              <StatusBadge
                intent={report.status === "active" ? "positive" : report.status === "paused" ? "attention" : "neutral"}
                dot={false}
              >
                {report.status}
              </StatusBadge>
            </div>
            <p className="mt-1 text-sm text-ink-soft">{report.description}</p>
            <p className="text-caption text-ink-faint">
              {template?.label ?? "Custom"} · {ctx.scheduleLabel}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/app/admin/reports/${id}/edit`}>
              <Button variant="secondary">Edit</Button>
            </Link>
            {report.status !== "active" ? (
              <form action={setReportStatusAction}>
                <input type="hidden" name="reportId" value={id} />
                <input type="hidden" name="status" value="active" />
                <Button type="submit">Activate</Button>
              </form>
            ) : (
              <form action={setReportStatusAction}>
                <input type="hidden" name="reportId" value={id} />
                <input type="hidden" name="status" value="paused" />
                <Button variant="secondary" type="submit">
                  Pause
                </Button>
              </form>
            )}
            <form action={testReportAction}>
              <input type="hidden" name="reportId" value={id} />
              <Button variant="secondary" type="submit">
                Send test
              </Button>
            </form>
            <form action={runReportAction}>
              <input type="hidden" name="reportId" value={id} />
              <ConfirmSubmit
                confirm={`Send “${report.name}” for ${ctx.period.label} to ${activeRecipients.length} active recipient${activeRecipients.length === 1 ? "" : "s"}? ${inactiveRecipients ? `${inactiveRecipients} inactive account${inactiveRecipients === 1 ? "" : "s"} will be suppressed. ` : ""}Each copy is generated from that person’s current permissions.`}
              >
                Run now
              </ConfirmSubmit>
            </form>
            <form action={deleteReportAction}>
              <input type="hidden" name="reportId" value={id} />
              <ConfirmSubmit variant="danger" confirm="Delete this report and its history?">
                Delete
              </ConfirmSubmit>
            </form>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Meta label="Reporting period" value={periodLabel(report.periodKey)} />
        <Meta label="Comparison" value={comparisonLabel(report.comparisonKey)} />
        <Meta label="As-of (data)" value={ctx.asOf} />
        <Meta label="Next 3 deliveries" value={ctx.upcoming.map((u) => u.ymd).join(" · ") || "—"} />
      </div>

      <Card>
        <CardContent className="space-y-3">
          <h3 className="font-semibold text-ink">
            Audience · {activeRecipients.length} active
            {inactiveRecipients ? ` · ${inactiveRecipients} will be suppressed` : ""}
          </h3>
          <p className="text-sm text-ink-soft">
            Delivery uses each user’s current login email. Suspended, revoked, expired, or pending
            accounts are not sent.
          </p>
          <ul className="divide-y divide-line">
            {recipients.map((r) => (
              <li key={r.userId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  {r.name}
                  <span className="text-ink-faint">
                    {" "}
                    · {r.email}
                    {r.roleName ? ` · ${r.roleName}` : ""}
                    {r.status !== "active" ? ` · ${r.status}` : ""}
                  </span>
                </span>
                <Link
                  href={`/app/admin/reports/${id}?preview=${r.userId}`}
                  className="text-forest-600 hover:text-forest-700"
                >
                  Preview as user
                </Link>
              </li>
            ))}
          </ul>
          <form className="flex flex-wrap items-end gap-2" method="get">
            <div>
              <label className="mb-1 block text-caption text-ink-faint">Preview as role</label>
              <Select name="asRole" defaultValue="">
                <option value="">Select a role</option>
                {options.roles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button variant="secondary" size="sm" type="submit">
              Preview
            </Button>
          </form>
        </CardContent>
      </Card>

      {preview && (
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-caption font-semibold uppercase tracking-[0.16em] text-amber-700">
            Preview — not sent · {preview.recipientName}
            {preview.recipientStatus !== "active" ? ` · account ${preview.recipientStatus}` : ""}
            · {preview.authorized} sections authorized · {preview.restricted} restricted
          </div>
          {previewSnap && <ReportDocument snap={previewSnap} mark="preview" />}
          {preview.emailHtml && (
            <Card>
              <CardContent>
                <h3 className="mb-3 font-semibold text-ink">Email preview</h3>
                <iframe
                  title="Email preview"
                  className="h-[480px] w-full rounded-lg border border-line bg-white"
                  srcDoc={preview.emailHtml}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-ink">Delivery history</h3>
        {history.length === 0 ? (
          <p className="text-sm text-ink-soft">No runs yet.</p>
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-line">
              {history.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <div>
                    <Link href={`/app/deliveries/${d.id}`} className="font-medium text-ink hover:text-forest-600">
                      {d.recipientName}
                    </Link>
                    <div className="text-caption text-ink-faint">
                      {d.recipientEmail} · {d.periodLabel} · {d.triggerKind} · {d.authorized} shown /{" "}
                      {d.restricted} withheld
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-caption text-ink-faint">{d.runAt}</span>
                    <StatusBadge
                      intent={
                        d.status === "delivered"
                          ? "positive"
                          : d.status === "failed"
                            ? "critical"
                            : "attention"
                      }
                      dot={false}
                    >
                      {d.status}
                    </StatusBadge>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="text-caption uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="mt-1 text-sm font-medium text-ink">{value}</div>
    </Card>
  );
}
