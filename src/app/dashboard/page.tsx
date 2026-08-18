import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardShell } from "@/components/dashboard-hub/dashboard-shell";
import { HeroGreeting } from "@/components/dashboard-hub/hero-greeting";
import { StreakCard } from "@/components/dashboard-hub/streak-card";
import { ActivityHeatmap } from "@/components/dashboard-hub/activity-heatmap";
import { ContinueJourney } from "@/components/dashboard-hub/continue-journey";
import { OtherChallenges } from "@/components/dashboard-hub/other-challenges";
import { Roadmaps } from "@/components/dashboard-hub/roadmaps";
import { EventsSection } from "@/components/dashboard-hub/events-section";
import { TestimonialsSection } from "@/components/dashboard-hub/testimonials-section";
import { FaqSection } from "@/components/dashboard-hub/faq-section";
import { getHubData } from "@/features/dashboard/get-hub-data";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const data = await getHubData(session.user.id);
  if (!data.hasUser) {
    redirect("/api/auth/signout?callbackUrl=/login");
  }

  const firstName = data.profile?.fullName.split(/\s+/)[0] ?? null;

  const shellUser = {
    name: data.profile?.fullName ?? session.user.name ?? "",
    email: session.user.email ?? "",
    image: session.user.image ?? null,
  };

  return (
    <DashboardShell
      user={shellUser}
      isAdmin={session.user.isAdmin ?? false}
    >
      <section className="px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-[1020px]">
          <HeroGreeting firstName={firstName} />
          <div className="mt-4 grid min-w-0 gap-6 lg:grid-cols-[1fr_320px] lg:items-center">
            <div className="min-w-0">
              <ActivityHeatmap cells={data.heatmap.cells} embedded />
            </div>
            <div className="mt-2 lg:mt-0 lg:pl-10">
              <StreakCard
                streak={data.streak}
                weekTicks={data.heatmap.weekTicks}
                totalActiveDays={data.heatmap.totalActiveDays}
              />
            </div>
          </div>
        </div>
      </section>

      <ContinueJourney enrollments={data.enrollments} />
      <OtherChallenges enrolledDomains={data.allEnrollmentDomains} />
      <Roadmaps
        enrolledDomains={data.allEnrollmentDomains}
        hasProgramMembership={data.hasProgramMembership}
      />
      <EventsSection />
      <TestimonialsSection />
      <FaqSection />
    </DashboardShell>
  );
}
