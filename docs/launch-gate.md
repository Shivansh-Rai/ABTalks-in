# The launch gate — what changed, and how to undo it

**Everything here is temporary.** It was built between 14 and 16 October 2026
to put a Claude Challenge launch page in front of the platform and to keep the
recruiter product invite-only. Nothing was deleted: every surface it hides is
still on disk and still works, and §4 restores the state the repository was in
on **14 October 2026, commit `57b1df56`**.

Keep this file current. Every further change to the gate belongs in §2 and §3.

---

## 1. Where things stand (16 October 2026)

| Surface | State |
| --- | --- |
| `/` | The launch one-pager: Claude Challenge, 15 November 2026, countdown, "Sign in" in the nav |
| Candidate product | **Open.** Registration, sign-in, dashboard, tracks, profile, settings, marketplace, assessments — all behave as they did before the gate |
| Dashboard "Get hired" stage | **Hidden**, with the open-to-work toggle it carries and the job board it leads to |
| `/jobs` | Hidden with it |
| Recruiter product (`/hire`, `/talent`, `/recruiter-onboarding`) | **Invite-only.** Reachable with a preview link, an HR invite, or an admin session |
| Recruiter sign-up | Closed by `ENABLE_RECRUITER_SIGNUP=false`; sign-in stays open so admin-created recruiters can get in |
| Full marketing landing | Still in the repository, unused while the one-pager is on |

## 2. The switches

All read at request time. None needs a deploy; changing one in Vercel takes
effect on the next request after the environment reloads.

| Variable | Default | What it does |
| --- | --- | --- |
| `LANDING_ONE_PAGER` | on (unset) | `false` restores the full marketing landing at `/` **and** lifts the recruiter gate entirely |
| `HIDE_GET_HIRED` | on (unset) | `false` restores the dashboard's hiring stage, the open-to-work toggle and `/jobs` |
| `PREVIEW_TOKEN_CANDIDATE` | unset | The candidate preview link: `https://app.klymb.ai/?preview=<value>` |
| `PREVIEW_TOKEN_RECRUITER` | unset | The recruiter preview link, same shape |
| `ENABLE_RECRUITER_SIGNUP` | follows `ENABLE_RECRUITER_AUTH` | `false` closes recruiter registration while leaving sign-in open |
| `ENABLE_RECRUITER_AUTH` | per environment | Governs recruiter sign-in **and** sign-up; leave it `true`, or admin-created recruiters cannot sign in |

**The preview links.** `/?preview=<token>` sets an httpOnly cookie for 30 days
and the token is stripped from the URL immediately. Opening one signs the
browser in as a dedicated account — `preview-candidate@klymb.ai` or
`preview-recruiter@klymb.ai` — created on first use. `?preview=off` clears
both. Rotating a token revokes every link made from it.

**HR invites.** `/admin/recruiters` → "Invite an HR to trial the desk" creates
that recruiter's own account, workspace and credits and emails them a
single-use sign-in link (7 days, SHA-256 hashed at rest). Their activity is
attributable to them on `/admin/recruiters/[userId]`.

## 3. What was changed, in order

| PR | Change | Files |
| --- | --- | --- |
| #792 | The launch one-pager at `/`; recruiter side hidden | `src/app/page.tsx`, `middleware.ts`, `src/components/landing/launch/*`, `src/lib/feature-flags.ts` |
| #793 | The whole platform behind the gate; two preview links | `middleware.ts`, `src/app/page.tsx`, launch components |
| #794 | `/login` behind the gate too (**since reversed — see #807**) | `middleware.ts`, `src/app/page.tsx` |
| #795 | Preview links sign you in; preview accounts provisioned on first use | `src/auth.ts`, `src/features/preview/preview-accounts.ts`, `src/app/preview/enter/route.ts` |
| #797 | Per-HR invite links | `src/features/hire/hr-invite.ts`, `src/features/email/hr-invite-email.ts`, `src/auth.ts`, `src/app/hr/signin/route.ts`, `src/app/actions/admin-hr-invite-actions.ts` |
| #798 | Both preview links work in one browser, in any order | `middleware.ts`, `src/app/preview/enter/route.ts` |
| #799 | The admin form that sends HR invites | `src/components/admin/hr-invite-form.tsx`, `src/app/admin/recruiters/page.tsx` |
| #800 | An HR link signs in as its own recruiter | `src/app/hr/signin/route.ts`, `src/features/hire/hr-invite.ts` |
| #801 | The invite email carries the URL as copyable text | `src/features/email/hr-invite-email.ts` |
| #802 | The gate lets an invited HR reach the desk | `middleware.ts` |
| #803 | Guard test: recruiter self-signup stays closed | `src/features/hire/recruiter-signup-closed.test.ts` |
| #804 | Password field in the hire sign-in dialog; `ENABLE_RECRUITER_SIGNUP` | `src/components/hire/*`, `src/app/hire/layout.tsx`, `src/lib/feature-flags.ts`, registration actions and pages |
| #805 | The desk header uses the Klymb AI wordmark | `src/components/hire/hire-chrome.tsx`, `src/app/hire/hire-scout.css` |
| #806 | The sign-in dialog opens on the password tab | `src/components/talent/recruiter-login-form.tsx` |
| #807 | A returning candidate can sign in and use their own track | `middleware.ts`, `src/app/page.tsx`, launch components |
| **this one** | Candidate product fully open; "Get hired" hidden | `middleware.ts`, `src/app/dashboard/page.tsx`, `src/components/dashboard-hub/stages/*`, `src/lib/feature-flags.ts` |

