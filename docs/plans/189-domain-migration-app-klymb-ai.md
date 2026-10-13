# 189 — Domain migration: abtalks.in → app.klymb.ai

> Supersedes an earlier draft numbered 184, which collided with
> `184-assessment-publish-without-candidates.md` after a master pull.

## 1. Goal

Move the ABTalks application from `abtalks.in` / `www.abtalks.in` to
**`app.klymb.ai`**, `abtalks.in` is then repurposed to host a different
site of ours, keeping four path prefixes redirected so links already sent in
email and WhatsApp, and the verify URLs printed on 3,429 issued certificates,
keep resolving (§5 step 15). Transactional mail keeps sending **from** `team@abtalks.in` (warmed,
already verified on both sending rails) while every link inside it points at
the new host.

**Hard constraint from the environment:** `klymb.ai` (the apex) already runs a
*different* application. That makes this a subdomain co-tenancy, not a domain
takeover, and it drives the single most important decision in this plan —
see §6-A.

## 2. Current behavior

- One canonical origin pair, `abtalks.in` + `www.abtalks.in`, both serving this
  Next app from one Vercel project (`abtalksapp`).
- `src/auth.config.ts` deliberately widens the Auth.js **OAuth check** cookies
  (PKCE verifier / state / nonce) to `.abtalks.in`, because a Google callback
  landing on the other of the two hosts could not read a host-only cookie.
  It matches the literal hostnames `abtalks.in` / `www.abtalks.in` out of
  `AUTH_URL`. **This is the only place in the codebase that sets a cookie
  `domain`** — audited across every `cookies.set` and `document.cookie` site.
- The **session** cookie (`__Secure-authjs.session-token.v2`) sets no `domain`
  and is therefore already host-only. So are `abtalks_ref`, `abtalks_src`,
  `abtalks_consent`, the UTM cookie and the newsletter-pref cookie.
- `middleware.ts:132` expires leftover OAuth check cookies on both `undefined`
  (host-only) and `.abtalks.in`.
- **14 non-test modules** hard-code `https://abtalks.in`, `https://www.abtalks.in`
  or `https://abtalksapp.vercel.app` as the **fallback** for an unset
  `NEXT_PUBLIC_APP_URL`.
- `src/app/achievements/page.tsx:47` and `src/app/admin/hackathon-links/page.tsx:20`
  derive the base URL from the inbound `Host` header, falling back to
  `"abtalks.in"` — already host-correct after cutover.
- **Two sending rails** (plans 185/186): `src/lib/email.ts` routes each mail
  `kind` either to Brevo or, when `EMAIL_VIA_ABT_KINDS` matches and
  `EMAIL_KEEP_ON_BREVO_KINDS` does not, to **ABT-Mailer** — a separate SES
  service deployed at `ABT_MAILER_URL` (`abt-mailer.vercel.app`). Both rails
  send `From: FROM_EMAIL` (default `team@abtalks.in`).
- **Two inbound webhooks**: `/api/webhooks/brevo?secret=<BREVO_WEBHOOK_SECRET>`
  and `/api/webhooks/abt-mailer` (HMAC via `ABT_MAILER_HMAC_SECRET`, no query
  secret). Both are configured *in the sender's* dashboard/deployment and point
  at this app's host.
- The chatbot knowledge base (`knowledge/**`) and the chat renderer
  (`src/components/chatbot/ChatBubble.tsx`) know `abtalks.in` as *the* site
  domain; the renderer auto-links bare `abtalks.in` URLs.
- There is **no** `sitemap.ts`, `robots.ts` or `metadataBase`; `layout.tsx`
  sets only `title: "ABTalks"`. Nothing to repoint — but also no canonical
  signal to help the move.
- Stored `UserNotification.href` values are **relative** (`/dashboard`,
  `/hackathon`), prefixed with the base URL at render time. Verify — §7.
