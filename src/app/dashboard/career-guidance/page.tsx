import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardShell } from "@/components/dashboard-hub/dashboard-shell";
import {
  HUB_BUTTON_CLASS,
  HUB_CARD_CTA_CLASS,
  HUB_CARD_HOVER_CLASS,
} from "@/components/dashboard-hub/nav-items";
import { getCareerGuidance } from "@/features/career-guidance/get-career-guidance";
import { loadAvailableInterviews } from "@/features/dashboard/load-available-interviews";
import { registrationRedirect } from "@/features/registration/registration-gate";
import type { GuidanceKind } from "@/features/career-guidance/types";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<GuidanceKind, string> = {
  cohort: "Cohort",
  hackathon: "Hackathon",
  challenge: "Challenge",
  opportunity: "Opportunity",
  mock: "Mock",
};

export default async function CareerGuidancePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const needsRegistration = await registrationRedirect(
    session.user.id,
    "/dashboard/career-guidance",
  );
  if (needsRegistration) redirect(needsRegistration);

  const availableInterviews = await loadAvailableInterviews(session.user.id);
  const guidance = await getCareerGuidance(
    session.user.id,
    availableInterviews.mock.map((m) => ({
      slug: m.slug,
      label: m.label,
      attemptsLeft: m.attemptsLeft,
    })),
  );

  const shellUser = {
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    image: session.user.image ?? null,
  };

  return (
    <DashboardShell
      user={shellUser}
      isAdmin={session.user.isAdmin ?? false}
      collapsible
      showSectionNav={false}
    >
      <section className="px-4 py-8 sm:px-6 lg:ml-4">
        <p className="text-sm text-[#8F8F8F]">
          <Link href="/dashboard" className="hover:text-[#03535F]">
            Dashboard
          </Link>
          <span aria-hidden> / </span>
          Career Guidance
        </p>
        <h1 className="mt-2 font-heading text-xl font-semibold uppercase text-[#03535F]">
          Career Guidance
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#4B4B4B]">
          Next steps from your own profile and activity. Nothing here is a
          market statistic or a score.
        </p>

        {guidance.items.length === 0 ? (
          <div
            className={cn(
              "mt-6 rounded-2xl border border-[#E0E0E0] bg-white p-6",
              HUB_CARD_HOVER_CLASS,
            )}
          >
            <p className="text-[#4B4B4B]">
              Start a challenge, join a cohort, or add skills on your profile.
              We will suggest a next step from what you actually do here.
            </p>
            <Link
              href="/challenges"
              className={cn(HUB_BUTTON_CLASS, "mt-4 inline-flex")}
            >
              Browse challenges
            </Link>
          </div>
        ) : (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {guidance.items.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "flex flex-col justify-between rounded-2xl border border-[#E0E0E0] bg-white p-5",
                  HUB_CARD_HOVER_CLASS,
                )}
              >
                <div>
                  <span className="inline-flex rounded-[4px] border border-[#03535F]/40 bg-[#EEF6F6] px-2 py-0.5 text-[11px] font-semibold text-[#03535F]">
                    {KIND_LABEL[item.kind]}
                  </span>
                  <p className="mt-2 font-inter font-bold text-black">
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm text-[#4B4B4B]">{item.because}</p>
                </div>
                <Link
                  href={item.href}
                  className={cn(HUB_CARD_CTA_CLASS, "mt-3 self-end")}
                >
                  {item.cta}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </DashboardShell>
  );
}
