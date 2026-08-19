import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Domain } from "@prisma/client";
import { isClaudeEnabled } from "@/lib/feature-flags";
import {
  HUB_ARROW_HOVER_CLASS,
  HUB_CARD_HOVER_CLASS,
  HUB_TEXT_LINK_CLASS,
} from "@/components/dashboard-hub/nav-items";
import { cn } from "@/lib/utils";

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
          <li
            className={cn(
              "rounded-2xl border border-neutral-200 bg-white p-5",
              HUB_CARD_HOVER_CLASS,
            )}
          >
            <p className="font-heading font-semibold text-black">
              Claude Challenge
            </p>
            <p className="mt-1 text-sm text-[#555555]">
              Build with Claude · 60 days
            </p>
            <Link href="/claude-signup" className={cn(HUB_TEXT_LINK_CLASS, "mt-4")}>
              Join
              <ArrowRight className={HUB_ARROW_HOVER_CLASS} aria-hidden />
            </Link>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
