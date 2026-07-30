# 049 — Explore tab in bottom nav, Mission into the hamburger

## 1. Goal

Give enrolled users a permanent way to find the other tracks. Replace the
Mission tab in the mobile bottom nav with an **Explore** tab backed by a new
`/explore` page listing all four tracks, and move Mission into the mobile
hamburger where it belongs.

## 2. Current behavior

**Track discovery is modal-only.** `src/app/dashboard/page.tsx` renders
`HackathonPromoModal` **twice** (lines 293, 353), `ClaudeEnrollmentBanner`
three times (238, 276, 342), and `ClaudeChallengeModal` once (351). Dismiss
them and there is **no path at all** to `/hackathon`, `/ai-workshop`,
`/challenges`, or `/claude-signup`.

**Nothing in either nav points to a track.**
- `bottom-nav.tsx:12-17` — `Home /dashboard`, `Jobs /jobs`,
  `Rewards /marketplace`, `Mission /mission`, `Profile /profile`.
- `app-header.tsx:100,125,141` — `/dashboard`, `/jobs`, `/admin` only.
- `mobile-sidebar.tsx` — Marketplace, Admin (conditional), Profile, Report an
  Issue, Logout. **No Mission.**

**Mission is in three places today:**

| Location | Visibility |
|---|---|
| `bottom-nav.tsx:15` | mobile only (bottom nav is mobile) |
| `app-header.tsx:201` | desktop only — the item carries `className="hidden md:flex"` |
| `landing-hub.tsx:249` | public footer |

So on mobile, Mission occupies one of only five bottom-nav slots; on desktop it
already lives in the header dropdown. Moving it to `MobileSidebar` makes the two
platforms symmetric and frees the slot.

**Multi-enrollment is supported.** `Enrollment` is unique on
`[userId, challengeId]` and `getUserActiveEnrollments` returns an **array**, so
a user can hold several tracks at once. Explore is "add a track", not "switch".
`ChallengeSwitcher` (`shared/challenge-switcher.tsx`, rendered in `AppHeader`)
already handles switching between tracks a user is *in* — Explore must not
duplicate it.

## 3. Files to touch

- `src/app/explore/page.tsx` — `[new]` the Explore page. Server Component.
- `src/components/explore/track-list.tsx` — `[new]` renders both sections. Server Component.
- `src/components/explore/track-row.tsx` — `[new]` one row. Server Component.
- `src/components/shared/bottom-nav.tsx` — `[edit]` swap the Mission tab for Explore.
- `src/components/shared/mobile-sidebar.tsx` — `[edit]` add Our Mission.
- `middleware.ts` — `[edit]` add `"/explore"` to `protectedPaths`.
- `src/app/dashboard/page.tsx` — `[edit]` remove `HackathonPromoModal`: import (57) + 2 usages (293, 353).

### Not touched
`app-header.tsx` (its desktop Mission item stays), `challenge-switcher.tsx`,
`landing-hub.tsx`, `prisma/schema.prisma`, `src/components/ui/*`.

## 4. Server vs Client

| Component | Type | Note |
|---|---|---|
| `app/explore/page.tsx` | **Server** | `auth()`, `getUserActiveEnrollments()`, `isClaudeEnabled()` |
| `TrackList` | **Server** | pure markup |
| `TrackRow` | **Server** | one `<Link>` per row |
| `BottomNav` | Client | already client — only the `tabs` array changes |
| `MobileSidebar` | Client | already client — one item added |

`TrackRow` takes `{ icon: "code" | "sparkles" | "bolt" | "play"; … }` — a
**string key**, mapped to a lucide component inside the row. Do not pass icon
components across a boundary. `TrackList` takes plain data only.

## 5. Steps

1. **`middleware.ts`** — add `"/explore"` to `protectedPaths`. It sits beside
   `/dashboard` in the logged-in shell and must not be public. No other change
   to this file.

