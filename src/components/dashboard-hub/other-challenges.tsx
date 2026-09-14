import type { Domain } from "@prisma/client";
import { isClaudeEnabled } from "@/lib/feature-flags";
import {
  HUB_CARD_GRID_CLASS,
  HUB_CARD_HOVER_CLASS,
  HUB_CONTAINER_CLASS,
  HUB_SECTION_CLASS,
} from "@/components/dashboard-hub/nav-items";
import { JoinClaudeButton } from "@/components/dashboard-hub/join-claude-button";
import { cn } from "@/lib/utils";

type OtherChallengesProps = {
  joinedDomains: Domain[];
  abandonedDomains: Domain[];
};

export function OtherChallenges({
  joinedDomains,
  abandonedDomains,
}: OtherChallengesProps) {
  const claudeEnabled = isClaudeEnabled();
  const joined = new Set(joinedDomains);
  const abandoned = new Set(abandonedDomains);

  const showClaude =
    claudeEnabled && !joined.has("CLAUDE") && !abandoned.has("CLAUDE");

  if (!showClaude) {
    return null;
  }

  return (
    <section id="other-challenges" className={HUB_SECTION_CLASS}>
      <div className={HUB_CONTAINER_CLASS}>
        <h2 className="font-heading text-xl font-semibold uppercase text-[#03535F]">
          Other challenges
        </h2>
        <ul className={cn("mt-4", HUB_CARD_GRID_CLASS)}>
          {showClaude ? (
            <li
              className={cn(
                "flex flex-col rounded-2xl border border-[#E0E0E0] bg-white p-5",
                HUB_CARD_HOVER_CLASS,
              )}
            >
              <p className="font-inter font-bold text-black">
                Claude Challenge
              </p>
              <p className="mt-1 text-sm text-[#4B4B4B]">
                Build with Claude · 60 days
              </p>
              <JoinClaudeButton />
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  );
}