- Vercel Blob assets serve from `*.public.blob.vercel-storage.com`:
  domain-independent.

## 3. Files to touch

### Code owned by me (Sohail — auth, security, infra, shared architecture)

| File | | Note |
|---|---|---|
| `src/auth.config.ts` | `[edit]` | Delete `oauthCookieDomain()` + the `cookieDomain` spread. Host-only OAuth check cookies. The §6-A security fix. |
| `middleware.ts` | `[edit]` | Document why `.abtalks.in` stays in the *expiry* sweep (see §6-D). No behaviour change. Stays edge-safe. |
| `src/lib/email-code.ts:350` | `[edit]` | `APP_URL` fallback → `https://app.klymb.ai`. |
| `src/app/actions/admin-actions.ts:174` | `[edit]` | Fallback → new host. |
| `src/app/verify/[certificateId]/download/route.ts:43` | `[edit]` | Certificate QR / verify URL fallback → new host. |
| `.env.example` | `[edit]` | Document the canonical host and the never-set-a-cookie-domain rule. |
| `docs/project-context.md` | `[edit]` | §6 auth + §env: new canonical host, cookie rule, retired widening. |
| `docs/CHANGELOG.md` | `[edit]` | One dated line under `## Pending reconcile`. |

### Cross-module — needs owner approval before editing (§6-B)

| File | Owner | Note |
|---|---|---|
| `src/features/hire/outreach.ts:55,57` | Zainab | `APP_URL` fallback `https://www.abtalks.in`. `OUTREACH_REPLY_TO_EMAIL` stays. |
| `src/features/hire/run-hire-alerts.ts:138,145` | Zainab | Fallback is `https://abtalksapp.vercel.app` — wrong even today. |
| `src/features/hire/unlock-transaction.ts:89` | Zainab | Support-email copy — **no change**. Listed so it is not "fixed" by mistake. |
| `src/features/resume/import/outreach.ts:57` | Zainab | Claim-link base fallback. |
| `src/features/resume/import/outreach-templates.ts:35` | Zainab | Hard-coded `http://abtalks.in/?utm_source=brevo…` in a template (also plain `http://`). |
| `src/features/notification/email-delivery.ts:90` | **Manuvrtti — LOCKED** | Base-URL fallback. |
| `src/features/notification/account-deleted-email.ts:15` | **Manuvrtti — LOCKED** | Base-URL fallback. |
| `src/features/notification/recruiter-welcome-email.ts:29` | **Manuvrtti — LOCKED** | Base-URL fallback. |
| `src/app/actions/enrollment-actions.ts:72` | Shared / enrollment | Fallback → new host. |
| `src/lib/hackathon-email.ts:6` | Shared / hackathon | Fallback → new host. |
| `src/features/legal/notify-data-request.ts:26` | Shared / legal | Fallback → new host. |
| `src/app/verify/[certificateId]/page.tsx:144` | Shallika | Visible certificate footer `Issued by ABTalks · abtalks.in`. |
| `src/components/hackathon/success-panel.tsx:107` | Shallika / hackathon | Visible copy `abtalks.in/hackathon`. |
| `src/components/hackathon/dashboard/invite-panel.tsx:61` | Shallika / hackathon | Visible copy `abtalks.in/hackathon`. |
| `src/components/chatbot/ChatBubble.tsx:26-27` | Shared / chatbot | Bare-URL autolinker keyed on `abtalks.in`; must also match `app.klymb.ai` or chatbot links render as plain text. |
| `knowledge/processed/*.md`, `knowledge/generated/*.md` | Shared / chatbot | KB answers quote `abtalks.in`. Re-ingest, do not hand-edit. |
| `content/legal/privacy.md`, `terms.md`, `cookies.md` | Shared / legal | Add the new domain to the "Service" definition. Contact address unchanged. |

