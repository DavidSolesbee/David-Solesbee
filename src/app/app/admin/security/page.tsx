import { requireAdmin } from "@/lib/auth/authz";
import {
  getSecuritySummary,
  listLoginEvents,
  listActiveSessions,
  listDevices,
  listIpRules,
} from "@/lib/admin/security";
import { approximateGeo } from "@/lib/security/geo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RiskBadge } from "@/components/admin/RiskBadge";
import { ConfirmSubmit } from "@/components/admin/ConfirmSubmit";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/States";
import {
  terminateSessionAction,
  terminateAllSessionsAction,
  lockUserAction,
  unlockUserAction,
  forcePasswordResetAction,
  resetMfaAction,
  setDeviceTrustAction,
  removeDeviceAction,
  addIpRuleAction,
  removeIpRuleAction,
} from "./actions";

export const dynamic = "force-dynamic";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso.replace(" ", "T") + (iso.includes("Z") ? "" : "Z")).toLocaleString();
}
function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso.replace(" ", "T") + (iso.includes("Z") ? "" : "Z")).getTime();
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function mfaBadge(status: string | null) {
  if (status === "failed") return <StatusBadge intent="critical">MFA failed</StatusBadge>;
  if (status === "enabled") return <StatusBadge intent="positive">MFA on</StatusBadge>;
  return <StatusBadge intent="neutral">No MFA</StatusBadge>;
}
function reasons(json: string | null): string {
  try {
    const arr = JSON.parse(json ?? "[]") as string[];
    return arr.join(" · ");
  } catch {
    return "";
  }
}

interface SP {
  searchParams: Promise<{ q?: string; result?: string; risk?: string }>;
}

