"use client";

import { useEffect } from "react";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { useTrack } from "@/lib/analytics/use-track";
import type { AppNotification } from "@/features/notification/types";

/**
 * T-253: emit GA4 events for the two notification kinds whose "was sent"
 * signal exists only on the server (T-250 job.alert.match, T-251
 * profile.viewed). GA4 has no server transport in this app (plan 114 §12),
 * so the browser fires them the FIRST time the candidate's feed carries a
 * new personal notification of that type. Once per notification key.
 *
 * The tracker is a component with no visible output. It sits alongside the
 * notification provider so it runs whenever the bell is mounted — which is
 * exactly when a real signed-in candidate has the feed loaded.
 */
const SEEN_KEY = "abtalks_analytics_seen_notifications";
const MAX_SEEN = 200;

function readSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

function writeSeen(seen: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    const arr = Array.from(seen);
    // Trim the oldest entries so the localStorage row never grows unbounded
    // — 200 entries is well past what a real user accumulates in a session.
    const trimmed = arr.length > MAX_SEEN ? arr.slice(-MAX_SEEN) : arr;
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage disabled — the tracker degrades to "may re-emit" which
    // is acceptable per T-253 §5 (GA4's own tag de-dupes on session id).
  }
}

export function NotificationAnalyticsTracker({
  items,
}: {
  items: readonly AppNotification[];
}) {
  const track = useTrack();

  useEffect(() => {
    if (items.length === 0) return;
    const seen = readSeen();
    let changed = false;

    for (const item of items) {
      if (seen.has(item.key)) continue;
      if (item.eventType === "job.alert.match") {
        track(ANALYTICS_EVENTS.siteJobAlertSent);
        seen.add(item.key);
        changed = true;
      } else if (item.eventType === "profile.viewed") {
        track(ANALYTICS_EVENTS.siteProfileViewNotified);
        seen.add(item.key);
        changed = true;
      }
    }

    if (changed) writeSeen(seen);
  }, [items, track]);

  return null;
}
