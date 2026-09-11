import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { getMfaChallengeUserId, beginMfaEnrollment, isMfaEnrolled } from "@/lib/auth/mfa";
import { getAppDb } from "@/lib/db/app";
import { MfaEnrollForm, MfaVerifyForm } from "./MfaForm";

export const dynamic = "force-dynamic";

export default async function MfaPage({
  searchParams,
}: {
  searchParams: Promise<{ enroll?: string }>;
}) {
  const userId = await getMfaChallengeUserId();
  if (!userId) redirect("/login");

  const enrolled = isMfaEnrolled(userId);
  const wantsEnroll = (await searchParams).enroll === "1" && !enrolled;

  let enroll: { backupCode: string; otpauth: string } | null = null;
  if (wantsEnroll) {
    const row = getAppDb()
      .prepare("SELECT email FROM users WHERE id = ?")
      .get(userId) as { email: string };
    enroll = beginMfaEnrollment(userId, row.email);
  }

  return (
    <Card>
      <CardContent className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {wantsEnroll ? "Set up MFA" : "Two-step verification"}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {wantsEnroll
              ? "Your organization requires multi-factor authentication before a session is created."
              : "Enter the code from your authenticator app. A session is not created until this succeeds."}
          </p>
        </div>
        {enroll ? (
          <MfaEnrollForm backupCode={enroll.backupCode} otpauth={enroll.otpauth} />
        ) : (
          <MfaVerifyForm />
        )}
      </CardContent>
    </Card>
  );
}
