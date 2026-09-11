"use client";

import { useEffect, useRef } from "react";
import { useCookieConsent } from "@/components/legal/cookie-consent-provider";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { useTrack } from "@/lib/analytics/use-track";

/**
 * Emits `recruiter_candidate_viewed` once, when a recruiter actually has a
 * candidate's profile on screen.
 *
 * The page is a Server Component, so this is the smallest client island that
 * can reach `window.gtag`. It renders nothing.
 *
 * Firing once is the whole job, and there are three ways to fire twice:
 *
 * - React's development double-invoked effect,
 * - `router.refresh()` after shortlisting, which re-renders the server tree
 *   under this same component instance,
 * - React reusing this instance when the recruiter moves to a different
 *   candidate, which changes the prop but not the mount.
 *
 * One ref holding the id it last emitted for answers all three: the first two
 * re-run the effect with an unchanged `candidateRef` and are ignored, the third
 * changes it and is a genuine second view.
 *
 * `candidateRef` is the pseudonymous public id already printed on the page. It
 * is a local dedupe key only — `recruiter_candidate_viewed` declares no
 * parameters, so nothing identifying it is sent to GA4.
 */
export function TrackCandidateView({ candidateRef }: { candidateRef: string }) {
  const { ready } = useCookieConsent();
  const track = useTrack();
  const emittedFor = useRef<string | null>(null);

  useEffect(() => {
    // Before the cookie is read, track() is a no-op — claiming the ref here
    // would spend the one shot on an event that never left.
    if (!ready) return;
    if (emittedFor.current === candidateRef) return;
    emittedFor.current = candidateRef;
    track(ANALYTICS_EVENTS.recruiterCandidateViewed);
  }, [ready, candidateRef, track]);

  return null;
}
