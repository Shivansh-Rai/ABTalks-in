import Link from "next/link";
import { Lock } from "lucide-react";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LockedState() {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="flex items-center gap-2 text-[#A78BFA]">
        <Lock className="size-4" aria-hidden />
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em]">
          Submission window
        </h2>
      </div>
      <div className="mt-4 space-y-2 text-sm text-zinc-300">
        <p>Briefs unlock at kickoff: {HACKATHON.kickoffLabel}</p>
        <p>Submissions close: {HACKATHON.deadlineLabel}</p>
      </div>
      <Link
        href="/hackathon/dashboard"
        className={cn(buttonVariants({ variant: "outline" }), "mt-6 w-full sm:w-auto")}
      >
        Back to your dashboard
      </Link>
    </section>
  );
}