Two of these are **not** gate work and should survive any revert: **#805**
(the wordmark, a Klymb AI rename miss) and **#806** (the password tab default,
a product decision about how recruiters sign in).

## 4. Getting back to 14 October

### The fast way — no code change, no deploy

In Vercel, set:

```
LANDING_ONE_PAGER=false
HIDE_GET_HIRED=false
```

and clear `ENABLE_RECRUITER_SIGNUP` (or set it `true`). That restores the full
marketing landing, lifts the recruiter gate, brings back the hiring stage and
the job board, and reopens recruiter registration. **Every line of gate code
is still there, doing nothing.** This is the recommended route: it is one
change, it is instant, and it is reversible.

Afterwards the preview links and HR invites stop being needed. They also stop
being special: with the gate off, `/hire` is public again, so any invite you
already sent still signs its HR in and their workspace keeps working.

### The thorough way — remove the code

Only worth doing when the launch is over for good. In this order:

1. **Revert the merge commits** listed in §3, newest first, skipping #805 and
   #806:
   ```bash
   git revert -m 1 <merge-sha>
   ```
   `git log --oneline --merges origin/master` lists them.
2. **Delete what the reverts leave behind**, if anything survives a conflict
   resolution:
   - `src/components/landing/launch/`
   - `src/features/preview/`
   - `src/app/preview/`
   - `src/app/hr/`
   - `src/features/hire/hr-invite.ts`, `src/features/email/hr-invite-email.ts`
   - `src/app/actions/admin-hr-invite-actions.ts`, `src/components/admin/hr-invite-form.tsx`
   - `docs/plans/191-*.md`, `192-*.md`, `193-*.md`, and this file
3. **Check `middleware.ts` is back to the shape it had at `57b1df56`**:
   no `GATE_PUBLIC_PATHS`, no `PREVIEW_COOKIE`, no `matchesPath`, and
   `protectedPaths` / `isPublicRecruiterEntry` untouched.
4. **Remove the env vars** in §2 from Vercel.
5. **Delete the preview and trial accounts** if you want them gone:
   `preview-candidate@klymb.ai`, `preview-recruiter@klymb.ai`, and any HR you
   invited. `/admin/recruiters` does it. Note that an organisation with a
   credit ledger cannot be deleted outright — the ledger's `RESTRICT` is
   deliberate — so disable the accounts rather than expecting the rows to go.
6. Run `npm run build`, `npm run test:preview-sides` (which should then be
   gone), `npm run test:observability:request-id` and
   `npm run test:recruiter-signup-closed`.

### What a revert does NOT undo

- **Accounts created while the gate was up.** Preview accounts, invited HRs,
  and anyone who registered. They are ordinary accounts and stay.
- **Credits granted** to those workspaces. The ledger is append-only.
- **The Klymb AI rename** (#805 touches it) — unrelated to the gate.

## 5. Tests that hold this together

| Command | What it protects |
| --- | --- |
| `npm run test:preview-sides` | What the gate opens and to whom — 21 cases, driving the real `middleware.ts` |
| `npm run test:recruiter-signup-closed` | Recruiter self-signup stays shut; invites keep working — 13 cases |
| `npm run test:hr-invite` | Invite tokens: single use, expiry, peek does not spend — 5 cases, needs `DATABASE_SAMPLE_URL` |
| `npm run test:observability:request-id` | Middleware still carries the request id on every branch, gate included |

A note for whoever reads this next: middleware does not load under `next dev`
in this project, and under `next start` the session cookie is `__Secure-`
prefixed, which plain `http://localhost` will not carry. That is why the gate
is tested through `preview-side-switch.test.ts` rather than by hand.
