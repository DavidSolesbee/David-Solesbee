/**
 * Ask Perseus consistency: same question twice, paraphrases resolve to one key.
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

const { askPerseus, authorizedQuestions } = await import("../src/lib/ai/service.ts");
const { matchQuestion } = await import("../src/lib/ai/catalog.ts");
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
const mismatches = [];

const allowed = authorizedQuestions(admin);
if (!allowed.length) mismatches.push("admin has no authorized questions");

for (const q of allowed) {
  const a = askPerseus(admin, q.key);
  const b = askPerseus(admin, q.key);
  if (a.narrative !== b.narrative) mismatches.push(`${q.key} narrative differed on repeat`);
  if (JSON.stringify(a.findings) !== JSON.stringify(b.findings)) {
    mismatches.push(`${q.key} findings differed on repeat`);
  }
  if (!a.authorized) mismatches.push(`${q.key} should be authorized for admin`);
}

const exact = [
  ["Why did revenue decline?", "revenue_change"],
  ["Who are our fastest-growing customers?", "growing_customers"],
  ["Which units are older than 180 days?", "aged_inventory"],
  ["revenue_change", "revenue_change"],
];
for (const [text, key] of exact) {
  const m = matchQuestion(text, allowed);
  if (m?.key !== key) mismatches.push(`"${text}" should map to ${key}, got ${m?.key}`);
}

const remaps = [
  ["revenue change", "alias must not remap"],
  ["which customers are growing", "alias must not remap"],
  ["aged inventory", "alias must not remap"],
  ["revenue decline last month", "partial text must not remap"],
];
for (const [text, why] of remaps) {
  const m = matchQuestion(text, allowed);
  if (m) mismatches.push(`"${text}" ${why} (got ${m.key})`);
}

const aliasAsk = askPerseus(admin, "revenue change");
if (!aliasAsk.unmatched) mismatches.push("alias free text must stay unmatched");
if (aliasAsk.findings.length) mismatches.push("alias free text must not invent findings");

const gibberish = matchQuestion("what is the weather in paris", allowed);
if (gibberish) mismatches.push("unrelated text should not match a catalog question");

const unknown = askPerseus(admin, "what is the weather in paris");
if (!unknown.unmatched) mismatches.push("unknown free text must be unmatched");
if (unknown.findings.length) mismatches.push("unknown free text must not invent findings");

const salesQs = authorizedQuestions(sales);
if (salesQs.some((q) => q.key === "technician_workload")) {
  mismatches.push("sales should not see technician workload");
}
const salesForced = askPerseus(sales, "technician_workload");
if (salesForced.authorized) mismatches.push("sales must not authorize technician_workload");

console.log(JSON.stringify({ adminQuestions: allowed.map((q) => q.key), mismatches }, null, 2));
if (mismatches.length) process.exit(1);
