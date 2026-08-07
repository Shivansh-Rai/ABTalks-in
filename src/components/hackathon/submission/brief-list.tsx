import type { Components } from "react-markdown";
import { ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  briefs: {
    id: string;
    number: number;
    title: string;
    tagline: string;
    bodyMd: string;
  }[];
  selectedId: string | null;
};

const briefMdComponents: Components = {
  h1: ({ children }) => (
    <h3 className="mt-6 text-base font-semibold tracking-tight text-white first:mt-0">
      {children}
    </h3>
  ),
  h2: ({ children }) => (
    <h3 className="mt-6 text-base font-semibold tracking-tight text-white first:mt-0">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="mt-4 text-sm font-semibold tracking-tight text-[#C4B5FD]">
      {children}
    </h4>
  ),
  h4: ({ children }) => (
    <h5 className="mt-3 text-sm font-semibold text-[#C4B5FD]">{children}</h5>
  ),
  p: ({ children }) => (
    <p className="mt-3 text-sm leading-relaxed text-zinc-300 first:mt-0">
      {children}
    </p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-[#C4B5FD]">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-zinc-300">{children}</em>,
  ul: ({ children }) => (
    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-300">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all text-[#A78BFA] underline-offset-2 hover:underline"
    >
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const isBlock = Boolean(className);
    if (isBlock) {
      return <code className={className}>{children}</code>;
    }
    return (
      <code className="rounded-md border border-[#7364E6]/30 bg-[#7364E6]/15 px-1.5 py-0.5 font-mono text-[0.85em] text-[#C4B5FD]">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-xs leading-relaxed text-zinc-200">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-5 border-white/10" />,
  blockquote: ({ children }) => (
    <blockquote className="mt-3 border-l-2 border-[#7364E6]/50 pl-3 text-sm italic text-zinc-400">
      {children}
    </blockquote>
  ),
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

            <div className="mt-4">
              {brief.bodyMd ? (
                <ReactMarkdown components={briefMdComponents}>
                  {brief.bodyMd}
                </ReactMarkdown>
              ) : (
                <p className="text-sm text-zinc-400">
                  Problem statement 3 will be updated soon.
                </p>
              )}
              {brief.id === "HACKPS2608002" ? (
                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <a
                    href="/hackathon/curriculum.json"
                    download="curriculum.json"
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "w-full border-[#7364E6]/50 text-[#C4B5FD] hover:bg-[#7364E6]/15 hover:text-[#C4B5FD]",
                    )}
                  >
                    DOWNLOAD CURRICULUM.JSON
                  </a>
                  <a
                    href="/hackathon/candidates.json"
                    download="candidates.json"
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "w-full border-[#7364E6]/50 text-[#C4B5FD] hover:bg-[#7364E6]/15 hover:text-[#C4B5FD]",
                    )}
                  >
                    DOWNLOAD CANDIDATES.JSON
                  </a>
                  <a
                    href="/hackathon/technical-spec.md"
                    download="technical-spec.md"
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "w-full border-[#7364E6]/50 text-[#C4B5FD] hover:bg-[#7364E6]/15 hover:text-[#C4B5FD]",
                    )}
                  >
                    DOWNLOAD TECHNICAL-SPECS.MD
                  </a>
                </div>
              ) : null}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