**Every fallback above is a fallback.** With `NEXT_PUBLIC_APP_URL=https://app.klymb.ai`
set in Vercel production, none is reached. Fixing them means a mis-set env var
degrades to the *right* host — worth doing, **not on the critical path, and not
a cutover blocker.** Ship §5 phases 1–4 first; land the literals per owner after.

## 4. Server vs Client

| Component / module | Boundary | Note |
|---|---|---|
| `middleware.ts` | Edge runtime | Edge-safe rule: only `next-auth` + `next/server`. The change edits a comment; adds no import. |
| `src/auth.config.ts` | Edge (imported by middleware) | The change *deletes* a function and a spread. Cannot grow the bundle. |
| `src/app/achievements/page.tsx` | Server Component | Reads `headers()`, passes a plain `verifyBaseUrl` string to a client child — string only, boundary-safe. |
| `src/app/admin/hackathon-links/page.tsx` | Server Component | Same pattern. |
| `src/app/verify/[certificateId]/download/route.ts` | Route handler | No boundary. |
| `src/components/chatbot/ChatBubble.tsx` | **Client** | Regex-only change; no new props cross the boundary. |
| `src/components/hackathon/success-panel.tsx`, `invite-panel.tsx` | **Client** | Static copy only. |
| `src/lib/email.ts`, `src/lib/abt-mailer.ts`, all `*-email.ts`, `outreach*.ts` | Server-only | Never imported by a client component. |

No Server→Client prop shape changes anywhere in this plan.

## 5. Steps

### Phase 1 — Prepare the new host (no user impact, fully reversible)

1. **Google Search Console:** verify `klymb.ai`. Step 5 blocks on this and it
   is the likeliest thing to stall, so it goes first.
2. **Vercel:** add `app.klymb.ai` to the `abtalksapp` project.
   Do **not** add `klymb.ai` or `www.klymb.ai` — the apex belongs to the other
   application and claiming it here would take that app down.
3. **DNS (klymb.ai zone):** add the `CNAME` for `app` that Vercel prints.
   Leave every existing apex/`www` record untouched.
   `dig app.klymb.ai CNAME +short`
4. Wait for the certificate (Domains tab: *Valid Configuration*). Confirm with
   `curl -sI https://app.klymb.ai/ | head -1`. Both hosts now serve the app;
   nothing has changed for users.
5. **Google Cloud Console** → the OAuth client behind `AUTH_GOOGLE_ID`, **add**
   (remove nothing):
   - JavaScript origins: `https://app.klymb.ai`
   - Redirect URIs: `https://app.klymb.ai/api/auth/callback/google`
   - Consent screen → Authorized domains: `klymb.ai` (needs step 1)
6. **Prove it before touching any env var:** sign in with Google at
   `https://app.klymb.ai/login` while `AUTH_URL` still points at the old host.
   Google rejects an unregistered redirect URI, so a successful sign-in is the
   proof. **Do not start Phase 3 until this passes.**

### Phase 2 — Code: cookie scope (independent of the cutover — see step 10)

7. `src/auth.config.ts`: delete `oauthCookieDomain()`, the `cookieDomain`
   constant and the `...(cookieDomain ? { domain: cookieDomain } : {})` spread.
   Replace the comment with the §6-A rationale.
8. `middleware.ts`: document why `.abtalks.in` stays in the expiry sweep (§6-D).
9. `npx tsc --noEmit` and `npm run build` must pass.
10. **Phase 2 is not a prerequisite for cutover.** `oauthCookieDomain()`
    matches only the two literal `abtalks.in` hostnames, so the moment
    `AUTH_URL` becomes `https://app.klymb.ai` it returns `undefined` and the
    cookies go host-only *with the old code still deployed*. Phase 2 removes
    dead code and the trap of it reactivating if anyone ever sets `AUTH_URL`
    back — valuable, but it can merge before or after Phase 3. Do NOT treat it
    as a gate, and do not deploy it to the old host on its own: there it would
    narrow the live apex↔www OAuth bridge for no benefit.

