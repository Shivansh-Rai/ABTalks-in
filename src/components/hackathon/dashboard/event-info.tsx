import Link from "next/link";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EventInfo() {
  return (
    <section className="rounded-2xl border border-[#E0E0E0] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] sm:p-6">
      <h2 className="font-heading text-[13px] leading-[18px] font-semibold uppercase tracking-[0.16em] text-[#03535F]">
        Event info
      </h2>

      <ol className="mt-4 space-y-3">
        {HACKATHON.timeline.map((item) => (
          <li key={item.title}>
            <p className="text-sm font-medium text-black">{item.title}</p>
            <p className="mt-0.5 text-sm text-[#626262]">{item.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-6 space-y-1 border-t border-[#E0E0E0] pt-4 text-sm text-[#353535]">
        <p>
          <span className="text-[#787878]">Kickoff · </span>
          {HACKATHON.kickoffLabel}
        </p>
        <p>
          <span className="text-[#787878]">Deadline · </span>
          {HACKATHON.deadlineLabel}
        </p>
        <p>
          <span className="text-[#787878]">Results · </span>
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
