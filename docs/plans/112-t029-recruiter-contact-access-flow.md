# 112 — T-029: How a recruiter earns the right to see contact details

> ⛔ **STOP — DO NOT IMPLEMENT.**
> This is the P1 *Investigate* output for T-029 (P0, HIGH RISK, releases personal
> data). Sohail reviews and approves this document **before any code is written**,
> and approves again before production. The junior must not self-merge.
> §6 is a *proposal for approval*, not an instruction to Cursor.

**Owner:** Zainab · **Task:** T-029 (Sat 5 – Wed 9 Sep, 3 days) · board `112-A`
**Status:** awaiting Sohail's review
**D-5: DECIDED** — plan credit, instant unlock. §6 already matches it; no change.
**D-8: still open on substance** — the ruling so far is only *when* it must be
resolved (before the visibility control or the paid unlock ships), not *how*.
See §8 and Finding 3 — the contradiction is materially worse than "the column
defaults true".
**Feeds:** T-030 (the unlock build, 5 days, Zainab). T-030 cannot start against
an unapproved flow.
**Investigated:** 2026-09-05, branch `Interview-proctoring`

---

## 1. Goal

Write down, before anything is built, the exact flow by which a recruiter comes
to see a candidate's real name and contact details: click contact → check the
plan allowance → record that access was granted → show the details — plus what
happens at zero allowance, and what the candidate is told. The rule that decides
"may this recruiter see this person" must keep deciding, unchanged.

## 2. The single access-deciding function — found

`hasContactAccess(recruiterUserId, candidateUserId)` in
[src/features/hire/contact-access.ts](src/features/hire/contact-access.ts), with
its batch twin `contactAccessFor(recruiterUserId, candidateUserIds[])`.

The rule it encodes:

> Access exists **iff** a `TalentEngagementRequest` row exists for this
> (recruiter, candidate) pair with `status = CONTACT_SHARED`.

Three properties of it that must survive T-029:

- **Derived, never stored.** There is no `contactVisible` boolean. A second flag
  is something a bug, a backfill, or a forgotten status change can leave switched
  on; there is nothing to forget when the answer is computed from the decision.
- **Keyed on `candidateUserId`, not `programMemberId`.** That is the only key all
  four tracks share — a 60-day/Claude/hackathon candidate has no `ProgramMember`
  row. A rule that cannot name half the candidates is not one rule.
- **`CONTACT_SHARED` is written in exactly one place:** `decideEngagementAction`
  in [src/app/actions/hire-request-actions.ts](src/app/actions/hire-request-actions.ts),
  behind `requireAdmin()`. Nothing else in the codebase sets that status.

### ⚠️ Finding 1: the function has zero callers

`hasContactAccess` and `contactAccessFor` are **not called by anything today**
(only `existingEngagements` from the same file is used, by `/hire/layout.tsx`,
`/talent/shortlist/page.tsx` and `load-request-matches.ts`). The rule is instead
re-implemented inline at each reveal site:

| Reveal site | How it decides today |
|---|---|
| [src/app/hire/requests/page.tsx:140](src/app/hire/requests/page.tsx) | inline `e.status === "CONTACT_SHARED"` → renders name + `mailto:` |
| `getShortlist` in [src/features/talent-pool/pool.ts](src/features/talent-pool/pool.ts) | its own `findMany({ status: "CONTACT_SHARED" })` → `revealedName` |
| `getTalentProfile` in the same file | hard-coded `contactReleased: false` — never releases |

So the docstring's promise ("One rule, one place. Every surface … asks this") is
currently aspirational. T-029's "must keep deciding, unchanged" is therefore two
jobs, not one: keep the function unchanged, **and make the three existing sites
actually call it.** T-030 must not add a fourth inline copy.

## 3. What the pool actually exposes today

- Recruiters browse by reference id (`AB-####`, `candidatePublicId`). Names are
  withheld across `/hire` and `/talent` (`ShortlistRow.revealedName` is null
  unless released; `TalentProfile.contactReleased` is a literal `false`).
