# 055 — Breeth sponsor: landing section, prize track, dashboard redeem panel

## Assumptions (organizer to confirm — override before Cursor runs)

These were not settled when the plan was written. Each is implemented as a
config constant so changing your mind is a one-line edit, not a rewrite.

1. **Two redeem links → only the 5k link ships.** The 3k link is stored in
   config, commented out, as reserve. Showing both invites double-claiming and
   nobody knows which to click.
2. **Landing section carries no redeem link.** It links to `thebreeth.com` and
   `docs.thebreeth.com` only. Rationale below — this one is load-bearing.
3. **Dashboard redeem panel is visible immediately**, not gated on kickoff.
   Kickoff is Fri 7 Aug 8:00 PM IST; participants who first see the tool at
   kickoff will burn build hours on setup.
4. **Sponsor prize reward text is a placeholder** (`TODO(organizer)`). The main
   1st/2nd/3rd prizes stay unannounced — see step 4 for why that matters.
5. **No logo asset.** Text wordmark + a lucide icon, matching how every other
   card on the page is built. Drop in an SVG later without touching layout.

### Why the redeem link must not go on the landing page

`/hackathon` is public and unauthenticated. The Breeth links have a fixed
redemption cap (5,000 / 3,000). A capped link on a public page gets scraped,
posted, and burned by people who never registered — you lose the allocation to
strangers and your actual participants hit an exhausted link at kickoff.

`/hackathon/dashboard` redirects to `/login` and then to `/hackathon/register`
([page.tsx:20-27](../../src/app/hackathon/dashboard/page.tsx)), so it is the
only surface where "registered participant" is actually enforced. Redeem link
lives there. Public page explains the tool and links to Breeth's own site.

---

## 1. Goal

Give Breeth sponsor placement across the hackathon: an explanatory section on
the public landing page, a "Best use of Breeth" prize track, and a redeem panel
on the participant dashboard above the problem statement. Framed capability-first
("give your app memory that persists") rather than leading with plan value.

## 2. Current behavior

**Landing** — [src/app/hackathon/page.tsx](../../src/app/hackathon/page.tsx)
renders `Hero → HowItWorks → Timeline → Deliverables → Rules → Prizes → Faq`.
No sponsor content anywhere on the page.

**Prizes** — [prizes.tsx](../../src/components/hackathon/prizes.tsx) branches on
`HACKATHON.prizes.length === 0`. The array is currently empty, so it renders a
single "Prizes announced soon" card. The populated branch is a `sm:grid-cols-3`
grid.

**Dashboard** — [dashboard/page.tsx](../../src/app/hackathon/dashboard/page.tsx)
renders `MissionTimer → ProblemStatementPanel → TeamRoster → (roster note) →
(InvitePanel) → SubmissionChecklist → EventInfo` inside a `space-y-6` stack.

**Config** — [hackathon-config.ts](../../src/components/hackathon/hackathon-config.ts)
is a single `as const` object holding all copy and dates. It already uses a
`// TODO(organizer):` comment convention (line 7).

**Note, out of scope:** `ThemeSection`
([theme-section.tsx](../../src/components/hackathon/theme-section.tsx)) is not
imported or rendered anywhere, and uses light-theme tokens (`text-foreground`,
`bg-card`) that do not match this page. Leave it alone in this change.

## 3. Files to touch

| Path | Mode | Note |
|---|---|---|
| `src/components/hackathon/hackathon-config.ts` | `[edit]` | Add `sponsor` object: name, blurb, three capability bullets, site/docs URLs, redeem URL, prize track copy. |
| `src/components/hackathon/sponsor-section.tsx` | `[new]` | Landing section. Reads `HACKATHON.sponsor`. |
| `src/app/hackathon/page.tsx` | `[edit]` | Import + render `<SponsorSection />` between `<Deliverables />` and `<Rules />`. |
| `src/components/hackathon/prizes.tsx` | `[edit]` | Append sponsor-track card below the existing branch, in both branches. |
| `src/components/hackathon/dashboard/sponsor-panel.tsx` | `[new]` | Dashboard redeem panel with the capped link. |
| `src/app/hackathon/dashboard/page.tsx` | `[edit]` | Import + render `<SponsorPanel />` directly above `<ProblemStatementPanel />`. |

