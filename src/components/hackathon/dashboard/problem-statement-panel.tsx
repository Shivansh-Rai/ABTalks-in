import Link from "next/link";
import { Lock } from "lucide-react";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  unlocked: boolean;
  closed: boolean;
};

export function ProblemStatementPanel({ unlocked, closed }: Props) {
  if (!unlocked) {
    return (
      <section className="rounded-2xl border border-[#E0E0E0] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] opacity-80 sm:p-6">
        <div className="flex items-center gap-2 text-[#03535F]">
          <Lock className="size-4" aria-hidden />
          <h2 className="font-heading text-[13px] leading-[18px] font-semibold uppercase tracking-[0.16em]">
            Problem statement
          </h2>
        </div>
        <p className="mt-3 text-sm text-[#626262]">
          Unlocks at kickoff: {HACKATHON.kickoffLabel}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#E0E0E0] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] sm:p-6">
      <h2 className="font-heading text-[13px] leading-[18px] font-semibold uppercase tracking-[0.16em] text-[#03535F]">
        Your challenge
      </h2>
      <p className="mt-4 text-sm text-[#626262]">
        Three Problem Statements are now available.
      </p>
      <Link
        href="/hackathon/submission"
        className={cn(buttonVariants({ size: "lg" }), "mt-4 w-full sm:w-auto")}
      >
        {closed ? "View your submission" : "Check Problem Statements"}
      </Link>
    </section>
  );
}
