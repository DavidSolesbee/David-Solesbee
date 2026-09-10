import { Card, CardContent } from "@/components/ui/Card";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardContent className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Reset password
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Enter your business email and we&apos;ll send reset instructions.
          </p>
        </div>
        <ForgotPasswordForm />
      </CardContent>
    </Card>
  );
}
