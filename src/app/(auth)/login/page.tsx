import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { getCurrentUser } from "@/lib/auth/authz";
import { postAuthPath } from "@/lib/tenant/context";
import { DEMO_PASSWORD } from "@/lib/auth/seed";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user?.status === "active") redirect(await postAuthPath());

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              Sign in
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              Welcome back. Access is secure and approval-only.
            </p>
          </div>
          <LoginForm />
        </CardContent>
      </Card>

      {/* Demo credentials — hackathon convenience only */}
      <Card className="bg-surface-tinted">
        <CardContent className="space-y-2">
          <p className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
            Demo accounts · password{" "}
            <span className="font-mono normal-case text-ink">{DEMO_PASSWORD}</span>
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-caption text-ink-soft">
            <span>admin@perseus.app</span><span className="text-ink-faint">System Administrator</span>
            <span>owner@perseus.app</span><span className="text-ink-faint">Dealer Principal</span>
            <span>gm@perseus.app</span><span className="text-ink-faint">General Manager</span>
            <span>sales@perseus.app</span><span className="text-ink-faint">Sales Manager</span>
            <span>parts@perseus.app</span><span className="text-ink-faint">Parts Manager</span>
            <span>service@perseus.app</span><span className="text-ink-faint">Service Manager</span>
            <span>pending@perseus.app</span><span className="text-ink-faint">Pending state</span>
            <span>suspended@perseus.app</span><span className="text-ink-faint">Suspended state</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
