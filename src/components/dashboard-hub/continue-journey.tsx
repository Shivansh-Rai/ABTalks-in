import Link from "next/link";
import type { Domain } from "@prisma/client";
import type { UserEnrollmentSummary } from "@/features/enrollment/get-user-enrollments";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TRACK_PATH: Record<Domain, string> = {
  AI: "/ai",
  DS: "/ds",
  SE: "/se",
  CLAUDE: "/claude",
};

const DOMAIN_LABEL: Record<Domain, string> = {
  AI: "Artificial Intelligence",
  DS: "Data Science",
  SE: "Software Engineering",
  CLAUDE: "Claude Challenge",
};

type ContinueJourneyProps = {
  enrollments: UserEnrollmentSummary[];
};

export function ContinueJourney({ enrollments }: ContinueJourneyProps) {
  return (
    <section className="scroll-mt-20 ml-4 px-4 py-8 sm:px-6">
      <h2 className=" font-heading text-xl font-semibold uppercase text-[#e05226]">
        Continue your journey
      </h2>

      {enrollments.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-6 text-center">
          <p className="text-[#555555]">
            You haven&apos;t started a challenge yet
          </p>
          <Link
            href="/challenges"
            className={cn(
              buttonVariants({ variant: "default" }),
              "mt-4 inline-flex bg-[#E05226] text-white hover:scale-100 hover:bg-[#C9411C] hover:shadow-none active:scale-100",
            )}
          >
            Browse challenges
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {enrollments.map((e) => {
            const pct = Math.min(100, Math.round((e.daysCompleted / 60) * 100));
            return (
              <li
                key={e.id}
                className="rounded-2xl border border-neutral-200 bg-white p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-inter font-bold text-black">
                      {DOMAIN_LABEL[e.domain]}
                    </p>
                    <p className="mt-1 text-sm text-[#555555]">
                      Day {e.daysCompleted + 1} of 60 · {e.currentStreak}-day
                      streak
                    </p>
                  </div>
                  <Link
                    href={TRACK_PATH[e.domain]}
                    className={cn(
                      buttonVariants({ variant: "default" }),
                      "shrink-0 self-start bg-[#E05226] text-white hover:scale-100 hover:bg-[#C9411C] hover:shadow-none active:scale-100 sm:self-auto",
                    )}
                  >
                    Continue
                  </Link>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  aria-label={`${DOMAIN_LABEL[e.domain]} progress`}
                  className="mt-4 h-1.5 w-full overflow-hidden rounded-lg bg-neutral-100"
                >
                  <div
                    className="h-full bg-[#e05226] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
