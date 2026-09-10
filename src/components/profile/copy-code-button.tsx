"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — no-op
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-[#197E23]" aria-hidden />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" aria-hidden />
          Copy code
        </>
      )}
    </button>
  );
}
