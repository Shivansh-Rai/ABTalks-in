import Link from "next/link";
import { ArrowRight, Code2 } from "lucide-react";
import { HUB_CARD_HOVER_CLASS } from "@/components/dashboard-hub/nav-items";
import {
  PILL_SOLID,
  STAGE_CARD,
} from "@/components/dashboard-hub/stages/stage-ui";
import { CODE_LANGUAGES } from "@/features/code-runner/languages";
import {
  PRACTICE_BASE,
  PRACTICE_PROGRAM_SLUGS,
  PRACTICE_QUESTIONS_PER_DAY,
} from "@/features/coding-practice/constants";
import { getPracticeChallenge } from "@/features/coding-practice/content";
import { cn } from "@/lib/utils";

/**
 * Dashboard "Practice DSA" section: one card per coding practice challenge.
 * Server component. Reads the content module only, never the database.
 */
export function PracticeDsa() {
  const challenges = PRACTICE_PROGRAM_SLUGS.flatMap((slug) => {
    const challenge = getPracticeChallenge(slug);
    return challenge ? [challenge] : [];
  });
  if (challenges.length === 0) return null;

  return (
    <section id="practice-dsa" className="mt-8 scroll-mt-24">
      <h4 className="font-heading text-xl font-bold text-black sm:text-2xl">
        Practice DSA
      </h4>
      <p className="mt-0.5 text-sm text-[#6B7280]">
        Solve coding problems in the browser, two a day.
      </p>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {challenges.map((c) => (
          <li
            key={c.programSlug}
            className={cn(STAGE_CARD, HUB_CARD_HOVER_CLASS, "flex flex-col p-5")}
          >
            <div className="flex gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF6F6] text-[#03535F]">
                <Code2 className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="font-bold text-black">
                  Array &amp; Strings {c.totalDays} Days Challenge
                </p>
                <p className="mt-1 text-sm text-[#4B4B4B]">{c.subtitle}</p>
                <p className="mt-1 text-xs text-[#6B7280]">
                  {c.totalDays} days · {PRACTICE_QUESTIONS_PER_DAY} problems a
                  day · {c.languages.map((l) => CODE_LANGUAGES[l].label).join(", ")}
                </p>
              </div>
            </div>
            <Link
              href={`${PRACTICE_BASE}/${c.programSlug}`}
              className={cn(PILL_SOLID, "mt-4 gap-1.5 self-end")}
            >
              Start practising
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
