# Cookie Policy

**Version:** 2026-08-10  
**Effective date:** 2026-08-10

This Cookie Policy explains what cookies and similar technologies ABTalks uses, why, and how you control them. It supplements our [Privacy Policy](/privacy).

## 1. What cookies are

Cookies are small text files a website stores in your browser. Some are essential — without them you cannot stay signed in. Others are optional and we only set them if you allow us to.

We also use a small amount of **browser storage** (`localStorage` / `sessionStorage`) purely to remember interface state — for example that you already dismissed a tooltip or a promotional dialog. This never leaves your device and is not used to track you.

## 2. Your choice

The first time you visit, we ask you to choose one of three options. You can change it at any time from this page.

| Choice | What it does |
|--------|--------------|
| **Allow all** | Sign-in cookies, plus referral and share attribution cookies, plus video preview thumbnails loaded from YouTube |
| **Limited** | Sign-in cookies and attribution cookies. No preview thumbnails are fetched from YouTube — click-to-load videos request nothing until you press play |
| **Deny** | Sign-in cookies only. We set no attribution cookies and expire any we previously set. No preview thumbnails are fetched |

Strictly necessary cookies cannot be switched off — they are required to sign you in and keep your session secure. Choosing **Deny** does not reduce your access to any feature; it only means we cannot credit referrals or measure which share link brought you here.

Your choice is itself stored in a cookie (`abtalks_consent`) so we don't ask again. If we materially change this Policy, we will ask once more.

## 3. Cookies we set

| Cookie | Purpose | Lifetime | Category |
|--------|---------|----------|----------|
| Auth.js session cookie | Keeps you signed in. `httpOnly`, so page scripts cannot read it | Session / until sign-out | Strictly necessary |
| `abtalks_consent` | Remembers your cookie choice and the policy version it applied to | ~180 days | Strictly necessary |
| `abtalks_ref` | Referral code captured from a `?ref=` link, so the person who referred you gets credit. `httpOnly` | ~7 days | Attribution — consent required |
| `abtalks_src` | First-touch share attribution captured from a `?s=` link, so we know which campaign or partner link brought you here. Never overwritten once set. `httpOnly` | ~30 days | Attribution — consent required |

## 4. Third-party scripts and embeds

- **Phone verification (MSG91).** When you use phone/OTP verification, your browser loads a widget script from `verify.msg91.com`. That provider may set its own cookies or storage under its own domain, governed by its own privacy policy. The script loads only at the moment you use phone verification — never on page load.
- **Video embeds (YouTube).** All videos use the privacy-extended `youtube-nocookie.com` domain, which does not set advertising cookies.
  - On **program mission pages and the video library**, videos are click-to-load. We show a placeholder and request nothing from Google until you press play. The video's preview thumbnail is fetched from YouTube only if you chose **Allow all**.
  - On **challenge day pages**, the tutorial player loads together with the page, so Google is contacted when you open that page. We disclose this rather than hide it; if you would rather it did not, avoid opening those pages or block the domain in your browser.

## 5. What we do not use

We do **not** use Google Analytics, PostHog, Meta Pixel, advertising cookies, cross-site tracking, or any third-party analytics SDK in the product. We do not sell personal data. If this changes, we will update this Policy and add the relevant category to the choice in §2 before setting anything.

**Do Not Track.** We do not currently alter our cookie practices in response to browser “Do Not Track” signals. Use the choice above (or Manage preferences) to control optional cookies.

## 6. Changing or clearing your choice

- Use the **Manage cookie preferences** button on this page to reopen the chooser at any time.
- You can also delete cookies directly in your browser settings. Clearing the ABTalks cookies will sign you out and cause the chooser to appear again on your next visit.

## 7. Contact

Questions about this Policy: [team@abtalks.in](mailto:team@abtalks.in) · [/contact](/contact) · [Data rights requests](/privacy/requests)