2. **`bottom-nav.tsx`** — in the `tabs` array (lines 12–17) replace
   ```ts
   { href: "/mission", label: "Mission", Icon: Compass },
   ```
   with
   ```ts
   { href: "/explore", label: "Explore", Icon: Compass },
   ```
   Keep the position (third of five in the mockup order is fine either way —
   do **not** reorder the other four). `Compass` is already imported; no import
   changes. Tab count stays 5, so the animated indicator measuring logic needs
   no adjustment.

   `isTabActive` needs no special case — the default
   `pathname === href || pathname.startsWith(href + "/")` is correct for
   `/explore`.

3. **`mobile-sidebar.tsx`** — add an "Our mission" item linking to `/mission`,
   placed between Profile and Report an Issue. Match the existing item markup
   exactly (same padding, icon size, text size); use the `Compass` icon from
   `lucide-react`. This restores mobile access to Mission, which step 2 removes.

   **Do this in the same commit as step 2.** Shipping step 2 alone strands
   `/mission` with no mobile entry point at all.

4. **`app/explore/page.tsx`** — Server Component:
   ```ts
   const session = await auth();          // middleware guarantees a session
   const enrollments = await getUserActiveEnrollments(session.user.id);
   const claudeEnabled = isClaudeEnabled();
   ```
   Render `<AppHeader />` as the other logged-in pages do, then `<TrackList />`.

5. **`track-list.tsx`** — two sections:

   **"Your tracks"** — one `TrackRow` per entry in `enrollments`, showing
   `Day {daysCompleted} · {currentStreak}-day streak` and an "Active" pill.
   Each links to `/dashboard?challenge={id}`. Omit the whole section when
   `enrollments` is empty.

   **"Open to join"** — the fixed catalogue below, minus any track the user is
   already enrolled in. Match on `domain`, not on title.

   | Track | href | Support line | Icon key | Shown |
   |---|---|---|---|---|
   | 60-day challenge | `/challenges` | Pick AI, Data Science or SE | `code` | unless enrolled in `SE`/`DS`/`AI` |
   | Claude challenge | `/claude-signup` | Build with Claude · 60 days | `sparkles` | only when `claudeEnabled` **and** not enrolled in `CLAUDE` |
   | Vibe code hackathon | `/hackathon` | 48 hours · teams of 3 | `bolt` | always |
   | Free AI bootcamp | `/ai-workshop` | Live 1-hour session | `play` | always |

   If "Open to join" ends up empty, render a single muted line —
   "You're in everything we run right now." Do not render an empty heading.

6. **`track-row.tsx`** — props
   `{ href; title; support; icon; badge?: { label: string; tone: "success" | "neutral" } }`.
   One `<Link>` wrapping the whole row; 34px rounded icon tile on the left,
   title + support in the middle, badge or chevron on the right. Minimum row
   height 56px for tap targets. Resolve the icon key and the tone to classes via
   lookup objects **inside** the component.

7. **`dashboard/page.tsx`** — remove exactly three lines:

   | Line | Content |
   |---|---|
   | 57 | `import { HackathonPromoModal } from "@/components/dashboard/hackathon-promo-modal";` |
   | 293 | `<HackathonPromoModal />` |
   | 353 | `<HackathonPromoModal />` |

   **Two JSX usages, not three.** Explore now covers that discovery
   permanently, and leaving both means the surface was added without the nag
   being removed.

   Removing these orphans `src/components/dashboard/hackathon-promo-modal.tsx`
   — nothing else in the codebase imports it. **Leave the file on disk**,
   unreferenced, so restoring the modal is a one-line import. Delete it in a
   later cleanup commit, not this one.

   **Leave `ClaudeChallengeModal` (351) and `ClaudeEnrollmentBanner`
   (238, 276, 342) alone** — they carry cohort start dates and enrollment
   state, not just a link, so retiring them is a separate decision. Do not
   remove them by analogy.

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** ship step 2 without step 3. Removing the Mission tab without adding
  it to the hamburger leaves `/mission` unreachable on mobile.
