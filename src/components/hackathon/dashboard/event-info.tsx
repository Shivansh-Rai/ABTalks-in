import Link from "next/link";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EventInfo() {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#A78BFA]">
        Event info
      </h2>

      <ol className="mt-4 space-y-3">
        {HACKATHON.timeline.map((item) => (
          <li key={item.title}>
            <p className="text-sm font-medium text-white">{item.title}</p>
            <p className="mt-0.5 text-sm text-zinc-400">{item.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-6 space-y-1 border-t border-white/10 pt-4 text-sm text-zinc-300">
        <p>
          <span className="text-zinc-500">Kickoff · </span>
          {HACKATHON.kickoffLabel}
        </p>
        <p>
          <span className="text-zinc-500">Deadline · </span>
          {HACKATHON.deadlineLabel}
        </p>
        <p>
          <span className="text-zinc-500">Results · </span>
          {HACKATHON.resultsLabel}
        </p>
      </div>

      <Link
        href={HACKATHON.whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ size: "lg" }), "mt-6 w-full sm:w-auto")}
      >
        Join the WhatsApp group
      </Link>
    </section>
  );
}
