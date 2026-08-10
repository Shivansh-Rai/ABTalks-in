# 059 — Legal & Privacy Compliance Hardening

> **Status: IMPLEMENTED** on branch `feat/legal-compliance-hardening` (commits `0110205`, `5295441`, `d14e0ba`, `624fb4c`, `ec64a55`).
>
> **Branch base correction:** cut from `feat/terms-privacy-consent`, **not** `master`. Plan 057 is unmerged, so `content/legal/`, `/terms` and `/privacy` do not exist on `master` — basing this work there would have broken every phase. The PR therefore targets `feat/terms-privacy-consent` (or rebase onto `master` once 057 lands).
>
> **Deviations from the plan as written**, all decided during implementation:
> 1. `src/lib/legal-constants.ts` `[new]` was added. Importing `@/lib/legal` from a Client Component pulled `node:fs/promises` into the browser bundle and failed the Turbopack build; client-safe constants had to be split out. `legal.ts` re-exports them so server callers are untouched.
> 2. The challenge day-page video was **left auto-loading** at the owner's direction. It is disclosed in the Privacy and Cookie policies instead of changed. `LiteYoutube` still moved to `components/shared` and is consent-aware for the program routes.
> 3. Consent gates the **YouTube preview thumbnail** (`i.ytimg.com`), not iframe auto-load. Auto-mounting a player on render is worse UX than the facade it would replace, and the thumbnail is the actual pre-consent call to Google.
> 4. `/ai-workshop` keeps its branded footer with legal links added inline; `AppFooter` returns the minimal strip for the other five funnel routes. The two workshop copyright lines were **not** deleted — that would have left those pages with no footer identity.
> 5. Admin status values are `PENDING` / `DONE` / `REJECTED` (the schema's actual `DataRightsRequestStatus`), not the `RESOLVED` named in §5.
> 6. `needsReconsent` swallows query errors and returns `false` — see the blocker below.
>
> **⚠️ Deployment blocker:** migration `20260808120000_legal_consent_and_rights` (from plan 057) has **never been applied** to the Neon database — `public.LegalConsent` does not exist. `npm run build` runs `prisma migrate deploy`, so a normal deploy applies it, but until then Phases 4 and 5 have no table to read. This was not run here: it is a state-changing command against a database shared by dev and prod.

---

## 1. Goal

Close the compliance gaps that plan `057-terms-privacy-consent` left open: publish the legal entity and a named grievance officer (required by DPDP 2023 / IT Rules 2021 / Consumer Protection E-Commerce Rules 2020), remove the self-defeating "draft pending counsel review" banner from the live docs, add the disclaimers and cookie/consent surface the product actually needs, and make data-rights requests visible to a human instead of accumulating unseen in a table.

Entity name, address, registration number and grievance officer name are **left blank as visible `<<FILL: …>>` markers** — they are not invented and not guessed.

---

## 2. Current behavior

Shipped by plan 057 and working — **do not rebuild any of this**:

- `/terms`, `/privacy` render markdown from `content/legal/` via `src/lib/legal.ts` → `src/components/legal/legal-document.tsx`.
- `/privacy/requests` writes a `DataRightsRequest` row (`noindex`).
- `LegalConsent` table records TERMS + PRIVACY rows with `ip` + `userAgent` on all seven signup funnels, via `src/features/legal/record-consent.ts`.
- `src/components/legal/legal-consent-fields.tsx` gates every funnel's submit button on three checkboxes.

Gaps this plan fixes:

| # | Gap | Evidence |
|---|-----|----------|
| 1 | No legal entity, address, or grievance officer anywhere | `content/legal/privacy.md:14` "entity details may be updated here when finalized" |
| 2 | Draft banner renders on the live public docs | `privacy.md:5`, `terms.md:5` |
| 3 | Certificates not disclaimed as non-accredited | `terms.md:52-54` (§6) is silent on accreditation |
| 4 | No indemnity clause; no statement that the Service is free | `terms.md` §11–12 have the liability cap but no indemnity counterpart |
| 5 | Synergy Points not disclaimed as non-currency | `terms.md:62-64` (§8) covers shipping only |
| 6 | DSAR requests trigger no email and have no admin UI | `src/app/actions/legal-actions.ts`; no admin page queries `dataRightsRequest` |
| 7 | Attribution cookies set before any consent | `middleware.ts:115` `withTracking` runs unconditionally |
| 8 | No footer legal links on six funnel routes | `src/components/shared/app-footer.tsx:140-148` returns `null` |
| 9 | MSG91 runtime script + `HackathonRemoval` PII retention undisclosed | `src/components/shared/phone-verify-field.tsx:109-118`; `prisma/schema.prisma:958` |
| 10 | Version bump never triggers re-acceptance | `TERMS_VERSION` stored per row, never compared |

**Accuracy note for the executor:** the employment-guarantee disclaimer **already exists** at `terms.md:33` (§3) and `terms.md:58` (§7). Do not add a duplicate — §5 only asks you to strengthen §7's wording in place.

---

## 3. Files to touch

### Phase 1 — legal content
| Path | | Note |
|---|---|---|
| `content/legal/privacy.md` | `[edit]` | Entity + grievance blocks, DPDP §13/§14 rights, MSG91 + HackathonRemoval + YouTube disclosures, drop draft banner, version bump |
| `content/legal/terms.md` | `[edit]` | Entity + grievance blocks, accreditation disclaimer, Synergy Points, fees, indemnity, notice-before-suit, drop draft banner, version bump |
| `content/legal/cookies.md` | `[new]` | Standalone cookie policy body |
| `src/lib/legal.ts` | `[edit]` | Version bump, `LEGAL_ENTITY` export, `LegalDocKind` widened to `"cookies"` |
| `docs/legal/business-decisions.md` | `[edit]` | Record the v2 decisions; keep the counsel caveat here |
| `docs/legal/data-practices-fact-sheet.md` | `[edit]` | Add `abtalks_consent` to the cookie table; note MSG91 script |

### Phase 2 — pages + footer
| Path | | Note |
|---|---|---|
| `src/app/cookies/page.tsx` | `[new]` | Server Component; renders `cookies.md` + client preferences button |
| `src/app/contact/page.tsx` | `[new]` | Server Component; renders `LEGAL_ENTITY` constants directly |
| `src/components/shared/app-footer.tsx` | `[edit]` | Replace `return null` with minimal legal strip; add Cookies + Contact to full footer |
| `src/app/ai-workshop/page.tsx` | `[edit]` | Remove local copyright footer (line ~417) |
| `src/app/ai-workshop/events/page.tsx` | `[edit]` | Remove local copyright footer (line ~128) |

### Phase 3 — cookie consent
| Path | | Note |
|---|---|---|
| `src/components/legal/cookie-consent-provider.tsx` | `[new]` | Client provider + context; reads `document.cookie` on mount |
| `src/components/legal/cookie-consent-modal.tsx` | `[new]` | Client blocking modal, three buttons |
| `src/components/legal/manage-cookies-button.tsx` | `[new]` | Client button for `/cookies` |
| `src/app/actions/legal-actions.ts` | `[edit]` | Add `setCookieConsentAction` |
| `src/lib/cookies.ts` | `[edit]` | Add `setSrcCookie`, `clearAttributionCookies` |
| `middleware.ts` | `[edit]` | Gate `withTracking` on the consent cookie |
| `src/app/layout.tsx` | `[edit]` | Mount provider + modal |
| `src/components/shared/lite-youtube.tsx` | `[new — moved]` | Moved from `src/components/program/lite-youtube.tsx` |
| `src/components/program/lite-youtube.tsx` | `[delete]` | Superseded by the shared copy |
| `src/components/challenge/day-page.tsx` | `[edit]` | Replace the auto-loading iframe at ~line 461 with `LiteYouTube` |
| program files importing `lite-youtube` | `[edit]` | Import path only |

### Phase 4 — DSAR visibility
| Path | | Note |
|---|---|---|
| `src/features/legal/notify-data-request.ts` | `[new]` | Email notification helper |
| `src/app/actions/legal-actions.ts` | `[edit]` | Fire notification after insert |
| `src/app/admin/data-requests/page.tsx` | `[new]` | Server Component admin list |
| `src/app/actions/legal-actions.ts` | `[edit]` | `resolveDataRightsRequestAction` (admin-only) |

### Phase 5 — re-acceptance
| Path | | Note |
|---|---|---|
| `src/features/legal/needs-reconsent.ts` | `[new]` | Compare latest consent version to constants |
| `src/components/legal/consent-refresh-banner.tsx` | `[new]` | Client banner + accept action |
| `src/app/actions/legal-actions.ts` | `[edit]` | `acceptCurrentLegalVersionsAction` |
| `src/app/(dashboard) layout` | `[edit]` | Mount banner for signed-in users |

---

## 4. Server vs Client

| Component | Boundary | Notes |
|---|---|---|
| `app/cookies/page.tsx` | **Server** | `async`, awaits `loadLegalMarkdown("cookies")` |
| `app/contact/page.tsx` | **Server** | Reads `LEGAL_ENTITY` — plain object, no client boundary |
| `manage-cookies-button.tsx` | **Client** | Only client island on `/cookies` |
| `cookie-consent-provider.tsx` | **Client** | `"use client"`, wraps `children` |
| `cookie-consent-modal.tsx` | **Client** | Consumes provider context |
| `lite-youtube.tsx` | **Client** | Already is; unchanged |
| `app-footer.tsx` | **Client** | Already is (`usePathname`) |
| `admin/data-requests/page.tsx` | **Server** | `requireAdmin` + Prisma `select` |
| `consent-refresh-banner.tsx` | **Client** | Receives `needsReconsent: boolean` from Server |

**Server → Client props crossing the boundary** — all plain serializable values, no functions, no icons, no class instances:
- `CookieConsentProvider` receives only `children`.
- `ConsentRefreshBanner` receives `needsReconsent: boolean`.
- `LiteYouTube` receives `videoId: string`, `title: string`.

---

## 5. Steps

### Phase 1 — legal content

**1.1 `src/lib/legal.ts`**

```ts
export const TERMS_VERSION = "2026-08-10";
export const PRIVACY_VERSION = "2026-08-10";
export const COOKIE_POLICY_VERSION = "2026-08-10";

export type LegalDocKind = "terms" | "privacy" | "cookies";

/** Single source of truth. The markdown docs repeat these literally
 *  (markdown cannot import) — update both together. */
export const LEGAL_ENTITY = {
  name: "<<FILL: registered entity legal name>>",
  tradingName: "ABTalks",
  address: "<<FILL: registered address>>",
  registrationNumber: "<<FILL: CIN / LLPIN / GSTIN, or 'Not applicable'>>",
  email: "team@abtalks.in",
  grievanceOfficer: {
    name: "<<FILL: grievance officer name>>",
    designation: "<<FILL: designation>>",
    email: "team@abtalks.in",
    acknowledgeWithin: "24 hours",
    resolveWithin: "15 days",
  },
} as const;
```

Widen the `loadLegalMarkdown` file map to include `cookies.md`.

**1.2 `content/legal/privacy.md`**

- Delete line 5 (`**Status:** Platform draft pending counsel review…`) entirely.
- Set `**Version:**` and `**Effective date:**` to `2026-08-10`.
- Replace §1 "Who we are" body with an entity block carrying the `<<FILL>>` markers verbatim from `LEGAL_ENTITY`: legal name, trading name, registered address, registration number, contact email.
- Add a new **§1.1 Grievance Officer** immediately after: name, designation, email, and the line *"We acknowledge grievances within 24 hours and aim to resolve them within 15 days."*
- **§2.5 cookie table** — add two rows: `abtalks_consent` (stores your cookie choice, 180 days, not httpOnly) and a note that the **MSG91 OTP widget loads a script from `verify.msg91.com` when you use phone verification**, and may set its own storage under that domain.
- Add to §2.5: YouTube embeds use `youtube-nocookie.com` and contact Google only when you press play.
- **§7 Retention** — replace the vague "removal logs… may be retained for integrity" with the specific truth: hackathon removal records retain **name, email, phone, college and graduation year after the participant record is deleted**, for integrity and anti-abuse, for up to **24 months**.
- **§10 Your rights** — append the two missing DPDP rights:
  - *Right to grievance redressal (DPDP §13)* — contact the Grievance Officer first; if unsatisfied, escalate to the Data Protection Board of India.
  - *Right to nominate (DPDP §14)* — nominate another person to exercise your rights in the event of death or incapacity; request via `/privacy/requests`.
- Add a short **Breach notification** line to §8: we will notify affected users and the Data Protection Board as required by law.

**1.3 `content/legal/terms.md`**

- Delete line 5 (draft banner). Bump version/effective date to `2026-08-10`.
- Expand the preamble (line 7) into an entity block matching Privacy §1, with the same `<<FILL>>` markers.
- Add **§16.1 Grievance Officer** (or fold into §16 Contact) with the same officer details and timelines.
- **§6 Certificates** — append: *"Certificates issued by ABTalks are certificates of participation and completion. They are **not** accredited academic or professional qualifications, confer no academic credit, and are not recognised by any university, statutory body, or regulator."*
- **§7** — strengthen in place (do **not** add a duplicate disclaimer; one already exists at §3 and §7): make explicit that inclusion in the talent pool, a `/r/[token]` report, or the jobs board is an introduction only, that ABTalks does not screen or endorse employers, and that no interview, offer, or outcome is warranted.
- **§8 Marketplace** — append a Synergy Points clause: points are a promotional loyalty balance, **not currency, not a payment instrument, and carry no cash value**; non-transferable; may be adjusted, expired or revoked for error or abuse; fulfilment is discretionary and currently India-only.
- **New §9 Fees** (renumber the rest): the Service is currently provided **free of charge**; no fees are collected and no payment instruments are processed. If paid offerings are introduced, separate terms including cancellation and refund rights will be presented at the point of purchase.
- **New section, after Limitation of liability — Indemnity**: you agree to indemnify and hold harmless ABTalks and its operators against claims arising from your content, your breach of these Terms, or your unlawful use of the Service.
- **§14 Governing law** — append a notice-before-suit clause: before initiating proceedings, the parties will give **30 days' written notice** to the other and attempt good-faith resolution. Governing law and India jurisdiction stay as-is, including the existing mandatory-consumer-protection carve-out.
- Add `/cookies` and `/contact` to the §16 contact links.

**1.4 `content/legal/cookies.md`** `[new]` — version header, what cookies are, the full table (Auth.js session, `abtalks_ref`, `abtalks_src`, `abtalks_consent`, MSG91 widget storage), what each consent choice does (mirror the table in Phase 3 exactly), how to change your choice, and how to clear cookies in the browser. Link back to `/privacy`.

**1.5 `docs/legal/business-decisions.md`** — add a v2 row block dated 2026-08-10: entity now published (pending `<<FILL>>`), grievance officer published, cookie banner **now required** (supersedes the v1 "not required" row — mark the old row superseded rather than deleting it), consent version `2026-08-10`. Keep the counsel caveat in this file.

**1.6 `docs/legal/data-practices-fact-sheet.md`** — add `abtalks_consent` to the cookie table and the MSG91 runtime script to the processors/scripts list.

### Phase 2 — pages + footer

**2.1** `src/app/cookies/page.tsx` — Server Component mirroring `src/app/privacy/page.tsx` exactly: `metadata` (`"Cookie Policy · ABTalks"`), `loadLegalMarkdown("cookies")`, `<LegalDocument />`, header bar linking `/privacy` and `/terms`. Render `<ManageCookiesButton />` beneath.

**2.2** `src/app/contact/page.tsx` — Server Component. No markdown: render `LEGAL_ENTITY` fields as a definition list (entity, trading name, registered address, registration number, email), then a Grievance Officer card (name, designation, email, 24h/15d commitment), then a link to `/privacy/requests` for data-rights requests. `metadata: "Contact · ABTalks"`.

**2.3** `src/app/actions/legal-actions.ts` and `src/components/legal/manage-cookies-button.tsx` — the button calls the provider's reopen function from context.

**2.4** `src/components/shared/app-footer.tsx`
- Replace the `return null` at lines 140–148 with a minimal strip: one centered line containing `Terms · Privacy · Cookies · Contact` plus `© {year} ABTalks`. No social icons, no three-column grid, neutral muted styling that does not fight the funnel page designs. Keep the same `pb-16 md:pb-0` bottom-nav clearance.
- In the full footer, add `Cookies` (`/cookies`) and `Contact` (`/contact`) to the existing `<nav aria-label="Legal">` at lines 168–181.
- Use `buttonVariants` on `<Link>` if any of these become buttons — never `<Button asChild>` or `<Button render={<Link>}>`.

**2.5** Remove the local copyright footers from `src/app/ai-workshop/page.tsx` (~line 417) and `src/app/ai-workshop/events/page.tsx` (~line 128) so the strip does not double up. Verify visually that nothing else on those pages depended on that markup.

### Phase 3 — cookie consent

**3.1 Cookie contract** (must match everywhere):

- Name: `abtalks_consent`
- Value: `` `${choice}.${COOKIE_POLICY_VERSION}` `` where choice ∈ `all` | `limited` | `essential`
- `httpOnly: false` (the client must read it), `sameSite: "lax"`, `secure` in production, `path: "/"`, `maxAge` 180 days

| Choice | Effect |
|---|---|
| **Allow all** (`all`) | Auth.js session + `abtalks_ref` / `abtalks_src` attribution + YouTube embeds auto-load |
| **Limited** (`limited`) | Session + attribution (first-party only); embeds stay click-to-load — nothing contacts Google until the user presses play |
| **Deny** (`essential`) | Session cookie only; middleware sets no attribution cookies and expires any existing ones; embeds click-to-load |

No database row is written. For anonymous visitors there is no identifier, and logging an IP for every visitor is itself a privacy cost. The cookie **is** the record; a `COOKIE_POLICY_VERSION` change re-prompts because the suffix no longer matches.

**3.2 `src/lib/cookies.ts`** — add, mirroring the existing `setRefCookie` shape and keeping its `length > 32` and `/^[a-zA-Z0-9_-]+$/` validation:
- `export const SRC_COOKIE_NAME = "abtalks_src"` and `setSrcCookie(slug: string)` — 30-day maxAge, `httpOnly: true`, lowercases the value (match `middleware.ts:65`).
- `clearAttributionCookies()` — deletes both.
- `setConsentCookie(choice)` per the contract above.

**3.3 `src/app/actions/legal-actions.ts`** — add `setCookieConsentAction`:
- Zod input: `{ choice: z.enum(["all","limited","essential"]), ref: z.string().max(32).nullable(), src: z.string().max(32).nullable() }`.
- Sets the consent cookie. If `all` or `limited`, calls `setRefCookie` / `setSrcCookie` with the passed values (helpers self-validate). If `essential`, calls `clearAttributionCookies()`.
- Returns the standard envelope `{ ok: true, data: { choice } } | { ok: false, message }`.

**3.4 `middleware.ts`** — **edge-safe, imports stay `next-auth` + `next/server` only. No `@/lib/*`.**
- Add `const CONSENT_COOKIE_NAME = "abtalks_consent";` and a local `readConsent(req)` that returns `req.cookies.get(CONSENT_COOKIE_NAME)?.value?.split(".")[0] ?? null`.
- In `withTracking`: if consent is `null` (undecided) or `"essential"`, do **not** set `abtalks_ref` / `abtalks_src`. If `"essential"` and either cookie exists, delete it on the response.
- Only when consent is `"all"` or `"limited"` does the existing `applyRefCookie` / `applySourceCookie` behaviour run — first-touch-wins for `abtalks_src` is preserved unchanged.
- Redirect branches keep calling `withTracking`, unchanged in shape.

**3.5 `cookie-consent-provider.tsx`** — `"use client"`. State `choice: Choice | null` where `null` means *not yet read*. On mount, parse `document.cookie`; if the value's version suffix ≠ `COOKIE_POLICY_VERSION`, treat as undecided. Expose `{ choice, isOpen, open(), decide(choice) }` via context. `decide` reads `ref` and `s` from `window.location.search`, calls `setCookieConsentAction`, then sets local state. Initial state `null` avoids any hydration mismatch — the modal simply does not render on the server pass.

**3.6 `cookie-consent-modal.tsx`** — `"use client"`. Renders only when `choice === null || isOpen`. **Centre-screen blocking dialog**: no close X, no Esc dismiss, no outside-click dismiss, focus trapped, `role="dialog"` + `aria-modal="true"` + `aria-labelledby`. Three clearly-labelled buttons — **Allow all**, **Limited**, **Deny** — with the one-line effect of each rendered beside it, plus links to `/cookies` and `/privacy`. Because middleware no longer sets attribution before a decision, the modal must render on first paint while `?ref=` / `?s=` are still in the URL.

**3.7 `src/app/layout.tsx`** — wrap `children` in `<CookieConsentProvider>` and render `<CookieConsentModal />` inside it. **Do not call `cookies()` in the root layout** — that would opt the whole app into dynamic rendering and deopt every static marketing page. The provider reads the cookie client-side for exactly this reason.

**3.8 Embeds** — `git mv src/components/program/lite-youtube.tsx src/components/shared/lite-youtube.tsx`, update the program import sites (path only, no behaviour change), then replace the auto-loading iframe at `src/components/challenge/day-page.tsx:461` with `<LiteYouTube />`. Inside `LiteYouTube`, auto-activate the iframe on mount **only** when consent is `"all"`; otherwise keep the existing click-to-load facade.

### Phase 4 — DSAR visibility

**4.1** `src/features/legal/notify-data-request.ts` — send to `team@abtalks.in` via the existing `src/lib/email.ts` (Resend). Subject includes the request type; body has email, type, message, and a link to `/admin/data-requests`.

**4.2** In `submitDataRightsRequestAction`, call it **after** the insert succeeds, wrapped in `try/catch` that logs via `lib/logger.ts` — a mail failure must never fail the user's request or change the returned envelope.

**4.3** `src/app/admin/data-requests/page.tsx` — Server Component behind the existing `requireAdmin` guard from `src/lib/admin-auth.ts`. Prisma query uses `select` (no full-record return). Columns: email, type, message, status, `createdAt`, age in days with a visual flag past 30 days. A `resolveDataRightsRequestAction` (admin-guarded, Zod-validated) flips status to `RESOLVED`. Link it from the existing admin nav.

### Phase 5 — re-acceptance

**5.1** `src/features/legal/needs-reconsent.ts` — given a `userId`, `select` the latest `LegalConsent` version per document and return `true` if either is behind `TERMS_VERSION` / `PRIVACY_VERSION`.

**5.2** `consent-refresh-banner.tsx` — `"use client"`, receives `needsReconsent: boolean`. Dismissible per session, links to `/terms` and `/privacy`, and an **I accept** button calling `acceptCurrentLegalVersionsAction`, which reuses `recordConsent` from `src/features/legal/record-consent.ts` with a new `ConsentSource` value (`reconsent`) to write fresh TERMS + PRIVACY rows.

**5.3** Mount in the signed-in dashboard layout, computing `needsReconsent` server-side and passing the boolean down.

---

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** fill in the `<<FILL: …>>` markers. No invented entity name, address, registration number, or officer name — per `docs/legal/business-decisions.md:9`. They must remain literally visible in the diff.
- **DO NOT** import `@/lib/*` in `middleware.ts` or anything it imports. Only `next-auth` and `next/server`. The consent constants must be duplicated locally inside `middleware.ts` — this duplication is deliberate; do not "fix" it by extracting a shared module.
- **DO NOT** add a Prisma model, field, enum value, or migration. This plan is schema-free by design. The one exception is the `ConsentSource` enum value in Phase 5 — **stop and ask** before adding it; if `ConsentSource` is a Prisma enum, reuse an existing value instead.
- **DO NOT** call `cookies()` or `headers()` in `src/app/layout.tsx`.
- **DO NOT** write a `LegalConsent` row for cookie choices.
- **DO NOT** add `requireRole` / `requireAdmin` to any public surface — `/cookies`, `/contact`, `/terms`, `/privacy` are public. Only `/admin/data-requests` is guarded.
- **DO NOT** add a duplicate employment-guarantee disclaimer; one already exists at `terms.md:33` and `terms.md:58`.
- **DO NOT** create `/refunds` or `/shipping` pages. No payment gateway exists in the codebase; the new Terms §8/§9 clauses cover it.
- **DO NOT** add analytics, a pixel, or any new third-party SDK. The consent buckets are built to accommodate one later; nothing gets wired in now.
- **DO NOT** use `<Button asChild>` or `<Button render={<Link>}>` — use `buttonVariants` directly on `<Link>`.
- **DO NOT** use `console.error` — use `lib/logger.ts`.
- **DO NOT** return full Prisma records — always `select`.
- **DO NOT** create new abstraction files beyond those listed in §3.
- **DO NOT** make the consent modal dismissible without a choice (no X, no Esc, no outside-click) — a dismissible modal that still sets cookies is worse than no modal.
- If a build error contradicts an assumption in this plan, **trust the error**, gather data, and report back — do not defend the plan's choice.

---

## 7. DB safety

**No schema change, no migration, no seed, no data backfill.** Nothing in this plan touches `prisma/schema.prisma`. The cookie choice lives in a cookie, re-acceptance reuses the existing `LegalConsent` table, and the admin page only reads `DataRightsRequest` and updates its `status`.

If Phase 5 turns out to need a new `ConsentSource` enum value, **stop and ask** — that would convert this into a migration and requires a commit checkpoint plus a Neon branch snapshot first.

---

## 8. Verification

**Build**
- `npm run build` and `npx tsc --noEmit` both pass, no `any`.
- Middleware still builds under the Edge 1 MB limit; confirm `middleware.ts` imports are `next-auth` + `next/server` only.

**Content**
- `/terms`, `/privacy`, `/cookies`, `/contact` all render, show `2026-08-10`, and **no draft banner appears on any of them**.
- `<<FILL: …>>` markers are visibly present on `/contact`, `/terms`, `/privacy` — this is expected, not a bug.

**Footer**
- Legal links visible on all six previously-bare routes: `/ai-workshop`, `/ai-cohort-register`, `/ai-cohort-india`, `/program`, `/talent`, `/hackathon`.
- No duplicated copyright line on `/ai-workshop` or `/ai-workshop/events`.
- Bottom-nav clearance on mobile unchanged (no footer hidden behind the nav bar).

**Consent** (fresh incognito each time)
- Visit `/?ref=TEST123&s=demo` → blocking modal appears; Esc and outside-click do nothing.
- **Deny** → devtools shows only the Auth.js cookie; no `abtalks_ref`, no `abtalks_src`.
- **Limited** → both attribution cookies present; a challenge day page video stays click-to-load.
- **Allow all** → both attribution cookies present with correct `maxAge`; video auto-loads.
- Reload after any choice → no re-prompt.
- `/cookies` → **Manage preferences** reopens the modal; changing Allow-all → Deny expires both attribution cookies.
- Referral still credits correctly end-to-end: land on `/?ref=<valid code>`, Allow all, register, confirm the `Referral` row is created.

**DSAR**
- Submit at `/privacy/requests` → row created, notification email received at `team@abtalks.in`, row visible at `/admin/data-requests` with correct age.
- Non-admin hitting `/admin/data-requests` is denied.
- Temporarily break the email key → request still succeeds, error logged via `lib/logger.ts`.

**Re-acceptance**
- Existing signed-in test user (`@abtalks.dev`) sees the banner; accepting writes two new `LegalConsent` rows at `2026-08-10` and the banner does not return on reload.

**Changed files** — exactly those in §3, nothing else. In particular `prisma/schema.prisma` must be **unchanged**.

**Changelog** — append one dated line under `## Pending reconcile` in `docs/CHANGELOG.md`, per `.cursorrules`.

---

## 9. Commit message and PR

Branch: `feat/legal-compliance-hardening` off `master`. Suggested commits, one per phase.

```
feat(legal): publish entity + grievance officer, add cookie consent and DSAR visibility

- Remove "draft pending counsel review" banner from public /terms and /privacy
- Add data fiduciary identification and Grievance Officer blocks (DPDP 2023,
  IT Rules 2021, Consumer Protection E-Commerce Rules 2020)
- Add DPDP s13 grievance redressal and s14 nomination rights
- Disclose MSG91 runtime script, HackathonRemoval PII retention, YouTube embeds
- Terms: certificate non-accreditation, Synergy Points non-currency, fees,
  indemnity, 30-day notice before suit
- New /cookies and /contact pages; legal links on the six funnel routes that
  previously had none
- Blocking cookie consent modal (Allow all / Limited / Deny) that actually gates
  attribution cookies in middleware and third-party embeds
- Data-rights requests now email the team and have an admin review page
- Re-acceptance banner when legal versions are bumped

No schema change. Entity details intentionally left as <<FILL>> placeholders.
```

**PR body must include this section verbatim:**

> ## ⚠️ Still missing — blocked on entity details
>
> This PR **must not be merged to production** until the following are supplied and the `<<FILL: …>>` markers replaced. They are currently rendered literally on `/contact`, `/terms` and `/privacy`.
>
> - [ ] Registered entity legal name
> - [ ] Registered address
> - [ ] Registration number (CIN / LLPIN / GSTIN, or confirmation that none applies)
> - [ ] Grievance Officer name
> - [ ] Grievance Officer designation
>
> Source of truth is `LEGAL_ENTITY` in `src/lib/legal.ts`; the same values are repeated literally in `content/legal/terms.md` and `content/legal/privacy.md` because markdown cannot import — **update all three together**.
>
> These are legally required under India's DPDP Act 2023, the IT Rules 2021, and the Consumer Protection (E-Commerce) Rules 2020. Everything else in this PR is complete and independently testable.
