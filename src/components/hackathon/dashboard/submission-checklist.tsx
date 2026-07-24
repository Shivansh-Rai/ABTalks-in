import { Circle } from "lucide-react";
import { HACKATHON } from "@/components/hackathon/hackathon-config";

export function SubmissionChecklist() {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#A78BFA]">
        Submission checklist
      </h2>
      <ul className="mt-4 space-y-4">
        {HACKATHON.deliverables.map((item) => (
          <li key={item.title} className="flex gap-3">
            <Circle
              className="mt-0.5 size-4 shrink-0 text-zinc-500"
              aria-hidden
            />
            <div>
              <p className="text-sm font-medium text-white">{item.title}</p>
              <p className="mt-0.5 text-sm text-zinc-400">{item.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-zinc-500">
        Submission opens near the deadline. You&apos;ll submit these here.
      </p>
    </section>
  );
}
