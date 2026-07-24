"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  teamCode: string;
  spotsLeft: number;
};

export function InvitePanel({ teamCode, spotsLeft }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(teamCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#A78BFA]">
          Invite your team
        </h2>
        <p className="text-xs text-zinc-400">
          {spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left
        </p>
      </div>

      <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <code className="flex-1 rounded-lg border border-white/15 bg-black/50 px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.2em] text-white">
          {teamCode}
        </code>
        <Button
          type="button"
          variant="outline"
          onClick={copyCode}
          className="gap-2 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
        >
          {copied ? (
            <>
              <Check className="size-4" aria-hidden />
              Copied!
            </>
          ) : (
            <>
              <Copy className="size-4" aria-hidden />
              Copy code
            </>
          )}
        </Button>
      </div>

      <p className="mt-3 text-sm text-zinc-400">
        Teammates register at abtalksapp.vercel.app/hackathon/register and enter
        this code.
      </p>
    </section>
  );
}
