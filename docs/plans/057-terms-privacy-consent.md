# 057 — Terms, Privacy & Consent (Phases 1–4)

## 1. Goal

Ship public Terms + Privacy, capture versioned consent (+ age) on all signup funnels, add program recruiter-visibility and voice-interview notices, strip contact PII from `/r/[token]`, and provide an in-app data-rights request path — matching `docs/legal/business-decisions.md` and `content/legal/*.md`.

## 2. Current behavior

No `/terms` or `/privacy`. No ToS/Privacy checkbox on funnels. Community Rules “I Agree” is conduct-only. `/r/[token]` can expose email/phone. Talent pool can show interview transcripts. No DSAR UI.

## 3. Files to touch

### Content / docs
- [existing] `content/legal/terms.md`, `content/legal/privacy.md`
- [existing] `docs/legal/*`
- [edit] `docs/CHANGELOG.md` — one schema/convention line

### Legal pages
- [new] `src/lib/legal.ts` — versions, read MD from `content/legal/`
- [new] `src/components/legal/legal-document.tsx` — Server Component markdown render
- [new] `src/app/terms/page.tsx`
- [new] `src/app/privacy/page.tsx`
- [new] `src/app/privacy/requests/page.tsx` + client form
- [edit] `src/components/shared/app-footer.tsx` — Terms / Privacy links
- [edit] `src/components/landing/landing-hub.tsx` — uncomment/enable footer with legal links

### Schema
- [edit] `prisma/schema.prisma` — `LegalConsent`, `DataRightsRequest`, `ProgramMember.recruiterVisibilityConsentAt`
- [new] `prisma/migrations/YYYYMMDDHHMMSS_legal_consent_and_rights/migration.sql`

### Consent shared UI + persistence
- [new] `src/components/legal/legal-consent-fields.tsx` — Client: Terms/Privacy + age checkboxes
- [new] `src/features/legal/record-consent.ts` — Node-only write helper
- [new] `src/lib/validations/legal.ts` — zod for consent + rights request
- [new] `src/app/actions/legal-actions.ts` — rights request action

### Funnels (checkbox + server enforce)
- [edit] `src/lib/validations/register.ts` + registration form + `complete-registration` / registration-actions
- [edit] workshop actions + registration form
- [edit] hackathon validations + register form + actions
- [edit] program validations + apply form + apply action; gate talent pool on consent
- [edit] talent validations + register form + actions
- [edit] cohort-application (+ india) schemas + forms + actions (store consent columns on Supabase insert if columns exist; else also write Neon LegalConsent by email when possible)

### Phase 3
- [edit] program apply — recruiter visibility checkbox; persist timestamp
- [edit] `src/features/talent-pool/pool.ts` — exclude members without consent; omit transcript from recruiter view
- [edit] interview client — acknowledge notice before start
- [edit] marketplace redeem UI — short fulfillment notice (inline text)

### Phase 4
- [edit] `src/features/recruiter/get-recruiter-profile.ts` + PDF/page — stop returning/rendering email & phone
- [new] privacy requests UI as above

## 4. Server vs Client

- Legal document pages: **Server** (read MD, `react-markdown`).
- Consent checkboxes / rights form / interview notice: **Client**.
- Consent persistence: **Server Actions** / feature helpers only (no middleware, no `@/lib/*` in middleware).
- Do not pass functions across RSC→client boundaries.

## 5. Steps

1. Add Prisma models + migration; `npx prisma generate`.
2. Add `src/lib/legal.ts` constants `TERMS_VERSION` / `PRIVACY_VERSION` = `2026-08-08`.
3. Add `/terms`, `/privacy` pages + footer/landing links.
4. Add `LegalConsentFields` + `recordLegalConsents` helper.
5. Wire every signup funnel: client checkboxes required; server Zod `acceptTerms: z.literal(true)`, `acceptPrivacy: z.literal(true)`, `confirmAge18: z.literal(true)`; on success write two LegalConsent rows (TERMS + PRIVACY) with `source`.
6. Program: add `recruiterVisibilityConsent` boolean → set `recruiterVisibilityConsentAt`; filter talent pool; remove transcript from recruiter DTO.
7. Interview page: require acknowledgment before starting WebRTC session.
8. Strip email/phone from public recruiter profile view + PDF.
9. `/privacy/requests` creates `DataRightsRequest` row (and emails team if easy via existing mailer — or just DB + toast).
10. CHANGELOG one line; typecheck/build.

### Supabase cohort apps
Add fields to insert payload: `accepted_terms_version`, `accepted_privacy_version`, `accepted_at`, `confirm_age_18`. If Supabase schema cannot be altered from this repo, still require UI checkboxes and insert into Neon `LegalConsent` with `userId: null` and `email` + `source` columns — prefer adding `email String?` on LegalConsent for pre-auth funnels.

**LegalConsent shape:**
```
id, userId?, email?, document (TERMS|PRIVACY), version, source, acceptedAt, ip?, userAgent?
```

**DataRightsRequest:**
```
id, userId?, email, type (ACCESS|CORRECTION|ERASURE|OTHER), message?, status (PENDING|DONE|REJECTED), createdAt
```

## 6. Guardrails for Cursor (DO NOT)

- DO NOT import `@/lib/*` from `middleware.ts`.
- DO NOT add cookie CMP banner.
- DO NOT put requireRole on public `/terms`, `/privacy`, `/privacy/requests`.
- DO NOT invent a fake registered street address in legal MD.
- DO NOT re-expose email/phone on `/r/[token]` after stripping.
- DO NOT send full interview transcripts to talent portal recruiters.
- DO NOT edit `CLAUDE.md` or `docs/project-context.md`.
- DO NOT edit the Cursor plan file under `.cursor/plans/`.
- No new abstraction files beyond those listed.

## 7. DB safety

- Commit checkpoint before migrate.
- Migration additive only (new tables/columns).
- After migrate: `npx prisma generate`.

## 8. Verification

- `/terms` and `/privacy` render MD; footer links work on app + landing.
- Register / workshop / hackathon / program / talent / cohort forms block submit without consents.
- LegalConsent rows appear after successful register.
- Talent list excludes non-opted-in members; member detail has no transcript field for recruiters.
- `/r/[token]` shows no email/phone.
- Privacy request creates PENDING row.
- `npx tsc --noEmit` / build passes.
- Files changed: only those listed (+ CHANGELOG).

## 9. Commit message

`feat: add Terms/Privacy pages, consent logging, and data-rights requests`
