import "server-only";
import { redirect } from "next/navigation";
import { getActiveContext, type AuthContext } from "@/lib/tenant/context";

/**
 * Page-level guard for a module. Ensures an active session, a validated tenant
 * context (an active membership in an active organization), and the required
 * `module.*` permission FOR THE ACTIVE ORGANIZATION — redirecting otherwise.
 *
 * This is the authoritative, server-side gate for each department module page.
 * Because permissions come from the active organization's membership role, the
 * same identity can be authorized for a module in one org and denied in
 * another. The nav only hides links; this is what actually enforces access.
 */
export async function guardModule(moduleKey: string): Promise<AuthContext> {
  const ctx = await getActiveContext();
  if (!ctx || ctx.status !== "active") redirect("/login");
  if (!ctx.permissions.has("app.access")) redirect("/login");
  if (!ctx.permissions.has(moduleKey)) redirect("/app");
  return ctx;
}