- A `CONTACT_SHARED` decision today reveals **full name + email, and nothing
  else**. Phone, LinkedIn, GitHub and resume URL are not surfaced anywhere on the
  recruiter path — `loadRecruiterIdentities` in
  [src/repositories/talent.ts](src/repositories/talent.ts) deliberately does not
  select them (`hasLinkedin` / `hasGithub` / `hasResume` are existence booleans).
- Discovery is gated separately and earlier by `searchableUserWhere()`
  (`CandidateVisibility.searchableByRecruiters = true`, `withdrawnAt = null`,
  `deletedAt = null`), guarded by `npm run test:visibility`
  ([src/features/hire/visibility.test.ts](src/features/hire/visibility.test.ts)).
- **No plan, entitlement, quota or billing exists anywhere in the codebase.**
  `isHireProPreviewEnabled()` is presentational only — every locked field in
  [src/features/hire/locked-preview.ts](src/features/hire/locked-preview.ts) is
  locked for everybody, and the values behind the blur are fabricated people.
  This matches what T-033 says to confirm ("There is NO server-side check at
  all"): confirmed, there is none.

### ⚠️ Finding 3: the consent audit trail is populated with non-consent (D-8)

D-8 states the contradiction as "the copy says opt-in, the column defaults true".
The code is worse than that, and in a way that changes which of D-8's three
options are actually available.

`CandidateVisibility` has a real consent audit trail — `consentedAt` and
`consentSource`, commented in
[prisma/schema.prisma](prisma/schema.prisma) as *"Audit trail for consent,
required under DPDP"*. But
[src/repositories/dual-write.ts:88](src/repositories/dual-write.ts) stamps it on
row creation for everybody:

```
searchableByRecruiters: true,
consentSource: "platform_default",
consentedAt: new Date(),
```

So a candidate who was never asked has a `consentedAt` timestamp. The field that
exists to prove consent records the moment a migration ran.

Three consequences:

1. **`consentedAt` cannot be read as "this person agreed."** It is non-null for
   people who did and people who did not. Only `consentSource` separates them.
2. **There is a genuine signal, and it is `consentSource`.** The same file writes
   `"program_apply_migrated"` when a real opt-in existed — carried from
   `ProgramMember.recruiterVisibilityConsentAt` (schema:760), which *was* a
   user-facing opt-in. `"platform_default"` means nobody asked. So the population
   is separable, and a read-only `groupBy consentSource` tells Sohail exactly how
   many candidates are in each bucket before he decides. **Run that count first —
   it sizes every option below.**
3. **The discovery gate does not check consent at all.** `searchableUserWhere()`
   in [src/repositories/talent.ts](src/repositories/talent.ts) tests
   `searchableByRecruiters`, `withdrawnAt` and `deletedAt` — and the schema
   comment on `searchableByRecruiters` says plainly *"Enforcement switch … not a
   user-facing opt-in."* The gate enforces an admin kill-switch. Nothing in the
   read path enforces the opt-in the privacy policy promises.

The one piece of good news: because the gate is already a single function with a
source-scan test behind it, enforcing consent is a change in one place, not a
sweep. The cost of D-8 is not engineering. It is how many candidates remain in
the pool afterwards.

## 4. Today's flow (what T-029 replaces)

1. Recruiter signs in. Recruiter role comes from `VerifiedRecruiterSeat` — an
   out-of-band, admin-verified email allowlist. `RecruiterProfile.approved` gates
   the pool. (This is also why "no company verification" is already decided — the
   seat list *is* the verification, done by hand.)
2. Recruiter shortlists and clicks "Request intro"
   (`placeEngagementRequestAction` / `placeBulkEngagementRequestAction`). One row
   per candidate, `status = SUBMITTED`. **This reveals nothing.**
3. A human admin works the queue at `/admin/hire` and sets `CONTACT_SHARED` /
   `DECLINED` via `decideEngagementAction`.
4. `/hire/requests` renders the name and a `mailto:` link for shared rows.

Step 3 is the step the board moves to a plan allowance.

## 5. The non-negotiable constraint

Already written down in `locked-preview.ts`, and it governs T-029 and T-030:

> A commercial gate may only ever show a **subset** of what the privacy gate
> already permits. Paying cannot widen it.

Adding an allowance must not remove, weaken, or route around `assertPoolAccess`,
`searchableUserWhere()`, or the `CONTACT_SHARED` rule. The allowance can only
ever turn a "yes" into a "no".

## 6. Proposed flow (for Sohail's approval)

The design that satisfies both halves of the brief — "it moves to a plan
allowance" *and* "the ONE function must keep deciding, unchanged" — is: **the
allowance does not replace `hasContactAccess`, it replaces `requireAdmin` as the
thing that authorises writing `CONTACT_SHARED`.** Same state, same reader, new
writer.

**A. Click contact.** Recruiter clicks *Unlock contact* on a candidate in their
shortlist or match list.

**B. Check access, then allowance — in that order, as two answers.**
   1. `hasContactAccess(recruiter, candidate)` → already unlocked? Show details,
      spend nothing (§F).
   2. The candidate must still pass `searchableUserWhere()` and the pool gate.
      A candidate who has since withdrawn is not unlockable at any price.
   3. **Pending D-8** — does this candidate have a real `consentSource`, i.e.
      did they actually opt in? See §8; if D-8 lands on Option C this is a
      condition here, and it sits *before* the allowance, not after.
   4. The shared server-side entitlement check from **T-033** ("R2") →
      does this recruiter have allowance left?

   Separate answers, ANDed. Never merged into one query, and the allowance
   is never consulted first — a refusal must never depend on the recruiter's
   plan when the real reason is that the person said no.

**C. Spend and record, in one transaction.** Decrement the allowance, write
`status = CONTACT_SHARED` (with `decidedAt`, and a new "released by allowance"
marker rather than `decidedByAdminId`), and write an audit row — proposed
`RecruiterContactReveal`: recruiter, candidateUserId, engagementId, revealedAt,
which allowance period paid for it. That row is the record of a person's details
having been handed over, so it is `onDelete: Restrict` on the candidate, matching
the posture already taken on `TalentEngagementRequest`. All in
`prisma.$transaction`, so a failed reveal never bills and a successful one is
never unrecorded.

**D. Show the details.** After the transaction, `hasContactAccess` returns true
and the existing reveal sites render — unchanged. **Which fields are released is
an open decision, see D-F.** Today it is name + email.

**E. Zero allowance.** The recruiter sees: allowance exhausted, when it resets,
how to get more. They see **no fragment** of the contact details — no partial
email, no blurred name, no initial. No engagement status changes, and the
candidate is not told: running out of allowance is a fact about the recruiter's
plan, not about the candidate.

**F. Re-reveal is free.** A recruiter re-opening a candidate they already
unlocked spends nothing — `hasContactAccess` short-circuits at B1. The allowance
is charged per (recruiter, candidate) pair, once. Anything else charges people
for their own browser history, and would make the counter drop on a page refresh.

**G. What remains admin.** Nothing in the flow above needs an admin, which is the
point — but `decideEngagementAction` and `DECLINED` must stay. An admin needs to
be able to refuse or close a release after the fact.

### ⚠️ Finding 2, for T-030's leak test

T-030's acceptance test is *"open the browser network tab on the refused case —
NO email, phone or CV link anywhere in the response."* The existing pattern will
not pass that test if it is copied into a Server Action or a Client Component.
[src/app/hire/requests/page.tsx](src/app/hire/requests/page.tsx) selects
`candidate.email` **unconditionally** and gates only at render. That is safe
today purely because it is a Server Component and the unrendered value never
crosses the wire. The rule for T-030: **the refused path must not `select` the
contact fields at all** — gate the query, not the JSX.

## 7. What the candidate is told — the biggest gap

**Today the candidate is told nothing.** No email, no notification, no in-app
surface fires when `CONTACT_SHARED` is set; nothing under
[src/features/email/](src/features/email) references engagements.

That was defensible while a human approved every release. Once the release is
automatic and paid-for, "we check with the candidate" stops being true unless
something is built. Two things make this urgent rather than tidy:

- The recruiter-facing copy at
  [src/app/hire/requests/page.tsx:21](src/app/hire/requests/page.tsx) currently
  says *"We're checking availability with the candidate."* — describing a step
  the code does not perform. Under an allowance it becomes plainly false and
  must change.
- `content/legal/privacy.md:167` still tells the public that approved recruiters
  see *"profile, email, LinkedIn, resume, GitHub, scores, projects"* for opted-in
  members. The code today is materially **stricter** (reference id only until
  `CONTACT_SHARED`, then name + email). Stale in the safe direction — but T-029's
  manual test is *"confirm the privacy wording matches what the site publicly
  promises"*, and right now it does not. Fix the policy before building on it,
  not after.

T-016 (candidate controls visibility + previews the recruiter view) and T-085
(candidate sees recruiter view counts) are the candidate-facing half of this and
share the D-8 dependency. Whatever notification is agreed here should land on the
same surface those two build, not a fourth one.

## 8. Decisions needed before this doc is approved

### Already decided at T-001 — recorded here so T-030 builds against them

- **Contact unlock is by plan allowance** (not admin approval). §6 is written to
  this.
- **Payments are deferred.** So the allowance exists without billing: a plan is
  *assigned* (admin / seat), not purchased. T-030 must not grow a checkout.
- **No company verification.** `VerifiedRecruiterSeat` remains the verification.

### D-5 — DECIDED: plan credit, instant unlock

> Spend one entitlement, write `TalentEngagementRequest` at `CONTACT_SHARED`,
> reveal. `hasContactAccess()` is unchanged, so every existing gate keeps
> working.

This is §6 as already drafted — no admin backstop, no second write path, one
transaction. **No change to this plan.** T-030 can build against §6.

### D-8 — OPEN. Only the timing is settled

> Published privacy copy says recruiter discoverability is OPT-IN while the
> column defaults TRUE — and contact is now a paid unlock.
> Options: correct the copy / change the default / require consent.
> Ruling so far: resolve BEFORE the visibility control or the paid unlock ships.

Read Finding 3 first — it changes what the options cost.

**Option A — correct the copy.** Publish that recruiter discoverability is
automatic rather than opt-in. Cheapest to build and the only option that ships
without touching the pool. But it means stating, in the privacy policy, that
candidates are made discoverable without being asked, while ABTalks charges
recruiters for their contact details. It converts a documentation bug into
declared policy, and `consentSource: "platform_default"` becomes evidence that
the practice was known. Under DPDP this is the option that gets worse the longer
it stands. **Not recommended.**

**Option B — change the default.** Flip `searchableByRecruiters` to default
false. Fixes new rows and does nothing for the existing pool, which is the whole
pool. On its own it resolves nothing; it is a component of C, not an option.

**Option C — require consent.** Add the consent condition to
`searchableUserWhere()` — the one gate, already source-scan tested — so only a
real `consentSource` counts, and re-ask everyone stamped `"platform_default"`.
Honest, and mechanically small. The cost is the pool shrinking, possibly sharply,
nine days before a launch that sells access to it. That cost is real and should
not be argued away.

**Recommended: C, staged — consent at the paid unlock now, consent at discovery
after a re-consent campaign.**

The two surfaces do not carry equal risk, and D-8 does not have to answer them
in one move:

- **Contact unlock (T-030) requires a real consent source, from day one.** This
  is where money changes hands for a named person's details, and it is a small,
  targeted gate on a path that does not exist yet — nothing regresses. Add it as
  a fourth condition in §6 step B, between the visibility check and the allowance
  check.
- **Discovery (search, shortlists) keeps today's behaviour** while a re-consent
  campaign runs, with the policy corrected in the meantime to describe what
  actually happens. Anonymous, reference-id browsing is a materially weaker
  exposure than releasing an email, and treating them the same is what forces the
  false choice between shipping and being straight.

This lets T-030 ship on 19 September without selling non-consented contact
details, and it does not require the whole pool to answer an email in nine days.
It is still a decision for Sohail, and Option A remains available to him — but he
should take it knowingly, not by default.

**Blocking for T-030 either way:** whichever option is chosen, §6 step B needs to
know whether to test consent. Sohail should run the `consentSource` count
(Finding 3) before deciding — it is read-only and it sizes every option.

### Open questions T-029 must answer regardless

- **D-B — Allowance unit and period.** Per (recruiter, candidate) pair, per
  seat or per company, per month or per plan term, carry-over or not. T-032
  stores the numbers; this decides what the number *counts*.
- **D-C — Where does the allowance live?** `VerifiedRecruiterSeat` (per-email,
  already admin-managed and revocable) vs a new plan/company table from T-032.
  T-032 is Sohail's and waits on D-3, so T-029 should state the shape it needs
  and let T-032 own the table.
- **D-D — Is the candidate told when their details are released?** At unlock, or
  not at all — and can they object afterwards? Under an allowance this is a new
  promise, not a refinement of an old one.
- **D-E — Does turning `searchableByRecruiters` off revoke an already-granted
  reveal?** Today it removes the candidate from discovery but does not retract a
  `CONTACT_SHARED` row, so a recruiter who unlocked yesterday keeps the email.
  T-016's acceptance test says visibility off removes the candidate *"everywhere
  including saved results"* — if that includes already-unlocked contacts, T-016
  and T-029 must agree on it now.
- **D-F — Which fields does an unlock release?** ⚠️ **Direct conflict on the
  board.** T-030's test says *"NO email, phone or CV link"* on the refused case,
  implying phone and CV are released on the allowed case. But phone is withheld
  from recruiters by policy (`privacy.md:62` — *"optional phone (admin-only; not
  shown to recruiters)"*, and `:167` — *"not phone"*), and no recruiter surface
  selects phone or resume URL today. Either T-030's wording is loose, or the
  released field set is being widened — which is a privacy decision of its own,
  not a detail of the unlock mechanism. **Sohail must settle this in T-029, or
  T-030 will settle it by accident.**

## 9. Guardrails for whoever implements T-030 (after approval)

- **DO NOT** add a `contactVisible` / `contactReleased` boolean column, or any
  second stored source of truth for access.
- **DO NOT** write `status === "CONTACT_SHARED"` in a new file. Call
  `hasContactAccess` / `contactAccessFor`, and route the three existing inline
  sites through it too.
- **DO NOT** merge the allowance check into `hasContactAccess`. Privacy and
  commerce are two answers; one function that returns "yes" for a paid reason is
  the failure mode this whole design exists to prevent.
- **DO NOT** weaken `searchableUserWhere()` or `assertPoolAccess`, and do not add
  a plan-based bypass to either.
- **DO NOT** `select` contact fields on a path that may refuse (Finding 2).
- **DO NOT** put the allowance check only in the UI — T-033's explicit warning.
  The spend must be server-side and transactional, or two tabs unlock twice for
  one allowance.
- **DO NOT** show a partial, blurred or teaser version of real contact details at
  zero allowance.
- **DO NOT** widen the released field set beyond whatever D-F decides.
- Schema work here touches 078-era tables: reach candidate data through
  `src/repositories/`, not fresh `prisma.studentProfile` / `prisma.programMember`
  calls. Follow the DB-safety step — commit checkpoint, Neon branch snapshot,
  note the commit hash — before any migration, and note that
  `prisma migrate deploy` does not work on this database (see T-002 / D-2).
- `npm run test:visibility` must still pass; extend its source scan so a reveal
  site that skips `hasContactAccess` fails the same way a missing visibility
  clause does.

## 10. Manual test (with Sohail, per the task)

Walk the flow on a staging cohort with a real seat: shortlist → unlock with
allowance → re-open the same candidate (counter must not move) → exhaust the
allowance → attempt another unlock → attempt it again with the browser bypassed.
At every step confirm a non-approved recruiter and a withdrawn candidate stay
invisible. Then read the candidate-facing wording against
`content/legal/privacy.md` and fix the policy where §7 says it is stale.

## 11. Done when

- Flow approved by Sohail, with D-5, D-8 and D-B…D-F resolved in §8.
- `hasContactAccess` is unchanged, and every reveal site calls it.
- Candidate-facing wording agreed and reconciled with the published policy.
