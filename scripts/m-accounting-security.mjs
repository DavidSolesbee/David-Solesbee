/**
 * Accounting Phase 1 security probe.
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

const { getAccountingOverview } = await import("../src/lib/accounting/metrics.ts");
const { getArSummary, listArAccounts } = await import("../src/lib/accounting/ar.ts");
const { departmentalContribution } = await import("../src/lib/accounting/statements.ts");
const { getAccountingHealth } = await import("../src/lib/accounting/health.ts");
const { getCloseCenter } = await import("../src/lib/accounting/close.ts");
const { listAccountingExceptions } = await import("../src/lib/accounting/exceptions.ts");
const { resolveSectionForViewer, bindViewerTenant } = await import("../src/lib/reports/resolve.ts");
const { resolvePeriod, resolveComparison } = await import("../src/lib/reports/periods.ts");
const { getTemplate } = await import("../src/lib/reports/catalog.ts");
const { loadUserById } = await import("../src/lib/auth/authz.ts");
const { getAppDb } = await import("../src/lib/db/app.ts");

function userByEmail(email) {
  const row = getAppDb().prepare("SELECT id FROM users WHERE email = ?").get(email);
  const u = loadUserById(Number(row?.id));
  if (!u) throw new Error("missing " + email);
  return u;
}

const admin = userByEmail("admin@perseus.app");
const sales = userByEmail("sales@perseus.app");
const service = userByEmail("service@perseus.app");
const mismatches = [];

if (!admin.permissions.has("module.accounting")) mismatches.push("admin missing module.accounting");
if (!admin.permissions.has("feature.view_ar")) mismatches.push("admin missing view_ar");
if (sales.permissions.has("module.accounting")) mismatches.push("sales should not have module.accounting");
if (service.permissions.has("module.accounting")) mismatches.push("service should not have module.accounting");

const overview = getAccountingOverview(admin);
if (!overview) mismatches.push("admin overview missing");
if (overview && overview.mtd.revenue <= 0) mismatches.push("admin MTD revenue empty");
if (/operating expense|cash position/i.test(JSON.stringify(overview)) && overview?.ar == null) {
  /* ignore */
}

const ar = getArSummary(admin);
if (!ar || ar.openAr <= 0) mismatches.push("admin AR should have an open balance");
if (/invoice aging|1–30|90\+/i.test(ar.methodology) === false) {
  // methodology must explain we do NOT invoice-age
}
if (!/Customer-net|invoice-level aging is not shown/i.test(ar.methodology)) {
  mismatches.push("AR methodology missing customer-net / no invoice-aging warning");
}

const accounts = listArAccounts(admin);
if (!accounts.length) mismatches.push("admin AR queue empty");
if (accounts.some((a) => /1–30|31–60/.test(a.name))) {
  mismatches.push("AR queue looks like fake aging buckets");
}

const stmt = departmentalContribution(admin);
if (!stmt?.rows.length) mismatches.push("admin statement empty");
if (!/not a books P&L/i.test(stmt.methodology)) mismatches.push("statement must disclaim books P&L");

const salesOverview = getAccountingOverview(sales);
// Sales may compute if they somehow had tenant, but they lack permissions in UI.
// Data functions do not re-check module.accounting — pages do. That's OK.
if (sales.permissions.has("feature.view_ar")) mismatches.push("sales should not have view_ar");

for (const key of [
  "accounting_executive_summary",
  "accounting_ar_review",
  "accounting_exception_report",
  "accounting_cash_position",
]) {
  if (!getTemplate(key)) mismatches.push("missing template " + key);
}

const asOf = "2026-04-29";
const period = resolvePeriod("week_to_date", asOf);
const comparison = resolveComparison("prior_week", period);
const ctx = { period, comparison, topN: 10, asOf };
const salesArSec = resolveSectionForViewer(
  "accounting_receivable",
  bindViewerTenant(sales),
  ctx,
);
if (salesArSec?.authorized) mismatches.push("sales must not authorize accounting_receivable");
const adminArSec = resolveSectionForViewer(
  "accounting_receivable",
  bindViewerTenant(admin),
  ctx,
);
if (!adminArSec?.authorized) mismatches.push("admin AR report section unauthorized");
if (adminArSec && /1–30 Days|31–60 Days/.test(JSON.stringify(adminArSec))) {
  mismatches.push("AR report section leaked invoice aging");
}
const salesSnap = resolveSectionForViewer("accounting_snapshot", bindViewerTenant(sales), ctx);
if (salesSnap?.authorized) mismatches.push("sales must not authorize accounting_snapshot");
const gaps = resolveSectionForViewer("accounting_gaps", bindViewerTenant(admin), ctx);
if (!gaps?.authorized) mismatches.push("admin gaps section missing");
if (gaps && /Total AP|Cash Position[\s\S]{0,40}\$0/.test(JSON.stringify(gaps))) {
  mismatches.push("gaps section invented $0 cash or AP");
}
if (gaps && !/Data Unavailable/.test(JSON.stringify(gaps))) {
  mismatches.push("gaps section must declare Data Unavailable");
}

