# 113 — T-003: Four shared helper stubs

**Owner:** Zainab · **Task:** T-003 (MEDIUM, P0, 2 days) · board `112-A`
**Due:** all four on `master` by Tuesday evening (8 Sep) so consumers can move.
**Investigated:** 2026-09-07, branch `T-029`

## 1. Goal

Four shared helpers exist as stubs that type-check, so consumers (T-030, T-033,
T-016, T-085, and the shortlist work) can import and build against a settled
signature before the real implementation lands. The signature is the deliverable
here — not the behaviour.

## 2. Current behaviour — what actually exists

The board says "None exist." That is right for one of the four and wrong for
three, in ways that change what gets built.

| Helper | Reality | Action |
|---|---|---|
| Check a plan limit | **Nothing.** Confirms T-033's "there is NO server-side check at all". The only match for `limit` is `parseResultLimit` in `pool-brief.ts`, which parses "show me 10" out of a chat message — unrelated. | New stub |
| Send a notification | A notification module exists, but it is **broadcast-only**. `Notification` (schema) has `audience` (ALL / CHALLENGE / PROGRAM / HACKATHON) and **no `userId`** — there is no way to notify one person. `deriveEventNotifications` computes items rather than storing them. | New stub, must not be confused with the broadcast path |
| Record a candidate signal | `emitSkillEvidence`, built on branch `T-146` (pushed to origin, **not merged**, not present on this branch). | Not T-003's job — land the PR |
| Add someone to a shortlist | `ensureShortlisted` / `toggleShortlist` exist in `features/talent-pool/pool.ts` — **but see §3.** They cannot be the shared helper. | New stub |

## 3. Why the existing shortlist helper cannot be reused

`RecruiterShortlistItem` is keyed on `memberId` with a hard FK:

```
member ProgramMember @relation(fields: [memberId], references: [id], onDelete: Restrict)
```

and every function around it goes through `assertPoolAccess`, which requires a
`ProgramCohort` with `resultsPublishedAt` set. So shortlisting works for AI
Cohort members and **nobody else** — a 60-day, Claude or hackathon candidate has
no `ProgramMember` row to point at.

