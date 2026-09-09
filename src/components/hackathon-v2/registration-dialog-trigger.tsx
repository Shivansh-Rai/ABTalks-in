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
import type { RegistrationPrefill } from "@/features/hackathon/registration-identity";

type Props = {
  registered: boolean;
  registrationOpen: boolean;
  isAuthed: boolean;
  /** What the popup still has to ask. Null when nobody is signed in. */
  prefill: RegistrationPrefill | null;
  className?: string;
  labelWhenRegister?: ReactNode;
  labelWhenClosed?: ReactNode;
};

export function RegistrationDialogTrigger({
  registered,
  registrationOpen,
  isAuthed,
  prefill,
  className = "ab-btn ab-btn--primary",
  labelWhenRegister = "Register",
  labelWhenClosed = "Registration closed",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function handleSuccess() {
    router.refresh();
  }

  // Keep the success panel mounted while the dialog is open. Once it closes,
  // the registration CTA disappears because the dashboard is not ready yet.
  if (registered && !open) {
    return null;
  }

  if (!registrationOpen) {
    return (
      <button type="button" className={className} disabled>
        {labelWhenClosed}
      </button>
    );
  }

  if (!isAuthed || !prefill) {
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
        <DialogContent className="hk-dialog">
          <DialogHeader className="hk-dialog__head">
            <DialogTitle className="hk-dialog__title">
              Register — <em>{HACKATHON.name}</em>
            </DialogTitle>
            <DialogDescription className="hk-dialog__sub">
              Solo, create a team of up to {HACKATHON.maxTeamSize}, or join an
              existing team with a code.
            </DialogDescription>
          </DialogHeader>
          <div className="hk-dialog__body">
            <RegistrationForm prefill={prefill} onSuccess={handleSuccess} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
