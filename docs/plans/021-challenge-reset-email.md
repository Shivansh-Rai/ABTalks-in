# 021 — Email participant when admin resets their Claude challenge

## 1. Goal
When an admin resets a participant's progress from the admin panel, automatically
email that participant confirming their **Claude AI Challenge** has been reset and
they can restart from Day 1. Fires only for **CLAUDE** enrollments.

## 2. Current behavior
`resetProgressAction` (`src/app/actions/admin-actions.ts:28`) runs a transaction:
deletes the enrollment's submissions, resets the enrollment
(`daysCompleted/currentStreak/longestStreak = 0`, `lastSubmittedDay = null`,
`status = ACTIVE`, `completedAt = null`, `startedAt = now`), clears
`isReadyForInterview`, and logs a `RESET_PROGRESS` admin action. **No email is
sent.** The enrollment is fetched via `tx.enrollment.findFirst({ where: { userId } })`
(full record, so `domain` is available) but the target user's email/name are not
loaded.

Email infra (reuse, do not add new): `sendEmail()` in `src/lib/email.ts` (Resend;
already skips `@abtalks.dev` test addresses and no-ops if `RESEND_API_KEY` is
missing). Templates live in `src/features/email/` and return `{ subject, html, text }`
(see `claude-welcome-email.ts`). Sends are fired via `after()` from `next/server`
so they don't block the action response (see `registration-actions.ts:98`).

## 3. Files to touch
- `[new]` `src/features/email/challenge-reset-email.ts` — template function
  `challengeResetEmail({ firstName, dashboardUrl })` returning `{ subject, html, text }`.
- `[edit]` `src/app/actions/admin-actions.ts` — in `resetProgressAction`, capture the
  reset enrollment's `domain`; after the transaction commits, if `domain === "CLAUDE"`,
  load the target user's email + first name and send the email via `after()` + `sendEmail()`.

## 4. Server vs Client
Both files are **server-only**. `admin-actions.ts` is a `"use server"` module;
`sendEmail` is `import "server-only"`. No client components, no Server→Client props.

## 5. Steps

### Step 1 — Create `src/features/email/challenge-reset-email.ts`
Mirror the structure of `claude-welcome-email.ts` (plain function, no side effects,
returns `{ subject, html, text }`). Content is fixed (from the provided copy);
only the first name and dashboard URL are dynamic.

- **Subject:** `Update: Your Challenge Reset Request Has Been Approved`
- **Greeting:** `Hello <strong>${firstName}</strong>,`
- **Body paragraphs** (verbatim from provided copy):
  1. "Thank you for submitting your Challenge Reset Request."
  2. "We have reviewed your request and are pleased to inform you that your challenge
     progress has been successfully reset. You may now restart the **ABTalks 60-Day
     Claude AI Challenge** from **Day 1**."
  3. "A fresh start is a valuable opportunity to rebuild momentum, strengthen your
     consistency, and get the most out of the challenge experience."
  4. "**Please note:** To continue your participation, you must complete and submit
     the **Day 1 task before 12:00 AM (midnight) today.**"
  5. "We encourage you to stay committed, maintain your daily streak, and keep moving
     forward one day at a time."
  6. "We look forward to supporting your journey and seeing your progress throughout
     the challenge."
  7. "Best regards,<br>Team ABTalks"
- **CTA button:** black (`background:#000000; border-radius:11px`), label
  "Login to Dashboard", `href` = `dashboardUrl`. Use a table-based / inline-styled
  anchor button (email-client safe), matching the Brevo design's black pill button.
- **Social icons row** (optional but requested by the Brevo design) — a centered row
  of linked icons using the Brevo-hosted PNG asset URLs from the provided template:
  LinkedIn `https://www.linkedin.com/company/abtalks-on-ai`,
  YouTube `https://youtube.com/@abtalksonai`,
  Discord `https://discord.gg/946Ucj6dd`,
  WhatsApp `https://chat.whatsapp.com/Fqx07wwZhiq0lA6Z7d5uad`,
  Instagram `https://www.instagram.com/abtalks_official`.
  (Icons via `<img>` with the `creative-assets.mailinblue.com/editor/social-icons/...`
  URLs already in the provided template. If any brand-consistency concern, they can be
  dropped — the button + copy are the required part.)