This is the same defect `hasContactAccess` was deliberately built to avoid
(`contact-access.ts`: *"a rule that cannot name half the candidates is not one
rule"*), still unfixed one layer down, at the schema level.

**Consequence for T-003:** the shared shortlist helper takes `candidateUserId`,
not `memberId`. It cannot delegate to `ensureShortlisted` when it is
implemented — that needs a schema change (a nullable `candidateUserId`, or a new
table) which is **out of scope for T-003 and belongs to whoever owns the
shortlist feature**. The stub's job is to stop consumers hard-coding `memberId`
into their call sites this week and having to unpick it later.

## 4. The rule that makes these stubs safe

**A no-op must never return success.**

A stub that returns `{ ok: true }` while storing nothing lets a consumer build a
"Added to shortlist" toast, a spent-credit counter or a "candidate notified"
confirmation on top of a lie — and nothing fails until someone checks the
database. For `checkPlanLimit` it is worse than misleading: a stub that defaults
to *allowed* is a fail-open gate on paid access to personal data, and if it ships
before T-033 lands, the gate is simply absent.

So every stub returns an explicit not-implemented result, and **fails closed**.
Consumers branch on it today and get real values later without changing a call
site.

## 5. Files to touch

- `src/features/hire/entitlements.ts` **[new]** — `checkPlanLimit`. In `hire/`
  because only recruiters have plans; this is the file T-033 grows into.
- `src/features/notification/notify-user.ts` **[new]** — `notifyUser`. Existing
  module, new file: the broadcast path in `admin-notification-actions.ts` stays
  untouched.
- `src/features/hire/shortlist.ts` **[new]** — `addToShortlist`, user-keyed.
- No schema change. No migration. No `prisma/` edits. **No DB safety step
  needed** — these stubs touch no tables.

## 6. Server vs Client

All three are **server-only** (`import "server-only"` at the top, matching
`contact-access.ts` and `pool.ts`). None are imported by a Client Component.
Nothing crosses the Server→Client boundary: consumers call them from Server
Actions or Server Components and pass plain serialisable results down.

Not in the middleware/edge import path — no `middleware.ts` involvement.

## 7. Steps

1. **`src/features/hire/entitlements.ts`**
   - `export type PlanLimitKey = "CONTACT_UNLOCK";` — one member for now.
     T-032/T-033 add the rest; a union means a typo is a compile error rather
     than a silently-unlimited limit.
   - `export type PlanLimitResult = { allowed: boolean; remaining: number | null; reason: "NOT_IMPLEMENTED" | "WITHIN_LIMIT" | "LIMIT_REACHED" | "NO_PLAN" };`
   - `export async function checkPlanLimit(recruiterUserId: string, key: PlanLimitKey): Promise<PlanLimitResult>`
     → returns `{ allowed: false, remaining: null, reason: "NOT_IMPLEMENTED" }`.
   - Doc comment: this is the single server-side entitlement check (T-033);
     it must never be called from a Client Component, and it must never be the
     only gate — see plan 112 §6, where it is the *last* of several ANDed checks.
2. **`src/features/notification/notify-user.ts`**
   - `export type NotifyUserInput = { userId: string; title: string; body?: string; href?: string; category: NotificationCategoryKey };`
     Reuse `NotificationCategoryKey` from `./types` — do not redeclare it.
   - `export async function notifyUser(input: NotifyUserInput): Promise<{ ok: true } | { ok: false; message: string }>`
     → logs via `lib/logger.ts` and returns `{ ok: false, message: "notifyUser not implemented" }`.
   - Doc comment: per-user notification does not exist yet; `Notification` is
     broadcast-by-audience and has no `userId`, so implementing this needs either
     a nullable `userId` on `Notification` or a separate table — a decision for
     whoever implements, not for this stub.
3. **`src/features/hire/shortlist.ts`**
   - `export async function addToShortlist(recruiterUserId: string, candidateUserId: string, note?: string): Promise<{ ok: true; added: boolean } | { ok: false; message: string }>`
     → returns `{ ok: false, message: "addToShortlist not implemented" }`.
   - Doc comment: **`candidateUserId`, never `memberId`** — with §3's reason, so
     the next person does not "simplify" it back to the cohort-only key.
4. Typecheck and import-check (§9). Do not write consumers.

## 8. Guardrails for Cursor (DO NOT)

- **DO NOT** implement any of the three. No Prisma calls, no tables, no logic.
  Stubs only.
- **DO NOT** return `{ ok: true }` or `allowed: true` from any stub (§4).
- **DO NOT** touch `prisma/schema.prisma`, write a migration, or run any
  `db:*` command.
- **DO NOT** modify `contact-access.ts`, `pool.ts`, `admin-notification-actions.ts`
  or anything under `src/components/ui/`.
- **DO NOT** delegate `addToShortlist` to `ensureShortlisted`, or take a
  `memberId` parameter anywhere (§3).
- **DO NOT** add a barrel/index file, a shared "stubs" module, or a helper to
  hold the shared types. Three files, that is all.
- **DO NOT** add `requireRole` / `requireAdmin` inside these — auth belongs at
  the Server Action boundary that calls them, and one of these will be called on
  a recruiter path, not an admin one.
- Do not create `emitSkillEvidence` here — it exists on `T-146`. Creating a
  second one is how the branch conflicts.

## 9. Verification

- `npx tsc --noEmit` clean.
- `npm run build` succeeds.
- Import each of the three from a scratch file, confirm it compiles, then
  **delete the scratch file** — it is not part of the commit. (The board's
  "import each from a test file" is a build check, not a test to keep.)
- `git status` shows exactly three new files under `src/features/`, nothing else.
- Nothing under `prisma/` changed.

## 10. Before it merges — signature review

These are contracts, and the value is entirely in getting them right before four
people build on them. Same discipline as the `emitSkillEvidence` carry-over: ask
the consumers, not the author.

- `checkPlanLimit` → Sohail (T-032 stores the limits) and whoever has T-033.
- `notifyUser` → Shivansh (T-016) and T-085, the two candidate-facing consumers.
- `addToShortlist` → whoever owns the shortlist work, plus a nod from Sohail on
  §3, since fixing it properly is a schema change someone must eventually own.

## 11. Commit message

```
feat(shared): add no-op stubs for plan limits, user notification, shortlist

Signatures only — every stub fails closed and returns not-implemented, so no
consumer can build a success path on a lie. checkPlanLimit is the T-033
entitlement check; notifyUser is per-user (the existing Notification model is
broadcast-only, no userId); addToShortlist is keyed on candidateUserId because
RecruiterShortlistItem's memberId FK cannot name non-cohort candidates.

Refs T-003. Plan: docs/plans/113-t003-shared-stubs.md

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
