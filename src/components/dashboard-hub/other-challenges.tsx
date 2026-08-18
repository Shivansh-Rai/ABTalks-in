import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Domain } from "@prisma/client";
import { isClaudeEnabled } from "@/lib/feature-flags";

type OtherChallengesProps = {
  enrolledDomains: Domain[];
};

export function OtherChallenges({ enrolledDomains }: OtherChallengesProps) {
  const claudeEnabled = isClaudeEnabled();
  const hasClaude = enrolledDomains.includes("CLAUDE");

  const showClaude = claudeEnabled && !hasClaude;

  if (!showClaude) {
    return null;
  }

  return (
    <section className="ml-4 scroll-mt-20 px-4 py-8 sm:px-6">
      <h2 className="font-heading text-xl font-semibold uppercase text-[#e05226]">
        Other challenges
      </h2>
      <ul className="mt-4 ml-4 grid gap-3 sm:grid-cols-2">
        {showClaude ? (
          <li className="rounded-2xl border border-neutral-200 bg-white p-5">
            <p className="font-heading font-semibold text-black">
              Claude Challenge
            </p>
            <p className="mt-1 text-sm text-[#555555]">
              Build with Claude · 60 days
            </p>
            <Link
              href="/claude-signup"
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-black hover:text-[#e05226]"
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
