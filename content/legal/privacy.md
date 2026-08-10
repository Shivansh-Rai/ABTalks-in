# Privacy Policy

**Version:** 2026-08-10  
**Effective date:** 2026-08-10

This Privacy Policy explains how **ABTalks** (“we”, “us”) collects, uses, shares, and protects personal data when you use our Service. It is designed around our actual product practices and India’s Digital Personal Data Protection Act, 2023 (DPDP), with disclosures relevant to US-facing cohort and program features.

**Contact for privacy / data rights:** [team@abtalks.in](mailto:team@abtalks.in)  
You can also submit a request in-product at [/privacy/requests](/privacy/requests).

## 1. Who we are — Data Fiduciary identification

We are the **Data Fiduciary** for the personal data described in this Policy.

| | |
|---|---|
| **Registered entity** | ABTalksOnAI |
| **Entity type** | Sole Proprietorship |
| **Proprietor** | Suman Shukla |
| **Trading name** | ABTalks |
| **Registered address** | Flat No 803-A, Tower 2A, 8th Floor, Panchsheel Wellington, Crossing Republic, Ghaziabad, Uttar Pradesh 201016, India |
| **Registration number** | UDYAM-UP-29-0250625 (Udyam Registration, MSME) |
| **Contact** | [team@abtalks.in](mailto:team@abtalks.in) |

ABTalks operates learning challenges, workshops, hackathons, an AI cohort program, and related recruiter/community features at our websites (including abtalks.in and related domains).

### 1.1 Grievance Officer

In accordance with the Digital Personal Data Protection Act, 2023, the Information Technology Rules, 2021, and the Consumer Protection (E-Commerce) Rules, 2020:

| | |
|---|---|
| **Name** | Suman Shukla |
| **Designation** | Proprietor and Grievance Officer |
| **Email** | [team@abtalks.in](mailto:team@abtalks.in) |
| **Address** | Flat No 803-A, Tower 2A, 8th Floor, Panchsheel Wellington, Crossing Republic, Ghaziabad, Uttar Pradesh 201016, India |

We **acknowledge grievances within 24 hours** of receipt and aim to **resolve them within 15 days**. Full contact details are also published at [/contact](/contact).

## 2. Data we collect

### 2.1 Account and profile

- Google account email, name, and profile image (via Google OAuth)  
- Challenge profile: full name, student/professional fields (college, graduation year, organization, role, experience), domain, skills, LinkedIn URL, GitHub username, resume URL, phone number (OTP-verified for Indian mobiles where required)  
- Program profile: job role, company, education, university, GitHub repo URL, optional phone (admin-only; not shown to recruiters)  
- Recruiter profile: name, company, optional phone  

### 2.2 Applications and events

- Workshop registration: name, email, phone, role, organization, graduation year  
- Hackathon: name, email, phone, college, graduation year; team membership; submission URLs  
- US cohort application (Supabase): name, email, LinkedIn, **visa / work-authorization category**, education, experience, industry, free-text essays, commitment confirmations  
- India cohort application (Supabase): similar fields without US visa; India-origin confirmation  

### 2.3 Activity data

- Challenge submissions (optional GitHub/LinkedIn proof URLs), quiz answers, streaks, enrollments  
- Program mission payloads, concept attempts, project repos/writeups, AI feedback, scores  
- Exit **voice interview** audio processed in real time; **transcript**, scores, and summary stored  
- Job applications (optional note); marketplace redemptions (**shipping address**, recipient phone)  
- Referral and share-link attribution  
- Admin remarks and audit logs of admin actions  

### 2.4 Certificates

- Snapshot of recipient name and completion metadata; public verification by certificate ID  

### 2.5 Cookies and similar tech

| Cookie | Purpose | Category |
|--------|---------|----------|
| Auth.js session cookie | Keep you signed in (httpOnly) | Strictly necessary |
| `abtalks_consent` | Stores your cookie choice so we don’t ask again (~180 days, readable by the page) | Strictly necessary |
| `abtalks_ref` | Referral code from `?ref=` (httpOnly, ~7 days) | Attribution — set only with your consent |
| `abtalks_src` | First-touch share attribution from `?s=` (httpOnly, ~30 days) | Attribution — set only with your consent |

**Your choice.** On your first visit we ask you to choose **Allow all**, **Limited**, or **Deny**. Attribution cookies (`abtalks_ref`, `abtalks_src`) are set only if you choose Allow all or Limited; choosing Deny means we set no attribution cookies and expire any we already set. Strictly necessary cookies are required for sign-in and cannot be switched off. You can change your choice any time at [/cookies](/cookies). Full details: [Cookie Policy](/cookies).

**Third-party scripts and embeds.**

- **Phone verification (MSG91).** If you use phone/OTP verification, your browser loads a script from `verify.msg91.com` in order to run the verification widget. That provider may set its own cookies or browser storage under its domain, governed by its own privacy policy. The script loads only when you actually use phone verification.
- **Video embeds (YouTube).** All video embeds use the privacy-extended `youtube-nocookie.com` domain, which does not set advertising cookies. On program mission pages and the video library, videos are **click-to-load**: nothing is requested from Google until you press play, and the video’s preview thumbnail is fetched from YouTube only if you chose **Allow all**. On challenge day pages the tutorial player loads together with the page, so Google is contacted when you open that page.

We do **not** currently use third-party advertising analytics SDKs (e.g. Google Analytics, PostHog) in the product. If that changes, we will update this Policy and add the relevant category to the cookie choice above.

