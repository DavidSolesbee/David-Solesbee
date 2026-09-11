"use server";

import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/tenant/context";
import { setFlash } from "@/lib/admin/flash";
import { config } from "@/lib/config";
import { toPerseusError } from "@/lib/errors";
import { isYmd } from "@/lib/reports/periods";
import { generateTemplateForSelf } from "@/lib/reports/generate";

function parseRange(formData: FormData): { start: string; end: string } {
  const start = String(formData.get("from") ?? "").trim().slice(0, 10);
  const end = String(formData.get("to") ?? "").trim().slice(0, 10);
  const asOf = config.dataAsOfFallback.slice(0, 10);
  if (!isYmd(start) || !isYmd(end)) {
    throw new Error("From and To are required dates.");
  }
  if (start > end) {
    throw new Error("From date must be on or before To date.");
  }
  if (end > asOf) {
    throw new Error("To date cannot be after the latest available data.");
  }
  return { start, end };
}

export async function runReportOnceAction(formData: FormData): Promise<void> {
  const user = await getActiveContext();
  if (!user || user.status !== "active" || !user.permissions.has("app.access")) {
    redirect("/login");
  }
  if (!user.permissions.has("feature.export")) redirect("/app");

  const templateKey = String(formData.get("templateKey") ?? "").trim();
  const after = String(formData.get("after") ?? "view").trim();
  let deliveryId: number | null = null;
  try {
    const range = parseRange(formData);
    deliveryId = generateTemplateForSelf(user, templateKey, range).deliveryId;
  } catch (e) {
    await setFlash({ kind: "error", message: toPerseusError(e).message });
    redirect("/app/reports");
  }
  if (after === "print" || after === "pdf") {
    redirect(`/app/deliveries/${deliveryId}/print?autoprint=1`);
  }
  redirect(`/app/deliveries/${deliveryId}`);
}
