"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/authz";
import { logout } from "@/lib/auth/service";

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  await logout(user);
  redirect("/login");
}
