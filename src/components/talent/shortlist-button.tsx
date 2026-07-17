"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleShortlistAction } from "@/app/actions/talent-actions";
import { cn } from "@/lib/utils";

export function ShortlistButton({
  memberId,
  initialShortlisted,
}: {
  memberId: string;
  initialShortlisted: boolean;
}) {
  const [shortlisted, setShortlisted] = useState(initialShortlisted);
  const [busy, setBusy] = useState(false);

  async function handleToggle() {
    setBusy(true);
    try {
      const result = await toggleShortlistAction({ memberId });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setShortlisted(result.data.shortlisted);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="shrink-0"
      disabled={busy}
      onClick={() => void handleToggle()}
      aria-label={shortlisted ? "Remove from shortlist" : "Add to shortlist"}
    >
      <Star
        className={cn(
          "size-4",
          shortlisted ? "fill-amber-400 text-amber-500" : "text-muted-foreground",
        )}
      />
    </Button>
  );
}
