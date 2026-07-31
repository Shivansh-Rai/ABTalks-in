"use client";

import { useState } from "react";
import { UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { removeHackathonTeamMemberAction } from "@/app/actions/hackathon-team-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function RemoveMemberButton({
  participantId,
  memberName,
}: {
  participantId: string;
  memberName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Remove ${memberName}`}
            className="text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <UserMinus className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {memberName}?</DialogTitle>
          <DialogDescription>
            Their spot opens up right away and someone else can join with your
            team code. {memberName} will be emailed. They can rejoin later with
            the same code if you change your mind.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor={`remove-reason-${participantId}`}>
            Reason (optional)
          </Label>
          <Textarea
            id={`remove-reason-${participantId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
        </div>

        <DialogFooter showCloseButton>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              const result = await removeHackathonTeamMemberAction({
                participantId,
                reason: reason || undefined,
              });
              setPending(false);

              if (result.ok) {
                toast.success(`Removed ${result.data.fullName}`);
                setOpen(false);
                router.refresh();
                return;
              }

              toast.error(result.message);
            }}
          >
            {pending ? "Removing…" : "Remove member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
