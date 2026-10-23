"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  link: string;
}

/** Square icon button: copies the public verify link for a certificate. */
export function CopyVerifyLinkButton({ link }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Verify link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link. Open the certificate and copy it from there.");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Verify link copied" : "Copy verify link"}
      title={copied ? "Copied" : "Copy verify link"}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#E0E0E0] bg-white text-[#353535] transition-colors hover:border-[#A6D2D5] hover:bg-[#EEF6F6] hover:text-[#03535F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03535F]"
    >
      {copied ? (
        <Check className="size-4 text-[#197E23]" aria-hidden />
      ) : (
        <Link2 className="size-4" aria-hidden />
      )}
    </button>
  );
}
