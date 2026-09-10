"use client";

import { useEffect, useRef, useState } from "react";
import type { HackathonMember } from "@/features/hackathon/get-my-registration";

type Props = {
  entryType: "SOLO" | "TEAM";
  teamCode: string;
  teamName: string | null;
  members: HackathonMember[];
  maxTeamSize: number;
};

type CopyState = "idle" | "copied" | "failed";

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

/**
 * "Your team" — the registered participant's team code and roster, on the
 * landing page itself. The dashboard carries the same information, but it is
 * behind SHOW_LIVE_DASHBOARD between events, so this is where a registrant
 * actually finds their code.
 *
 * Read-only on purpose: removing a teammate stays a dashboard affordance.
 */
export function TeamPanel({
  entryType,
  teamCode,
  teamName,
  members,
  maxTeamSize,
}: Props) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const timerRef = useRef<number | null>(null);

  // A second click restarts the window instead of stacking timers, and an
  // unmount mid-window doesn't set state on a dead component.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  function flash(next: CopyState) {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setCopyState(next);
    timerRef.current = window.setTimeout(() => {
      setCopyState("idle");
      timerRef.current = null;
    }, 2500);
  }

  async function copyCode() {
    try {
      // Undefined on non-HTTPS origins, so this is a real branch, not paranoia.
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(teamCode);
      flash("copied");
    } catch {
      flash("failed");
    }
  }

  // Defence in depth. `page.tsx` already withholds this component for SOLO so
  // the code is never serialized into the RSC payload — this only catches a
  // future caller that forgets.
  if (entryType === "SOLO") return null;

  const openSpots = Math.max(0, maxTeamSize - members.length);

  return (
    <section className="hk-team" aria-labelledby="hk-team-title">
      <h2 className="hk-h2 hk-team__title" id="hk-team-title">
        Your team
      </h2>
      <p className="hk-team__sub">
        {teamName ?? "Your team"} · {members.length}/{maxTeamSize} members
      </p>

      <div className="hk-team__panel">
        <span className="hk-team__label">Your team code</span>
        <div className="hk-team__code-row">
          <code className="hk-team__code">{teamCode}</code>
          <button
            type="button"
            className="ab-btn hk-btn--outline hk-team__copy"
            onClick={copyCode}
          >
            {copyState === "copied"
              ? "Copied!"
              : copyState === "failed"
                ? "Copy failed"
                : "Copy"}
          </button>
        </div>
        <p className="hk-team__note" aria-live="polite">
          {copyState === "failed"
            ? "Couldn't copy automatically — select the code above and copy it."
            : "Teammates open the Register popup on this page and enter this code to join you."}
        </p>
      </div>

      <ul className="hk-team__list">
        {members.map((member) => (
          <li key={member.id} className="hk-team__member">
            <span className="hk-team__avatar" aria-hidden>
              {initials(member.fullName)}
            </span>
            <div className="hk-team__who">
              <p className="hk-team__name">
                {member.fullName}
                {member.isLeader ? (
                  <span className="hk-team__chip">Leader</span>
                ) : null}
              </p>
              <p className="hk-team__college">{member.college}</p>
            </div>
          </li>
        ))}
        {Array.from({ length: openSpots }).map((_, i) => (
          <li key={`open-${i}`} className="hk-team__member hk-team__member--open">
            <span className="hk-team__avatar hk-team__avatar--open" aria-hidden>
              ?
            </span>
            <p className="hk-team__college">Open spot</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
