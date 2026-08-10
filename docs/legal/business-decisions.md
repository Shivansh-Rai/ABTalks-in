# ABTalks — Legal / product decisions (v1 defaults)

**Status:** Interim defaults for shipping Terms/Privacy/consent. Replace with counsel-confirmed values when available.  
**Date:** 2026-08-08

| Decision | Default locked for v1 | Notes |
|----------|----------------------|--------|
| Legal entity name | ABTalks (operating name); formal registered entity TBD | Update Privacy/ToS header when entity papers exist |
| Registered address | TBD — contact via email | Do not invent a street address |
| Country | India (primary) | US disclosures for cohort/program tracks |
| Privacy / rights contact | `team@abtalks.in` | Same as existing support; counsel may add `privacy@` later |
| Governing law / venue | Laws of India; disputes subject to courts in India | US users still see the same Terms; Privacy discloses US processors |
| Retention | Active account for life of service use; after confirmed deletion request, erase or anonymize within 30 days except (a) certificates kept as public credentials unless revoked, (b) financial/audit logs up to 24 months, (c) legal holds | Documented in Privacy |
| Talent-pool sharing | **Opt-in** via `recruiterVisibilityConsent` on program apply | Not mandatory for completing missions; required before appearing in `/talent` |
| `/r/[token]` contact fields | **Strip email and phone** from public report + PDF | LinkedIn/GitHub may remain; matches original plan 010 intent |
| Interview transcripts to recruiters | **Summary + scores only** on talent portal (no full transcript) | Reduces sensitivity; admin still has transcript |
| Age policy | **18+** attestation required on all signup funnels | |
| Marketing email | **Transactional only** (welcome, workshop, hackathon, reset) | No promo list without separate opt-in |
| Cookie banner | **Not required** for current first-party essential + attribution cookies | Revisit if third-party analytics added |
| Consent versioning | `TERMS`/`PRIVACY` version `2026-08-08` | Bump constants when legal MD changes |

These defaults unblock Phase 0–4 implementation. Counsel review should confirm before treating docs as final legal advice.

---

## v2 decisions — 2026-08-10 (plan 059)

| Decision | v2 value | Supersedes |
|----------|----------|------------|
| Entity identification | **Published** on `/terms`, `/privacy`, `/contact` as a Data Fiduciary block. Values held as `<<FILL: …>>` markers in `LEGAL_ENTITY` (`src/lib/legal.ts`) until the real details are supplied | v1 row "Legal entity name" |
| Grievance Officer | **Published** — name, designation, email, address. Commitment: acknowledge within **24 hours**, resolve within **15 days** (IT Rules 2021 timeline, stricter than the E-Commerce Rules, so safe for both) | new |
| Cookie banner | **Required.** Blocking centre-screen chooser with Allow all / Limited / Deny that genuinely gates attribution cookies in middleware and third-party embeds | **Supersedes** the v1 row "Cookie banner: not required" |
| Cookie consent storage | `abtalks_consent` cookie only — **no DB row**. For anonymous visitors there is no identifier, and logging an IP per visitor is itself a privacy cost | new |
| Certificates | Explicitly disclaimed as **not accredited** qualifications (Terms §6) | new |
| Synergy Points | Explicitly **not currency**, no cash value, non-transferable; fulfilment India-only and discretionary (Terms §8) | new |
| Fees | Service is **free**; no payment instruments processed. Refund/cancellation terms deferred to point-of-purchase if paid offerings launch — this is why no `/refunds` page exists (Terms §9) | new |
| Indemnity | Added as counterpart to the existing liability cap (Terms §14) | new |
| Dispute resolution | **30 days' written notice** before proceedings, good-faith resolution attempt. Governing law India unchanged (Terms §16) | extends v1 "Governing law" |
| Hackathon removal logs | Disclosed explicitly: retain name, email, phone, college, graduation year post-deletion, capped at **24 months** | extends v1 "Retention" |
| DPDP rights | Added §13 grievance redressal (with escalation to the Data Protection Board) and §14 nomination to Privacy §10 | new |
| Consent versioning | `TERMS` / `PRIVACY` / `COOKIE_POLICY` version `2026-08-10` | supersedes v1 `2026-08-08` |

**Open — blocking production merge:** registered entity legal name, registered address, registration number, Grievance Officer name and designation. Until supplied, the `<<FILL: …>>` markers render literally on the public pages. Per the v1 rule, **do not invent an address**.
