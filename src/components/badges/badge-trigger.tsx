"use client";

import { useState } from "react";
import { CalendarCheck, ShieldCheck } from "lucide-react";
import "./badges.css";
import {
  BADGE_FAMILY_LABEL,
  type EarnedBadge,
} from "@/features/badges/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { BadgeMedallion } from "./badge-medallion";

/**
 * A badge you can inspect. `tile` shows the medallion with its name and
 * context; `icon` is the bare medallion (Quick Links preview). Either opens
 * the detail view: what it is, how it is earned, and when it was awarded.
 */
export function BadgeTrigger({
  badge,
  variant = "tile",
  size,
}: {
  badge: EarnedBadge;
  variant?: "tile" | "icon";
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const label = `${badge.title}, ${badge.context}. Earned ${badge.awardedOn}.`;

  return (
    <>
      <button
        type="button"
        className={`bdg-trigger ${variant === "tile" ? "bdg-tile" : "bdg-icon"}`}
        onClick={() => setOpen(true)}
        aria-label={`${label} View details`}
        title={variant === "icon" ? `${badge.title} · ${badge.context}` : undefined}
        aria-haspopup="dialog"
      >
        <BadgeMedallion badge={badge} size={size ?? (variant === "tile" ? 76 : 30)} />
        {variant === "tile" ? (
          <span>
            <span className="bdg-tile-name">{badge.title}</span>
            <span className="bdg-tile-context">{badge.context}</span>
          </span>
        ) : null}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[380px] gap-0 overflow-hidden p-0">
          <div className="flex flex-col items-center bg-gradient-to-b from-[#EEF6F6] to-white px-6 pb-4 pt-8">
            <BadgeMedallion badge={badge} size={132} />
            <span className="mt-4 rounded-full bg-[#D4EBEC] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#03535F]">
              {BADGE_FAMILY_LABEL[badge.family]} badge
            </span>
            <DialogTitle className="mt-2 text-center font-display text-xl font-semibold text-black">
              {badge.title}
            </DialogTitle>
            <p className="mt-0.5 text-center text-sm font-medium text-[#03535F]">
              {badge.context}
            </p>
          </div>
          <div className="space-y-4 px-6 pb-6 pt-2">
            <DialogDescription className="text-center text-sm leading-relaxed text-[#4B4B4B]">
              {badge.description}
            </DialogDescription>
            <dl className="divide-y divide-[#E9E9E9] rounded-xl border border-[#E9E9E9] text-sm">
              <div className="flex items-start gap-3 px-4 py-3">
                <CalendarCheck className="mt-0.5 size-4 shrink-0 text-[#03535F]" aria-hidden />
                <div>
                  <dt className="text-xs text-[#626262]">Awarded on</dt>
                  <dd className="font-medium text-black">{badge.awardedOn}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3 px-4 py-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#03535F]" aria-hidden />
                <div>
                  <dt className="text-xs text-[#626262]">How it&apos;s earned</dt>
                  <dd className="text-[#353535]">{badge.criteria}</dd>
                </div>
              </div>
            </dl>
            <p className="text-center text-[11.5px] text-[#787878]">
              Verified by Klymb AI from your platform records.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
