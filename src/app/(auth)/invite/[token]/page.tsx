import { Card, CardContent } from "@/components/ui/Card";
import { getOpenInvitation } from "@/lib/admin/invitations";
import { getAppDb } from "@/lib/db/app";
import { InviteForm } from "./InviteForm";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = getOpenInvitation(token);

  if (!invite) {
    return (
      <Card>
        <CardContent className="space-y-3">
          <h1 className="text-2xl font-semibold text-ink">Invitation unavailable</h1>
          <p className="text-sm text-ink-soft">
            This link is expired, revoked, or already used. Ask your administrator for a new invitation.
          </p>
        </CardContent>
      </Card>
    );
  }

  const existing = !!getAppDb()
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(invite.email);

  return (
    <Card>
      <CardContent className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Join {invite.organizationName}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            You were invited as {invite.roleName ?? "a member"}. Membership is granted
            only after you accept — the email alone does not authorize access.
          </p>
        </div>
        <InviteForm token={token} email={invite.email} existingUser={existing} />
      </CardContent>
    </Card>
  );
}
