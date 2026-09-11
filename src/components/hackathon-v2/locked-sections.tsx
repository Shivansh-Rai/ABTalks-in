"use client";

import type { ReactNode } from "react";
import { useUnlock } from "@/components/hackathon-v2/unlock-provider";

/**
 * Wraps every landing section below the hero. Children render only after
 * the visitor has unlocked the page — registering does that on its own, and
 * the code is the way back in from a signed-out browser or another device.
 * A quiet placeholder tells them what to do while it's still locked.
 */
export function LockedSections({ children }: { children: ReactNode }) {
  const { unlocked } = useUnlock();

  if (!unlocked) {
    return (
      <section
        className="hk-locked-placeholder"
        aria-label="Rest of the hackathon details, locked"
      >
        <p className="hk-locked-placeholder__title">
          Details locked
        </p>
        <p className="hk-locked-placeholder__text">
          Register above and this opens straight away — how it works, the
          timeline, the rules and the Discord. Already have your{" "}
          <b>unlock code</b>? Type it on the padlock.
        </p>
      </section>
    );
  }

  return <>{children}</>;
}