### Phase 3 — Cutover (the user-visible moment)

**Observed starting state (measured 2026-10-10):** `AUTH_URL` is
`https://abtalks.in`; `abtalks.in` 307s to `www.abtalks.in`, so **www is the
canonical host today**, not the apex. `app.klymb.ai` already serves the app
(200, `<title>ABTalks</title>`) but Auth.js there still resolves every
`signinUrl` / `callbackUrl` to `https://abtalks.in/...`, and the OAuth-check
cookies are emitted with `Domain=.abtalks.in` — which a browser on
`app.klymb.ai` rejects outright.

**Consequence: Phase 1 step 6 cannot be satisfied as written, and a Google
sign-in started from `app.klymb.ai` today does not test the new host at all.**
With `AUTH_URL` on the old host, Auth.js sends
`redirect_uri=https://abtalks.in/api/auth/callback/google`, so Google returns
the user to the OLD host. It looks like a successful sign-in and proves
nothing about `app.klymb.ai`. The env flip has to come first; the gate moves
to step 13 below.

11. **Vercel env vars, Production scope:**
    - `NEXT_PUBLIC_APP_URL=https://app.klymb.ai`
    - `AUTH_URL=https://app.klymb.ai` (and `NEXTAUTH_URL` if set — keep identical)
    - leave `NEXT_PUBLIC_APP_ENV`, `AUTH_SECRET`, `FROM_EMAIL`,
      `REPLY_TO_EMAIL`, `OUTREACH_REPLY_TO_EMAIL`, `ABT_MAILER_URL` and both
      mail-routing lists **unchanged**.
    `NEXT_PUBLIC_APP_URL` is inlined at build time → **redeploy, not restart.**
12. **Do not set the domain redirects yet.** Leave `abtalks.in` /
    `www.abtalks.in` serving the app. This is the rollback lever: if step 13
    fails, revert the two env vars, redeploy, and the old host is still live
    and canonical. Nothing is irreversible until step 14.
13. **THE GATE — Google sign-in on the new host.** Sign in with Google at
    `https://app.klymb.ai/login`. Confirm all three:
    - `curl -s https://app.klymb.ai/api/auth/providers` shows every
      `callbackUrl` on `https://app.klymb.ai/...` (not `abtalks.in`);
    - the Google consent screen appears rather than
      `Error 400: redirect_uri_mismatch` — a mismatch means Phase 1 step 5 did
      not land, so fix the redirect URI and retry;
    - you land back on `app.klymb.ai` **signed in**, not bounced to `/login`.
    Then devtools → Application → Cookies: the session cookie and every
    OAuth-check cookie must show **no** `Domain` value.
    If any of the three fails, roll back per step 12.
14. Sign in through **every remaining door**: candidate email code, candidate
    password, recruiter OTP, recruiter password, admin (Google-only). Confirm
    `/admin` gates and a recruiter session cannot reach a candidate surface.
