import Link from "next/link";
import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { auth } from "@/auth";
import { getAchievements } from "@/features/certificate/get-achievements";
import { AchievementCard } from "@/components/certificate/achievement-card";
import { DashboardShell } from "@/components/dashboard-hub/dashboard-shell";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function AchievementsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userExists = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });

  if (!userExists) {
    redirect("/api/auth/signout?callbackUrl=/login");
  }

  const userId = session.user.id;
  const shellUser = {
    name: session.user.name ?? session.user.email ?? "",
    email: session.user.email ?? "",
    image: session.user.image ?? null,
  };

  const achievements = await getAchievements(userId);
  const earnedCount = achievements.filter((a) => a.status !== "REVOKED").length;

  const headersList = await headers();
  const host = headersList.get("host") ?? "abtalks.in";
  const protocol = host.includes("localhost") ? "http" : "https";
  const verifyBaseUrl = `${protocol}://${host}`;

  return (
    <DashboardShell
      user={shellUser}
      isAdmin={session.user.isAdmin ?? false}
      showSectionNav={false}
    >
      <main className="mx-auto w-full min-w-0 max-w-[1280px] flex-1 px-4 py-8 sm:px-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-heading text-[13px] font-semibold uppercase tracking-[0.08em] text-[#03535F]">
              Achievements
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-black sm:text-[40px] sm:leading-[48px]">
              Your certificates
            </h1>
            
          </div>
          
        </header>

        {achievements.length === 0 ? (
          <section className="mt-8 flex flex-col items-center rounded-3xl border-[1.5px] border-dashed border-[#D5DEDE] bg-white px-6 py-12 text-center">
            <span
              className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-[#C7D6D6] bg-[#EEF5F5] text-[#03535F]"
              aria-hidden
            >
              <Trophy className="size-7" />
            </span>
            <h2 className="mt-4 font-display text-xl font-semibold text-black">
              No certificates yet
            </h2>
            <p className="mt-1 max-w-md text-sm text-[#4B4B4B]">
              Finish a challenge, hackathon or cohort and your certificate will
              show up here.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-[#03535F] px-5 text-sm font-semibold text-white shadow-[inset_0_-5px_14px_rgba(0,0,0,0.34)] transition-colors hover:bg-[#076573]"
            >
              Back to dashboard
            </Link>
          </section>
        ) : (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {achievements.map((achievement) => (
              <li key={achievement.key} className="flex min-w-0">
                <AchievementCard
                  achievement={achievement}
                  verifyBaseUrl={verifyBaseUrl}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </DashboardShell>
  );
}