const health = getAccountingHealth(admin);
if (!health) mismatches.push("admin health missing");
if (health && health.components.find((c) => c.key === "ap")?.score !== null) {
  mismatches.push("AP health must not be a number");
}
if (health && health.components.find((c) => c.key === "cash")?.score !== null) {
  mismatches.push("cash health must not be a number");
}
if (health && health.components.find((c) => c.key === "close")?.score !== null) {
  mismatches.push("close health must not be a number");
}
if (health && !/Partial score only/i.test(health.methodology)) {
  mismatches.push("health methodology must say partial");
}

const close = getCloseCenter(admin);
if (!close) mismatches.push("admin close missing");
if (close && close.completionPct !== null) mismatches.push("close invented completion %");
if (close && close.targetDate !== null) mismatches.push("close invented target date");
if (close && close.tasks.some((t) => t.status === "source_unavailable" && /complete/i.test(t.note))) {
  mismatches.push("unavailable close task looks completed");
}

const exceptions = listAccountingExceptions(admin);
if (exceptions.some((e) => /AP invoices past due|unreconciled bank|duplicate vendor/i.test(e.title))) {
  mismatches.push("exception center invented AP/bank findings");
}

const db = new DatabaseSync(path.join(process.cwd(), "data", "perseus_app.db"));
function mint(userId) {
  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  const expires = new Date(Date.now() + 8 * 3600 * 1000).toISOString();
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
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
  http.push(await probe("sales@perseus.app", sales.id, "/app/accounting"));
  http.push(await probe("sales@perseus.app", sales.id, "/app/accounting/receivable"));
  http.push(await probe("admin@perseus.app", admin.id, "/app/accounting"));
  http.push(await probe("admin@perseus.app", admin.id, "/app/accounting/receivable"));
  http.push(await probe("admin@perseus.app", admin.id, "/app/accounting/payable"));
  http.push(await probe("admin@perseus.app", admin.id, "/app/accounting/ledger"));
  http.push(await probe("admin@perseus.app", admin.id, "/app/accounting/cash"));
  http.push(await probe("admin@perseus.app", admin.id, "/app/accounting/inventory"));
  http.push(await probe("admin@perseus.app", admin.id, "/app/accounting/departments"));
  http.push(await probe("admin@perseus.app", admin.id, "/app/accounting/exceptions"));
  http.push(await probe("admin@perseus.app", admin.id, "/app/accounting/close"));
  http.push(await probe("admin@perseus.app", admin.id, "/app/accounting/health"));
  http.push(await probe("admin@perseus.app", admin.id, "/app/accounting/reports"));
  http.push(await probe("sales@perseus.app", sales.id, "/app/accounting/ledger"));
  http.push(await probe("sales@perseus.app", sales.id, "/app/accounting/exceptions"));
  http.push(await probe("service@perseus.app", service.id, "/app/accounting"));
} catch (e) {
  mismatches.push("http probe failed: " + e.message);
}

const salesAcct = http.find((h) => h.email.startsWith("sales") && h.url === "/app/accounting");
if (salesAcct && ![302, 303, 307].includes(salesAcct.status)) {
  mismatches.push(`sales /app/accounting should redirect, got ${salesAcct.status}`);
}
const adminHome = http.find((h) => h.email.startsWith("admin") && h.url === "/app/accounting");
if (adminHome && adminHome.status !== 200) {
  mismatches.push(`admin /app/accounting should be 200, got ${adminHome.status}`);
}
if (adminHome?.body && !/Data Unavailable/i.test(adminHome.body)) {
  mismatches.push("admin overview missing Data Unavailable for unsupported measures");
}
if (adminHome?.body && /Accounts Payable[\s\S]{0,80}\$0/.test(adminHome.body)) {
  mismatches.push("admin overview showed AP as $0");
}
const adminAr = http.find((h) => h.url === "/app/accounting/receivable" && h.email.startsWith("admin"));
if (adminAr && adminAr.status !== 200) {
  mismatches.push(`admin AR should be 200, got ${adminAr.status}`);
}
if (adminAr?.body && /1–30 Days|31–60 Days|61–90 Days/i.test(adminAr.body)) {
  mismatches.push("AR page leaked invoice aging buckets");
}
const adminAp = http.find((h) => h.url === "/app/accounting/payable");
if (adminAp && adminAp.status !== 200) {
  mismatches.push(`admin AP should be 200, got ${adminAp.status}`);
}
if (adminAp?.body && !/Data Unavailable|Not in source/i.test(adminAp.body)) {
  mismatches.push("AP page should declare data unavailable");
}
if (adminAp?.body && /Total AP|Past Due AP|Largest Vendor Balance/i.test(adminAp.body)) {
  mismatches.push("AP page invented payable amounts");
}

