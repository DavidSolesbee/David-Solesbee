import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type AuthUser } from "@/lib/auth/authz";

/**
 * Page-level guard for a module. Ensures an active session and the required
 * `module.*` permission, redirecting otherwise. This is the authoritative,
 * server-side gate for each department module page (the nav only hides links).
 */
export async function guardModule(moduleKey: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user || user.status !== "active") redirect("/login");
  if (!user.permissions.has("app.access")) redirect("/login");
  if (!user.permissions.has(moduleKey)) redirect("/app");
  return user;
}
