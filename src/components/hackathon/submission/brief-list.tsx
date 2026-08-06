import { ChevronDown } from "lucide-react";
import { HACKATHON } from "@/components/hackathon/hackathon-config";

type Props = {
  briefs: {
    id: string;
    number: number;
    title: string;
    tagline: string;
    body: string[];
  }[];
  selectedId: string | null;
};

export function BriefList({ briefs, selectedId }: Props) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#A78BFA]">
          {HACKATHON.briefsHeading}
        </h2>
        <p className="mt-2 text-sm text-zinc-400">Read all three. You submit to one.</p>
      </div>

      <div className="space-y-3">
        {briefs.map((brief) => (
          <details
            key={brief.id}
            className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors open:border-[#7364E6]/40 open:bg-[#7364E6]/[0.06] sm:p-6"
          >
            <summary className="flex cursor-pointer list-none items-start gap-4 [&::-webkit-details-marker]:hidden">
              <div className="grid size-8 shrink-0 place-items-center rounded-lg border border-[#7364E6]/40 bg-[#7364E6]/15 font-mono text-sm font-bold text-[#C4B5FD]">
                {brief.number}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="min-w-0 text-base font-semibold text-white">
                    {brief.title}
                  </h3>
                  {selectedId === brief.id ? (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                      Your entry
                    </span>
                  ) : null}
                </div>
                {brief.tagline ? (
                  <p className="mt-1 text-sm text-zinc-400">{brief.tagline}</p>
                ) : null}
              </div>
              <ChevronDown className="ml-auto size-5 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" />
            </summary>

            <div className="mt-4 space-y-3">
              {brief.body.length > 0 ? (
                brief.body.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-relaxed text-zinc-300">
                    {paragraph}
                  </p>
                ))
              ) : (
                <p className="text-sm text-zinc-400">
                  Full brief drops here shortly — watch the WhatsApp group.
                </p>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
