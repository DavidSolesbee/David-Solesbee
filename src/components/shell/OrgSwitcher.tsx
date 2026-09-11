import { switchOrganizationAction } from "@/app/app/actions";
import type { OrgMembership } from "@/lib/tenant/organizations";

/**
 * In-app organization switcher (Auth v2, Phase D).
 *
 * Single-org identities see the name only. Multi-org identities get a native
 * dropdown; each choice POSTs to a server action that re-validates membership
 * before binding the new tenant. The UI never widens access.
 */
export function OrgSwitcher({
  label,
  activeOrganizationId,
  organizations,
  viewingAs = false,
}: {
  label: string;
  activeOrganizationId: number;
  organizations: OrgMembership[];
  viewingAs?: boolean;
}) {

  if (organizations.length <= 1) {
    return (
      <div className="hidden items-center border-l border-line pl-3 md:flex">
        <span className="text-sm font-medium text-ink">{label}</span>
      </div>
    );
  }

  return (
    <details className="relative border-l border-line pl-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg py-1 pr-1 text-sm font-medium text-ink hover:text-forest-700 [&::-webkit-details-marker]:hidden">
        <span className="max-w-[14rem] truncate">{label}</span>
        <span className="rounded-full bg-surface-tinted px-2 py-0.5 text-caption font-normal text-ink-faint">
          {organizations.length} orgs
        </span>
        <span aria-hidden className="text-ink-faint">
          ▾
        </span>
      </summary>
      <div className="absolute left-3 top-full z-50 mt-2 w-72 rounded-xl border border-line bg-surface p-1.5 shadow-card">
        <p className="px-3 py-1.5 text-caption uppercase tracking-wide text-ink-faint">
          Switch organization
        </p>
        <ul>
          {organizations.map((org) => {
            const active = !viewingAs && org.id === activeOrganizationId;
            return (
              <li key={org.id}>
                <form action={switchOrganizationAction}>
                  <input type="hidden" name="organizationId" value={org.id} />
                  <button
                    type="submit"
                    disabled={active}
                    className="flex w-full items-start justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-tinted disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <span>
                      <span className="block text-sm font-medium text-ink">
                        {org.name}
                      </span>
                      <span className="mt-0.5 block text-caption text-ink-faint">
                        {org.roleName ?? "Member"}
                        {org.location ? ` · ${org.location}` : ""}
                      </span>
                    </span>
                    {active && (
                      <span className="mt-0.5 text-caption font-medium text-forest-600">
                        Current
                      </span>
                    )}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
