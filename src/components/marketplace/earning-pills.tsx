import { CheckCircle2, Users } from "lucide-react";
import {
  SYNERGY_BASE_SUBMISSION,
  SYNERGY_REFERRAL,
} from "@/features/synergy/scoring";

const pills = [
  {
    label: "Complete a Daily Task",
    Icon: CheckCircle2,
    points: SYNERGY_BASE_SUBMISSION,
  },
  {
    label: "Refer a Friend",
    Icon: Users,
    points: SYNERGY_REFERRAL,
  },
] as const;

export function EarningPills() {
  return (
    <div className="flex flex-wrap gap-2 sm:gap-2.5">
      {pills.map(({ label, Icon, points }) => (
        <div
          key={label}
          className="flex items-center gap-2 rounded-full border border-[#E0E0E0] bg-white px-3.5 py-2 text-sm text-[#353535]"
        >
          <Icon className="size-4 text-[#03535F]" aria-hidden />
          <span className="whitespace-nowrap">{label}</span>
          <span className="whitespace-nowrap font-semibold text-[#03535F]">
            +{points} SP
          </span>
        </div>
      ))}
    </div>
  );
}