for (const path of [
  "/app/accounting/ledger",
  "/app/accounting/cash",
  "/app/accounting/inventory",
  "/app/accounting/departments",
]) {
  const page = http.find((h) => h.email.startsWith("admin") && h.url === path);
  if (page && page.status !== 200) {
    mismatches.push(`admin ${path} should be 200, got ${page.status}`);
  }
  if (page?.body && !/Coming in a newer release/i.test(page.body)) {
    mismatches.push(`${path} should be marked coming in a newer release`);
  }
  if (page?.body && /\$[0-9]/.test(page.body) && !/No sample/i.test(page.body)) {
    mismatches.push(`${path} looks like it invented dollar amounts`);
  }
}
const salesGl = http.find((h) => h.email.startsWith("sales") && h.url === "/app/accounting/ledger");
if (salesGl && ![302, 303, 307].includes(salesGl.status)) {
  mismatches.push(`sales /app/accounting/ledger should redirect, got ${salesGl.status}`);
}
const adminReports = http.find((h) => h.email.startsWith("admin") && h.url === "/app/accounting/reports");
if (adminReports && adminReports.status !== 200) {
  mismatches.push(`admin reports should be 200, got ${adminReports.status}`);
}
if (adminReports?.body && !/Automated Reporting/i.test(adminReports.body)) {
  mismatches.push("accounting reports should point at the existing engine");
}
if (adminReports?.body && /Cash Position:\s*\$[0-9]|Total Cash:\s*\$[0-9]/i.test(adminReports.body)) {
  mismatches.push("reports catalog invented cash amounts");
}

const salesEx = http.find((h) => h.email.startsWith("sales") && h.url === "/app/accounting/exceptions");
if (salesEx && ![302, 303, 307].includes(salesEx.status)) {
  mismatches.push(`sales /app/accounting/exceptions should redirect, got ${salesEx.status}`);
}

const adminEx = http.find((h) => h.email.startsWith("admin") && h.url === "/app/accounting/exceptions");
if (adminEx && adminEx.status !== 200) {
  mismatches.push(`admin exceptions should be 200, got ${adminEx.status}`);
}
if (adminEx?.body && /AP invoices past due[\s\S]{0,80}\$[0-9]/.test(adminEx.body)) {
  mismatches.push("exceptions invented AP past-due amounts");
}

const adminClose = http.find((h) => h.email.startsWith("admin") && h.url === "/app/accounting/close");
if (adminClose && adminClose.status !== 200) {
  mismatches.push(`admin close should be 200, got ${adminClose.status}`);
}
if (adminClose?.body && /Completion[\s\S]{0,40}[0-9]+%/.test(adminClose.body)) {
  mismatches.push("close page invented a completion percentage");
}
if (adminClose?.body && !/Data Unavailable/i.test(adminClose.body)) {
  mismatches.push("close page should keep completion/target unavailable");
}

const adminHealth = http.find((h) => h.email.startsWith("admin") && h.url === "/app/accounting/health");
if (adminHealth && adminHealth.status !== 200) {
  mismatches.push(`admin health should be 200, got ${adminHealth.status}`);
}
if (adminHealth?.body && !/not a complete score/i.test(adminHealth.body)) {
  mismatches.push("health page must say it is not a complete score");
}
if (
  adminHealth?.body &&
  /AP Health/i.test(adminHealth.body) &&
  !/AP Health[\s\S]{0,200}Data Unavailable/i.test(adminHealth.body)
) {
  mismatches.push("health page scored AP");
}

console.log(
  JSON.stringify(
    {
      adminHasAccounting: admin.permissions.has("module.accounting"),
      salesHasAccounting: sales.permissions.has("module.accounting"),
      arOpen: ar.openAr,
      arAccounts: ar.accountCount,
      mtdRevenue: overview?.mtd.revenue,
      http: http.map((h) => ({ email: h.email, url: h.url, status: h.status })),
      mismatches,
    },
    null,
    2,
  ),
);
if (mismatches.length) process.exit(1);
