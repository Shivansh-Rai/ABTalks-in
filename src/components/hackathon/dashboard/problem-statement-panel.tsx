import Link from "next/link";
import { Lock } from "lucide-react";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  unlocked: boolean;
  closed: boolean;
  statement: string | null;
};

export function ProblemStatementPanel({ unlocked, closed, statement }: Props) {
  if (!unlocked) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 opacity-80 sm:p-6">
        <div className="flex items-center gap-2 text-[#A78BFA]">
          <Lock className="size-4" aria-hidden />
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em]">
            Problem statement
          </h2>
        </div>
        <p className="mt-3 text-sm text-zinc-400">
          Unlocks at kickoff: {HACKATHON.kickoffLabel}
        </p>
      </section>
    );
  }

  if (!statement) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#A78BFA]">
          Your challenge
        </h2>
        <p className="mt-3 text-sm text-zinc-300">
          The brief is dropping shortly. 
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#A78BFA]">
        Your challenge
      </h2>
      {/* <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
        {statement}
      </p> */}
      <p className="mt-4 text-sm text-zinc-400">
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
