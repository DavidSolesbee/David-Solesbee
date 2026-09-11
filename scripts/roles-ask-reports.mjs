/**
 * Role dashboards, Ask AI no-remap, and department report runner.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const stub = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: "data:text/javascript,export default true;", shortCircuit: true };
  }
  if (specifier === "next/headers" || specifier === "next/cache" || specifier === "next/navigation") {
    return {
      url: "data:text/javascript," + encodeURIComponent(\`
        export function cookies() { return { get() { return undefined; }, set() {}, delete() {} }; }
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

const { seedRoleDashboards, listVisibleDashboards, getDashboardForViewer } = await import(
  "../src/lib/dashboards/service.ts"
);
const { askPerseus } = await import("../src/lib/ai/service.ts");
const { matchQuestion } = await import("../src/lib/ai/catalog.ts");
const { authorizedQuestions } = await import("../src/lib/ai/service.ts");
const { canRunTemplate, getTemplate } = await import("../src/lib/reports/catalog.ts");
const { generateTemplateForSelf, getDeliveryForViewer } = await import("../src/lib/reports/generate.ts");
const { loadUserById } = await import("../src/lib/auth/authz.ts");
const { getAppDb } = await import("../src/lib/db/app.ts");

function userByEmail(email) {
  const row = getAppDb().prepare("SELECT id FROM users WHERE email = ?").get(email);
  const u = loadUserById(Number(row?.id));
  if (!u) throw new Error("missing " + email);
  return u;
}

const admin = userByEmail("admin@perseus.app");
const owner = userByEmail("owner@perseus.app");
const parts = userByEmail("parts@perseus.app");
const mismatches = [];

seedRoleDashboards(admin);

const partsBoards = listVisibleDashboards(parts);
if (partsBoards.some((d) => d.name === "Executive Metrics")) {
  mismatches.push("parts must not discover Executive Metrics");
}
if (!partsBoards.some((d) => d.name === "Parts Counter")) {
  mismatches.push("parts should see Parts Counter");
}

const ownerBoards = listVisibleDashboards(owner);
const exec = ownerBoards.find((d) => d.name === "Executive Metrics");
if (!exec) mismatches.push("owner should see Executive Metrics");
else {
  if (exec.visibility !== "role") mismatches.push("Executive Metrics must be role-visible");
  const partsExec = getDashboardForViewer(parts, exec.id);
  if (partsExec) mismatches.push("parts must 404 Executive Metrics by id");
}

const allowed = authorizedQuestions(admin);
if (matchQuestion("revenue change", allowed)) {
  mismatches.push("Ask must not remap aliases");
}
const exact = askPerseus(admin, "Why did revenue decline?");
if (!exact.authorized) mismatches.push("exact prompt should run");
const remap = askPerseus(admin, "revenue decline last month please");
if (!remap.unmatched) mismatches.push("free text must not auto-map");
if (remap.findings.length) mismatches.push("unmatched Ask must not invent findings");

const partsPerf = getTemplate("parts_performance");
const execFin = getTemplate("accounting_executive_summary");
if (!partsPerf || !canRunTemplate(parts.permissions, partsPerf)) {
  mismatches.push("parts should be able to run Parts Performance");
}
if (execFin && canRunTemplate(parts.permissions, execFin)) {
  mismatches.push("parts must not run accounting templates");
}

try {
  const run = generateTemplateForSelf(parts, "parts_performance", {
    start: "2026-03-30",
    end: "2026-04-29",
  });
  if (!run.deliveryId) mismatches.push("parts run-once returned no delivery");
  const delivery = getDeliveryForViewer(parts, run.deliveryId);
  if (!delivery?.snapshot) mismatches.push("parts cannot open their Parts Performance delivery");
  else if (!String(delivery.snapshot.periodLabel).includes("2026-03-30 → 2026-04-29")) {
    mismatches.push("run-once period override missing: " + delivery.snapshot.periodLabel);
  }
} catch (e) {
  mismatches.push("parts run-once failed: " + (e instanceof Error ? e.message : e));
}

try {
  generateTemplateForSelf(parts, "accounting_executive_summary", {
    start: "2026-03-30",
    end: "2026-04-29",
  });
  mismatches.push("parts must not generate an accounting pack");
} catch {
  // expected
}

console.log(JSON.stringify({ partsBoards: partsBoards.map((d) => d.name), mismatches }, null, 2));
if (mismatches.length) process.exit(1);
