import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  hasUsablePassword,
  isFreshSignIn,
  isGoogleOnlyAccount,
} from "@/lib/email-auth";
import { isEmailLoginEnabled } from "@/lib/feature-flags";
import { isAvatarStorageConfigured } from "@/features/profile/avatar-storage";
import { getEmailNotificationPreferences } from "@/features/notification/email-preferences";
import { DashboardShell } from "@/components/dashboard-hub/dashboard-shell";
import { AccountSettings } from "@/components/settings/account-settings";

export const metadata: Metadata = {
  title: "Account settings | Klymb AI",
};

/**
 * Candidate Account Settings: identity, sign-in, notifications and account
 * deletion in one place. Recruiters keep /hire/settings and the standalone
 * /settings/security page, so they are sent there.
 *
 * Nothing here adds a new setting. Every section renders an existing form or
 * read-only data that already lives elsewhere.
 */
export default async function AccountSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?from=/settings");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      password: true,
      createdAt: true,
      recruiterProfile: { select: { id: true } },
      candidateProfile: {
        select: { fullName: true, phone: true, phoneVerified: true },
      },
      accounts: {
        where: { provider: "google" },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!user) redirect("/login?from=/settings");
  if (user.recruiterProfile && !user.candidateProfile) {
    redirect("/hire/settings");
  }

  const emailLoginEnabled = isEmailLoginEnabled();
  const [googleOnly, notificationPreferences] = await Promise.all([
    emailLoginEnabled
      ? isGoogleOnlyAccount(user.email, user)
      : Promise.resolve(false),
    getEmailNotificationPreferences(user.id),
  ]);

  const fullName =
    user.candidateProfile?.fullName?.trim() ||
    session.user.name?.trim() ||
    user.name?.trim() ||
    user.email;

  return (
    <DashboardShell
      user={{ name: fullName, email: user.email, image: user.image ?? null }}
      isAdmin={session.user.isAdmin ?? false}
      showSectionNav={false}
      collapsible
      contentClassName="min-h-0"
    >
      <AccountSettings
        fullName={fullName}
        email={user.email}
        imageUrl={user.image ?? null}
        phone={user.candidateProfile?.phone ?? null}
        phoneVerified={user.candidateProfile?.phoneVerified ?? false}
        memberSince={user.createdAt.toISOString()}
        hasCandidateProfile={user.candidateProfile !== null}
        avatarUploadEnabled={isAvatarStorageConfigured()}
        googleConnected={user.accounts.length > 0}
        notificationPreferences={notificationPreferences}
        security={
          emailLoginEnabled
            ? {
                hasPassword: hasUsablePassword(user),
                googleOnly,
                needsCode: !isFreshSignIn(session.authTime),
              }
            : null
        }
      />
    </DashboardShell>
  );
}
