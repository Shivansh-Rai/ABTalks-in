import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { DataRightsRequestForm } from "@/components/legal/data-rights-request-form";

import { EcosystemPageHeader } from "@/components/shared/ecosystem-page-header";

export const metadata: Metadata = {
  title: "Data rights request · ABTalks",
  description: "Request access, correction, or deletion of your ABTalks data",
  robots: { index: false },
};

export default async function PrivacyRequestsPage() {
  const session = await auth();

  return (
    <div className="min-h-svh bg-background">
      <EcosystemPageHeader />
      <div className="mx-auto max-w-lg space-y-6 px-5 py-12 md:px-8">
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Data rights request
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Submit a request to access, correct, or erase personal data we hold
            about you. We may verify your identity before acting. See our{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>{" "}
            for details.
          </p>
        </div>
        <DataRightsRequestForm defaultEmail={session?.user?.email ?? ""} />
      </div>
    </div>
  );
}
