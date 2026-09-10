# 120 — Profile Performance: search appearances + recruiter actions

## 1. Goal

Give the candidate two real numbers in the profile sidebar: how many recruiters
opened their details on `/hire`, and how many unlocked their resume — both over
a rolling 90 days, both derived from events the platform actually records rather
than a placeholder constant.

## 2. Current behavior

**The panel does not exist.** "Profile performance" and its two figures were
removed from `ProfileCard` earlier (along with the `PROFILE_PERFORMANCE`
placeholder constant in `app/profile/page.tsx` and every `pw-performance-*` /
`pw-col-value` rule in `profile-wizard.css` — `grep -c` returns 0). This plan
re-adds it, wired to data.

**Neither event is recorded anywhere.**

*Search appearance.* On `/hire`, "View more details" and a click on the card
body both call `onOpen` (`desk-match-card.tsx:145, 220, 257, 360`) →
`match-results.tsx:88` → `setOpenMatch` in `scout-chat.tsx:1035`, which opens
`CandidateInspector`. That is **pure client state** — no server round trip, so
nothing observes it today.

*Resume unlock.* The inspector's Resume button
(`candidate-inspector.tsx:263`) calls `setGate("resume")`, which opens the
`SubscriptionGate` dialog **unconditionally**. It never opens a resume.
`evidenceResumeHref` and `/hire/evidence` still exist but the button no longer
points at them.

**There is no subscription system.** `checkPlanLimit`
(`features/hire/entitlements.ts`) is a stub returning
`{ allowed: false, reason: "NOT_IMPLEMENTED" }`; `RecruiterProfile` carries
`approved` and `setupStep` and no plan, price or billing column; a
schema-wide grep for `subscription|planKey|isPro|billing` finds only
`NewsletterSubscription`. The "Pro" paywall is UI copy.

**The only real unlock that exists** is admin-granted `CONTACT_SHARED`
(`hire-request-actions.ts:265` `decideEngagementAction`), which is what
`contact-access.ts` reads to release email and phone.

**Guests can do all of this.** `/hire` renders for `session === null`
(`app/hire/page.tsx:15`) with a whole guest cart/session subsystem. There is no
stable guest identifier: `guest-session.ts` stores a spec and messages, not an
id.

**No reusable event table.** `SynergyEvent` is points, `RateLimitEvent` is
throttling, `VirtualCandidateEvent` is a different subsystem.

## 3. Decisions (owner-confirmed)

| Question | Decision |
| --- | --- |
| Search appearance | Recruiter opens the candidate's details (the inspector), not a list impression |
| Dedupe | **Once per viewer per candidate per day** |
| Guests | **Counted**, alongside signed-in recruiters |
| Window | **Rolling 90 days** |
| Resume unlock | **Do not build billing.** Ship a seam now; the counter increments whenever a resume is genuinely unlocked, today or later |

### 3a. What "resume unlocked" means in this plan

One recorder, `recordResumeUnlock()`, and one seam, `canViewResume()`.

- Today `canViewResume()` returns the only honest answer available:
  `hasContactAccess(recruiterUserId, candidateUserId)` — the admin
  `CONTACT_SHARED` grant. The recorder is called from that transition, so the
  number is real from day one and small.
- The Resume button and its paywall are **left exactly as they are**. This plan
  does not open a resume to anyone who could not already see the candidate's
  contact details, because a resume carries the phone and email that
  `contact-access.ts` exists to protect.
- When a plan/billing system lands, it calls the same `recordResumeUnlock()`
  from the resume-view path and changes `canViewResume()`. **No counter work is
  needed then** — that is the whole point of the seam.

### 3b. Viewer identity without a new tracking cookie

Dedupe needs to recognise "the same viewer, same candidate, same day".

- Signed-in recruiter → `viewerKey = "u:<userId>"`.
- Guest → `viewerKey = "g:" + sha256(dailySalt + ip + userAgent).slice(0,32)`,
  where `dailySalt` is `HIRE_VIEW_SALT` + the IST date.