export default async function SecurityPage({ searchParams }: SP) {
  const actor = await requireAdmin();
  const sp = await searchParams;
  const summary = getSecuritySummary(actor);
  const events = listLoginEvents(actor, {
    search: sp.q,
    result: sp.result === "success" || sp.result === "fail" ? sp.result : undefined,
    risk: sp.risk || undefined,
    limit: 60,
  });
  const sessions = listActiveSessions(actor);
  const devices = listDevices(actor, 40);
  const ipRules = listIpRules(actor);

  const cards: { label: string; value: number; intent: "neutral" | "positive" | "attention" | "critical" }[] = [
    { label: "Failed logins (24h)", value: summary.failedLogins24h, intent: summary.failedLogins24h > 0 ? "attention" : "neutral" },
    { label: "Elevated-risk events (24h)", value: summary.elevatedRisk24h, intent: summary.elevatedRisk24h > 0 ? "critical" : "neutral" },
    { label: "Active sessions", value: summary.activeSessions, intent: "neutral" },
    { label: "Locked accounts", value: summary.lockedAccounts, intent: summary.lockedAccounts > 0 ? "attention" : "neutral" },
    { label: "New devices (24h)", value: summary.newDevices24h, intent: "neutral" },
    { label: "Blocked IPs", value: summary.blockedIps, intent: "neutral" },
  ];

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <div className="text-caption uppercase tracking-wide text-ink-faint">{c.label}</div>
            <div
              className={
                "mt-1 text-2xl font-semibold " +
                (c.intent === "critical"
                  ? "text-terracotta-600"
                  : c.intent === "attention"
                    ? "text-amber-600"
                    : "text-ink")
              }
            >
              {c.value}
            </div>
          </Card>
        ))}
      </div>

      <p className="text-caption text-ink-faint">
        Geographic information is <span className="font-medium text-ink-soft">approximate</span>, derived from IP
        address, and must not be treated as a verified physical location. Private / local network addresses are
        labeled accordingly.
      </p>

      {/* Login Intelligence */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Login Intelligence</CardTitle>
            <CardDescription>Every authentication attempt, with device, approximate location, and risk.</CardDescription>
          </div>
          <form method="get" className="flex flex-wrap items-center gap-2">
            <Input name="q" defaultValue={sp.q ?? ""} placeholder="Search user or IP" className="h-9 w-44" />
            <Select name="result" defaultValue={sp.result ?? ""} className="h-9 w-32">
              <option value="">All results</option>
              <option value="success">Success</option>
              <option value="fail">Failed</option>
            </Select>
            <Select name="risk" defaultValue={sp.risk ?? ""} className="h-9 w-32">
              <option value="">All risk</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </Select>
            <Button type="submit" variant="secondary" size="sm">Filter</Button>
          </form>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <EmptyState title="No login events" description="Authentication attempts will appear here as users sign in." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <tr>
                    <TH>When</TH>
                    <TH>User</TH>
                    <TH>Result</TH>
                    <TH>Risk</TH>
                    <TH>IP</TH>
                    <TH>Approx. location</TH>
                    <TH>Device</TH>
                    <TH>MFA</TH>
                  </tr>
                </THead>
                <TBody>
                  {events.map((e) => (
                    <TR key={e.id}>
                      <TD className="whitespace-nowrap text-ink-faint">{timeAgo(e.created_at)}</TD>
                      <TD>
                        <div className="font-medium text-ink">{e.user_name ?? e.email ?? "unknown"}</div>
                        <div className="text-caption text-ink-faint">{e.organization ?? "—"}</div>
                      </TD>
                      <TD>
                        {e.success ? (
                          <StatusBadge intent="positive">Success</StatusBadge>
                        ) : (
                          <StatusBadge intent="critical">{(e.failure_reason ?? "Failed").replace(/_/g, " ")}</StatusBadge>
                        )}
                      </TD>
                      <TD>
                        <span title={reasons(e.risk_reasons)}>
                          <RiskBadge level={e.risk_level} />
                        </span>
                      </TD>
                      <TD className="whitespace-nowrap font-mono text-caption text-ink-soft">{e.ip ?? "—"}</TD>
                      <TD className="whitespace-nowrap text-caption text-ink-soft">{e.geo_approx ?? "—"}</TD>
                      <TD className="whitespace-nowrap text-caption text-ink-soft">
                        {e.browser} · {e.os}
                        <span className="ml-1">
                          {e.device_known ? (
                            <StatusBadge intent="neutral" dot={false}>Recognized</StatusBadge>
                          ) : (
                            <StatusBadge intent="attention" dot={false}>New</StatusBadge>
                          )}
                        </span>
                      </TD>
                      <TD>{mfaBadge(e.mfa_status)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>Live sessions across all users. Terminate a session to force re-authentication.</CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <EmptyState title="No active sessions" description="Signed-in users will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <tr>
                    <TH>User</TH>
                    <TH>Device</TH>
                    <TH>IP · approx. location</TH>
                    <TH>Started</TH>
                    <TH>Last activity</TH>
                    <TH>Risk</TH>
                    <TH>Actions</TH>
                  </tr>
                </THead>
                <TBody>
                  {sessions.map((s) => {
                    const geo = approximateGeo(s.ip);
                    return (
                      <TR key={s.id}>
                        <TD>
                          <div className="font-medium text-ink">{s.user_name}</div>
                          <div className="text-caption text-ink-faint">{s.role_name ?? "—"} · {s.organization ?? "—"}</div>
                        </TD>
                        <TD className="text-caption text-ink-soft">
                          {s.device_label ?? "Unknown device"}
                          {s.device_trusted ? (
                            <span className="ml-1"><StatusBadge intent="positive" dot={false}>Trusted</StatusBadge></span>
                          ) : null}
                        </TD>
                        <TD className="whitespace-nowrap text-caption text-ink-soft">
                          <span className="font-mono">{s.ip ?? "—"}</span>
                          <div className="text-ink-faint">{geo.label}</div>
                        </TD>
                        <TD className="whitespace-nowrap text-caption text-ink-faint">{fmt(s.created_at)}</TD>
                        <TD className="whitespace-nowrap text-caption text-ink-faint">{timeAgo(s.last_activity_at)}</TD>
                        <TD><RiskBadge level={s.risk_level} /></TD>
                        <TD>
                          {s.user_id === actor.id ? (
                            <StatusBadge intent="info" dot={false}>Current session (you)</StatusBadge>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              <form action={terminateSessionAction}>
                                <input type="hidden" name="sessionId" value={s.id} />
                                <ConfirmSubmit variant="danger" size="sm" confirm={`End this session for ${s.user_name}? They will be signed out immediately.`}>
                                  Terminate
                                </ConfirmSubmit>
                              </form>
                              <form action={terminateAllSessionsAction}>
                                <input type="hidden" name="userId" value={s.user_id} />
                                <ConfirmSubmit variant="secondary" size="sm" confirm={`End ALL active sessions for ${s.user_name}?`}>
                                  End all
                                </ConfirmSubmit>
                              </form>
                              <form action={lockUserAction}>
                                <input type="hidden" name="userId" value={s.user_id} />
                                <ConfirmSubmit variant="secondary" size="sm" confirm={`Lock ${s.user_name}'s account? They will be signed out and unable to sign in until unlocked.`}>
                                  Lock
                                </ConfirmSubmit>
                              </form>
                              <form action={forcePasswordResetAction}>
                                <input type="hidden" name="userId" value={s.user_id} />
                                <ConfirmSubmit variant="secondary" size="sm" confirm={`Force a password reset for ${s.user_name}? A temporary password will be issued.`}>
                                  Reset pwd
                                </ConfirmSubmit>
                              </form>
                              <form action={resetMfaAction}>
                                <input type="hidden" name="userId" value={s.user_id} />
                                <ConfirmSubmit variant="ghost" size="sm" confirm={`Reset MFA for ${s.user_name}?`}>
                                  Reset MFA
                                </ConfirmSubmit>
                              </form>
                            </div>
                          )}
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Device registry */}
        <Card>
          <CardHeader>
            <CardTitle>Device Registry</CardTitle>
            <CardDescription>Devices seen per user. Mark trusted or remove.</CardDescription>
          </CardHeader>
          <CardContent>
            {devices.length === 0 ? (
              <EmptyState title="No devices yet" description="Devices appear after users sign in." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <tr>
                      <TH>User</TH>
                      <TH>Device</TH>
                      <TH>Logins</TH>
                      <TH>Last seen</TH>
                      <TH>Trusted</TH>
                      <TH>Actions</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {devices.map((d) => (
                      <TR key={d.id}>
                        <TD className="text-caption text-ink-soft">{d.user_name}</TD>
                        <TD className="text-caption text-ink-soft">{d.label}</TD>
                        <TD className="text-caption text-ink-faint">{d.login_count}</TD>
                        <TD className="whitespace-nowrap text-caption text-ink-faint">{timeAgo(d.last_seen)}</TD>
                        <TD>
                          {d.trusted ? (
                            <StatusBadge intent="positive" dot={false}>Trusted</StatusBadge>
                          ) : (
                            <StatusBadge intent="neutral" dot={false}>—</StatusBadge>
                          )}
                        </TD>
                        <TD>
                          <div className="flex flex-wrap gap-1.5">
                            <form action={setDeviceTrustAction}>
                              <input type="hidden" name="deviceRowId" value={d.id} />
                              <input type="hidden" name="trusted" value={d.trusted ? "0" : "1"} />
                              <Button type="submit" variant="secondary" size="sm">
                                {d.trusted ? "Untrust" : "Trust"}
                              </Button>
                            </form>
                            <form action={removeDeviceAction}>
                              <input type="hidden" name="deviceRowId" value={d.id} />
                              <ConfirmSubmit variant="ghost" size="sm" confirm="Remove this device from the registry?">
                                Remove
                              </ConfirmSubmit>
                            </form>
                          </div>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* IP rules */}
        <Card>
          <CardHeader>
            <CardTitle>IP Allowlist / Blocklist</CardTitle>
            <CardDescription>Blocked IPs are denied at sign-in, server-side.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={addIpRuleAction} className="flex flex-wrap items-end gap-2">
              <Input name="ip" placeholder="e.g. 203.0.113.4" className="h-9 w-40" required />
              <Select name="rule" defaultValue="block" className="h-9 w-28">
                <option value="block">Block</option>
                <option value="allow">Allow</option>
              </Select>
              <Input name="note" placeholder="Note (optional)" className="h-9 w-40" />
              <Button type="submit" size="sm">Add rule</Button>
            </form>
            {ipRules.length === 0 ? (
              <p className="text-sm text-ink-soft">No IP rules configured.</p>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>IP</TH>
                    <TH>Rule</TH>
                    <TH>Note</TH>
                    <TH>Added</TH>
                    <TH></TH>
                  </tr>
                </THead>
                <TBody>
                  {ipRules.map((r) => (
                    <TR key={r.id}>
                      <TD className="font-mono text-caption text-ink-soft">{r.ip}</TD>
                      <TD>
                        {r.rule === "block" ? (
                          <StatusBadge intent="critical" dot={false}>Block</StatusBadge>
                        ) : (
                          <StatusBadge intent="positive" dot={false}>Allow</StatusBadge>
                        )}
                      </TD>
                      <TD className="text-caption text-ink-faint">{r.note ?? "—"}</TD>
                      <TD className="whitespace-nowrap text-caption text-ink-faint">{timeAgo(r.created_at)}</TD>
                      <TD>
                        <form action={removeIpRuleAction}>
                          <input type="hidden" name="ruleId" value={r.id} />
                          <Button type="submit" variant="ghost" size="sm">Remove</Button>
                        </form>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
