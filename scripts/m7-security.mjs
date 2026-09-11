/**
 * Milestone 7 security probe.
 * Stubs Next-only modules, then exercises per-recipient generation.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { createHash, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const stub = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: "data:text/javascript,export default true;", shortCircuit: true };
  }
  if (specifier === "next/headers" || specifier === "next/cache" || specifier === "next/navigation") {
    return {
      url: "data:text/javascript," + encodeURIComponent(\`
        export function cookies() {
          return { get() { return undefined; }, set() {}, delete() {} };
        }
        export function redirect() { const e = new Error("NEXT_REDIRECT"); e.digest = "NEXT_REDIRECT"; throw e; }
        export function notFound() { const e = new Error("NEXT_NOT_FOUND"); e.digest = "NEXT_NOT_FOUND"; throw e; }
        export function revalidatePath() {}
        export default true;
      \`),
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
`;

register("data:text/javascript," + encodeURIComponent(stub), pathToFileURL("./"));

const root = process.cwd();
const appDbPath = path.join(root, "data", "perseus_app.db");

const {
  createReport,
  loadReport,
  expectedRecipients,
} = await import("../src/lib/reports/service.ts");
const { generateReport, loadDelivery, getDeliveryForViewer, previewForRecipient } =
  await import("../src/lib/reports/generate.ts");
const { loadUserById } = await import("../src/lib/auth/authz.ts");
const { getAppDb } = await import("../src/lib/db/app.ts");

function userByEmail(email) {
  const row = getAppDb()
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email);
  const u = loadUserById(Number(row?.id));
  if (!u) throw new Error("missing " + email);
  return u;
}

const admin = userByEmail("admin@perseus.app");
const sales = userByEmail("sales@perseus.app");
const service = userByEmail("service@perseus.app");
const suspended = userByEmail("suspended@perseus.app");

const reportId = createReport(admin, {
  name: "M7 Security Pack",
  description: "Cross-role generation probe",
  templateKey: "weekly_executive_performance",
  periodKey: "last_30_days",
  comparisonKey: "prior_month",
  customDays: 14,
  scheduleKind: "weekdays",
  scheduleDays: [1, 2, 3, 4, 5],
  monthlyMode: "calendar_day",
  monthlyDay: 1,
  customIntervalDays: 14,
  deliveryTime: "06:30",
  timezone: "America/Chicago",
  topN: 10,
  formatHtml: true,
  formatPdf: true,
  formatLink: true,
  status: "active",
  sectionKeys: [
    "executive_summary",
    "kpi_scorecard",
    "business_pulse",
    "parts_performance",
    "customer_opportunities",
    "service_performance",
  ],
  audience: [
    { kind: "user", value: String(admin.id) },
    { kind: "user", value: String(sales.id) },
    { kind: "user", value: String(service.id) },
    { kind: "user", value: String(suspended.id) },
  ],
});

const recipients = expectedRecipients(admin, loadReport(reportId).audience);
if (!recipients.some((r) => r.userId === suspended.id)) {
  // suspended is in audience rules as explicit user — should still resolve
}

const result = generateReport(admin, reportId, "manual");

const db = new DatabaseSync(appDbPath);
const deliveries = db
  .prepare(
    `SELECT id, recipient_user_id, recipient_email, status, snapshot, sections_authorized, sections_restricted
     FROM report_deliveries WHERE report_id = ? ORDER BY id`,
  )
  .all(reportId);

function snapOf(email) {
  const row = deliveries.find((d) => d.recipient_email === email);
  if (!row) return null;
  return {
    ...row,
    snapshot: row.snapshot ? JSON.parse(row.snapshot) : null,
  };
}

const mismatches = [];
const adminD = snapOf("admin@perseus.app");
const salesD = snapOf("sales@perseus.app");
const serviceD = snapOf("service@perseus.app");
const susD = snapOf("suspended@perseus.app");

if (!adminD || adminD.status !== "delivered") mismatches.push("admin not delivered");
if (!salesD || salesD.status !== "delivered") mismatches.push("sales not delivered");
if (!serviceD || serviceD.status !== "delivered") mismatches.push("service not delivered");
if (!susD || susD.status !== "suppressed")
  mismatches.push(`suspended should be suppressed, got ${susD?.status}`);

function section(d, key) {
  return d?.snapshot?.sections?.find((s) => s.key === key);
}

if (section(salesD, "parts_performance")?.authorized) {
  mismatches.push("sales received parts_performance (lacks module.parts)");
}
if (section(salesD, "business_pulse")?.authorized) {
  mismatches.push("sales received business_pulse (lacks cross-department)");
}
if (section(salesD, "service_performance")?.authorized) {
  mismatches.push("sales received service_performance");
}
const salesParts = JSON.stringify(salesD?.snapshot ?? {});
if (/of parts revenue|Parts margin|Parts cost/i.test(salesParts)) {
  mismatches.push("sales snapshot leaked parts margin/cost copy");
}

if (!section(serviceD, "service_performance")?.authorized) {
  mismatches.push("service should receive service_performance");
}
if (section(serviceD, "business_pulse")?.authorized) {
  mismatches.push("service received business_pulse (lacks cross-department)");
}
if (section(serviceD, "parts_performance")?.authorized) {
  mismatches.push("service received parts_performance");
}

if (!section(adminD, "business_pulse")?.authorized) {
  mismatches.push("admin should receive business_pulse");
}

// Preview double-gate: if we had a lesser admin it would hide values.
// Sales cannot load another user's delivery.
const stolen = getDeliveryForViewer(sales, adminD.id);
if (stolen) mismatches.push("sales could open admin delivery");

const own = getDeliveryForViewer(sales, salesD.id);
if (!own) mismatches.push("sales could not open own delivery");

// Preview as sales from admin: restricted cells must not include margin figures.
const preview = previewForRecipient(admin, reportId, sales.id);
const shownPulse = preview.cells.find((c) => c.key === "business_pulse");
if (shownPulse?.cell.state !== "restricted") {
  mismatches.push(`preview business_pulse for sales should be restricted, got ${shownPulse?.cell.state}`);
}

// HTTP route gates
function mint(userId) {
  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  const expires = new Date(Date.now() + 8 * 3600 * 1000).toISOString();
  db.prepare(
    `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)`,
  ).run(hash, userId, expires);
  return token;
}

const base = process.env.BASE_URL || "http://localhost:3200";
async function probe(email, userId, url) {
  const token = mint(userId);
  const res = await fetch(base + url, {
    redirect: "manual",
    headers: { cookie: `perseus_session=${token}` },
  });
  return { email, url, status: res.status, location: res.headers.get("location") };
}

const http = [];
try {
  http.push(await probe("sales@perseus.app", sales.id, "/app/admin/reports"));
  http.push(await probe("admin@perseus.app", admin.id, "/app/admin/reports"));
  http.push(await probe("sales@perseus.app", sales.id, "/app/reports"));
  http.push(await probe("sales@perseus.app", sales.id, `/app/deliveries/${adminD.id}`));
  http.push(await probe("sales@perseus.app", sales.id, `/app/deliveries/${salesD.id}`));
} catch (e) {
  mismatches.push("http probe failed: " + e.message);
}

const salesAdmin = http.find((h) => h.email.startsWith("sales") && h.url === "/app/admin/reports");
if (salesAdmin && salesAdmin.status !== 307 && salesAdmin.status !== 302 && salesAdmin.status !== 303) {
  mismatches.push(`sales /app/admin/reports should redirect, got ${salesAdmin.status}`);
}
const adminHome = http.find((h) => h.email.startsWith("admin") && h.url === "/app/admin/reports");
if (adminHome && adminHome.status !== 200) {
  mismatches.push(`admin /app/admin/reports should be 200, got ${adminHome.status}`);
}
const salesNav = http.find((h) => h.url === "/app/reports");
if (salesNav && salesNav.status !== 404) {
  mismatches.push(`ordinary /app/reports should 404, got ${salesNav.status}`);
}
const stealHttp = http.find((h) => h.url === `/app/deliveries/${adminD.id}`);
if (stealHttp && stealHttp.status !== 404) {
  mismatches.push(`sales opening admin delivery should 404, got ${stealHttp.status}`);
}

console.log(
  JSON.stringify(
    {
      reportId,
      generate: result,
      deliveries: deliveries.map((d) => ({
        email: d.recipient_email,
        status: d.status,
        authorized: d.sections_authorized,
        restricted: d.sections_restricted,
        sections: d.snapshot
          ? JSON.parse(d.snapshot).sections.map((s) => `${s.key}:${s.authorized ? "yes" : "no"}`)
          : [],
      })),
      http,
      mismatches,
    },
    null,
    2,
  ),
);

if (mismatches.length) process.exit(1);