### 2.6 Sources

You; Google (sign-in); GitHub API (public repo/commit checks for program features); cookies as above; admins (assessment fields on curated reports).

## 3. How we use data

- Provide accounts, tracks, day unlocks, grading, certificates, and support  
- Send **transactional** email/SMS (welcome, workshop/hackathon confirmations, OTP, account notices) — not marketing lists unless you separately opt in later  
- Operate referrals, leaderboards, and peer profiles (limited fields)  
- Admin operations, integrity (anti-cheat), and security  
- AI-assisted feedback, grading, recommendations, and interview evaluation  
- Recruiter discoverability **only if you opt in** (program talent pool)  
- Improve the Service using aggregated or de-identified insights where feasible  

## 4. Legal bases / consent (high level)

Where required, we rely on your **consent** (checkbox acceptance of Terms/Privacy; age attestation; recruiter-visibility opt-in; interview notice acknowledgment). We also process data as needed to provide the Service you request and for security and compliance. Counsel may refine DPDP basis language.

## 5. Sharing

We share personal data with:

| Recipient | What / when |
|-----------|-------------|
| **Service processors** | Vercel (hosting), Neon (database), Google (OAuth), Supabase (certain applications/config), MSG91 (OTP), Resend & Brevo (email), Anthropic & OpenAI (AI/interview processing), GitHub (API checks) |
| **Admins** | Full operational access; CSV exports for running events |
| **Approved recruiters** (`/talent`) | Opted-in program members: profile, email, LinkedIn, resume, GitHub, scores, projects, interview **summary and scores** (not full transcript; not phone) after cohort results are published |
| **Public** | Certificate verification pages (name + credential metadata); anyone with a published share-report link at `/r/[token]` sees the curated assessment **without email or phone** |
| **Peers (signed-in)** | Limited profiles (name, college/org, skills, LinkedIn, GitHub, streaks) — not email/phone |
| **Hackathon teammates** | Name and college (not email/phone) |

We do not sell personal data.

## 6. International transfers

Processors may process data in India, the United States, and other countries (e.g. cloud and AI providers). By using the Service you understand that such transfers may occur. We use reputable providers and contractual protections where applicable.

## 7. Retention

- Account and profile data: while your account is active  
- After a confirmed deletion request: erase or anonymize within **30 days**, except certificates retained as public credentials unless revoked; limited audit/security records up to **24 months**; longer if required by law or dispute  
- **Hackathon removal records:** if you are removed from, or leave, a hackathon team, we keep a removal record containing your **name, email, phone, college and graduation year** even after your participant record itself is deleted. We do this to prevent re-registration abuse and to keep team-attribution accurate. These records are retained for up to **24 months**, then deleted.  
- Admin audit rows may be retained for integrity for up to **24 months**  
- Consent records retained to demonstrate acceptance  

## 8. Security

We use industry-standard hosting, access controls (admin allowlists, role checks), and encrypted transport (HTTPS). No method of transmission or storage is 100% secure.

**Breach notification.** If a personal data breach occurs, we will notify the Data Protection Board of India and each affected user in the manner and within the timelines required by the DPDP Act and its rules.

## 9. Children

The Service is for users **18+**. We do not knowingly collect data from children under 18. If you believe a minor registered, contact us to delete the account.

## 10. Your rights

Subject to applicable law, you may request:

- **Access** to personal data we hold about you, including a summary of processing and the recipients we have shared it with  
- **Correction** of inaccurate data, and completion or updating of incomplete data (you can also edit much of your profile in-app)  
- **Erasure** / account deletion  
- **Withdrawal of consent** for optional processing (e.g. recruiter visibility), which may limit features. Withdrawal is as easy as giving consent, and does not affect processing already carried out  
- **Grievance redressal (DPDP §13)** — you may raise a grievance with our Grievance Officer (§1.1) about our handling of your data or your rights request, regardless of whether you have used any other remedy. We acknowledge within **24 hours** and aim to resolve within **15 days**. If you are not satisfied with our response, you may escalate to the **Data Protection Board of India**  
- **Nomination (DPDP §14)** — you may nominate another individual to exercise these rights on your behalf in the event of your death or incapacity. Submit a nomination through [/privacy/requests](/privacy/requests)  

Submit requests at [/privacy/requests](/privacy/requests) or email [team@abtalks.in](mailto:team@abtalks.in). We may need to verify your identity. We aim to respond within a reasonable period (target: 30 days).

**Your duties.** Under DPDP §15, please do not impersonate another person when providing data, suppress material information, or file false or frivolous grievances.

## 11. AI processing notice

Mission code, prompts, project context, and interview audio/transcripts may be sent to AI providers (Anthropic, OpenAI) to generate feedback, scores, or summaries. Do not include passwords, payment card numbers, or unrelated sensitive data in submissions.

Before starting a voice interview, you will see an in-product notice that the session is recorded/transcribed for evaluation.

## 12. US cohort applications

US-facing applications may collect visa or work-authorization category and related professional information to evaluate cohort fit. That data is stored with our application backend (currently Supabase) and accessible to ABTalks admins — not published on public pages.

## 13. Changes

We may update this Policy. The version and effective date appear at the top. Material changes may require re-acceptance.

## 14. Contact

Grievance Officer and full entity details: [/contact](/contact)  
Data rights requests: [/privacy/requests](/privacy/requests)  
Cookie choices: [/cookies](/cookies)  
Email: [team@abtalks.in](mailto:team@abtalks.in)