The hash rotates daily, so it dedupes within the day and **cannot be linked
across days or to a person**. Deliberately not a cookie: the repo already runs a
DPDP consent regime (`allowsAttribution`, `CONSENT_COOKIE_NAME`), and a new
persistent visitor id would have to answer to it. A daily rotating hash is not a
persistent identifier and needs no consent.

Raw IP is never stored — only the digest.

## 4. Files to touch

**Schema**

- `prisma/schema.prisma` `[edit]` — `model CandidateProfileEvent` + `enum CandidateProfileEventType { DETAIL_VIEW, RESUME_UNLOCK }`.
- `prisma/migrations/NNN_candidate_profile_event/migration.sql` `[new]`.

**Recording (server)**

- `src/features/profile/profile-events.ts` `[new]` — `recordDetailView()`, `recordResumeUnlock()`, `viewerKeyFor()`. The only writer.
- `src/app/actions/hire-view-actions.ts` `[new]` — `recordCandidateViewAction(candidateRef)`: a Server Action callable by guests, resolves the ref → `userId`, then records. Fire-and-forget, never throws into the UI.
- `src/app/actions/hire-request-actions.ts` `[edit]` — call `recordResumeUnlock()` when `decideEngagementAction` transitions to `CONTACT_SHARED`.
- `src/features/hire/entitlements.ts` `[edit]` — add the documented `canViewResume()` seam.

**Reading (server)**

- `src/features/profile/get-profile-performance.ts` `[new]` — two `count()` queries over the 90-day window.

**UI**

- `src/components/hire/scout-chat.tsx` `[edit]` — call the action in `setOpenMatch`.
- `src/components/profile/profile-card.tsx` `[edit]` — re-add the performance panel.
- `src/components/profile/profile-wizard.css` `[edit]` — re-add the `pw-performance-*` block.
- `src/app/profile/page.tsx` `[edit]` — read the counts, pass them down.
- `src/components/profile/profile-wizard.tsx` `[edit]` — thread the prop.

**Tests**

- `src/features/profile/profile-events.test.ts` `[new]`.

## 5. Server vs Client

| Component | Kind | Note |
| --- | --- | --- |
| `profile-events.ts`, `get-profile-performance.ts` | server-only | `import "server-only"` |
| `hire-view-actions.ts` | Server Action | must work with **no session** |
| `scout-chat.tsx` | client | calls the action; must not await it in the click path |
| `ProfileCard` | client | receives two plain numbers |

Only `{ searchAppearances: number; recruiterActions: number }` crosses the
RSC boundary — no functions, no dates, no dossiers.

## 6. Steps

1. **Schema.** `CandidateProfileEvent { id, candidateUserId, type, viewerKey, occurredAt }`, with `@@unique([candidateUserId, type, viewerKey, dayKey])` where `dayKey` is a stored `YYYY-MM-DD` IST string. The unique constraint **is** the per-day dedupe — an upsert that hits it is a no-op, so no read-then-write race. Index `[candidateUserId, type, occurredAt(sort: Desc)]` for the windowed count.
2. **`profile-events.ts`.** `viewerKeyFor()` per §3b; `recordDetailView` / `recordResumeUnlock` do one `upsert` inside try/catch and log-and-swallow on failure. Analytics must never break a recruiter's click or an admin's decision.
3. **`hire-view-actions.ts`.** Zod-validate the ref, `decodeCandidateRef` → userId, ignore `SAMPLE:` refs, skip when the viewer *is* the candidate (self-views are not interest), then record. Always returns `{ ok: true }`.
4. **`scout-chat.tsx`.** In `setOpenMatch`, `void recordCandidateViewAction(match.candidateRef)` — not awaited, so the panel opens at the same speed.
5. **Resume seam.** Add `canViewResume(recruiterUserId, candidateUserId)` to `entitlements.ts`, delegating to `hasContactAccess` today, with a comment naming this plan and what changes when billing lands. Call `recordResumeUnlock()` from the `CONTACT_SHARED` branch of `decideEngagementAction`, inside the existing transaction's success path.
6. **`get-profile-performance.ts`.** Two `prisma.candidateProfileEvent.count()` calls filtered by type and `occurredAt >= now - 90d`.
7. **Profile page.** Read it alongside the existing `Promise.all`, `.catch()` to `{ searchAppearances: 0, recruiterActions: 0 }` like the other degradable reads.
8. **Panel.** Re-add the markup and CSS, with a "Last 90 days" caption so the number is honest, and drop the old `PROFILE_PERFORMANCE` placeholder for good.

