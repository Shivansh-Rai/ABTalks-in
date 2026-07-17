"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  adminUnlockDayAction,
  dropMemberAction,
  grantSkipTokenAction,
  promoteWaitlistedAction,
  regenerateRecommendationAction,
} from "@/app/actions/admin-program-actions";

type Props = {
  memberId: string;
  memberName: string;
  status: string;
  skipTokensUsed: number;
};

export function ProgramMemberActionPanel({
  memberId,
  memberName,
  status,
  skipTokensUsed,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [unlockDay, setUnlockDay] = useState("1");

  async function run(
    action: () => Promise<{ ok: boolean; message?: string }>,
    success: string,
  ) {
    setBusy(true);
    try {
      const res = await action();
      if (!res.ok) {
        toast.error(res.message ?? "Action failed.");
        return;
      }
      toast.success(success);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "WAITLISTED" && (
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={() =>
            void run(
              () => promoteWaitlistedAction({ memberId }),
              `${memberName} promoted to enrolled`,
            )
          }
        >
          Promote from waitlist
        </Button>
      )}

      <Dialog>
        <DialogTrigger
          render={
            <Button type="button" size="sm" variant="destructive" disabled={busy}>
              Drop member
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Drop {memberName}?</DialogTitle>
            <DialogDescription>
              Soft drop — data is retained but they leave the leaderboard and
              talent pool.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="drop-reason">Reason</Label>
            <Textarea
              id="drop-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || !reason.trim()}
              onClick={() =>
                void run(
                  () => dropMemberAction({ memberId, reason }),
                  "Member dropped",
                )
              }
            >
              Confirm drop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger
          render={
            <Button type="button" size="sm" variant="outline" disabled={busy}>
              Unlock day
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlock day for {memberName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="unlock-day">Day (1–31)</Label>
            <Input
              id="unlock-day"
              type="number"
              min={1}
              max={31}
              value={unlockDay}
              onChange={(e) => setUnlockDay(e.target.value)}
            />
            <Label htmlFor="unlock-reason">Reason</Label>
            <Textarea
              id="unlock-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={busy || !reason.trim()}
              onClick={() =>
                void run(
                  () =>
                    adminUnlockDayAction({
                      memberId,
                      day: Number(unlockDay),
                      reason,
                    }),
                  "Day unlocked",
                )
              }
            >
              Unlock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {skipTokensUsed > 0 && (
        <Dialog>
          <DialogTrigger
            render={
              <Button type="button" size="sm" variant="outline" disabled={busy}>
                Grant skip token back
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Restore a skip token</DialogTitle>
              <DialogDescription>
                Used tokens: {skipTokensUsed}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="skip-reason">Reason</Label>
              <Textarea
                id="skip-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                disabled={busy || !reason.trim()}
                onClick={() =>
                  void run(
                    () => grantSkipTokenAction({ memberId, reason }),
                    "Skip token restored",
                  )
                }
              >
                Grant token
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() =>
          void run(
            () => regenerateRecommendationAction({ memberId }),
            "Recommendation regenerated",
          )
        }
      >
        Regenerate AI note
      </Button>
    </div>
  );
}
