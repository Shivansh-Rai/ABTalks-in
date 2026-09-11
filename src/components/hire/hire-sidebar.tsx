"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHireAuth } from "@/components/hire/hire-auth-provider";
import { useHireDesk } from "@/components/hire/hire-desk-context";
import {
  SubscriptionGate,
  type GateReason,
} from "@/components/hire/subscription-gate";
import type { RecruiterAccountSnapshot } from "@/features/hire/recruiter-account-types";
import { cn } from "@/lib/utils";

/**
 * The nav card on the left of the Scout desk (Figma 1585:76).
 *
 * The grey squares are the icon slots exactly as the design ships them. Analytics
 * has no page yet, so it is a disabled row rather than a link to nowhere.
 * "+ Create New Project" asks ScoutChat to start over through the desk context —
 * the conversation state lives there, not here.
 */
export function HireSidebar({
  account,
}: {
  account: RecruiterAccountSnapshot | null;
}) {
  const pathname = usePathname();
  const { openAuth } = useHireAuth();
  const { projectName, requestNewSearch } = useHireDesk();
  const [gate, setGate] = useState<GateReason | null>(null);

  const name = account?.fullName ?? "Guest";
  const sub = account
    ? `${account.company}’s Dashboard`
    : "Sign in to save searches";

  const who = (
    <>
      <img
        src="/hire/avatar-sidebar.png"
        alt=""
        width={45}
        height={44}
        className="hire-side__avatar"
      />
      <span className="hire-side__who">
        <span className="hire-side__name">{name}</span>
        <span className="hire-side__sub">{sub}</span>
      </span>
    </>
  );

  return (
    <aside className="hire-side" aria-label="Hire navigation">
      <nav className="hire-side__nav">
        <Link
          href="/hire"
          className={cn("hire-side__item", pathname === "/hire" && "is-current")}
          aria-current={pathname === "/hire" ? "page" : undefined}
        >
          <span className="hire-side__icon" aria-hidden="true" />
          Home
        </Link>
        <Link
          href="/hire/requests"
          className={cn(
            "hire-side__item",
            pathname === "/hire/requests" && "is-current",
          )}
        >
          <span className="hire-side__icon" aria-hidden="true" />
          Projects
        </Link>
        <span
          className="hire-side__item is-disabled"
          aria-disabled="true"
          title="Coming soon"
        >
          <span className="hire-side__icon" aria-hidden="true" />
          Analytics
        </span>

        <span className="hire-side__spacer hire-side__spacer--a" aria-hidden="true" />

        <div className="hire-side__project">
          <span className="hire-side__item">
            <span className="hire-side__icon" aria-hidden="true" />
            <span className="hire-side__label">
              {projectName || "Current Project"}
            </span>
          </span>
          <button
            type="button"
            className="hire-side__new"
            onClick={requestNewSearch}
          >
            + Create New Project
          </button>
        </div>

        <span className="hire-side__spacer hire-side__spacer--b" aria-hidden="true" />

        <Link href="/contact" className="hire-side__item">
          <span className="hire-side__icon" aria-hidden="true" />
          Support
        </Link>
        <button
          type="button"
          className="hire-side__upgrade"
          aria-haspopup="dialog"
          onClick={() => setGate("default")}
        >
          Upgrade →
        </button>
      </nav>

      {account ? (
        <div className="hire-side__me">{who}</div>
      ) : (
        <button
          type="button"
          className="hire-side__me"
          onClick={() => openAuth("nav")}
        >
          {who}
        </button>
      )}

      <SubscriptionGate reason={gate} onClose={() => setGate(null)} />
    </aside>
  );
}
