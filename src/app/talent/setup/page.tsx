import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getRecruiterState } from "@/features/talent-pool/recruiter-registration";
import { RecruiterSetupForm } from "@/components/talent/recruiter-setup-form";
import { RecruiterAuthClosed } from "@/components/talent/recruiter-auth-closed";
import { isRecruiterAuthEnabled } from "@/lib/feature-flags";

export const metadata: Metadata = {
  title: "Set up your workspace | ABTalks",
  description: "Finish setting up your own independent recruiter workspace.",
};

/**
 * Resumable recruiter setup.
 *
 * Reached by a signed-in recruiter whose setup is unfinished — which means they
 * are NOT approved yet, so this page must not require approval or an admin
 * role. It requires a session and a RecruiterProfile, nothing more.
 */
export default async function TalentSetupPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/talent/login");

  if (!isRecruiterAuthEnabled()) {
    return <RecruiterAuthClosed />;
  }

  const state = await getRecruiterState(session.user.id);
  if (state.status === "none") redirect("/talent/register");
  if (state.status === "pending") redirect("/talent/pending");
  if (state.status === "approved") redirect("/hire");

  const profile = await prisma.recruiterProfile.findUnique({
    where: { userId: session.user.id },
    select: { fullName: true, company: true, phone: true },
  });

  return (
    <div className="mx-auto max-w-md space-y-8 py-4">
      <header className="space-y-2 text-center">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          ABTalks Hire
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Set up your workspace
        </h1>
        <p className="text-sm text-muted-foreground">
          Your workspace is yours alone. Leave halfway and you will come back to
          exactly this step.
        </p>
      </header>

      <div className="rounded-xl border bg-card p-6">
        <RecruiterSetupForm
          // `COMPLETE` with no completion timestamp means the last step saved
          // but provisioning did not land. Send them back to the step they can
          // actually retry rather than showing a success screen for a
          // workspace that was never created.
          initialStep={state.step === "COMPLETE" ? "COMPANY" : state.step}
          initialValues={{
            fullName: profile?.fullName ?? "",
            company: profile?.company ?? "",
            phone: profile?.phone ?? "",
          }}
        />
      </div>
    </div>
  );
}