## 7. Guardrails for Cursor (DO NOT)

- **DO NOT** build billing, plan storage, or a subscription model. The seam is the deliverable.
- **DO NOT** change what the Resume button does or open a resume to anyone who cannot already see that candidate's contact details.
- **DO NOT** store a raw IP or user agent. Only the daily digest.
- **DO NOT** set a new persistent visitor cookie — that would pull this into the DPDP consent flow.
- **DO NOT** let a recording failure surface to the user. Every call is fire-and-forget inside try/catch.
- **DO NOT** await the view recorder in the click handler; the inspector must open instantly.
- **DO NOT** count `SAMPLE:` refs or a candidate viewing themselves.
- **DO NOT** put the counts on any recruiter surface — they are the candidate's own numbers.
- **DO NOT** reuse `SynergyEvent`; it is points and awards, not analytics.

## 8. DB safety

One new table and one new enum. Additive, no existing table altered, no
backfill — counts start at zero on the day this ships, which is honest and needs
no disclaimer beyond the "Last 90 days" caption.

Commit checkpoint first; snapshot a Neon child branch; note the commit hash;
`npx prisma migrate deploy` against the branch and verify the unique constraint
holds before production.

## 9. Verification

`npx tsc --noEmit`, `npx eslint`, plus `profile-events.test.ts`:

- `viewerKeyFor` returns a stable key for the same signed-in user, and the same key for the same guest twice on one day.
- Two guest keys differ once the day salt changes.
- Neither key contains a raw IP or user agent.
- The recorder never throws when the write fails.
- Source scan: `profile-events.ts` is the only file writing `candidateProfileEvent`.
- Source scan: no recruiter surface reads it.

Manual:

1. Recruiter A opens candidate X's details 5× in one day → Search Appearances = 1. Recruiter B opens it → 2.
2. Same recruiter returns the next day → 3.
3. A logged-out guest opens X → counts.
4. X opens their own card → does not count.
5. Admin sets an engagement for X to CONTACT_SHARED → Recruiter Actions = 1; setting it again does not double-count.
6. A candidate with no activity sees `0` and `0`, not a placeholder.
7. Panel shows "Last 90 days".

## 10. Commit message

```
feat(profile): wire Profile Performance to real recruiter events

Search Appearances counts a recruiter opening the candidate's details on
/hire; Recruiter Actions counts a genuine resume unlock. Both are deduped
per viewer per candidate per day and reported over a rolling 90 days,
from a new CandidateProfileEvent table.

Guests are counted via a daily-rotating hash of IP + user agent rather
than a new tracking cookie, so nothing persistent identifies them and the
DPDP consent flow is untouched. No raw IP is stored.

No billing is built. Resume unlocks go through one canViewResume() seam
that today delegates to the existing CONTACT_SHARED grant; when a plan
system lands it calls the same recorder and the counter needs no change.
```

## 11. Open question for the owner

The panel says **"Search appearances"**, which on Naukri means *appeared in a
recruiter's result list* — an impression. This plan counts *details opened*,
which is a stronger, rarer signal and will show a much smaller number.

Either is defensible; they should not be confused. Options: keep the count and
rename the tile to **"Profile views"**, or keep the label and additionally
record a `SEARCH_IMPRESSION` event when a card is rendered in results. Flagging
rather than choosing — the label is a product call.
