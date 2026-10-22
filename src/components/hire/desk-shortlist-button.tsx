"use client";

import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import {
  deskShortlistHas,
  itemFromMatch,
  toggleDeskShortlist,
} from "@/components/hire/desk-shortlist";
import type { MatchCardData } from "@/components/hire/match-card";
import { cn } from "@/lib/utils";

export function DeskShortlistButton({
  candidateRef,
  jobRole,
  match,
  icon = false,
}: {
  candidateRef: string;
  jobRole: string;
  match?: MatchCardData;
  /** A bookmark icon instead of the labelled checkbox, for dense result rows. */
  icon?: boolean;
}) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(deskShortlistHas(candidateRef));
  }, [candidateRef]);

  function toggle() {
    setOn(
      toggleDeskShortlist(
        match ? itemFromMatch(match) : { candidateRef, jobRole },
      ),
    );
  }

  if (icon) {
    const label = on ? "Saved for later" : "Save for later";
    return (
      <button
        type="button"
        className={cn("desk-save", on && "is-on")}
        aria-pressed={on}
        aria-label={label}
        // A styled tooltip (CSS, on hover and keyboard focus) rather than the
        // browser's slow native one: an icon alone does not say "save for later".
        data-tip={on ? "Saved for later. Click to remove" : "Save for later"}
        onClick={toggle}
      >
        {on ? (
          <BookmarkCheck className="size-4" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Bookmark className="size-4" strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={cn("desk-shortlist", on && "is-on")}
      aria-pressed={on}
      onClick={toggle}
    >
      <span className="desk-shortlist__box" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            d="m5 12.5 4.5 4.5L19 7.5"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {on ? "Saved for later" : "Save for later"}
    </button>
  );
}