No other files. No new `lib/` helper, no shared "sponsor" abstraction — there is
one sponsor and the content is static config.

## 4. Server vs Client

Every component in this change is a **Server Component**. None of them take
state, effects, event handlers, or browser APIs.

- `SponsorSection` — Server. Static content from config.
- `SponsorPanel` — Server. Static content + one `<Link>`.
- `Prizes` — Server (unchanged status).
- `page.tsx` (landing) — Server (unchanged status).
- `dashboard/page.tsx` — Server, `async` (unchanged status).

**No `"use client"` on any file in this change.** No Server→Client prop passing
is introduced, so there is no function/icon/class-instance boundary risk. Icons
are imported and used *inside* the server components, never passed as props.

## 5. Steps

### Step 1 — `src/components/hackathon/hackathon-config.ts` `[edit]`

Add a `sponsor` key to the `HACKATHON` object. Place it immediately after the
`prizes` line (line 22), before `steps`. Keep it inside the existing `as const`.

```ts
  // TODO(organizer): paste the real Breeth redeem URL before kickoff.
  // Breeth supplied two capped links: 5,000 redemptions and 3,000 redemptions.
  // Ship the 5k link. If it exhausts mid-event, swap this one value to the 3k
  // link — no other file changes.
  // Reserve (3k): "PASTE_3K_LINK_HERE"
  sponsor: {
    name: "Breeth",
    kicker: "Sponsor",
    heading: "Your apps get memory",
    blurb:
      "Breeth is a memory layer for AI agents. Your app writes what happened, and it remembers — across sessions, across users, across the whole weekend. Every participant gets Breeth Pro, free.",
    capabilities: [
      {
        title: "Persistent memory, no infra",
        body: "One API call to save, one to search. No embeddings, no vector database, no retrieval pipeline to build in 48 hours.",
      },
      {
        title: "Plugs into Claude Code and Cursor",
        body: "Breeth ships an MCP server, so your AI assistant can read and write project memory while it codes for you.",
      },
      {
        title: "Remembers why, not just what",
        body: "Facts carry the reasoning behind them, and old beliefs fade as they're contradicted. Build things that notice when a user changes their mind.",
      },
    ],
    siteUrl: "https://thebreeth.com",
    docsUrl: "https://docs.thebreeth.com",
    redeemUrl: "PASTE_5K_LINK_HERE",
    redeemLabel: "Claim your Breeth Pro access",
    // TODO(organizer): confirm reward with Breeth before announcing.
    prizeTitle: "Best use of Breeth",
    prizeReward: "Sponsor track — reward announced soon.",
  },
```

Do not reorder, rename, or edit any existing key in this file.

### Step 2 — `src/components/hackathon/sponsor-section.tsx` `[new]`

Server Component. Match the landing page's section shell exactly as used in
[deliverables.tsx](../../src/components/hackathon/deliverables.tsx) — same
wrapper, same gradient heading, same card treatment.

```tsx
import { BrainCircuit, Plug, Sparkles } from "lucide-react";
import Link from "next/link";
import { HACKATHON } from "@/components/hackathon/hackathon-config";

const ICONS = [BrainCircuit, Plug, Sparkles] as const;

export function SponsorSection() {
  const { sponsor } = HACKATHON;

  return (
    <section className="mx-auto w-full max-w-[1897px] px-8 py-16 sm:px-9 sm:py-24">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#968BEC]">
        {sponsor.kicker} · {sponsor.name}
      </p>
      <h2
        className="mt-3 bg-gradient-to-r from-white from-[75%] to-[#A2A2A2] bg-clip-text text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-tight text-transparent"
        style={{ fontFamily: "var(--font-hackathon-mono), monospace" }}
      >
        {sponsor.heading}
      </h2>
      <p className="mt-3 max-w-3xl text-[clamp(1rem,2vw,1.25rem)] tracking-[0.02em] text-[#BCBCBC]">
        {sponsor.blurb}
      </p>

      <ul className="mt-12 grid gap-6 sm:grid-cols-3 sm:gap-8">
        {sponsor.capabilities.map((item, index) => {
          const Icon = ICONS[index] ?? BrainCircuit;
          return (
            <li
              key={item.title}
              className="rounded-[20px] border border-[#403880] bg-[#030712] p-6 transition-colors hover:border-[#7364E6]"
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-[#403880]/40">
                <Icon className="size-6 text-[#968BEC]" aria-hidden />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#BCBCBC]">
                {item.body}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm">
        <Link
          href={sponsor.siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#968BEC] underline underline-offset-4 transition-colors hover:text-white"
        >
          {sponsor.name.toLowerCase()}.com
        </Link>
        <Link
          href={sponsor.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#968BEC] underline underline-offset-4 transition-colors hover:text-white"
        >
          Read the docs before kickoff
        </Link>
      </div>
    </section>
  );
}
```

