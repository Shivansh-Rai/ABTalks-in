# 152 — Recruiter sign-in email deliverability

## 1. Goal
Stop the recruiter sign-in code email from landing in Gmail / Outlook junk
folders. Land it in the primary inbox where recruiters actually check.

## 2. Symptom
User report (2026-09-18): recruiter login OTP email consistently lands in
the spam/junk folder on Gmail and Outlook, not the primary inbox.

## 3. Root cause — mixed
The problem is a combination of two things. Fixing one without the other
gets partial improvement; the mail lands in inbox reliably only when both
are in place.

### 3a. Message-level (code) problems
- **Tiny 3-line HTML fragment** with no `<html>`/`<head>`/`<body>`, no
  `<title>`, no preheader. Every modern spam filter treats a bare HTML
  fragment as a strong phishing signal.
- **Subject line contains "verification code"**. "Verification" is a
  spam-heavy word; "sign-in code" or "one-time code" scores far better,
  and putting the code IN the subject is what every legit transactional
  sender (Google, Slack, Notion, GitHub) now does — Gmail's snippet
  expansion also shows it for one-tap copy.
- **No `List-Unsubscribe` header**. Gmail's Feb-2024 bulk-sender rules
  score this even for transactional mail. Absent = worse Inbox placement.
- **No `X-Entity-Ref-ID`**. Helps recipient MUAs dedupe if a code is
  resent, which improves engagement metrics that filters weight.
- **No `Precedence: bulk` fallback**.
- **No recipient display name** in the `To:` field.

### 3b. Domain-level (DNS) problems — verify all three
Even the best-written mail lands in spam if the sender domain isn't
authenticated. `abtalks.in` needs all three DNS records below. Check
current state with [MXToolbox](https://mxtoolbox.com/SuperTool.aspx) —
enter `abtalks.in` and run: SPF Lookup, DKIM Lookup (selector: `brevo1`,
`brevo2`, then `mail`), DMARC Lookup.

Each record type is checked below with the value it should have.

## 4. Fix (this plan)

### 4a. Code (this branch — landed)
- Extend `src/lib/email.ts` with `headers` + `tags` + `toName` options.
  Every send now defaults to a `List-Unsubscribe`, `List-Unsubscribe-Post`,
  `X-Entity-Ref-ID`, `X-Mailer` and `Precedence: bulk` header set. Every
  send gets a Brevo tag = `[kind]` for dashboard filtering.
- Rewrite the OTP email template in
  `src/app/actions/recruiter-auth-actions.ts`:
  - Subject: `Your ABTalks sign-in code is ${code}` (code in subject).
  - Full HTML5 document (matches the workshop-email house style).
  - Preheader line (shown in inbox snippet).
  - Big monospace code block, expiry copy, reassurance copy, support
    mailto, footer with domain and transactional disclaimer.
  - Longer plain-text version (bare code was too short).
  - Brevo tags: `["recruiter-otp", "transactional"]`.

### 4b. DNS — you must do this on your registrar (Cloudflare / GoDaddy / Route 53 / etc.)

The name of each record is the exact hostname you enter. TTL 3600 is fine
for all of them.

**1. SPF record (TXT on the root domain)**

Only ONE SPF record is allowed per domain. If one already exists, DON'T
add another — merge the Brevo include into it.

- Host / Name: `@` (or blank / `abtalks.in` depending on the registrar)
- Type: `TXT`
- Value: `v=spf1 include:spf.brevo.com include:_spf.google.com ~all`

If you don't use Google Workspace for `abtalks.in` mail, drop the Google
include:

- Value: `v=spf1 include:spf.brevo.com ~all`

The `~all` at the end is softfail — safer than `-all` while you're
still ramping up sender reputation.

**2. DKIM records (2 CNAMEs published by Brevo)**

Log in to Brevo → **Senders, Domains & Dedicated IPs** → **Domains** →
find `abtalks.in` → **Authenticate this domain**. Brevo will show two
CNAMEs to add. They look like:

- Host: `brevo1._domainkey.abtalks.in` → Value: `b1.abtalks.in.dkim.brevo.com` (or similar)
- Host: `brevo2._domainkey.abtalks.in` → Value: `b2.abtalks.in.dkim.brevo.com` (or similar)

Add both as CNAME records on your DNS. Then go back to Brevo and click
**Verify** — it should turn green within 5 minutes. If it doesn't,
propagation can take up to 24h.

Also add the **Brevo Code** TXT record Brevo shows on the same page
(host: `abtalks.in`, type: TXT, value: `brevo-code:XXXXX`).

**3. DMARC record (TXT on `_dmarc.abtalks.in`)**

- Host / Name: `_dmarc`
- Type: `TXT`
- Value: `v=DMARC1; p=none; rua=mailto:dmarc@abtalks.in; ruf=mailto:dmarc@abtalks.in; fo=1; adkim=r; aspf=r; pct=100`

Start with `p=none` (monitor-only, no rejection). Watch the DMARC reports
that land in `dmarc@abtalks.in` for a week. Once you're sure all your
legitimate mail (Brevo, Google Workspace, transactional apps) is aligned,
tighten to `p=quarantine` and then eventually `p=reject`. Never jump
straight to `p=reject` — you WILL bounce mail you didn't mean to.

### 4c. Brevo dashboard — verify the sender

Even with DNS right, Brevo won't send from a domain that isn't verified
in their dashboard. Confirm:

1. Brevo → **Senders, Domains & Dedicated IPs** → **Senders**.
2. `team@abtalks.in` should be listed and show a green "Authenticated"
   badge. If it shows "Not authenticated", click it and complete the
   verification flow (email verification link to the address).

## 5. Verification (after DNS records propagate — 5 min to 24h)

1. Trigger a recruiter sign-in from `/talent/login` with a personal test
   address (Gmail account you can check).
2. Open the received message → three-dot menu → **Show original**
   (Gmail) or **View message source** (Outlook).
3. Look for:
   - `SPF: PASS`
   - `DKIM: PASS` (with `d=abtalks.in`)
   - `DMARC: PASS`
   - `List-Unsubscribe:` header present
   - `X-Entity-Ref-ID:` header present
4. If all three auth results are PASS and the mail is in Inbox (not
   Promotions, not Spam), you're done.
5. Optional but nice: use [mail-tester.com](https://www.mail-tester.com/)
   — it grades your mail out of 10 and lists any remaining issues. Aim
   for 9+.

## 6. Ownership
- **Manuvrtti** (Notification delivery, this ticket): code changes in
  `src/lib/email.ts` and `src/app/actions/recruiter-auth-actions.ts`,
  this doc.
- **Sohail** (Authentication, waived on user's explicit go-ahead): the
  OTP email template edit lives in the recruiter-auth actions file.
- **DNS + Brevo sender verification**: you (product / infra), not code.

## 7. Rollback
The code changes are additive and safe. If we needed to roll back:
- Revert the commit.
- The old template will send again; the header additions default in
  `sendEmail` disappear.
- DNS changes don't need to be rolled back — SPF/DKIM/DMARC are strictly
  beneficial regardless of provider choice.
