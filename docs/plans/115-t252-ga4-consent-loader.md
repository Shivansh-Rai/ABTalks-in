# T-252 — GA4 consent + production-only loading

**Owner:** Manuvrtti
**Demo:** Demo 1
**Implementation date:** 2026-09-09
**Internal test date:** 2026-09-11
**Blocks:** T-253, T-254
**Depends on:** T-150 (docs/plans/114-ga4-event-taxonomy.md) — already executed
**Test case:** TC-S-007

---

## 1. Outcome (verbatim, from ABTalks_Execution_Plan.xlsx)

> As ABTalks, GA4 loads in production only and respects the cookie choice.

## 2. Definition of Done (verbatim)

> GA4 loads only in production and only after the analytics cookie choice permits it. Declining prevents loading entirely. No personal data is ever sent.

## 3. Acceptance test — TC-S-007

1. Load the site in a non-production environment → GA4 does not load (zero requests to `googletagmanager.com` / `google-analytics.com`).
2. In production, decline consent (or leave it undecided) → no GA4 request.
3. In production, accept consent → GA4 loads and `collect` requests fire.

## 4. Non-negotiable constraints (from docs/plans/114-ga4-event-taxonomy.md)

- **middleware.ts must NOT change.** Edge runtime forbids `@/lib/*` imports. GA is client-side only.
- **Every `gtag('event', …)` call must gate on both**:
  1. Consent Mode v2 signals, AND
  2. `useCookieConsent()` (client) or `getConsentChoice()` (server).
  Belt and braces. Consent Mode alone is not enough.
- **Consent Mode v2 defaults must be set BEFORE `gtag.js` loads.** Order: `gtag('consent','default', …)` → load gtag.js → `gtag('config', ID, …)`.
- **Emit only from Client Components / client callers.** Server Actions must not call `gtag` directly (see plan §9).
- **No PII in any parameter, ever.** Full exclusion list in plan §7.

## 5. Consent Mode v2 mapping (from plan §6)

| Cookie choice | ad_storage | analytics_storage | ad_user_data | ad_personalization | Notes |
|---|---|---|---|---|---|
| `null` (unread) | denied | denied | denied | denied | Consent Mode default; cookieless ping only |
| `essential` | denied | denied | denied | denied | Same as null |
| `limited` | denied | **granted** | denied | denied | **Target state** — analytics on, ad signals off |
| `all` | granted | granted | granted | granted | Same event set as limited, ad signals also granted |

`CookieChoice` type is defined in `src/lib/cookies.ts`. `useCookieConsent()` lives in `src/components/legal/cookie-consent-provider.tsx`.

## 6. Environment gate

- Add (or reuse) an env var that identifies production runtime, e.g. `NEXT_PUBLIC_APP_ENV=production`.
- Set this **only** on the production deploy. Never on preview, never in `.env.local`.
- Document it in `.env.example`.

## 7. Measurement ID

- Production: `G-KJCDR1DZ0F`
- Config key: `NEXT_PUBLIC_GA_MEASUREMENT_ID`
- Property: "ABTalks Production" under GA account "ABTalksOnAI"
- Data retention: 14 months (max free-tier)
- IP anonymization: platform-enforced, always on (no toggle)

## 8. Files this task touches (from plan §8)

- **[new]** `src/lib/analytics/consent.ts` — maps `CookieChoice` → Consent Mode signals. Plain module (no `"server-only"`, no `next/headers`) so it's importable from both sides.
- **[new]** `src/components/analytics/ga4-loader.tsx` — the loader. Client component. Uses `useCookieConsent()`. Sets Consent Mode defaults before loading `gtag.js`. Reacts to consent changes via `gtag('consent','update', …)`.
- **[edit]** `src/app/layout.tsx` — mount `<GoogleAnalytics />` inside the `CookieConsentProvider` tree.
- **[edit]** `src/lib/env.ts` (or wherever env helpers live) — add `isProduction()` if not present.
- **[edit]** `.env.example` — document `NEXT_PUBLIC_GA_MEASUREMENT_ID` and `NEXT_PUBLIC_APP_ENV`.
- **[edit]** `content/legal/privacy.md` (line ~101) — remove "we do not use Google Analytics" paragraph; add GA4 + Consent Mode v2 disclosure.
- **[edit]** `content/legal/cookies.md` (line ~46) — same.
- **[edit]** `src/lib/legal-constants.ts` — bump `COOKIE_POLICY_VERSION` and `PRIVACY_VERSION` to `"2026-09-09"`. **This re-prompts every existing user for consent — surface this in the PR description.**

## 9. Tests to add

**Unit — Consent Mode mapping contract** (Jest / Vitest):
- `toGaConsent('essential')` and `toGaConsent(null)` return all-denied.
- `toGaConsent('limited')` returns `analytics_storage: 'granted'`, others denied.
- `toGaConsent('all')` returns all-granted.

