"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteOwnAccountAction } from "@/app/actions/candidate-account-actions";

export function DeleteOwnAccountDialog() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const canDelete = confirmText === "DELETE";

  async function onConfirm() {
    setPending(true);
    const result = await deleteOwnAccountAction({ confirm: confirmText });
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    window.location.assign("/api/auth/signout?callbackUrl=/");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) setConfirmText("");
      }}
    >
      <DialogTrigger
        render={
          <Button type="button" variant="destructive" size="sm">
            Delete my account
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete my account</DialogTitle>
          <DialogDescription>
            This removes your data from ABTalks and cannot be undone. Type DELETE
            to confirm.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="delete-own-confirm">Type DELETE</Label>
          <Input
            id="delete-own-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
          />
        </div>
        <DialogFooter showCloseButton>
          <Button
            type="button"
            variant="destructive"
            disabled={!canDelete || pending}
            onClick={onConfirm}
          >
            {pending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
