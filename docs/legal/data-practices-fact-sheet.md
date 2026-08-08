# ABTalks — Data practices fact sheet (internal)

**Audience:** Counsel / founder. Not a public Privacy Policy.  
**As of:** 2026-08-08 (code audit).  
**Decisions:** see [business-decisions.md](./business-decisions.md).

## Products / tracks

1. **60-Day Challenge** (`/register`, `/dashboard`, `/challenge/…`) — IST day boundaries  
2. **Workshops** (`/ai-workshop`) — Neon `WorkshopRegistration`  
3. **Hackathon** (`/hackathon`) — teams, submissions  
4. **AI Cohort Program** (`/program`) — America/Chicago; missions, AI grading, voice interview  
5. **Talent portal** (`/talent`) — approved recruiters  
6. **Marketing funnels** — `/ai-cohort-register`, `/ai-cohort-india` (applications on **Supabase**)

## Auth

- Production: Google OAuth only (Auth.js v5, JWT session cookies).  
- Dev: optional Credentials (`ENABLE_DEV_AUTH`).  
- Admin: email allowlist `ADMIN_EMAILS` (not a DB role).

## Personal data by store

### Neon (primary)

| Model | Notable fields |
|-------|----------------|
| User / Account | email, name, image, OAuth tokens |
| StudentProfile | fullName, college/org, phone, LinkedIn, GitHub, resume URL, skills |
| PhoneVerification | E.164 phone + verified flag |
| Submission / QuizAttempt | GitHub/LinkedIn URLs; quiz answers JSON |
| Redemption | shippingAddress, recipientPhone |
| RecruiterReview | assessment + shareToken; published reports |
| ProgramMember | professional profile, phone (admin-only), GitHub repo |
| ProgramInterview | transcript JSON, scores, summary |
| HackathonParticipant / Removal | name, email, phone, college, year |
| WorkshopRegistration | name, email, phone, role, org, year |
| Certificate | recipientName snapshot; public verify by ID |
| LegalConsent (new) | document, version, acceptedAt, source, optional IP/UA |
| DataRightsRequest (new) | type, status, message |

### Supabase (residual)

- `cohort_applications` — US app incl. **visa category**, essays  
- `cohort_applications_india` — India clone  
- `workshop_config` — Zoom/WhatsApp links (not PII roster)

## Cookies (first-party)

| Cookie | Purpose | Max-age |
|--------|---------|---------|
| Auth.js session | Login | session/JWT policy |
| `abtalks_ref` | Referral `?ref=` | 7 days, httpOnly |
| `abtalks_src` | Share attribution `?s=` | 30 days, httpOnly, first-touch |

No Google Analytics / PostHog / ad pixels in app code today.

## Processors

Vercel (hosting/cron), Neon (DB), Google (OAuth), Supabase, MSG91 (OTP SMS), Resend & Brevo (transactional email), Anthropic (grading/mentor), OpenAI (voice interview Realtime), GitHub API (commit/repo checks).

## Sharing / public surfaces

| Surface | Exposed |
|---------|---------|
| `/talent` (approved recruiters) | Name, email, LinkedIn, resume, GitHub, scores, projects, interview **summary/scores** (transcript withheld from recruiters per v1 decision); phone withheld |
| `/r/[token]` (+ PDF) | Assessment report; **email/phone stripped** per v1 decision |
| `/verify/[certificateId]` | recipientName + credential metadata (public) |
| `/students/[id]` | Logged-in peers: name, college/org, skills, LinkedIn, GitHub (no email/phone) |
| Leaderboards | fullName |
| Admin CSV exports | Full PII as needed for ops |

## Consent gaps closed by this project

- Public `/terms` + `/privacy`  
- Checkbox + versioned `LegalConsent` on all signup funnels  
- Age 18+ attestation  
- Program recruiter-visibility opt-in  
- Voice interview notice before session  
- Privacy rights request path (`/privacy/requests`)

## Open counsel items

- Formal registered entity name and address  
- Whether India DPDP “significant data fiduciary” obligations apply at scale  
- Cross-border transfer language for US vendors  
- Re-accept policy when Terms/Privacy versions bump
