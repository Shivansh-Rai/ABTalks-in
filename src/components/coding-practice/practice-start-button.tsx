"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { enrollInPracticeAction } from "@/app/actions/coding-practice-actions";
import { PILL_SOLID } from "@/components/dashboard-hub/stages/stage-ui";
import { cn } from "@/lib/utils";

export function PracticeStartButton({ challenge }: { challenge: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function start() {
    startTransition(async () => {
      const result = await enrollInPracticeAction({ challenge });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={pending}
      className={cn(PILL_SOLID, "disabled:opacity-60")}
    >
      {pending ? "Starting..." : "Start challenge"}
    </button>
  );
}
