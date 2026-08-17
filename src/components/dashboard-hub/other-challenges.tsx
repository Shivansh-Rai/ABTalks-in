import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Domain } from "@prisma/client";
import { isClaudeEnabled, isProgramEnabled } from "@/lib/feature-flags";

type OtherChallengesProps = {
  hasProgramMembership: boolean;
  enrolledDomains: Domain[];
};

export function OtherChallenges({
  hasProgramMembership,
  enrolledDomains,
}: OtherChallengesProps) {
  const programEnabled = isProgramEnabled();
  const claudeEnabled = isClaudeEnabled();
  const hasClaude = enrolledDomains.includes("CLAUDE");

  const showProgram = programEnabled && !hasProgramMembership;
  const showClaude = claudeEnabled && !hasClaude;

  if (!showProgram && !showClaude) {
    return null;
  }

  return (
    <section className="scroll-mt-20 px-4 py-8 sm:px-6">
      <h2 className="font-display text-xl font-semibold text-black">
        Other challenges
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {showProgram ? (
          <li className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="font-display font-semibold text-black">
              31 Days AI Cohort
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Working professionals · structured curriculum
            </p>
            <Link
              href="/program"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-black hover:underline"
            >
              Learn more
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </li>
        ) : null}
        {showClaude ? (
          <li className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="font-display font-semibold text-black">
              Claude Challenge
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Build with Claude · 60 days
            </p>
            <Link
              href="/claude-signup"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-black hover:underline"
            >
              Join
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
