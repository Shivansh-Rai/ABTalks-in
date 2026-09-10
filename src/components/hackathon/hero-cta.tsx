"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
};

const PRIMARY_BUTTON_CLASS =
  "inline-flex h-8 flex-1 items-center justify-center rounded-[8px] px-2 text-center text-[11px] font-semibold whitespace-nowrap text-white transition-opacity hover:opacity-90 sm:h-[47px] sm:flex-none sm:rounded-[10px] sm:px-6 sm:text-[16px] disabled:cursor-not-allowed disabled:opacity-70";

const PRIMARY_BUTTON_STYLE = {
  background:
    "linear-gradient(180deg, rgba(115, 100, 230, 1) 0%, rgba(64, 56, 128, 1) 100%)",
} as const;

export function HeroCta({
  registered,
  registrationOpen,
  isAuthed,
  initialEmail,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  function handleSuccess() {
    router.refresh();
  }

  return (
    <>
      <div className="flex w-full flex-row items-center justify-center gap-2 sm:gap-3 md:w-auto">
        {registered ? (
          <Link
            href="/hackathon/dashboard"
            className={PRIMARY_BUTTON_CLASS}
            style={PRIMARY_BUTTON_STYLE}
          >
            Go to your dashboard →
          </Link>
        ) : !registrationOpen ? (
          <button
            type="button"
            disabled
            className={PRIMARY_BUTTON_CLASS}
            style={PRIMARY_BUTTON_STYLE}
          >
            Registration closed
          </button>
        ) : isAuthed && initialEmail ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={PRIMARY_BUTTON_CLASS}
            style={PRIMARY_BUTTON_STYLE}
          >
            Register free →
          </button>
        ) : (
          <Link
            href="/login?from=/hackathon"
            className={PRIMARY_BUTTON_CLASS}
            style={PRIMARY_BUTTON_STYLE}
          >
            Register free →
          </Link>
        )}

        <Link
          href="#how-it-works"
          className="inline-flex h-8 flex-1 items-center justify-center rounded-[8px] border border-[#2C1BA9] bg-[#100A3D] px-2 text-center text-[11px] font-semibold whitespace-nowrap text-white transition-opacity hover:opacity-90 sm:h-[47px] sm:flex-none sm:rounded-[10px] sm:px-6 sm:text-[16px]"
        >
          How it works
        </Link>
      </div>

      {isAuthed && initialEmail && registrationOpen ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh] w-full max-w-[calc(100%-1.5rem)] overflow-y-auto border-border bg-background p-0 text-foreground sm:max-w-lg">
            <DialogHeader className="border-b border-border px-5 pt-5 pb-4 sm:px-6">
              <DialogTitle className="font-display text-lg font-semibold text-foreground sm:text-xl">
                Register — {HACKATHON.name}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Free entry. Solo or teams of {HACKATHON.maxTeamSize}. Two minutes.
              </DialogDescription>
            </DialogHeader>
            <div className="px-5 py-5 sm:px-6 sm:py-6">
              {/* The form reads name/email/phone from the account itself now,
                  and falls back to asking for everything when no prefill is
                  passed — which is all this legacy v1 surface can offer. */}
              <RegistrationForm onSuccess={handleSuccess} />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
