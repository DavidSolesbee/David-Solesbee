"use server";

import { redirect } from "next/navigation";
import { getActiveContext } from "@/lib/tenant/context";

export async function askAction(formData: FormData): Promise<void> {
  const user = await getActiveContext();
  if (!user) redirect("/login");
  const q = String(formData.get("question") ?? "").trim();
  if (!q) redirect("/app/ask");
  redirect(`/app/ask?q=${encodeURIComponent(q)}`);
}