**E2E — TC-S-007** (Playwright, `tests/e2e/ga4-consent.spec.ts`):
- Non-production URL → zero requests matching `google-analytics|googletagmanager`.
- Production URL, decline consent → zero matching requests.
- Production URL, accept consent → `googletagmanager` request fires.

Discover the banner's actual button labels from `src/components/legal/cookie-consent-provider.tsx` (or the banner component beside it) — do not hardcode "Accept"/"Decline"; read the real strings.

## 10. Evidence to attach to the PR

- Unit test output (all green).
- Playwright test output (all three scenarios green).
- 30–60 second browser recording covering the three TC-S-007 scenes.
- Screenshot of GA4 Realtime showing a session recorded after accept in prod (once deployed).

## 11. Regression guards

- Never load GA4 in non-production, whatever the consent choice.
- Never load GA4 in production without a granted analytics_storage signal.
- Never send an event payload containing anything from the plan §7 exclusion list.
- Do not touch middleware.ts.

## 12. Out of scope for T-252 (do not build)

- The typed `track()` wrapper and event emit sites — that's T-253.
- UTM capture and DebugView verification — that's T-254.
- The `src/lib/analytics/events.ts` enum — that's T-253.

## 13. Decision Record

### 13.1 Strict gate vs. lenient Consent Mode v2 (decided 2026-09-09)

**The ambiguity.** During implementation on 2026-09-09 the plan was read to
mean two different things:

- **Lenient interpretation** — matches §5 verbatim. gtag.js loads in
  production whenever the user has been prompted; Consent Mode v2 defaults are
  set to `analytics_storage: denied` for null/essential; the runtime signals
  ("cookieless pings", "same as null") do the gating. This is Google's
  standard Consent Mode v2 pattern and is what a literal reading of the §5
  table produces.
- **Strict interpretation** — matches §3 acceptance line 2 ("decline or
  undecided → no GA4 request") and §11 regression guard ("Never load GA4 in
  production without a granted `analytics_storage` signal"). Under this
  reading gtag.js does **not** load at all until choice ∈ {limited, all};
  there are zero requests to `googletagmanager.com` and `google-analytics.com`
  under essential / undecided, cookieless-ping mode is unreachable, and the
  DevTools filter in TC-S-007 scene 2 shows literally nothing.

The two conflict: the strict interpretation forbids the exact behaviour the
lenient interpretation relies on for §5.

**Decision.** **Strict interpretation wins**, decided by Sohail (verbal,
2026-09-09). Rationale: §3 and §11 are testable operational claims that will
be enforced by TC-S-007 scene 2; §5 documents Consent Mode v2 semantics
generally, but ABTalks does not need cookieless pings — no cross-user
modelling relies on them, and going stricter than the spec is only ever a
win for user trust and DPDP compliance.

**Consequence.** GA4Loader renders `null` unless
`ready && isProd && measurementId && choice ∈ {limited, all}`. When it does
render, defaults are `toGaConsent(choice)` (matching the actual choice),
not always ALL_DENIED — because we know consent is granted at mount time.
The `consent update` useEffect from the original plan is removed.

### 13.2 Downgrade handling — reload lives in the loader, not the provider

**The problem.** `next/script` injects a `<script>` tag on mount but does
**not** remove it on unmount. So under the strict gate, a
`limited/all → essential` transition can't be honoured by re-render alone:
the loader `return null`s on the next render, but gtag.js stays in the DOM
and keeps tracking for the rest of the session.

**Options considered.**

- **Fire `gtag('consent','update', ALL_DENIED)` on downgrade.** Best-effort;
  reduces to the lenient interpretation for the remainder of the session and
  violates §11.
- **Force a `window.location.reload()` on downgrade from
  `CookieConsentProvider.decide()`.** Guarantees §11, but couples the
  provider to an analytics concern — the provider is legal-compliance code
  and analytics has no business editing it.
- **Force a `window.location.reload()` from GA4Loader's useEffect.**
  Guarantees §11, keeps the coupling one-way (loader depends on provider,
  not the reverse). ✓

**Decision.** The reload lives in `GA4Loader`, driven by a `useRef` guard
inside a `useEffect` that watches `choice`. First observation
(`prev === undefined`) never reloads; equal `prev === next` never reloads;
only `{limited|all} → {essential|null}` transitions do. Pure predicate
`shouldReloadOnDowngrade` is extracted to `ga4-loader-gate.ts` so
`ga4-loader-logic.test.ts` covers every branch without React.
`CookieConsentProvider` is unchanged.

**Trade-off accepted.** A rare `limited/all → essential` transition causes a
visible page reload. This is disclosed to users in the updated privacy and
cookies policies (§4 GA4 bullet in cookies.md, §2.5 in privacy.md) as an
honesty and trust signal.