15. **Only now, hand over `abtalks.in` — with carve-outs.** Decision
    (2026-10-13): `abtalks.in` will host a DIFFERENT site, owned by us, rather
    than 308 to `app.klymb.ai` wholesale. Four path prefixes must still
    redirect, because their recipients **cannot reconstruct the URL**: the
    token is opaque, or the link is baked into an artifact already in someone
    else's hands.

    | Prefix | Why it must survive |
    |---|---|
    | `/verify/:path*` | 3,429 issued `Credential` rows. The verify URL is printed in downloaded PDFs and encoded in their QR codes, and sits on LinkedIn profiles and résumés. Unrecoverable — you cannot reissue an artifact someone already holds. |
    | `/claim/:path*` | Signed single-use outreach tokens in already-sent invite email (`outreach.ts:61`). Nobody can retype one. |
    | `/r/:path*` | Opaque recruiter share tokens for assessment reports. Named explicitly in `content/legal/terms.md`. |
    | `/hackathon`, `/hackathon/:path*` | Printed in UI copy ("register at abtalks.in/hackathon") and spread by WhatsApp share. Reconstructable, but free to include. |

    Deliberately NOT carved out: `/dashboard`, `/profile`, `/hire`, `/jobs`,
    `/login`, `/program`, `/workshop`. A person who lands on the new site can
    reach all of these by going to `app.klymb.ai` and signing in, and reserving
    them would constrain the new site's own URL space for no gain.

    Rules go on **whichever project serves the new site**, not this one, and
    cover `www.abtalks.in` as well as the apex. On Vercel:

    ```json
    { "redirects": [
      { "source": "/verify/:path*",    "destination": "https://app.klymb.ai/verify/:path*",    "permanent": true },
      { "source": "/claim/:path*",     "destination": "https://app.klymb.ai/claim/:path*",     "permanent": true },
      { "source": "/r/:path*",         "destination": "https://app.klymb.ai/r/:path*",         "permanent": true },
      { "source": "/hackathon",        "destination": "https://app.klymb.ai/hackathon",        "permanent": true },
      { "source": "/hackathon/:path*", "destination": "https://app.klymb.ai/hackathon/:path*", "permanent": true }
    ] }
    ```

    **Order matters — deploy the rules before the DNS moves**, or there is a
    window where a scanned certificate QR 404s:
    1. Deploy the new site WITH the redirect rules above, on its own URL.
    2. Remove `abtalks.in` and `www.abtalks.in` from the ABTalks Vercel project
       (Vercel refuses the same domain on two projects).
    3. Add both to the new project; let the certificate issue.
    4. Verify before announcing anything:
       ```
       curl -sI https://abtalks.in/verify/ABT-XXXXX     | grep -i location
       curl -sI https://www.abtalks.in/claim/sometoken  | grep -i location
       curl -sI https://abtalks.in/r/sometoken          | grep -i location
       ```
       Each must land on the same path under `app.klymb.ai`.

16. **Expect every signed-in user to be logged out.** The session cookie is
    host-only by design and does not travel across domains. There is no
    supported way to carry a `__Secure-` host-only session over without
    widening it to `.klymb.ai`, which §6-A forbids. Warn users beforehand and
    cut over off-peak IST.

### Phase 4 — Third-party and operational follow-through

17. **Both mail webhooks** now point at this app's host and must move — a 308
    on a POST is fragile, and bounce handling failing silently is a real failure
    mode:
    - Brevo dashboard → transactional webhook →
      `https://app.klymb.ai/api/webhooks/brevo?secret=<BREVO_WEBHOOK_SECRET>`
    - **ABT-Mailer deployment** → its callback/webhook target →
      `https://app.klymb.ai/api/webhooks/abt-mailer`. This lives in the
      separate `abt-mailer` project, not this repo. Check it for any other
      hard-coded `abtalks.in` callback or allow-list entry while you are there.
    Send one test through each rail and confirm a row lands.
18. **Sender identity needs no change**, but confirm it: `FROM_EMAIL`
    (`team@abtalks.in`) is used by *both* rails, so `abtalks.in` must stay a
    verified SES identity in ABT-Mailer **and** a verified Brevo sender. Do not
    let the domain move prompt a sender change — see §6-C.
19. **Google Search Console:** verify `app.klymb.ai` as a property. The *Change
    of Address* tool is apex→apex only, so a move into a subdomain of a domain
    you do not fully own is not eligible; rely on the 308s. Request indexing of
    `/`, `/workshop`, `/hire`, `/program`, `/hackathon`.
20. **GA4:** update the web data stream's URL. Because the apex app is a
    separate application, check whether it has its own GA property — if so, add
    each other's hostname to *referral exclusions* so an apex→app hop is not
    counted as new acquisition traffic.
