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
