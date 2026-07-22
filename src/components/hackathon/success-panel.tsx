"use client";

import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { cn } from "@/lib/utils";

type Props = {
  entryType: "SOLO" | "TEAM_CREATE" | "TEAM_JOIN";
  teamCode: string;
  teamName: string | null;
};

export function SuccessPanel({ entryType, teamCode, teamName }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.65 },
    });
  }, []);

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
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
      {entryType === "TEAM_CREATE" ? (
        <div className="space-y-4">
          <h2 className="font-display text-xl font-bold text-foreground">
            Team created
            {teamName ? ` — ${teamName}` : ""}
          </h2>
          <p className="text-sm text-muted-foreground">
            Share this code with your teammates — they each register at{" "}
            <span className="font-medium text-foreground">
              abtalksapp.vercel.app/hackathon/register
            </span>{" "}
            and enter it.
          </p>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <code className="flex-1 rounded-lg border border-border bg-muted/50 px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.2em] text-foreground">
              {teamCode}
            </code>
            <Button type="button" variant="outline" onClick={copyCode} className="gap-2">
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
        </div>
      ) : null}

      {entryType === "TEAM_JOIN" ? (
        <h2 className="font-display text-xl font-bold text-foreground">
          You&apos;re in{teamName ? ` — ${teamName}` : ""}.
        </h2>
      ) : null}

      {entryType === "SOLO" ? (
        <h2 className="font-display text-xl font-bold text-foreground">
          You&apos;re registered.
        </h2>
      ) : null}

      <div className="mt-8 space-y-3">
        <h3 className="font-display text-base font-semibold text-foreground">
          What happens next
        </h3>
        <p className="text-sm text-muted-foreground">
          Kickoff is {HACKATHON.kickoffLabel}. The problem statement drops at
          kickoff — be in the WhatsApp group so you don&apos;t miss it.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href={HACKATHON.whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}
        >
          Join the WhatsApp group
        </Link>
        <Link
          href="/hackathon"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "w-full sm:w-auto",
          )}
        >
          Back to landing
        </Link>
      </div>
    </div>
  );
}