21. **Sentry:** check `instrumentation-client.ts` / `sentry.server.config.ts`
    for `tracePropagationTargets` or an allowed-domains list pinned to the old
    host. Confirm with a deliberate test error that events arrive and source
    maps resolve.
22. **Vercel crons** (`/api/cron/program-commits`, `/api/cron/hire-alerts`,
    `/api/cron/resume-imports`) are path-relative to the deployment and need no
    change; `RESUME_IMPORT_SELF_URL` is unset and falls back to `VERCEL_URL`.
    Confirm the next scheduled run succeeds rather than assuming it.
23. **Chatbot knowledge base**, once the new host is live:
    `SITE_BASE_URL=https://app.klymb.ai npm run ingest:site`, then
    `npm run kb:embed` (costs OpenAI credit), then `npm run test:chatbot`.
24. **Literals follow-up (separate PR per owner):** land §3's fallback-string
    and visible-copy changes, each gated on its owner's approval.

## 6. Guardrails

### 6-A. The one that matters: never set a cookie `domain` of `.klymb.ai`

`klymb.ai` already runs a different application. A cookie scoped to `.klymb.ai`
is sent by the browser to **every** host under it — that application included —
and can be *set* by any present or future `*.klymb.ai` subdomain, which is
subdomain session fixation.

- **DO NOT** add `domain` to `cookies.sessionToken` in `src/auth.config.ts`.
- **DO NOT** reintroduce `oauthCookieDomain()` with `.klymb.ai`.
- **DO NOT** set a `domain` on `abtalks_ref`, `abtalks_src`, `abtalks_consent`,
  the UTM cookie or the newsletter-pref cookie. All are host-only today.
- The widening existed **only** to bridge `abtalks.in` ↔ `www.abtalks.in`. One
  canonical host removes the need. This is a security improvement, not a
  regression.
- Any future "share login with the klymb.ai site" request is an
  authentication-architecture change and comes to me (Sohail) first.

### 6-B. Ownership

- `src/features/notification/**` is **LOCKED** (Manuvrtti). Three files hold an
  `https://abtalks.in` base-URL fallback, *unreachable* in production once
  `NEXT_PUBLIC_APP_URL` is set. The cutover does not require touching them. Do
  not edit them here; raise separately — see §6-E for the notice.
- `src/features/hire/**` and `src/features/resume/import/**` are Zainab's;
  `src/components/hackathon/**` and the certificate footer copy are Shallika's.
  Separate PRs, owner as reviewer.
- Do not bundle unrelated `.github/CODEOWNERS` edits into this migration.

### 6-C. Mail

- **DO NOT** change `FROM_EMAIL`, `REPLY_TO_EMAIL` or `OUTREACH_REPLY_TO_EMAIL`.
  Mail keeps flowing from the warmed `abtalks.in` identity on both rails.
- *Known cosmetic consequence:* mail will be `From: team@abtalks.in` carrying
  `app.klymb.ai` links. DMARC aligns on the From domain, so deliverability is
  technically unaffected — but some recipients and stricter filters read a
  From/link-domain mismatch as a phishing signal. Watch Brevo bounce and
  spam-report rates, and ABT-Mailer's SES bounce/complaint rates, for two weeks
  after cutover. A move there is the trigger for a separate sender-migration
  project, not a reason to rush one now.
- **DO NOT** point `ABT_MAILER_URL` at the new domain. It is the *sender
  service's* own host (`abt-mailer.vercel.app`) and is unrelated to this move.

### 6-D. Why `.abtalks.in` was REMOVED from the middleware sweep

An earlier revision of this plan kept `.abtalks.in` in
`expireOAuthCheckCookies`, reasoning that the function only expires cookies so
it carries no risk, and that the entry would clear cookies widened by an
earlier deploy. **Measurement on the live deploy disproved that.**

