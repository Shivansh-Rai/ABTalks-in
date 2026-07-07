"use client";

import { useEffect } from "react";

/**
 * If the visitor hasn't interacted (scrolled/tapped) within 3s of landing,
 * gently scroll them to the registration form once. Any interaction cancels it.
 */
export default function AutoScrollToForm() {
  useEffect(() => {
    let done = false;

    const cancel = () => {
      done = true;
      cleanup();
    };

    const events: (keyof WindowEventMap)[] = [
      "wheel",
      "touchmove",
      "scroll",
      "keydown",
      "pointerdown",
    ];

    const cleanup = () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, cancel));
    };

    events.forEach((e) =>
      window.addEventListener(e, cancel, { passive: true, once: true }),
    );

    const timer = setTimeout(() => {
      // Only if the user is still at the top and hasn't interacted.
      if (done || window.scrollY > 40) {
        cleanup();
        return;
      }
      document
        .getElementById("register")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      cleanup();
    }, 3000);

    return cleanup;
  }, []);

  return null;
}
