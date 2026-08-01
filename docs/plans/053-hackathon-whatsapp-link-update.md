# 053 — Update hackathon WhatsApp group link

## 1. Goal
Point the Vibe Code Hackathon WhatsApp group link (site + emails) at the new
group invite. The old group (`BbF7QWppRjD9KlER4lGYLX`) is being replaced.

New link:
`https://chat.whatsapp.com/LqTfjJa5mZAIsk4VoW5Epv?s=cl&p=a&ilr=1`

## 2. Current behavior
The hackathon WhatsApp URL is hardcoded in exactly two places, both with the
same old value:

- `src/components/hackathon/hackathon-config.ts` → `HACKATHON.whatsappLink`,
  consumed by the hackathon landing page, success panel, and dashboard.
- `src/lib/hackathon-email.ts` → module-level `WHATSAPP_LINK`, used in the
  registration/confirmation email templates.

Other WhatsApp links in the repo belong to different products (60-day
challenge, AI workshop, Claude track) and are **out of scope** — they use
different group IDs and must not be touched.

## 3. Files to touch
- `src/components/hackathon/hackathon-config.ts` `[edit]` — line 21,
  `whatsappLink` value.
- `src/lib/hackathon-email.ts` `[edit]` — line 12–13, `WHATSAPP_LINK` value.

## 4. Server vs Client
No component boundaries change. `hackathon-config.ts` is a plain constants
module already imported from both Server and Client components — it stays a
serializable object literal. `hackathon-email.ts` is `import "server-only"` and
stays server-only. No new props cross the Server→Client boundary.

## 5. Steps
1. In `src/components/hackathon/hackathon-config.ts`, replace the value on
   line 21 so it reads:
   ```ts
   whatsappLink: "https://chat.whatsapp.com/LqTfjJa5mZAIsk4VoW5Epv?s=cl&p=a&ilr=1",
   ```
2. In `src/lib/hackathon-email.ts`, replace the value on lines 12–13 so it
   reads:
   ```ts
   const WHATSAPP_LINK =
     "https://chat.whatsapp.com/LqTfjJa5mZAIsk4VoW5Epv?s=cl&p=a&ilr=1";
   ```
3. Nothing else. Do not reformat, reorder, or otherwise edit either file.

## 6. Guardrails for Cursor (DO NOT)
- DO NOT change any other `chat.whatsapp.com` URL in the repo. Specifically
  leave `LSru1BgvifpEB4OMZsaZEi` (landing hub, community slide, pre-start
  dashboard, Claude CTA/FAQ, Claude welcome email), `LDUvHRIlb5dGHpDJLueR9i`
  (AI workshop), and `Fqx07wwZhiq0lA6Z7d5uad` (challenge reset email) alone.
- DO NOT extract the link into a new shared constants file, a new module, or an
  env var. Two literals is the intended shape here.
- DO NOT touch `docs/plans/*` historical plans that quote the old URL — they
  are a record of past decisions.
- DO NOT modify Prisma schema, migrations, or seed scripts. No DB change is
  involved.
- DO NOT alter the query string; the new URL includes `?s=cl&p=a&ilr=1`
  verbatim.

## 7. DB safety
Not applicable — no schema or data changes.

## 8. Verification
- `npx tsc --noEmit` (or `npm run build`) passes.
- `grep -r "BbF7QWppRjD9KlER4lGYLX" src/` returns nothing.
- `grep -r "LqTfjJa5mZAIsk4VoW5Epv" src/` returns exactly two hits, one per file
  above.
- Manual: load `/hackathon`, confirm the WhatsApp CTA and the post-registration
  success panel both open the new group; check the hackathon dashboard's event
  info card too.
- Manual: trigger a hackathon registration confirmation email (test address)
  and confirm the WhatsApp button in the email body resolves to the new group.
- Exactly two files should show as changed in `git status`.

## 9. Commit message
```
chore(hackathon): point WhatsApp group link at new invite

Updates the hackathon group URL in both the shared hackathon config
(site CTAs, success panel, dashboard) and the registration email
template. Other product WhatsApp links are unchanged.
```
