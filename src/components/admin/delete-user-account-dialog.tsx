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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteUserAccountAction } from "@/app/actions/admin-actions";

interface DeleteUserAccountDialogProps {
  userId: string;
  userName: string;
}

export function DeleteUserAccountDialog({
  userId,
  userName,
}: DeleteUserAccountDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);

  const canDelete = confirmText === "delete";

  const handleOpenChange = (next: boolean) => {
    if (pending) return;
    setOpen(next);
    if (!next) setConfirmText("");
  };

  const handleDelete = async () => {
    if (!canDelete || pending) return;
    setPending(true);
    const result = await deleteUserAccountAction({
      targetUserId: userId,
      confirm: confirmText,
    });
    setPending(false);

    if (result.ok) {
      toast.success(`Deleted account for ${userName}`);
      setOpen(false);
      setConfirmText("");
      router.push("/admin/students");
      router.refresh();
      return;
    }
    toast.error(result.message);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button type="button" variant="destructive" size="sm">
            Delete user account
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete user account</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this user&apos;s account?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="delete-confirm">
            Type <span className="font-mono font-semibold">delete</span> to
            delete the user
          </Label>
          <Input
            id="delete-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
            disabled={pending}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canDelete || pending}
            onClick={handleDelete}
          >
            {pending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
