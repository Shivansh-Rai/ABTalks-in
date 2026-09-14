"use client";

import { useEffect } from "react";
import {
  parseCookie,
  readUtm,
  serialiseCookie,
  UTM_COOKIE,
  UTM_COOKIE_TTL_SECONDS,
} from "@/lib/utm";

/**
 * T-254 first-touch UTM capture. Sits in the root layout — every landing
 * page mounts it. Reads UTM keys from the URL, writes them to a first-party
 * cookie on **first** visit only, then persists via a small server action on
 * signup completion (see utm-actions.ts).
 *
 * "First-touch wins" is the rule: if the cookie is already set, later visits
 * DO NOT overwrite it. That means when a candidate hears about ABTalks from a
 * LinkedIn campaign, wanders off, and later finds us via a Google search
 * before signing up, the LinkedIn attribution survives.
 *
 * The cookie is set with `SameSite=Lax` and no HttpOnly — it needs to be
 * readable client-side by this file, so a compromised page could read it.
 * That's acceptable because UTM values are marketing metadata that were in
 * the URL query anyway, not user secrets.
 */
export function UtmCapture() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const fresh = readUtm(url.searchParams);
      if (!fresh) return;

      // First-touch: bail if there is already a cookie parse.
      const cookies = document.cookie.split("; ");
      const existing = cookies.find((c) => c.startsWith(`${UTM_COOKIE}=`));
      if (existing) {
        const parsed = parseCookie(
          decodeURIComponent(existing.slice(UTM_COOKIE.length + 1)),
        );
        if (parsed) return;
      }

      const payload = serialiseCookie(fresh, new Date());
      const secure = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${UTM_COOKIE}=${encodeURIComponent(payload)}; Path=/; Max-Age=${UTM_COOKIE_TTL_SECONDS}; SameSite=Lax${secure}`;
    } catch {
      // Any failure here means we lose an attribution — never worth breaking
      // the page over. UTM is best-effort by design.
    }
  }, []);

  return null;
}