`curl -sI https://app.klymb.ai/login` returns **12** OAuth-check `Set-Cookie`
headers for **12** names in `OAUTH_CHECK_COOKIE_NAMES` — one each, every one
carrying `Domain=.abtalks.in`. `NextResponse.cookies.set` keys by name, so the
second loop iteration overwrote the first and the host-only variant was never
emitted at all. The sweep has therefore never cleared a host-only cookie, which
is the exact case it exists for.

The entry is now gone and the sweep is host-only, one header per name. A
widened cookie still sitting on someone's browser is scoped to a domain
`app.klymb.ai` is not under, so it is never sent to the new host and could not
be cleared from there regardless; it lapses on its own 15-minute `maxAge`.

### 6-E. Other DO-NOTs

- **DO NOT** add `klymb.ai` or `www.klymb.ai` to this Vercel project.
- **DO NOT** add `@/lib/*` imports to `middleware.ts` or `src/auth.config.ts`
  (edge 1 MB bundle limit).
- **DO NOT** implement the old→new host redirect in `next.config.ts`
  `redirects()` or in middleware. `redirects()` matches paths, not hosts, and a
  middleware host check burns a function invocation on every legacy hit.
- **DO NOT** add `requireRole` / `requireAdmin` to `/login`, `/logout` or the
  Auth.js handler while touching auth files.
- **DO NOT** change `AUTH_SECRET` *during* the cutover — it compounds two
  forced-logout events and makes failures indistinguishable. Afterwards it is a
  judgement call, and the better primary mitigation is below.
- **Stale session cookies on `abtalks.in`.** Users who signed in before the
  cutover still hold a host-only `__Secure-authjs.session-token.v2` for that
  host, so the browser sends it to whatever is served there. The value is
  encrypted with `AUTH_SECRET` and cannot be read without it, but it is a
  bearer token: replayed as a cookie on `app.klymb.ai` it resumes that session,
  for up to the Auth.js default 30 days (no `session.maxAge` is set).
  Since the new site is ours, the clean fix is for IT to expire those names on
  its responses — same host, so it can. That clears each cookie the first time
  its owner visits, which is also the only time it travels anywhere, and costs
  nobody a logout:
  `__Secure-authjs.session-token.v2`, `authjs.session-token.v2`,
  `__Secure-authjs.callback-url`, `__Host-authjs.csrf-token`, plus the twelve
  names in `OAUTH_CHECK_COOKIE_NAMES`.
  Rotating `AUTH_SECRET` also works and is strictly more thorough, but it signs
  every active user out of `app.klymb.ai` too. Keep it as belt-and-braces, or
  as the answer if `abtalks.in` ever passes to a third party.
- **DO NOT** delete the `abtalks.in` DNS records or let the domain lapse, and
  do not drop the step-15 carve-outs from the new site. They are load-bearing
  for 3,429 issued certificates, already-sent `/claim/<token>` invites and
  `/r/<token>` shared reports. Treat them as permanent infrastructure, not
  migration scaffolding.
- **DO NOT** remove the old Google OAuth redirect URIs until the old host has
  redirected cleanly for 30 days.
- **DO NOT** treat this as a rebrand. "ABTalks" as a product name, the logo,
  `abtalks-logo.png`, the `abtalks_*` cookie names, the `@abtalks.dev` seed
  addresses, `OTEL_SERVICE_NAME=abtalks-web` and the `abtalksapp` package name
  all stay. Renaming the cookies forces another logout; renaming the seed
  domain breaks `src/repositories/talent.ts`'s test-account exclusion, the
  `@abtalks.dev` guard in `src/lib/email.ts:153` and
  `src/features/hire/outreach.ts`'s "never email test addresses" rule.

## 7. DB safety

**No schema change and no data migration.**

Stored `UserNotification.href` values are relative in every code path
(`admin-action-notify.ts`, `derive-event-notifications.ts`), prefixed at render
time. Confirm rather than assume, with a **read-only** session (see
`docs/project-context.md`; note the local env points at production):

