/**
 * Milestone 8 security probe.
 * AI only receives what the logged-in user may see. Forced question keys
 * still return authorized:false with empty findings.
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

const { askPerseus, authorizedQuestions, perseusBriefing } = await import("../src/lib/ai/service.ts");
const { createReport, loadReport } = await import("../src/lib/reports/service.ts");
const { generateReport } = await import("../src/lib/reports/generate.ts");
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
const parts = userByEmail("parts@perseus.app");

const mismatches = [];

function leak(label, hay, pattern) {
  if (pattern.test(typeof hay === "string" ? hay : JSON.stringify(hay))) {
    mismatches.push(label);
  }
}

const salesQs = authorizedQuestions(sales).map((q) => q.key);
if (salesQs.includes("top_parts")) mismatches.push("sales catalog includes top_parts");
if (salesQs.includes("technician_workload")) mismatches.push("sales catalog includes technician_workload");
if (salesQs.includes("aging_work_orders")) mismatches.push("sales catalog includes aging_work_orders");
if (!salesQs.includes("revenue_change")) mismatches.push("sales should see revenue_change");

const serviceQs = authorizedQuestions(service).map((q) => q.key);
if (serviceQs.includes("top_parts")) mismatches.push("service catalog includes top_parts");
if (!serviceQs.includes("technician_workload")) mismatches.push("service should see technician_workload");

const partsQs = authorizedQuestions(parts).map((q) => q.key);
if (partsQs.includes("technician_workload")) mismatches.push("parts catalog includes technician_workload");
if (!partsQs.includes("top_parts")) mismatches.push("parts should see top_parts");

const salesParts = askPerseus(sales, "top_parts");
if (salesParts.authorized) mismatches.push("sales top_parts authorized");
if (salesParts.findings.length) mismatches.push("sales top_parts returned findings");
if (salesParts.followUps.length) mismatches.push("sales top_parts returned follow-ups");
leak("sales top_parts narrative leaked parts", salesParts.narrative, /parts revenue|top-selling part/i);

const salesTech = askPerseus(sales, "technician_workload");
if (salesTech.authorized) mismatches.push("sales technician_workload authorized");
if (salesTech.findings.length) mismatches.push("sales technician_workload returned findings");

const salesRev = askPerseus(sales, "revenue_change");
if (!salesRev.authorized) mismatches.push("sales revenue_change should be authorized");
if (!salesRev.findings.length) mismatches.push("sales revenue_change returned no findings");
if (salesRev.findings.some((f) => f.id === "rev_depts")) {
  mismatches.push("sales revenue_change included department contribution");
}
leak("sales revenue narrative leaked dept/parts/margin", salesRev.narrative, /departmental contribution|parts revenue|margin/i);

const salesBrief = perseusBriefing(sales);
if (!salesBrief) mismatches.push("sales briefing missing");
else {
  leak("sales briefing leaked WO/parts/dept", salesBrief.narrative, /work-order|parts revenue|departmental contribution/i);
  if (salesBrief.findings.some((f) => f.id === "brief_wo" || f.id === "rev_depts" || f.id === "parts_rev")) {
    mismatches.push("sales briefing included withheld findings");
  }
}

const serviceTech = askPerseus(service, "technician_workload");
if (!serviceTech.authorized) mismatches.push("service technician_workload should be authorized");
if (!serviceTech.findings.length) mismatches.push("service technician_workload returned no findings");

const serviceParts = askPerseus(service, "top_parts");
if (serviceParts.authorized) mismatches.push("service top_parts authorized");
if (serviceParts.findings.length) mismatches.push("service top_parts returned findings");

const partsAsk = askPerseus(parts, "top_parts");
if (!partsAsk.authorized) mismatches.push("parts top_parts should be authorized");

const adminAsk = askPerseus(admin, "revenue_change");
if (!adminAsk.authorized) mismatches.push("admin revenue_change should be authorized");
if (!adminAsk.findings.some((f) => f.id === "rev_depts")) {
  mismatches.push("admin revenue_change should include department contribution");
}

const reportId = createReport(admin, {
  name: "M8 AI Security Pack",
  description: "AI narrative cross-role probe",
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
  aiNarrative: true,
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
  ],
});

const gen = generateReport(admin, reportId, "manual");
if (!loadReport(reportId)?.aiNarrative) mismatches.push("created report missing aiNarrative flag");

const db = new DatabaseSync(appDbPath);
const deliveries = db
  .prepare(
    `SELECT recipient_email, snapshot FROM report_deliveries WHERE report_id = ? ORDER BY id`,
  )
  .all(reportId);

function snapOf(email) {
  const row = deliveries.find((d) => d.recipient_email === email);
  return row?.snapshot ? JSON.parse(row.snapshot) : null;
}

const salesSnap = snapOf("sales@perseus.app");
const adminSnap = snapOf("admin@perseus.app");
if (!salesSnap?.aiNarrative) mismatches.push("sales delivery missing AI narrative");
if (!adminSnap?.aiNarrative) mismatches.push("admin delivery missing AI narrative");
leak("sales report AI leaked parts/margin/pulse", salesSnap?.aiNarrative ?? "", /parts margin|parts cost|of parts revenue|business pulse/i);

function mint(userId) {
  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  const expires = new Date(Date.now() + 8 * 3600 * 1000).toISOString();
  db.prepare(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)`).run(
    hash,
    userId,
    expires,
  );
  return token;
}

const base = process.env.BASE_URL || "http://localhost:3200";
async function probe(email, userId, url) {
  const token = mint(userId);
  const res = await fetch(base + url, {
    redirect: "manual",
    headers: { cookie: `perseus_session=${token}` },
  });
  const body = res.status === 200 ? await res.text() : "";
  return { email, url, status: res.status, location: res.headers.get("location"), body };
}

const http = [];
try {
  http.push(await probe("sales@perseus.app", sales.id, "/app/ask"));
  http.push(await probe("sales@perseus.app", sales.id, "/app/ask?q=top_parts"));
  http.push(await probe("sales@perseus.app", sales.id, "/app/ask?q=revenue_change"));
  http.push(await probe("service@perseus.app", service.id, "/app/ask?q=technician_workload"));
  http.push(await probe("sales@perseus.app", sales.id, "/app"));
} catch (e) {
  mismatches.push("http probe failed: " + e.message);
}

const salesAsk = http.find((h) => h.email.startsWith("sales") && h.url === "/app/ask");
if (salesAsk && salesAsk.status !== 200) {
  mismatches.push(`sales /app/ask should be 200, got ${salesAsk.status}`);
}
const forced = http.find((h) => h.url === "/app/ask?q=top_parts");
if (forced && forced.status !== 200) {
  mismatches.push(`sales forced top_parts should render 200, got ${forced.status}`);
}
if (forced?.body && !/Restricted/i.test(forced.body)) {
  mismatches.push("sales forced top_parts page missing Restricted");
}
if (forced?.body && /Posted parts revenue|The top-selling part is/i.test(forced.body)) {
  mismatches.push("sales forced top_parts page leaked parts findings");
}
const salesHome = http.find((h) => h.url === "/app");
if (salesHome && salesHome.status !== 200) {
  mismatches.push(`sales /app should be 200, got ${salesHome.status}`);
}
if (salesHome?.body && !/Perseus Briefing/i.test(salesHome.body)) {
  mismatches.push("sales overview missing Perseus Briefing");
}
if (salesHome?.body && /Work-order aging|departmental contribution/i.test(salesHome.body)) {
  mismatches.push("sales briefing HTML leaked withheld topics");
}
const svcTech = http.find((h) => h.url === "/app/ask?q=technician_workload");
if (svcTech && svcTech.status !== 200) {
  mismatches.push(`service technician_workload should be 200, got ${svcTech.status}`);
}
if (svcTech?.body && !/Authorized finding/i.test(svcTech.body)) {
  mismatches.push("service technician_workload missing Authorized finding");
}

console.log(
  JSON.stringify(
    {
      salesQs,
      serviceQs,
      partsQs,
      salesParts: { authorized: salesParts.authorized, findings: salesParts.findings.length },
      salesRev: {
        authorized: salesRev.authorized,
        findingIds: salesRev.findings.map((f) => f.id),
      },
      serviceTech: { authorized: serviceTech.authorized, findings: serviceTech.findings.length },
      reportId,
      generate: gen,
      http: http.map((h) => ({ email: h.email, url: h.url, status: h.status })),
      mismatches,
    },
    null,
    2,
  ),
);

if (mismatches.length) process.exit(1);
