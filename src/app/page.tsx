import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/authz";

/**
 * Product entry — not a marketing page. The family-of-applications site is
 * elsewhere. Signed-in users go to the workspace; everyone else to login.
 */
export default async function RootPage() {
  const user = await getCurrentUser();
  if (user?.status === "active" && user.permissions.has("app.access")) {
    redirect("/app");
  }
  redirect("/login");
}
