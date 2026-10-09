import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { auth } from "@/auth";
import {
  PracticeDayList,
  type PracticeDayRow,
} from "@/components/coding-practice/practice-day-list";
import { PracticeStartButton } from "@/components/coding-practice/practice-start-button";
import {
  PRACTICE_BASE,
  PRACTICE_QUESTIONS_PER_DAY,
  PRACTICE_TZ,
} from "@/features/coding-practice/constants";
import {
  getPracticeChallenge,
  getPracticeDayIndex,
} from "@/features/coding-practice/content";
import {
  practiceDayState,
  unlockKeyForDay,
} from "@/features/coding-practice/progression";
import { isDayLockBypassEnabled } from "@/lib/feature-flags";
import { getPracticeProgress } from "@/repositories/coding-practice";

export const metadata: Metadata = { title: "DSA Practice | ABTalks" };

type Props = { params: Promise<{ challenge: string }> };

/** When a day's date begins, said the way a learner in India reads a clock. */
function opensAtLabel(startedAt: Date, day: number): string {
  const instant = fromZonedTime(
    `${unlockKeyForDay(startedAt, day)}T00:00:00`,
    PRACTICE_TZ,
  );
  return `${formatInTimeZone(instant, "Asia/Kolkata", "d MMM, h:mm a")} IST`;
}

export default async function PracticeChallengePage({ params }: Props) {
  const { challenge: slug } = await params;
  const challenge = getPracticeChallenge(slug);
  if (!challenge) notFound();

  const path = `${PRACTICE_BASE}/${slug}`;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect(`/login?from=${encodeURIComponent(path)}`);

  const index = getPracticeDayIndex(slug);
  const progress = await getPracticeProgress(userId, slug);
  const solved = new Set(progress?.solvedActivityIds ?? []);
  const days = index.map((d) => ({
    day: d.day,
    activityIds: d.questions.map((q) => q.activityId),
  }));
  const now = new Date();
  const bypassLocks = isDayLockBypassEnabled();

  const rows: PracticeDayRow[] = Array.from(
    { length: challenge.totalDays },
    (_, i) => {
      const day = i + 1;
      const entry = index.find((d) => d.day === day) ?? null;
      if (!progress) {
        return { day, entry, state: "NOT_STARTED", lockNote: null };
      }
      if (!entry) {
        return {
          day,
          entry,
          state: "LOCKED_DATE",
          lockNote: "Questions for this day are coming soon.",
        };
      }
      const state = practiceDayState({
        day,
        startedAt: progress.startedAt,
        solved,
        days,
        now,
        bypassLocks,
      });
      const lockNote =
        state === "LOCKED_DATE"
          ? `Opens on ${opensAtLabel(progress.startedAt, day)}.`
          : state === "LOCKED_PREVIOUS"
            ? `Complete Day ${day - 1} to open this day.`
            : null;
      return { day, entry, state, lockNote };
    },
  );

  const totalQuestions = challenge.totalDays * PRACTICE_QUESTIONS_PER_DAY;

  return (
    <main className="mx-auto w-full max-w-[880px] px-4 py-8 sm:px-6">
      <h1 className="font-heading text-2xl font-bold tracking-tight text-black sm:text-3xl">
        {challenge.title}
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-[#4B4B4B]">
        {challenge.subtitle}
      </p>

      {progress ? (
        <p className="mt-4 text-sm font-medium text-[#03535F]">
          {solved.size} of {totalQuestions} solved
        </p>
      ) : (
        <div className="mt-5 rounded-2xl border border-[#E0E0E0] bg-white p-5">
          <p className="text-sm leading-relaxed text-[#4B4B4B]">
            Day 1 opens as soon as you start. Solve both problems to complete a
            day. A new day opens every morning at 5:30 AM IST, once the day
            before it is complete.
          </p>
          <div className="mt-4">
            <PracticeStartButton challenge={slug} />
          </div>
        </div>
      )}

      <div className="mt-6">
        <PracticeDayList challenge={slug} rows={rows} solved={solved} />
      </div>
    </main>
  );
}
