"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setOpenToWorkAction } from "@/app/actions/candidate-profile-actions";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { STAGE_CARD } from "./stage-ui";

/* Compact Open to work pill, beside the Get hired header button. The switch
   saves straight away and flips back if the save fails. */
export function OpenToWorkBar({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, startTransition] = useTransition();

  function change(next: boolean) {
    setOn(next);
    startTransition(async () => {
      const result = await setOpenToWorkAction({ openToWork: next });
      if (!result.ok) {
        setOn(!next);
        toast.error(result.message);
        return;
      }
      toast.success(next ? "You're open to work. Recruiters can find you." : "Open to work is off.");
    });
  }

  return (
    <label
      className={cn(
        STAGE_CARD,
        "inline-flex h-11 shrink-0 cursor-pointer items-center gap-2.5 rounded-full py-0 pl-4 pr-3 text-sm",
      )}
    >
      <span
        className={cn("size-2 shrink-0 rounded-full transition-colors", on ? "bg-[#2BD4A0]" : "bg-[#BFC6C6]")}
        aria-hidden="true"
      />
      <span className="font-heading font-bold text-black">Open to work</span>
      <Switch
        checked={on}
        onCheckedChange={change}
        disabled={pending}
        aria-label="Open to work"
        title={on ? "Recruiters can see you're looking." : "Let recruiters know you're looking."}
        className="data-checked:bg-[#03535F]"
      />
    </label>
  );
}
