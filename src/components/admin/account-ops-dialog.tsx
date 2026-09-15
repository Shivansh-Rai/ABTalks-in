"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import {
  disableAccountAction,
  restoreAccountAction,
  secureAccountAction,
} from "@/app/actions/admin-account-actions";

type AccountOp = "disable" | "restore" | "secure";

const COPY: Record<
  AccountOp,
  { title: string; description: string; confirm: string; variant: "outline" | "secondary" | "destructive" }
> = {
  disable: {
    title: "Disable account",
    description:
      "They cannot sign in until restored. Their data is kept.",
    confirm: "Disable account",
    variant: "destructive",
  },
  restore: {
    title: "Restore account",
    description: "Sign-in will work again. Existing data is unchanged.",
    confirm: "Restore account",
    variant: "secondary",
  },
  secure: {
    title: "Secure account",
    description:
      "They will be signed out of every device. They can sign in again with the same password. You cannot see or set a password.",
    confirm: "Secure account",
    variant: "outline",
  },
};

export function AccountOpsDialog({
  targetUserId,
  targetName,
  op,
  disabled = false,
}: {
  targetUserId: string;
  targetName: string;
  op: AccountOp;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const copy = COPY[op];
  const canSubmit = reason.trim().length >= 8 && !pending && !disabled;

  async function onConfirm() {
    setPending(true);
    const input = { targetUserId, reason: reason.trim() };
    const result =
      op === "disable"
        ? await disableAccountAction(input)
        : op === "restore"
          ? await restoreAccountAction(input)
          : await secureAccountAction(input);
    setPending(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(`${copy.title} saved for ${targetName}`);
    setOpen(false);
    setReason("");
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) setReason("");
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" variant={copy.variant} size="sm" disabled={disabled}>
            {copy.title}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`account-op-reason-${op}`}>Reason</Label>
          <Textarea
            id={`account-op-reason-${op}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            minLength={8}
          />
        </div>
        <DialogFooter showCloseButton>
          <Button
            type="button"
            variant={copy.variant}
            disabled={!canSubmit}
            onClick={onConfirm}
          >
            {pending ? "Saving..." : copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RecruiterAccountOps({
  userId,
  name,
  disabledAt,
}: {
  userId: string;
  name: string;
  disabledAt: string | null;
}) {
  const frozen = Boolean(disabledAt);
  return (
    <div className="flex flex-wrap gap-2">
      <AccountOpsDialog
        targetUserId={userId}
        targetName={name}
        op="disable"
        disabled={frozen}
      />
      <AccountOpsDialog
        targetUserId={userId}
        targetName={name}
        op="restore"
        disabled={!frozen}
      />
      <AccountOpsDialog targetUserId={userId} targetName={name} op="secure" />
    </div>
  );
}
