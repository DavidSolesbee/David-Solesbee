import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, accountStateMessage } from "@/lib/auth/authz";
import { AuthedShell } from "@/components/shell/AuthedShell";
import { PerseusMark } from "@/components/brand/PerseusLogo";
import { Card, CardContent } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { logoutAction } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Server-side gate for the entire /app area. Enforces:
 *   - a valid session (else -> /login),
 *   - an ACTIVE account with app.access (else -> blocked screen).
 * This runs on the server for every /app request; front-end visibility is never
 * trusted.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  if (user.status !== "active" || !user.permissions.has("app.access")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-5 text-center">
            <PerseusMark size={44} className="mx-auto" />
            <StatusBadge
              intent={user.status === "pending" ? "attention" : "critical"}
            >
              Account {user.status}
            </StatusBadge>
            <h1 className="text-xl font-semibold text-ink">Access unavailable</h1>
            <p className="text-sm text-ink-soft">
              {accountStateMessage(user.status) ||
                "Your account does not have application access."}
            </p>
            <form action={logoutAction}>
              <Button variant="secondary" className="w-full" type="submit">
                Sign out
              </Button>
            </form>
            <Link
              href="/"
              className="block text-sm text-ink-soft hover:text-ink"
            >
              Return home
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <AuthedShell user={user}>{children}</AuthedShell>;
}
