import Link from "next/link";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SponsorPanel() {
  const { sponsor } = HACKATHON;

  return (
    <section className="rounded-2xl border border-[#03535F]/30 bg-[#EEF6F6] p-5 sm:p-6">
      <h2 className="font-heading text-[13px] leading-[18px] font-semibold uppercase tracking-[0.16em] text-[#03535F]">
        Your {sponsor.name} Pro access
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-[#353535]">
        {sponsor.name} is a memory layer for AI agents — persistent memory for
        whatever you build, plus an MCP server your AI assistant can use while it
        codes. Every participant gets Pro, free.
      </p>
      <p className="mt-3 text-sm text-[#626262]">
        Claim it and run one test write <strong className="text-[#353535]">before
        kickoff</strong>. Setup time is not build time.
      </p>

      <Link
        href={sponsor.redeemUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ size: "lg" }), "mt-6 w-full sm:w-auto")}
      >
        {sponsor.redeemLabel}
      </Link>

      <Link
        href={sponsor.docsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 block text-sm text-[#03535F] underline underline-offset-4 transition-colors hover:text-[#03535F]"
      >
        Quickstart and MCP setup →
      </Link>
    </section>
  );
}
