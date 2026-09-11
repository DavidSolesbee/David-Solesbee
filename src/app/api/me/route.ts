import { NextResponse } from "next/server";
import { getActiveContext } from "@/lib/tenant/context";

export const dynamic = "force-dynamic";

/**
 * Returns the caller's resolved identity + permissions, or 401/403.
 * Demonstrates that authorization is enforced server-side (not via the UI).
 */
export async function GET() {
  const user = await getActiveContext();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (user.status !== "active" || !user.permissions.has("app.access")) {
    return NextResponse.json(
      { error: "forbidden", status: user.status },
      { status: 403 },
    );
  }
  return NextResponse.json({
    id: user.id,
    email: user.email,
    role: user.roleKey,
    department: user.department,
    location: user.locationName,
    organization: {
      id: user.activeOrganizationId,
      name: user.activeOrganizationName,
      slug: user.activeOrganizationSlug,
      tenantId: user.activeTenantId,
    },
    availableOrganizations: user.availableOrganizationCount,
    scope: user.scope,
    permissions: [...user.permissions].sort(),
  });
}