```sql
SELECT count(*) FROM "UserNotification" WHERE "href" LIKE 'http%';
SELECT count(*) FROM "Notification"     WHERE "href" LIKE 'http%';
```

Both must be `0`. If either is non-zero, an admin-composed notification stored
an absolute URL and the rows need a one-off `UPDATE … replace(href, …)` — which
touches a **locked** Prisma model and requires Manuvrtti's explicit approval
before it runs. In that case stop and issue:

```
NOTIFICATION MODULE LOCKED — approval required from Manuvrtti
```

with the row count, the exact `UPDATE`, and the reason.

No Neon branch snapshot is needed for a no-DDL change; take one anyway before
Phase 3 if another deploy lands in the same window.

## 8. Verification

**Pre-cutover (Phases 1–2):**
- `dig app.klymb.ai CNAME +short` resolves to Vercel.
- `curl -sI https://app.klymb.ai/ | head -1` → `200`.
- `npx tsc --noEmit` clean; `npm run build` exits 0.
- Google sign-in completes at `https://app.klymb.ai/login` (proves the redirect
  URI is registered).

**Post-cutover (Phase 3):**
- `curl -sI https://abtalks.in/hire` → 308, `Location: https://app.klymb.ai/hire`.
- `curl -sI https://www.abtalks.in/r/abc` → `Location: https://app.klymb.ai/r/abc`.
- All six sign-in doors work. `/admin` gates. Recruiter isolation holds.
- Devtools → Application → Cookies on `app.klymb.ai`: the session cookie and
  all three `abtalks_*` cookies show **no** `Domain` value (host-only).
  **Nothing is scoped to `.klymb.ai`.** Check this by eye — it is the §6-A
  assertion.
- Open `klymb.ai` (the sibling app) in the same browser; confirm it sees none
  of this app's cookies.
- A mail on **each** rail (one Brevo kind, one `EMAIL_VIA_ABT_KINDS` kind)
  renders `app.klymb.ai` links with a `team@abtalks.in` From address, and its
  webhook writes a delivery row.
- A certificate PDF (`/verify/<id>/download`) embeds an `app.klymb.ai` verify
  URL and the QR scans to the new host.
- Cookie banner reappears (new host = new cookie jar); all three choices persist.
- Chatbot answers a contact question with the new domain after step 21;
  `npm run test:chatbot` passes.
- Sentry receives a deliberate test error from the new host.
- The next scheduled cron run succeeds (Vercel → Crons → last run).

**Files that should have changed in the Phase-2 commit — and nothing else:**
`src/auth.config.ts`, `middleware.ts`, `.env.example`,
`docs/project-context.md`, `docs/CHANGELOG.md`, and this plan file.

## 9. Commit message

```
chore(auth,infra): scope cookies host-only for the app.klymb.ai move

The OAuth check cookies were widened to `.abtalks.in` to bridge the
apex/www split on the old domain. The new canonical host is a single
origin, app.klymb.ai, so the widening is unnecessary — and actively
unsafe, because klymb.ai already runs a separate application: a
`.klymb.ai` cookie would be readable by that application and settable
by any future *.klymb.ai subdomain.

Drops `oauthCookieDomain()` from auth.config.ts and the cookie-domain
spread from the OAuth-check cookie options. auth.config.ts:51 was the
only place in the codebase setting a cookie domain, so after this
nothing is scoped to a registrable domain.

`.abtalks.in` stays in the middleware EXPIRY sweep on purpose — that
function only clears cookies, and dropping it would strand widened
cookies from earlier deploys. Comment explains the 30-day removal
trigger.

Session cookies were already host-only, so the cutover signs every
user out. That is expected and documented in the plan.

No schema change. Mail keeps sending from team@abtalks.in on both the
Brevo and ABT-Mailer rails.

Plan: docs/plans/189-domain-migration-app-klymb-ai.md

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
