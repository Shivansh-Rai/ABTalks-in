import {
  CheckCircle2,
  GitBranch,
  Share2,
  Users,
} from "lucide-react";
import {
  SYNERGY_BASE_SUBMISSION,
  SYNERGY_PROOF_GITHUB,
  SYNERGY_PROOF_LINKEDIN,
  SYNERGY_REFERRAL,
} from "@/features/synergy/scoring";

const pills = [
  {
    label: "Complete Task",
    Icon: CheckCircle2,
    points: SYNERGY_BASE_SUBMISSION,
  },
  {
    label: "Refer a Friend",
    Icon: Users,
    points: SYNERGY_REFERRAL,
  },
  {
    label: "Share on LinkedIn",
    Icon: Share2,
    points: SYNERGY_PROOF_LINKEDIN,
  },
  {
    label: "Contribute on GitHub",
    Icon: GitBranch,
    points: SYNERGY_PROOF_GITHUB,
  },
] as const;

export function EarningPills() {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-0 gap-2 sm:justify-center">
        {pills.map(({ label, Icon, points }) => (
          <div
            key={label}
            className="flex shrink-0 items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs sm:text-sm"
          >
            <Icon className="size-4 text-violet-400" aria-hidden />
            <span className="whitespace-nowrap text-zinc-200">{label}</span>
            <span className="whitespace-nowrap font-semibold text-violet-400">
              +{points} SP
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
