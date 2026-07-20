"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PhoneVerifyField } from "@/components/shared/phone-verify-field";
import { INDIA_DIALING_CODE, isIndianPhone } from "@/lib/validations/phone";

/** Shown-once flag — the nudge appears a single time per browser, then never again. */
const SHOWN_KEY = "ab_phone_verify_shown";

type Props = {
  phone: string | null;
  phoneVerified: boolean;
};

/**
 * One-time (per session) popup nudging existing Indian participants to verify
 * their phone. Optional — dismissible, never blocks. Shows only for unverified
 * users whose number is Indian (+91) or missing.
 */
export function PhoneVerifyNudge({ phone, phoneVerified }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const eligible = !phoneVerified && (phone === null || isIndianPhone(phone));

  useEffect(() => {
    if (!eligible || typeof window === "undefined") return;
    if (localStorage.getItem(SHOWN_KEY)) return;
    const t = setTimeout(() => {
      // Mark as shown the moment it opens, so it displays only once ever.
      try {
        localStorage.setItem(SHOWN_KEY, "1");
      } catch {
        /* ignore storage errors (private mode) */
      }
      setOpen(true);
    }, 800);
    return () => clearTimeout(t);
  }, [eligible]);

  if (!eligible) return null;

  const defaultNational = phone && isIndianPhone(phone) ? phone.slice(3) : "";

  function dismiss() {
    // Already marked shown when it opened; just close.
    setOpen(false);
  }

  function handleVerified() {
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setOpen(true);
        else dismiss();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" aria-hidden />
            Verify your phone number
          </DialogTitle>
          <DialogDescription>
            Confirm your mobile number so the ABTalks team and recruiters can
            reach you. It only takes a few seconds.
          </DialogDescription>
        </DialogHeader>

        <div className="py-1">
          <PhoneVerifyField
            defaultCountryCode={INDIA_DIALING_CODE}
            defaultPhoneNumber={defaultNational}
            onVerified={handleVerified}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={dismiss}>
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
