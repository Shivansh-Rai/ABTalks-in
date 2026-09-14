import type { Metadata } from "next";
import Link from "next/link";
import { requireRecruiter } from "@/lib/program-auth";
import { getRecruiterProfileAction } from "@/app/actions/recruiter-profile-actions";
import { RecruiterProfileForm } from "@/components/hire/recruiter-profile-form";

export const metadata: Metadata = {
  title: "Settings | ABTalks Hire",
};

/**
 * Recruiter settings page (T-227).
 * Allows the recruiter to view and edit their profile (name, phone) and
 * company identity (name, website, industry, size, location).
 * Isolated per-recruiter workspace via requireRecruiter().
 */
export default async function HireSettingsPage() {
  await requireRecruiter();
  const res = await getRecruiterProfileAction();

  if (!res.ok) {
    return (
      <div className="space-y-6">
        <Link href="/hire" className="hire-back">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 19 8 12l7-7" />
          </svg>
          <span>Back to Scout</span>
        </Link>
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">
            Workspace
          </p>
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Settings
          </h2>
          <p className="max-w-xl text-sm text-destructive">
            {res.message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <Link href="/hire" className="hire-back">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 19 8 12l7-7" />
        </svg>
        <span>Back to Scout</span>
      </Link>

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          Workspace
        </p>
        <h2 className="font-display text-2xl font-bold tracking-tight">
          Settings
        </h2>
        <p className="max-w-xl text-sm text-muted-foreground">
          Manage your personal recruiter profile and company identity. Changes
          reflect on your outreach messages, candidate searches, and job posts.
        </p>
      </div>

      <RecruiterProfileForm initialData={res.data} />
    </div>
  );
}