`sponsor.redeemUrl` is **not** referenced in this file. That is deliberate — see
the rationale at the top.

### Step 3 — `src/app/hackathon/page.tsx` `[edit]`

Add the import (alphabetical position among the existing
`@/components/hackathon/*` imports, i.e. after `Rules`) and render the section
between `<Deliverables />` and `<Rules />`:

```tsx
          <Deliverables />
          <SponsorSection />
          <Rules />
```

Change nothing else — leave the `zoom` wrappers and `metadata` as they are.

### Step 4 — `src/components/hackathon/prizes.tsx` `[edit]`

**Read this before writing code.** `HACKATHON.prizes` is still empty, so the
component currently renders the "announced soon" card. Do **not** solve the
sponsor track by pushing an entry into `HACKATHON.prizes` — that flips the
component to its populated branch and renders one lonely card in a
`sm:grid-cols-3` grid, while also implying the main prizes are decided when they
are not.

Instead: leave the existing conditional exactly as it is, and append the sponsor
card *after* it, inside the same `<section>`. It renders in both branches.

Add `Sparkles` to the existing lucide import, then after the closing of the
`{HACKATHON.prizes.length === 0 ? (...) : (...)}` expression:

```tsx
      <div className="mt-8 max-w-2xl rounded-[20px] border border-[#403880] bg-[#030712] p-6 sm:p-8">
        <div className="flex size-12 items-center justify-center rounded-xl bg-[#403880]/40">
          <Sparkles className="size-6 text-[#968BEC]" aria-hidden />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#968BEC]">
          Sponsored by {HACKATHON.sponsor.name}
        </p>
        <h3 className="mt-2 text-lg font-semibold text-white">
          {HACKATHON.sponsor.prizeTitle}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[#BCBCBC]">
          {HACKATHON.sponsor.prizeReward}
        </p>
      </div>
```

### Step 5 — `src/components/hackathon/dashboard/sponsor-panel.tsx` `[new]`

Server Component. Match the dashboard panel shell used by
[event-info.tsx](../../src/components/hackathon/dashboard/event-info.tsx) —
`rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6`, uppercase
`#A78BFA` heading.

Per the CLAUDE.md button rule, the CTA is `buttonVariants` applied directly to
`<Link>` — never `<Button asChild>` or `<Button render={...}>`.

```tsx
import Link from "next/link";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SponsorPanel() {
  const { sponsor } = HACKATHON;

  return (
    <section className="rounded-2xl border border-[#7364E6]/40 bg-[#7364E6]/[0.06] p-5 sm:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#A78BFA]">
        Your {sponsor.name} Pro access
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-zinc-300">
        {sponsor.name} is a memory layer for AI agents — persistent memory for
        whatever you build, plus an MCP server your AI assistant can use while it
        codes. Every participant gets Pro, free.
      </p>
      <p className="mt-3 text-sm text-zinc-400">
        Claim it and run one test write <strong className="text-zinc-200">before
        kickoff</strong>. Setup time is not build time.
      </p>

      <Link
        href={sponsor.redeemUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ size: "lg" }), "mt-6 w-full sm:w-auto")}
      >
        {sponsor.redeemLabel}
      </Link>

      <Link
        href={sponsor.docsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 block text-sm text-[#A78BFA] underline underline-offset-4 transition-colors hover:text-white"
      >
        Quickstart and MCP setup →
      </Link>
    </section>
  );
}
```

The tinted border/background is intentional — this panel should read as distinct
from the neutral `white/10` panels around it, since it is the one thing on the
dashboard with a deadline attached.

### Step 6 — `src/app/hackathon/dashboard/page.tsx` `[edit]`

