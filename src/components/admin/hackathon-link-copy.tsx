"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HackathonLinkCopy({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-1.5"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
