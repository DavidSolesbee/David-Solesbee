import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/authz";
import { getDeliveryForViewer } from "@/lib/reports/generate";
import { ReportDocument } from "@/components/reports/ReportDocument";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

/**
 * Secure "View in Perseus" destination. Authentication required.
 * No credentials or reusable tokens in the URL — the session is the gate,
 * and only the recipient (or an admin) may open the delivery.
 */
export default async function DeliveryViewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.status !== "active" || !user.permissions.has("app.access")) {
    redirect("/login");
  }
  const { id: idRaw } = await params;
  const delivery = getDeliveryForViewer(user, Number(idRaw));
  if (!delivery || !delivery.snapshot) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          Delivered {delivery.deliveredAt ?? "—"} · {delivery.recipientEmail}
        </p>
        {delivery.snapshot && (
          <Link href={`/app/deliveries/${delivery.id}/print`}>
            <Button variant="secondary" size="sm">
              Print / PDF
            </Button>
          </Link>
        )}
      </div>
      <ReportDocument
        snap={delivery.snapshot}
        mark={delivery.snapshot.test ? "test" : null}
      />
    </div>
  );
}