- Use table-based layout with inline styles for email-client compatibility (the
  existing welcome template is minimal; this one has a button + icons so wrap the
  content in a 600px centered `<table>`). Keep a full plain-text `text` version
  (same copy, `Login to your dashboard: <dashboardUrl>`, no HTML).
- `firstName` derivation is done by the caller (Step 2); the template just interpolates.

### Step 2 — Wire into `resetProgressAction` (`src/app/actions/admin-actions.ts`)
1. Add imports at top:
   ```ts
   import { after } from "next/server";
   import { sendEmail } from "@/lib/email";
   import { challengeResetEmail } from "@/features/email/challenge-reset-email";
   ```
2. Inside the transaction, capture the enrollment's `domain` (it's already fetched via
   `findFirst`; just read `enrollment.domain`). Hoist a `let resetDomain: string | null`
   in the action scope and set it from the fetched enrollment so it's available after
   commit. (Or re-select minimally — but the record is already loaded, so just capture it.)
3. After `revalidateAdminViews(targetUserId)` and before `return { ok: true }`, add:
   ```ts
   if (resetDomain === "CLAUDE") {
     const target = await prisma.user.findUnique({
       where: { id: targetUserId },
       select: { email: true, studentProfile: { select: { fullName: true } } },
     });
     const to = target?.email;
     const fullName = target?.studentProfile?.fullName ?? "";
     if (to) {
       const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://abtalks.in";
       const firstName = fullName.trim().split(/\s+/)[0] || "there";
       after(async () => {
         const { subject, html, text } = challengeResetEmail({
           firstName,
           dashboardUrl: `${appUrl}/dashboard`,
         });
         await sendEmail({ to, subject, html, text });
       });
     }
   }
   ```
4. Email send is best-effort: `after()` runs post-response and `sendEmail` already
   swallows/logs its own failures, so a mail problem must never fail the reset. Do NOT
   wrap the reset transaction around the email.

## 6. Guardrails for Cursor (DO NOT)
- Do NOT use Brevo or add a new email client/SDK — reuse `sendEmail()` (Resend). The
  Brevo YAML is a **design reference only**.
- Do NOT send for non-CLAUDE resets — gate strictly on `domain === "CLAUDE"`.
- Do NOT block or fail `resetProgressAction` if the email fails — send inside `after()`,
  outside the DB transaction.
- Do NOT fetch the user's email inside the `$transaction` callback — do it after commit.
- Do NOT add `requireAdmin`/auth changes — the action already calls `requireAdmin()`.
- Do NOT hardcode the app URL — use `process.env.NEXT_PUBLIC_APP_URL ?? "https://abtalks.in"`
  (same pattern as `registration-actions.ts`).
- Keep the template a pure function returning `{ subject, html, text }` — no I/O, no
  `sendEmail` call inside the template file.
- `sendEmail` already skips `@abtalks.dev` — no extra test-account handling needed.

## 7. DB safety
None — no schema or migration changes. Read-only user lookup + existing reset logic.

## 8. Verification
- Reset a **CLAUDE** participant (real email, not `@abtalks.dev`) from
  `/admin/students/[id]` → participant receives the "Challenge Reset Request Has Been
  Approved" email; greeting shows their first name; "Login to Dashboard" button points
  to `<appUrl>/dashboard`; reset still completes and admin views revalidate.
- Reset a participant whose enrollment domain is **not** CLAUDE → reset works, **no**
  email sent.
- Reset with `RESEND_API_KEY` unset (local) → reset works, `sendEmail` logs "skipping"
  and no throw.
- Reset a `@abtalks.dev` test account → reset works, email skipped.
- `npm run build` and `npx tsc --noEmit` pass.
- Files changed: `src/features/email/challenge-reset-email.ts` (new),
  `src/app/actions/admin-actions.ts` (imports + email block in `resetProgressAction`).

## 9. Commit message
```
feat(admin): email participant when their Claude challenge is reset
```
