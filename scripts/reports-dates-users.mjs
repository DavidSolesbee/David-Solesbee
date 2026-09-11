/**
 * Date-range override + admin user actions (set password, deactivate, remove).
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

const { generateTemplateForSelf, getDeliveryForViewer } = await import("../src/lib/reports/generate.ts");
const { loadUserById } = await import("../src/lib/auth/authz.ts");
const { getAppDb } = await import("../src/lib/db/app.ts");
const adminSvc = await import("../src/lib/admin/service.ts");
const { hashPassword } = await import("../src/lib/auth/password.ts");

function userByEmail(email) {
  const row = getAppDb().prepare("SELECT id FROM users WHERE email = ?").get(email);
  const u = loadUserById(Number(row?.id));
  if (!u) throw new Error("missing " + email);
  return u;
}

const mismatches = [];
const parts = userByEmail("parts@perseus.app");
const admin = userByEmail("admin@perseus.app");

try {
  generateTemplateForSelf(parts, "parts_performance", { start: "2026-05-01", end: "2026-05-02" });
  mismatches.push("future To date should be rejected");
} catch (e) {
  if (!(e instanceof Error) || !/latest available/i.test(e.message)) {
    mismatches.push("future range error: " + (e instanceof Error ? e.message : e));
  }
}

try {
  generateTemplateForSelf(parts, "parts_performance", { start: "2026-04-20", end: "2026-04-01" });
  mismatches.push("from > to should be rejected");
} catch (e) {
  if (!(e instanceof Error) || !/on or before/i.test(e.message)) {
    mismatches.push("from>to error: " + (e instanceof Error ? e.message : e));
  }
}

const run = generateTemplateForSelf(parts, "parts_performance", {
  start: "2026-04-01",
  end: "2026-04-15",
});
const delivery = getDeliveryForViewer(parts, run.deliveryId);
if (!delivery?.snapshot?.periodLabel.includes("2026-04-01 → 2026-04-15")) {
  mismatches.push("custom range not applied: " + delivery?.snapshot?.periodLabel);
}

const email = `tmp.remove.${Date.now()}@perseus.app`;
const db = getAppDb();
const pw = hashPassword("TempPass#1");
db.prepare(
  `INSERT INTO users
    (first_name, last_name, email, password_hash, password_salt, role_id,
     department, job_title, location_id, location_name, dealership, status, source, activated_at)
   VALUES ('Tmp', 'Remove', ?, ?, ?, (SELECT id FROM roles WHERE key='parts_manager'),
           'Parts', 'Temp', 1, 'Main Location', 'Perseus', 'active', 'test', datetime('now'))`,
).run(email, pw.hash, pw.salt);
const tmpId = Number(db.prepare("SELECT id FROM users WHERE email=?").get(email).id);
const org = db.prepare("SELECT id FROM organizations WHERE slug='perseus'").get();
if (org) {
  db.prepare(
    `INSERT INTO user_organization_memberships
       (user_id, organization_id, role_id, status, is_primary)
     VALUES (?, ?, (SELECT id FROM roles WHERE key='parts_manager'), 'active', 1)`,
  ).run(tmpId, org.id);
}

try {
  adminSvc.setPassword(admin, admin.id, "ShouldFail1");
  mismatches.push("admin must not set own password");
} catch {
  // expected
}

adminSvc.setPassword(admin, tmpId, "Chosen#99");
const afterSet = db.prepare("SELECT password_hash FROM users WHERE id=?").get(tmpId);
if (!afterSet?.password_hash) mismatches.push("setPassword did not store a hash");

adminSvc.setStatus(admin, tmpId, "expired");
const status = db.prepare("SELECT status FROM users WHERE id=?").get(tmpId);
if (status?.status !== "expired") mismatches.push("deactivate did not set expired");

try {
  adminSvc.deleteUser(admin, admin.id);
  mismatches.push("admin must not remove self");
} catch {
  // expected
}

adminSvc.deleteUser(admin, tmpId);
const gone = db.prepare("SELECT id FROM users WHERE id=?").get(tmpId);
if (gone) mismatches.push("deleteUser left the row");
const auditDel = db
  .prepare("SELECT action FROM audit_log WHERE action='user.deleted' AND target_id=? ORDER BY id DESC LIMIT 1")
  .get(String(tmpId));
if (!auditDel) mismatches.push("user.deleted audit missing");
const auditPw = db
  .prepare("SELECT action FROM audit_log WHERE action='user.password_set' AND target_id=? ORDER BY id DESC LIMIT 1")
  .get(String(tmpId));
if (!auditPw) mismatches.push("user.password_set audit missing");

console.log(JSON.stringify({ mismatches, deliveryPeriod: delivery?.snapshot?.periodLabel }, null, 2));
if (mismatches.length) process.exit(1);
