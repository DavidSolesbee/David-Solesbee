import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/authz";
import { getSessionFromCookie } from "@/lib/auth/session";
import { listUserOrganizations, suggestOrganizationByDomain } from "@/lib/tenant/organizations";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { logoutAction } from "@/app/app/actions";
import { selectOrganizationAction } from "@/app/(auth)/actions";

export const dynamic = "force-dynamic";

export default async function SelectOrganizationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status !== "active") redirect("/login");

  const session = await getSessionFromCookie();
  if (session?.active_organization_id) redirect("/app");

  const orgs = listUserOrganizations(user.id);
  if (orgs.length <= 1) redirect("/app");

  const hinted = suggestOrganizationByDomain(user.email);
  const hintedId =
    hinted && orgs.some((o) => o.id === hinted.id) ? hinted.id : null;
  const sp = await searchParams;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              Choose an organization
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              Signed in as {user.email}. Access is based on your membership,
              not your email domain.
            </p>
          </div>

          {sp.error && (
            <div
              role="alert"
              className="rounded-lg border border-terracotta-300 bg-terracotta-50 px-4 py-3 text-sm text-terracotta-600"
            >
              That organization is not available for your account.
            </div>
          )}

          <ul className="space-y-2">
            {orgs.map((org) => {
              const suggested = org.id === hintedId;
              return (
                <li key={org.id}>
                  <form action={selectOrganizationAction}>
                    <input type="hidden" name="organizationId" value={org.id} />
                    <button
                      type="submit"
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 text-left shadow-subtle transition-colors hover:border-sage-300 hover:bg-surface-tinted"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-ink">
                          {org.name}
                        </span>
                        <span className="mt-0.5 block text-caption text-ink-faint">
                          {org.roleName ?? "Member"}
                          {org.location ? ` · ${org.location}` : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {org.isPrimary && (
                          <StatusBadge intent="info" dot={false}>
                            Primary
                          </StatusBadge>
                        )}
                        {suggested && (
                          <StatusBadge intent="attention" dot={false}>
                            Suggested
                          </StatusBadge>
                        )}
                      </span>
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>

          <p className="text-caption text-ink-faint">
            Domain matching is a hint only. You can only enter organizations
            you already belong to.
          </p>
        </CardContent>
      </Card>

      <form action={logoutAction} className="text-center">
        <Button variant="ghost" type="submit">
          Sign out
        </Button>
      </form>
    </div>
  );
}