- **DO NOT** remove the Mission item from `app-header.tsx:201`. It is
  `hidden md:flex` — desktop only — and is the desktop counterpart of the
  hamburger item you are adding.
- **DO NOT** remove Mission from the `landing-hub.tsx` footer.
- **DO NOT** reorder or add bottom-nav tabs. Exactly one tab changes; five stay.
- **DO NOT** rebuild track switching. `ChallengeSwitcher` already handles moving
  between tracks the user is enrolled in. Explore lists and links; it does not
  switch.
- **DO NOT** make `/explore` public — it must be in `protectedPaths`.
- **DO NOT** show the Claude row when `isClaudeEnabled()` is false.
  `/claude-signup` self-redirects to `/`, so the row would dead-end.
- **DO NOT** pass lucide components or functions into `TrackRow` — string keys
  only, mapped inside.
- **DO NOT** add a CTA button to each row. The row is the tap target; four
  buttons in a list is four competing CTAs.
- **DO NOT** use `<Button asChild>` — `buttonVariants` on `<Link>`.
- **DO NOT** touch `prisma/schema.prisma`. No schema change here.
- **DO NOT** use `console.error`; use `lib/logger.ts`.

## 7. DB safety

No schema change, no migration, no seed. `getUserActiveEnrollments` already
exists and already uses `select`; reuse it as-is rather than writing a new
query.

## 8. Verification

```
npm run build
```
Zero TS errors, zero `any`.

Mobile (375px), logged in as a student enrolled in one SE track:
1. Bottom nav shows Home, Jobs, Explore, Rewards, Profile — **no Mission tab**.
2. Explore tab navigates to `/explore` and renders as the active tab.
3. "Your tracks" lists the SE enrollment with the correct day and streak;
   tapping it lands on `/dashboard?challenge=<id>`.
4. "Open to join" does **not** list the 60-day challenge (already enrolled) and
   **does** list hackathon and bootcamp.
5. Hamburger contains "Our mission" and it opens `/mission`.
6. Every row is at least 56px tall and tappable across its full width.

Flag states:
7. `ENABLE_CLAUDE_CHALLENGE=true` → Claude row present; `false` → absent.
8. Enrolled in CLAUDE with the flag on → Claude appears under "Your tracks",
   not under "Open to join". No duplicate.

Regressions:
9. Logged out, `/explore` redirects to `/login?from=/explore`.
10. Desktop header dropdown still has "Our Mission".
11. `/mission` itself still renders.
12. Dashboard no longer shows the hackathon promo modal; the Claude modal and
    enrollment banner are unchanged.
13. `ChallengeSwitcher` in the header still works for a user with 2+ tracks.

Files changed should be exactly:
```
middleware.ts                                (add "/explore")
src/app/dashboard/page.tsx                   (drop HackathonPromoModal: import + 2 usages)
src/app/explore/page.tsx                     [new]
src/components/explore/track-list.tsx        [new]
src/components/explore/track-row.tsx         [new]
src/components/shared/bottom-nav.tsx         (one tab)
src/components/shared/mobile-sidebar.tsx     (one item)
```

## 9. Commit message

```
feat(explore): add Explore tab, move Mission to the mobile hamburger

Track discovery was modal-only — dismissing HackathonPromoModal or
ClaudeChallengeModal left no path to /hackathon, /ai-workshop,
/challenges or /claude-signup from anywhere in the logged-in shell.

Add /explore listing the user's active tracks and the tracks still open
to them, and give it the bottom-nav slot Mission was using. Mission
moves into the mobile hamburger, matching where it already sits in the
desktop header dropdown.

Drop HackathonPromoModal now that Explore covers it permanently. The
Claude modal and enrollment banner stay — they carry cohort dates, not
just a link.
```

## Appendix — note for plan 048

`src/components/shared/faq-accordion.tsx` now exists, so plan 048 §3 marking it
`[new]` is stale. Reuse the existing component there rather than creating a
second one.
