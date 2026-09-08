"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { RegistrationForm } from "@/components/hackathon/registration-form";

type Props = {
  registered: boolean;
  registrationOpen: boolean;
  isAuthed: boolean;
  initialEmail: string | null;
  initialName: string;
  className?: string;
  labelWhenRegister?: ReactNode;
  labelWhenRegistered?: ReactNode;
  labelWhenClosed?: ReactNode;
};

export function RegistrationDialogTrigger({
  registered,
  registrationOpen,
  isAuthed,
  initialEmail,
  initialName,
  className = "ab-btn ab-btn--primary",
  labelWhenRegister = "Register",
  labelWhenRegistered = "Open dashboard →",
  labelWhenClosed = "Registration closed",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function handleSuccess() {
    router.refresh();
  }

  if (registered) {
    return (
      <Link href="/hackathon/dashboard" className={className}>
        {labelWhenRegistered}
      </Link>
    );
  }

  if (!registrationOpen) {
    return (
      <button type="button" className={className} disabled>
        {labelWhenClosed}
      </button>
    );
  }

  if (!isAuthed || !initialEmail) {
    return (
      <Link href="/login?from=/hackathon" className={className}>
        {labelWhenRegister}
      </Link>
    );
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {labelWhenRegister}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] w-full max-w-[calc(100%-1.25rem)] overflow-y-auto border-border bg-background p-0 text-foreground sm:max-w-lg">
          <DialogHeader className="border-b border-border px-5 pt-5 pb-4 sm:px-6">
            <DialogTitle className="font-display text-lg font-semibold text-foreground sm:text-xl">
              Register — {HACKATHON.name}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Solo, create a team of up to {HACKATHON.maxTeamSize}, or join an
              existing team with a code.
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 py-5 sm:px-6 sm:py-6">
            <RegistrationForm
              initialEmail={initialEmail}
              initialName={initialName}
              onSuccess={handleSuccess}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
