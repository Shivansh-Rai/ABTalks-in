import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { auth } from "@/auth";
import { PracticeWorkspace } from "@/components/coding-practice/practice-workspace";
import { dayMdClassName } from "@/components/program/day-section-card";
import { programMdComponents } from "@/components/program/markdown-code";
import { CODE_LANGUAGES } from "@/features/code-runner/languages";
import { PRACTICE_BASE } from "@/features/coding-practice/constants";
import {
  getPracticeChallenge,
  getPracticeDayIndex,
  getPracticeQuestion,
  type PracticeQuestion,
} from "@/features/coding-practice/content";
import { practiceDayState } from "@/features/coding-practice/progression";
import { isDayLockBypassEnabled } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";
import {
  getPracticeProgress,
  getSavedSolution,
} from "@/repositories/coding-practice";

export const metadata: Metadata = { title: "DSA Practice | ABTalks" };

// Submit is a Server Action called from this page: it waits on Judge0.
export const maxDuration = 30;

type Props = {
  params: Promise<{ challenge: string; day: string; slot: string }>;
};

const DIFFICULTY_CLASS: Record<PracticeQuestion["difficulty"], string> = {
  Easy: "bg-emerald-50 text-emerald-700",
  Medium: "bg-amber-50 text-amber-700",
  Hard: "bg-red-50 text-red-700",
};

function Statement({ question }: { question: PracticeQuestion }) {
  return (
    <article>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-heading text-xl font-bold text-black">
          {question.title}
        </h1>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
            DIFFICULTY_CLASS[question.difficulty],
          )}
        >
          {question.difficulty}
        </span>
      </div>

      <div className={cn(dayMdClassName, "mt-4")}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={programMdComponents}
        >
          {question.statementMd}
        </ReactMarkdown>
      </div>

      {question.examples.map((example, i) => (
        <section key={i} className="mt-5">
          <h2 className="text-sm font-semibold text-black">Example {i + 1}</h2>
          <pre className="mt-2 overflow-auto rounded-lg border border-[#E0E0E0] bg-[#F4F4F4] px-3 py-2 font-mono text-xs leading-5 text-[#111111]">
            {`Input: ${example.input}\nOutput: ${example.output}`}
          </pre>
          <p className="mt-2 text-sm leading-6 text-[#4B4B4B]">
            {example.explanation}
          </p>
        </section>
      ))}
    </article>
  );
}

export default async function PracticeQuestionPage({ params }: Props) {
  const raw = await params;
  const slug = raw.challenge;
  const day = Number(raw.day);
  const slot = Number(raw.slot);
  const challenge = getPracticeChallenge(slug);
  if (!challenge || !Number.isInteger(day) || !Number.isInteger(slot)) {
    notFound();
  }
  const question = getPracticeQuestion(slug, day, slot);
  if (!question) notFound();

  const challengePath = `${PRACTICE_BASE}/${slug}`;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect(
      `/login?from=${encodeURIComponent(`${challengePath}/${day}/${slot}`)}`,
    );
  }

  // Not started, or the day is still locked: back to the day list, which says why.
  const progress = await getPracticeProgress(userId, slug);
  if (!progress) redirect(challengePath);
  const state = practiceDayState({
    day,
    startedAt: progress.startedAt,
    solved: new Set(progress.solvedActivityIds),
    days: getPracticeDayIndex(slug).map((d) => ({
      day: d.day,
      activityIds: d.questions.map((q) => q.activityId),
    })),
    now: new Date(),
    bypassLocks: isDayLockBypassEnabled(),
  });
  if (state !== "OPEN" && state !== "COMPLETE") redirect(challengePath);

  const solved = progress.solvedActivityIds.includes(question.activityId);
  const saved = solved
    ? await getSavedSolution(progress.enrollmentId, question.activityId)
    : null;

  return (
    <main className="flex w-full flex-col gap-3 px-4 py-4 sm:px-6 lg:h-[calc(100svh-56px)]">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
        <Link
          href={challengePath}
          className="inline-flex items-center gap-1.5 font-medium text-[#03535F] hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {challenge.title}
        </Link>
        <span aria-hidden="true" className="text-[#8F8F8F]">
          /
        </span>
        <span aria-current="page" className="text-[#4B4B4B]">
          Day {day}
        </span>
      </nav>

      <PracticeWorkspace
        challenge={slug}
        day={day}
        slot={slot}
        statement={<Statement question={question} />}
        languages={question.languages.map((id) => ({
          id,
          label: CODE_LANGUAGES[id].label,
        }))}
        starterCode={question.starterCode}
        defaultLanguage={question.defaultLanguage}
        solved={solved}
        initialCode={saved ? { language: saved.language, code: saved.code } : null}
        submissions={
          saved
            ? [
                {
                  languageLabel: CODE_LANGUAGES[saved.language].label,
                  submittedAtLabel: saved.submittedAt
                    ? `${formatInTimeZone(saved.submittedAt, "Asia/Kolkata", "d MMM yyyy, h:mm a")} IST`
                    : "",
                  code: saved.code,
                },
              ]
            : []
        }
      />
    </main>
  );
}
