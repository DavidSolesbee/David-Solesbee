import "server-only";
import { redirect } from "next/navigation";
import { guardModule } from "@/lib/auth/guards";
import { audit } from "@/lib/auth/audit";
import type { AuthContext } from "@/lib/tenant/context";
import { ACCOUNTING_PERMS } from "@/lib/accounting/permissions";

export async function guardAccounting(feature: string): Promise<AuthContext> {
  const user = await guardModule(ACCOUNTING_PERMS.module);
  if (!user.permissions.has(feature)) redirect("/app");
  return user;
}

export function auditAccounting(
  user: AuthContext,
  action: string,
  target = "accounting",
): void {
  audit({
    actorUserId: user.id,
    actorLabel: user.email,
    action,
    targetType: "module",
    targetId: target,
    detail: user.activeOrganizationName,
  });
}
