import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/authz";
import { getDeliveryForViewer } from "@/lib/reports/generate";
import { ReportDocument } from "@/components/reports/ReportDocument";
import { Autoprint } from "./Autoprint";

export const dynamic = "force-dynamic";

export default async function DeliveryPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autoprint?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.status !== "active" || !user.permissions.has("app.access")) {
    redirect("/login");
  }
  const { id: idRaw } = await params;
  const { autoprint } = await searchParams;
  const delivery = getDeliveryForViewer(user, Number(idRaw));
  if (!delivery || !delivery.snapshot) notFound();

  return (
    <div className="print:p-0">
      <Autoprint enabled={autoprint === "1"} />
      <p className="mb-4 text-sm text-ink-soft print:hidden">
        Print sends this report to a printer. Choose Save as PDF in that dialog
        to get a file Adobe or Preview can open. No extra token is required.
      </p>
      <ReportDocument
        snap={delivery.snapshot}
        mark={delivery.snapshot.test ? "test" : null}
      />
    </div>
  );
}
