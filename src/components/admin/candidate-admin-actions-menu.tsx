"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  deleteUserAccountAction,
  grantSynergyAction,
  removeFromChallengeAction,
  resetProgressAction,
  toggleReadyForInterviewAction,
} from "@/app/actions/admin-actions";
import {
  disableAccountAction,
  restoreAccountAction,
  secureAccountAction,
} from "@/app/actions/admin-account-actions";

type AdminAction =
  | "reset"
  | "ready"
  | "grant"
  | "remove"
  | "disable"
  | "restore"
  | "secure"
  | "delete";

const ACTION_NAME: Record<AdminAction, string> = {
  reset: "Reset progress",
  ready: "Toggle ready for interview",
  grant: "Grant synergy",
  remove: "Remove from challenge",
  disable: "Disable account",
  restore: "Restore account",
  secure: "Secure account",
  delete: "Delete user account",
};

function sure(action: AdminAction, readyLabel?: string): string {
  const name =
    action === "ready" && readyLabel ? readyLabel : ACTION_NAME[action];
  return `Are you sure you want to perform this ${name}?`;
}

type ChallengeFlags = {
  isReadyForInterview: boolean;
  isActive: boolean;
};

export function CandidateAdminActionsMenu({
  userId,
  name,
  disabledAt,
  challenge,
}: {
  userId: string;
  name: string;
  disabledAt: string | null;
  challenge?: ChallengeFlags;
}) {
  const router = useRouter();
  const frozen = Boolean(disabledAt);
  const readyLabel = challenge?.isReadyForInterview
    ? "Unset ready for interview"
    : "Mark ready for interview";

  const [openAction, setOpenAction] = useState<AdminAction | null>(null);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState("");
  const [points, setPoints] = useState("50");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  function resetFields() {
    setOpenAction(null);
    setReason("");
    setPoints("50");
    setDeleteConfirm("");
  }

  async function run(
    fn: () => Promise<{ ok: boolean; message?: string }>,
    success: string,
    after?: () => void,
  ) {
    setPending(true);
    const result = await fn();
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(success);
    resetFields();
    after?.();
    router.refresh();
  }

  const accountReasonOk = reason.trim().length >= 8;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          type="button"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-11 min-h-11 gap-2 px-4",
          )}
        >
          Perform admin action
          <ChevronDown className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56 w-auto">
          {challenge ? (
            <DropdownMenuGroup>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => setOpenAction("reset")}
              >
                Reset progress
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => setOpenAction("ready")}
              >
                {readyLabel}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                disabled={!challenge.isActive}
                onClick={() => challenge.isActive && setOpenAction("remove")}
              >
                Remove from challenge
              </DropdownMenuItem>
            </DropdownMenuGroup>
          ) : null}
          {challenge ? <DropdownMenuSeparator /> : null}
          <DropdownMenuGroup>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => setOpenAction("grant")}
            >
              Grant synergy
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={frozen}
              onClick={() => !frozen && setOpenAction("disable")}
            >
              Disable account
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              disabled={!frozen}
              onClick={() => frozen && setOpenAction("restore")}
            >
              Restore account
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => setOpenAction("secure")}
            >
              Secure account
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            className="cursor-pointer"
            onClick={() => setOpenAction("delete")}
          >
            Delete user account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={openAction !== null}
        onOpenChange={(next) => {
          if (!next && pending) return;
          if (!next) resetFields();
        }}
      >
        <DialogContent>
          {openAction ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {openAction === "ready" ? readyLabel : ACTION_NAME[openAction]}
                </DialogTitle>
                <DialogDescription>
                  {sure(openAction, readyLabel)}
                </DialogDescription>
              </DialogHeader>

              {openAction === "grant" ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="admin-grant-points">Points</Label>
                    <Input
                      id="admin-grant-points"
                      type="number"
                      min={1}
                      max={4000}
                      value={points}
                      onChange={(e) => setPoints(e.target.value)}
                      disabled={pending}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-grant-reason">Reason (optional)</Label>
                    <Textarea
                      id="admin-grant-reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      disabled={pending}
                    />
                  </div>
                </div>
              ) : null}

              {openAction === "reset" ||
              openAction === "ready" ||
              openAction === "remove" ? (
                <div className="space-y-2">
                  <Label htmlFor="admin-op-reason">Reason (optional)</Label>
                  <Textarea
                    id="admin-op-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={pending}
                  />
                </div>
              ) : null}

              {openAction === "disable" ||
              openAction === "restore" ||
              openAction === "secure" ? (
                <div className="space-y-2">
                  <Label htmlFor="admin-account-reason">Reason</Label>
                  <Textarea
                    id="admin-account-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    minLength={8}
                    disabled={pending}
                  />
                </div>
              ) : null}

              {openAction === "delete" ? (
                <div className="space-y-2">
                  <Label htmlFor="admin-delete-confirm">
                    Type <span className="font-mono font-semibold">delete</span>{" "}
                    to delete the user
                  </Label>
                  <Input
                    id="admin-delete-confirm"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    autoComplete="off"
                    disabled={pending}
                  />
                </div>
              ) : null}

              <DialogFooter showCloseButton>
                <Button
                  type="button"
                  variant={
                    openAction === "delete" ||
                    openAction === "disable" ||
                    openAction === "remove"
                      ? "destructive"
                      : "default"
                  }
                  disabled={
                    pending ||
                    ((openAction === "disable" ||
                      openAction === "restore" ||
                      openAction === "secure") &&
                      !accountReasonOk) ||
                    (openAction === "delete" && deleteConfirm !== "delete")
                  }
                  onClick={async () => {
                    if (openAction === "reset") {
                      await run(
                        () =>
                          resetProgressAction({
                            targetUserId: userId,
                            reason: reason || undefined,
                          }),
                        `Progress reset for ${name}`,
                      );
                      return;
                    }
                    if (openAction === "ready") {
                      await run(
                        () =>
                          toggleReadyForInterviewAction({
                            targetUserId: userId,
                            reason: reason || undefined,
                          }),
                        challenge?.isReadyForInterview
                          ? `${name} is no longer marked ready`
                          : `${name} is now ready for interview`,
                      );
                      return;
                    }
                    if (openAction === "remove") {
                      await run(
                        () =>
                          removeFromChallengeAction({
                            targetUserId: userId,
                            reason: reason || undefined,
                          }),
                        `${name} removed from challenge`,
                      );
                      return;
                    }
                    if (openAction === "grant") {
                      const parsedPoints = Number.parseInt(points, 10);
                      if (
                        !Number.isFinite(parsedPoints) ||
                        parsedPoints < 1 ||
                        parsedPoints > 4000
                      ) {
                        toast.error("Enter points between 1 and 4000");
                        return;
                      }
                      await run(
                        () =>
                          grantSynergyAction({
                            targetUserId: userId,
                            points: parsedPoints,
                            reason: reason || undefined,
                          }),
                        `Granted ${parsedPoints} synergy to ${name}`,
                      );
                      return;
                    }
                    if (openAction === "disable") {
                      await run(
                        () =>
                          disableAccountAction({
                            targetUserId: userId,
                            reason: reason.trim(),
                          }),
                        `Disable account saved for ${name}`,
                      );
                      return;
                    }
                    if (openAction === "restore") {
                      await run(
                        () =>
                          restoreAccountAction({
                            targetUserId: userId,
                            reason: reason.trim(),
                          }),
                        `Restore account saved for ${name}`,
                      );
                      return;
                    }
                    if (openAction === "secure") {
                      await run(
                        () =>
                          secureAccountAction({
                            targetUserId: userId,
                            reason: reason.trim(),
                          }),
                        `Secure account saved for ${name}`,
                      );
                      return;
                    }
                    if (openAction === "delete") {
                      await run(
                        () =>
                          deleteUserAccountAction({
                            targetUserId: userId,
                            confirm: deleteConfirm,
                          }),
                        `Deleted account for ${name}`,
                        () => router.push("/admin/students"),
                      );
                    }
                  }}
                >
                  {pending ? "Saving..." : "Confirm"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
