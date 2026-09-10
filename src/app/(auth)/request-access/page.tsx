import { Card, CardContent } from "@/components/ui/Card";
import { RequestAccessForm } from "./RequestAccessForm";

export const dynamic = "force-dynamic";

export default function RequestAccessPage() {
  return (
    <Card>
      <CardContent className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Request access
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Access is approval-only. Submit your details and an administrator
            will review your request.
          </p>
        </div>
        <RequestAccessForm />
      </CardContent>
    </Card>
  );
}
