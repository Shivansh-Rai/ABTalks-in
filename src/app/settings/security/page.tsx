import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  hasUsablePassword,
  isFreshSignIn,
  isGoogleOnlyAccount,
} from "@/lib/email-auth";
import { isEmailLoginEnabled } from "@/lib/feature-flags";
import { PasswordSettingsForm } from "@/components/settings/password-settings-form";

export const metadata: Metadata = {
  title: "Password & sign-in | Klymb AI",
};

/**
 * Plan 154. Set a first password, or change the current one. Any signed-in
 * account — candidate or recruiter; the form signs them back in through their
 * own door after a change.
 */
export default async function SecuritySettingsPage() {
  if (!isEmailLoginEnabled()) notFound();

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?from=/settings/security");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      role: true,
      password: true,
      recruiterProfile: { select: { id: true } },
    },
  });
  if (!user) redirect("/login?from=/settings/security");

  const googleOnly = await isGoogleOnlyAccount(user.email, user);
  // Back to where the link to this page lives: the profile for a candidate,
  // Hire settings for a recruiter.
  const backHref = user.recruiterProfile ? "/hire/settings" : "/settings";
  const backLabel = user.recruiterProfile
    ? "Back to settings"
    : "Back to account settings";

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <Link
        href={backHref}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {backLabel}
      </Link>
      <h1 className="mb-2 text-2xl font-semibold">Password &amp; sign-in</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{user.email}</span>.
        You can always sign in with an emailed code; a password is an extra way
        in.
      </p>
      <PasswordSettingsForm
        email={user.email}
        audience={user.recruiterProfile ? "recruiter" : "candidate"}
        hasPassword={hasUsablePassword(user)}
        googleOnly={googleOnly}
        needsCode={!isFreshSignIn(session.authTime)}
        backHref={backHref}
        backLabel={backLabel}
      />
    </main>
  );
}