Add the import alongside the other dashboard component imports, and render the
panel directly above `<ProblemStatementPanel />`:

```tsx
        <MissionTimer ... />
        <SponsorPanel />
        <ProblemStatementPanel
          kickoffUtc={HACKATHON.kickoffUtc}
          statement={problemStatement}
        />
```

No time gating, no conditional — the panel is always visible to any registered
participant who reaches this page. Change nothing else in the file: leave the
`auth()` guard, the redirects, and the roster logic untouched.

## 6. Guardrails for Cursor (DO NOT)

- **DO NOT** put `sponsor.redeemUrl` on `/hackathon` (landing), in `Hero`, in
  `Faq`, in metadata, or anywhere else reachable without auth. The link has a
  hard redemption cap. Dashboard only. If you think it belongs somewhere else,
  stop and ask.
- **DO NOT** add entries to `HACKATHON.prizes` — see step 4. The "announced
  soon" empty state must survive this change.
- **DO NOT** add `"use client"` to any file in this change. All six are Server
  Components and need to stay that way.
- **DO NOT** use `<Button asChild>` or `<Button render={<Link>}>` for the CTA.
  `buttonVariants` goes directly on `<Link>` (Base UI button semantics).
- **DO NOT** create a `lib/sponsor.ts`, a sponsors array, a `SponsorCard`
  primitive, or any other abstraction. There is one sponsor and the content is
  static. Only the two new files listed in section 3 may appear.
- **DO NOT** touch `middleware.ts`, `auth.ts`, or `auth.config.ts`. This change
  adds no routes and no auth surface.
- **DO NOT** add `requireRole` / `requireAdmin` anywhere. The landing page is
  public by design; the dashboard's existing `auth()` guard is sufficient and
  already correct.
- **DO NOT** modify `theme-section.tsx` or wire it into the page. It is a known
  orphan and is out of scope here.
- **DO NOT** touch anything under `src/components/ui/`.
- **DO NOT** invent a redeem URL. Leave `PASTE_5K_LINK_HERE` verbatim so the
  organizer can find it; the build will pass with the placeholder in place.

## 7. DB safety

None. No schema change, no migration, no seed, no data write. `problemStatement`
continues to be read from `HackathonEvent` exactly as before.

## 8. Verification

**Build must pass:**

```bash
npx tsc --noEmit && npm run build
```

**Manual — landing (`/hackathon`), logged out:**
1. A "Sponsor · Breeth" section appears between "What you submit" and the rules
   section, with three cards.
2. Heading font and gradient match the "What you submit" heading above it.
3. Cards use the same purple border and hover state as the deliverables cards.
4. Two outbound links at the bottom; both open in a new tab.
5. **Search the rendered page source for `PASTE_5K_LINK_HERE` — it must not
   appear.** This is the check that the capped link did not leak to a public
   surface.
6. Prizes section still shows "Prizes announced soon", now with a "Best use of
   Breeth" card underneath it.

**Manual — dashboard (`/hackathon/dashboard`), as a registered participant:**
1. The Breeth panel sits between the mission timer and the problem statement.
2. Tinted purple border, visually distinct from the panels below it.
3. It is visible **before** kickoff — do not gate it behind the kickoff time.
4. The CTA renders as a full-width button on mobile, auto-width from `sm:` up.
5. Logged out, `/hackathon/dashboard` still redirects to `/login`.

**Exactly these six files should show as changed:**

```
src/app/hackathon/dashboard/page.tsx
src/app/hackathon/page.tsx
src/components/hackathon/dashboard/sponsor-panel.tsx   (new)
src/components/hackathon/hackathon-config.ts
src/components/hackathon/prizes.tsx
src/components/hackathon/sponsor-section.tsx           (new)
```

If anything else changed, revert it.

## 9. Commit message

```
feat(hackathon): add Breeth sponsor section, prize track, and dashboard redeem panel

Landing gets a capability-first sponsor section between Deliverables and
Rules, and a "Best use of Breeth" card in Prizes that coexists with the
unannounced main prizes.

The capped redeem link is confined to /hackathon/dashboard, which is auth-
and registration-gated, so the allocation can only be spent by registered
participants. The public landing page links to Breeth's site and docs only.

Redeem URL is a placeholder pending the organizer.
```
