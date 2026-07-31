# 040 — Certificates: Claude Challenge completion, verification & achievements

## 1. Goal

Issue a uniquely-identified completion certificate (`ABT-CC-XXXXX`) to every user who
finishes the 60-day CLAUDE challenge, expose it on a new **Your Achievements** page,
and let anyone verify it at a public `/verify/<certificate-id>` page with a PDF
download. The data model and UI are built generic (Claude Challenge / Hackathon /
Cohort / Workshop) but **only `CLAUDE_CHALLENGE` is wired up in this plan**.

---

## 2. Current behavior

- **Completion signal already exists.** `src/features/submission/submit-day.ts:255-270`
  sets `Enrollment.status = COMPLETED` + `completedAt` and flips
  `StudentProfile.isReadyForInterview` once `daysCompleted >= 60`. Nothing is issued.
- **No certificate concept anywhere** — no model, no route, no `/verify`, no
  `/achievements`.
- **PDF precedent exists but is the wrong tool here.** `@react-pdf/renderer@4.5.1` is a
  dependency and used by `src/app/r/[token]/pdf/route.ts` + `src/features/recruiter/recruiter-pdf.tsx`
  to *build* a PDF from scratch. It **cannot overlay text onto an existing PDF**, which is
  what a designed template requires. This plan adds `pdf-lib` for that.
  `src/features/recruiter/pdf-fonts.ts` documents the project's current stance: built-in
  Helvetica, no TTF registration. We keep that stance.
- **`/profile`** (`src/app/profile/page.tsx`) is a single-scroll Server Component with
  cards (Resume, My Redemptions, Refer & Earn). No tab bar.
- **Mobile sidebar** (`src/components/shared/mobile-sidebar.tsx`) has a `nav` block with
  Admin Panel / theme / Profile / Report an Issue rows.
- **Bottom nav** (`src/components/shared/bottom-nav.tsx`) already has its full 5 tabs.
- **Middleware** (`middleware.ts`) gates via a literal `protectedPaths` string array —
  edge-safe, no `@/lib/*` imports.
- No rate limiting exists anywhere in the app (documented in `docs/security-todos.md`).

---

## 3. Decisions taken (read before implementing)

| Decision | Choice | Why |
|---|---|---|
| Name font | **pdf-lib built-in `StandardFonts.HelveticaBold`, size 30** | Confirmed by product owner — no Angeletta, no licensed TTF to hide, no `@pdf-lib/fontkit` dep. Matches `pdf-fonts.ts` precedent. |
| Achievements placement | **Dedicated `/achievements` route** | Deep-linkable from the sidebar; `/profile` gets one entry card only. |
| Download access | **Public** — anyone holding the certificate ID | It is a verifiable credential; the PDF carries nothing the verify page doesn't already show. |
| Template PDF hosting | **Runtime fetch from `CERTIFICATE_TEMPLATE_URL`, with a gitignored local-file fallback for dev** | Repo is public (`github.com/Shivansh-Rai/ABTalks-in`) and Vercel only deploys what's in git — so the template cannot be committed. Vendor-neutral (works with Vercel Blob, S3, Cloudinary, any HTTPS host), zero new deps. **All of this is isolated in one file (`template-source.ts`) — swap it if you'd rather store bytes in Neon.** |
| Issuance trigger | **Lazy + idempotent**, on `/achievements` load and via a backfill script. **Never** inside `submitDay`. | Keeps the submission hot path and its 20s transaction untouched; automatically covers admin-marked completions and anyone who finished before this ships. |
| Recipient name | **Snapshot at issue time** into `Certificate.recipientName` | A verified credential must not silently change if the student later edits their profile name. |

---

## 4. Files to touch

### Schema & config
| Path | | Note |
|---|---|---|
| `prisma/schema.prisma` | `[edit]` | `CertificateType` + `CertificateStatus` enums, `Certificate` model, back-relations on `User` and `Enrollment`. |
| `package.json` | `[edit]` | Add `pdf-lib`, `qrcode` deps + `@types/qrcode` devDep; add `db:backfill:certificates` script. |
| `.gitignore` | `[edit]` | Add `/assets/certificates/` so the local template is never committed. |
| `middleware.ts` | `[edit]` | Add `"/achievements"` to `protectedPaths`. **String only — no new imports.** |

### Feature module — `src/features/certificate/` (all server-only)
| Path | | Note |
|---|---|---|
| `constants.ts` | `[new]` | Type registry (code/title/layout), ID alphabet, layout constants. |
| `generate-certificate-id.ts` | `[new]` | `ABT-CC-XXXXX` generation with collision retry. |
| `issue-certificate.ts` | `[new]` | `ensureClaudeCertificate(userId)` — eligibility check + idempotent create. |
| `get-achievements.ts` | `[new]` | Achievements list for the signed-in user. |
| `get-certificate.ts` | `[new]` | Public lookup by certificate ID (verify page + download route). |
| `template-source.ts` | `[new]` | Loads template bytes (URL env → local file fallback), module-level cached. |
| `render-certificate-pdf.ts` | `[new]` | pdf-lib overlay: name, QR, verify URL. |

### Routes
| Path | | Note |
|---|---|---|
| `src/app/achievements/page.tsx` | `[new]` | Protected Server Component. |
| `src/app/verify/[certificateId]/page.tsx` | `[new]` | **Public** Server Component. |
| `src/app/verify/[certificateId]/download/route.ts` | `[new]` | **Public** GET route handler, `runtime = "nodejs"`. |

### Components
| Path | | Note |
|---|---|---|
| `src/components/certificate/achievement-card.tsx` | `[new]` | Server Component. |
| `src/components/certificate/copy-verify-link-button.tsx` | `[new]` | `"use client"` — mirror `src/components/profile/copy-referral-link-button.tsx`. |

### Wiring
| Path | | Note |
|---|---|---|
| `src/components/shared/mobile-sidebar.tsx` | `[edit]` | Add "Your Achievements" row (`Award` icon) above Profile. |
| `src/app/profile/page.tsx` | `[edit]` | Add one "Your Achievements" card linking to `/achievements`. |

### Script
| Path | | Note |
|---|---|---|
| `prisma/scripts/backfill-certificates.ts` | `[new]` | Issue certificates for already-COMPLETED CLAUDE enrollments. |

**Do NOT create any file not on this list.**

---

## 5. Server vs Client

| Component / module | Boundary |
|---|---|
| `src/app/achievements/page.tsx` | **Server** (`force-dynamic`) |
| `src/app/verify/[certificateId]/page.tsx` | **Server** (`force-dynamic`) |
| `src/app/verify/[certificateId]/download/route.ts` | **Server** route handler, Node runtime |
| `src/components/certificate/achievement-card.tsx` | **Server** |
| `src/components/certificate/copy-verify-link-button.tsx` | **Client** |
| `src/components/shared/mobile-sidebar.tsx` | **Client** (already) |
| everything in `src/features/certificate/` | **Server only** |

**Server → Client prop passing:** the only boundary crossing is
`<CopyVerifyLinkButton link={string} />` — a plain string. **No functions, no icon
components, no Date objects, no Prisma model instances cross the boundary.** Format all
dates to strings on the server with `formatDateIST` from `@/lib/date-utils` before
rendering.

---

## 6. Steps

### Step 1 — `prisma/schema.prisma` `[edit]`

Add two enums near the existing enums (after `SubmissionStatus`):

```prisma
enum CertificateType {
  CLAUDE_CHALLENGE
  HACKATHON
  COHORT
  WORKSHOP
}

enum CertificateStatus {
  ISSUED
  REVOKED
}
```

Add the model:

```prisma
model Certificate {
  id            String            @id @default(cuid())
  /// Public, human-readable credential ID. Format: ABT-XX-XXXXX (e.g. ABT-CC-7K2M9).
  certificateId String            @unique
  userId        String
  type          CertificateType
  status        CertificateStatus @default(ISSUED)
  /// Snapshot of the recipient's name at issue time — never re-read from the profile.
  recipientName String
  /// Snapshot of the track. Null for non-challenge certificate types.
  domain        Domain?
  /// Set for challenge certificates; one certificate per completed enrollment.
  enrollmentId  String?           @unique
  issuedAt      DateTime          @default(now())
  /// Snapshot: { daysCompleted, longestStreak, completedAt, college? , organization? }
  metadata      Json?
  revokedAt     DateTime?
  revokedReason String?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  user       User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  enrollment Enrollment? @relation(fields: [enrollmentId], references: [id], onDelete: SetNull)

  @@index([userId, status])
  @@index([type, issuedAt])
}
```

Add back-relations:
- `User` → `certificates Certificate[]`
- `Enrollment` → `certificate Certificate?`

Migration name: `add_certificates`. See §7 before running anything.

---

### Step 2 — `src/features/certificate/constants.ts` `[new]`

```ts
import { CertificateType, Domain } from "@prisma/client";

/**
 * Crockford-style alphabet: no 0/O/1/I/L. 31^5 ≈ 28.6M ids per track —
 * plenty for a 1,500-student platform, and unambiguous when read off a printed page.
 */
export const CERT_ID_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CERT_ID_LENGTH = 5;
export const CERT_ID_PATTERN = /^ABT-[A-Z]{2}-[23456789A-HJ-NP-Z]{5}$/;

type CertificateTypeConfig = {
  /** The XX segment of ABT-XX-XXXXX. */
  code: string;
  title: string;
  subtitle: string;
};

export const CERTIFICATE_TYPES: Record<CertificateType, CertificateTypeConfig> = {
  CLAUDE_CHALLENGE: {
    code: "CC",
    title: "60-Day Claude Challenge",
    subtitle: "Claude AI Mastery Track",
  },
  HACKATHON: { code: "HK", title: "ABTalks Hackathon", subtitle: "Hackathon" },
  COHORT: { code: "CH", title: "ABTalks Cohort", subtitle: "Cohort Program" },
  WORKSHOP: { code: "WS", title: "ABTalks Workshop", subtitle: "Workshop" },
};

/**
 * Overlay layout, expressed as FRACTIONS of the template page box.
 *
 * Derived by measuring the approved template artwork (landscape, orange/near-black
 * "CERTIFICATE OF COMPLETION" design). Ratios rather than absolute points because the
 * artwork's aspect ratio (~1.57) is NOT A4 landscape (1.415) or Letter landscape
 * (1.294) — it is a custom page box, so hard-coded points would be wrong.
 *
 * The template has FIVE stamp targets, not three:
 *   1. ISSUED ON value       — under the top-left "ISSUED ON" label
 *   2. CERTIFICATE ID value  — under the top-centre "CERTIFICATE ID" label
 *   3. Recipient name        — between "PROUDLY PRESENTED TO" and the orange rule
 *   4. QR code               — under the bottom-right "SCAN TO VERIFY" label
 *   5. Verify URL            — under the bottom-right "Verify authenticity at" label
 *
 * Note the artwork's content column is centred at ~0.512, not 0.5 — the decorative
 * "AI" head graphic on the left pushes the text block slightly right. Centring the
 * name on 0.5 makes it visibly misaligned against "CERTIFICATE" above it.
 *
 * !!! These are STARTING values measured off the artwork render. Confirm against the
 * real PDF's MediaBox with the debug grid (see Step 9a) before shipping. !!!
 * Origin is bottom-left (pdf-lib convention), y grows upward.
 */
export const CLAUDE_CERT_LAYOUT = {
  /** Shared centre of the artwork's content column. */
  contentCenterXRatio: 0.512,

  issuedOn: {
    centerXRatio: 0.315,
    baselineYRatio: 0.905,
    fontSize: 10,
    color: { r: 0.07, g: 0.09, b: 0.15 },
  },
  certificateId: {
    centerXRatio: 0.619,
    baselineYRatio: 0.905,
    fontSize: 10,
    color: { r: 0.07, g: 0.09, b: 0.15 },
  },
  name: {
    /** Matches the content column, NOT the page centre. */
    centerXRatio: 0.512,
    /** Sits in the gap between "PROUDLY PRESENTED TO" and the orange rule. */
    baselineYRatio: 0.59,
    /** Locked by product owner. Auto-shrinks only if a name would overflow. */
    fontSize: 30,
    minFontSize: 16,
    /** Must not run past the orange rule (which spans ~0.30–0.72 of page width). */
    maxWidthRatio: 0.55,
    color: { r: 0.07, g: 0.09, b: 0.15 },
  },
  qr: {
    /** Bottom-left corner of the QR square, centred under "SCAN TO VERIFY". */
    xRatio: 0.873,
    yRatio: 0.082,
    sizeRatio: 0.082,
  },
  verifyText: {
    /** LEFT-aligned under "Verify authenticity at" — this label is bottom-right in the
     *  artwork, not bottom-centre. Do not centre this on the page. */
    xRatio: 0.855,
    baselineYRatio: 0.033,
    fontSize: 7,
    color: { r: 0.42, g: 0.45, b: 0.5 },
  },
} as const;

export function certificateDomainLabel(domain: Domain | null): string {
  switch (domain) {
    case Domain.CLAUDE: return "Claude AI Mastery";
    case Domain.SE: return "Software Engineering";
    case Domain.DS: return "Data Science";
    case Domain.AI: return "Artificial Intelligence";
    default: return "—";
  }
}
```

---

### Step 3 — `src/lib/validations/certificate.ts` `[new]`

```ts
import { z } from "zod";
import { CERT_ID_PATTERN } from "@/features/certificate/constants";

export const certificateIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(CERT_ID_PATTERN, "Invalid certificate ID format");
```

> Note: `@/lib/validations/*` importing from `@/features/*` is unusual for this repo but
> avoids duplicating the regex. If lint complains about the direction, inline the regex
> literal here instead and delete the import — **do not create a third file for it.**

---

### Step 4 — `src/features/certificate/generate-certificate-id.ts` `[new]`

```ts
import "server-only";
import { randomInt } from "node:crypto";
import type { CertificateType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CERTIFICATE_TYPES, CERT_ID_ALPHABET, CERT_ID_LENGTH } from "./constants";
```

- `randomSuffix()` — `CERT_ID_LENGTH` chars pulled with `randomInt(0, CERT_ID_ALPHABET.length)`.
  **Use `node:crypto`, not `Math.random`.**
- `export async function generateCertificateId(type: CertificateType): Promise<string>`
  - Loop max **6** attempts: build `ABT-${CERTIFICATE_TYPES[type].code}-${randomSuffix()}`,
    `prisma.certificate.findUnique({ where: { certificateId }, select: { id: true } })`,
    return on miss.
  - After 6 attempts, `logger.error` and throw `new Error("Could not allocate a unique certificate ID")`.
- The `@@unique` constraint is still the real guard — Step 5 handles `P2002`.

---

### Step 5 — `src/features/certificate/issue-certificate.ts` `[new]`

```ts
export type IssueResult =
  | { ok: true; data: { certificateId: string; alreadyIssued: boolean } }
  | { ok: false; message: string };

export async function ensureClaudeCertificate(userId: string): Promise<IssueResult>
```

Logic, in order:

1. Load the CLAUDE enrollment:
   ```ts
   prisma.enrollment.findFirst({
     where: { userId, domain: Domain.CLAUDE },
     select: {
       id: true, status: true, daysCompleted: true, longestStreak: true,
       completedAt: true, challenge: { select: { totalDays: true } },
       user: { select: { studentProfile: { select: { fullName: true, college: true, organization: true } } } },
     },
   })
   ```
   (Adjust the profile relation name to whatever `schema.prisma` actually calls it.)
2. Not found → `{ ok: false, message: "Not enrolled in the Claude challenge" }`.
3. **Eligibility:** `status === EnrollmentStatus.COMPLETED || daysCompleted >= (totalDays ?? 60)`.
   Not eligible → `{ ok: false, message: "Challenge not completed yet" }`.
4. Idempotency: `findUnique({ where: { enrollmentId } })` → if present, return
   `{ ok: true, data: { certificateId, alreadyIssued: true } }`.
5. Missing/blank `fullName` → `{ ok: false, message: "Complete your profile name before claiming your certificate" }`.
6. `generateCertificateId(CertificateType.CLAUDE_CHALLENGE)`, then `prisma.certificate.create`
   with `recipientName: fullName.trim()`, `domain: Domain.CLAUDE`, `enrollmentId`,
   `issuedAt: completedAt ?? new Date()`, and
   `metadata: { daysCompleted, longestStreak, completedAt: completedAt?.toISOString() ?? null, college, organization }`.
7. Catch `P2002` (race between two tabs) → re-read by `enrollmentId` and return it as
   `alreadyIssued: true`. Any other error → `logger.error` + `{ ok: false, message: "Could not issue certificate" }`.

**Single write, no transaction needed** — the unique constraints are the guard.

---

### Step 6 — `src/features/certificate/get-achievements.ts` `[new]`

```ts
export type AchievementView = {
  key: string;
  title: string;          // "60-Day Claude Challenge"
  subtitle: string;       // "Claude AI Mastery Track"
  certificateId: string;
  issuedOn: string;       // formatDateIST(...)
  daysCompleted: number;
  longestStreak: number;
  status: "COMPLETED" | "REVOKED";
};

export async function getAchievements(userId: string): Promise<AchievementView[]>
```

- Calls `ensureClaudeCertificate(userId)` first, wrapped in `try/catch` — a failure must
  **log and be swallowed**, never 500 the page.
- Then `prisma.certificate.findMany({ where: { userId }, select: {...}, orderBy: { issuedAt: "desc" } })`.
- Maps to `AchievementView` with all dates already stringified via `formatDateIST`.
- Returns `[]` for everyone else. **No "in progress" / locked rows** — per spec, users who
  haven't completed see no achievements.

---

### Step 7 — `src/features/certificate/get-certificate.ts` `[new]`

```ts
export type PublicCertificateView = {
  certificateId: string;
  recipientName: string;
  title: string;
  subtitle: string;
  domainLabel: string;
  issuedOn: string;
  daysCompleted: number | null;
  longestStreak: number | null;
  isRevoked: boolean;
};

export async function getPublicCertificate(rawId: string): Promise<PublicCertificateView | null>
```

- Parse with `certificateIdSchema.safeParse(rawId)` → return `null` on failure (**never
  hit the DB with an unvalidated string**).
- `findUnique` with an explicit `select` (no `userId`, no `user` relation, no `enrollmentId` —
  **nothing that identifies the account**).
- Read `daysCompleted` / `longestStreak` defensively out of the `metadata` JSON (it's
  `Json?`; guard with `typeof x === "number"`).

---

### Step 8 — `src/features/certificate/template-source.ts` `[new]`

Everything about *where the template lives* is isolated here.

```ts
import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { logger } from "@/lib/logger";

let cached: Uint8Array | null = null;

/**
 * The designed template is deliberately NOT in git (public repo). Production reads it
 * from CERTIFICATE_TEMPLATE_URL; local dev falls back to a gitignored file.
 * pdf-lib does not mutate the source bytes, so a module-level cache is safe.
 */
export async function loadCertificateTemplate(): Promise<Uint8Array> { … }
```

Resolution order:
1. `cached` → return.
2. `process.env.CERTIFICATE_TEMPLATE_URL` → `fetch(url, { cache: "force-cache" })`;
   non-2xx → throw `new Error("Certificate template fetch failed: <status>")`.
   `new Uint8Array(await res.arrayBuffer())`.
3. `process.env.CERTIFICATE_TEMPLATE_PATH ?? "assets/certificates/claude-certificate-template.pdf"`
   resolved against `process.cwd()` → `readFile`.
4. Neither works → `logger.error` and throw
   `new Error("Certificate template not configured")`.

Assign to `cached` before returning. **Do not put the template under `public/`** — that
would serve the blank template at a guessable URL.

---

### Step 9 — `src/features/certificate/render-certificate-pdf.ts` `[new]`

```ts
import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { CLAUDE_CERT_LAYOUT } from "./constants";
import { loadCertificateTemplate } from "./template-source";

export async function renderCertificatePdf(input: {
  recipientName: string;
  certificateId: string;
  /** Already formatted IST string, e.g. "12 Mar 2026". Formatted by the caller. */
  issuedOn: string;
  verifyUrl: string;
  /** Draws a calibration grid over the page. Dev only — see Step 9a. */
  debugGrid?: boolean;
}): Promise<Uint8Array>
```

1. **Sanitize the name for WinAnsi.** Built-in Helvetica is WinAnsi-encoded — pdf-lib
   *throws* on characters outside it (Devanagari, emoji, smart quotes from a paste).
   ```ts
   function toWinAnsiSafe(name: string): string {
     return name
       .normalize("NFKD")
       .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
       .replace(/[‐-―]/g, "-")
       .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
       .replace(/\s+/g, " ")
       .trim();
   }
   ```
   Empty result → throw `new Error("UNRENDERABLE_NAME")` (Step 11 turns this into a 422).
2. `const pdfDoc = await PDFDocument.load(await loadCertificateTemplate(), { updateMetadata: false });`
3. `const page = pdfDoc.getPages()[0];` — guard `undefined` → throw. `const { width, height } = page.getSize();`
4. Embed **both** faces — the name is bold, the small values are not:
   ```ts
   const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
   const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
   ```
   Add a local `drawCentered(text, font, size, centerXRatio, baselineYRatio, color)`
   helper **inside this file** — it's used four times. Do not extract it to a new file.
4a. **ISSUED ON + CERTIFICATE ID values.** The artwork prints only the *labels*; the
   values are ours to stamp, centred under each label:
   ```ts
   drawCentered(issuedOn, regular, L.issuedOn.fontSize, L.issuedOn.centerXRatio, L.issuedOn.baselineYRatio, L.issuedOn.color);
   drawCentered(certificateId, bold, L.certificateId.fontSize, L.certificateId.centerXRatio, L.certificateId.baselineYRatio, L.certificateId.color);
   ```
   The ID goes in **bold** — it's the field people transcribe off a printed page.
5. **Name, centred on the content column, auto-shrink safety valve:**
   ```ts
   const maxWidth = width * L.name.maxWidthRatio;
   let size = L.name.fontSize;                       // 30
   let textWidth = font.widthOfTextAtSize(safeName, size);
   while (textWidth > maxWidth && size > L.name.minFontSize) {
     size -= 1;
     textWidth = font.widthOfTextAtSize(safeName, size);
   }
   page.drawText(safeName, {
     x: width * L.name.centerXRatio - textWidth / 2,
     y: height * L.name.baselineYRatio,
     size, font, color: rgb(L.name.color.r, L.name.color.g, L.name.color.b),
   });
   ```
   30pt is the spec'd size; the loop only fires for unusually long names.
6. **QR:**
   ```ts
   const qrPng = await QRCode.toBuffer(verifyUrl, {
     type: "png", margin: 1, width: 512, errorCorrectionLevel: "M",
     color: { dark: "#000000FF", light: "#FFFFFFFF" },
   });
   const qrImage = await pdfDoc.embedPng(qrPng);
   const qrSize = width * L.qr.sizeRatio;
   page.drawImage(qrImage, { x: width * L.qr.xRatio, y: height * L.qr.yRatio, width: qrSize, height: qrSize });
   ```
7. **Verify URL text — LEFT-aligned, not centred.** The artwork's "Verify authenticity at"
   label sits bottom-**right**, so the URL goes directly beneath it at `L.verifyText.xRatio`:
   ```ts
   page.drawText(verifyUrl.replace(/^https?:\/\//, ""), {
     x: width * L.verifyText.xRatio,
     y: height * L.verifyText.baselineYRatio,
     size: L.verifyText.fontSize, font: regular, color: rgb(...),
   });
   ```
   Strip the scheme for legibility (`abtalks.in/verify/ABT-CC-7K2M9`); the **QR still
   encodes the full `https://` URL** so scanners resolve it.
8. `pdfDoc.setTitle(...)`, `setAuthor("ABTalks")`, `setSubject("60-Day Claude Challenge Certificate")`,
   `setKeywords([certificateId])`, `setProducer("ABTalks")`.
9. `if (debugGrid) drawCalibrationGrid(page, bold);` — see Step 9a.
10. `return await pdfDoc.save();`

---

### Step 9a — calibration grid (same file, dev only)

The layout ratios in Step 2 were measured off an artwork **render**, not the real PDF, and
its aspect ratio isn't a standard page size. Rather than nudge numbers blind, add a local
helper in `render-certificate-pdf.ts`:

```ts
function drawCalibrationGrid(page: PDFPage, font: PDFFont): void {
  const { width, height } = page.getSize();
  for (let i = 1; i < 20; i += 1) {
    const r = i / 20;
    page.drawLine({ start: { x: width * r, y: 0 }, end: { x: width * r, y: height },
      thickness: 0.3, color: rgb(1, 0, 0), opacity: 0.35 });
    page.drawLine({ start: { x: 0, y: height * r }, end: { x: width, y: height * r },
      thickness: 0.3, color: rgb(0, 0, 1), opacity: 0.35 });
    page.drawText(r.toFixed(2), { x: width * r + 1, y: 3, size: 5, font, color: rgb(1, 0, 0) });
    page.drawText(r.toFixed(2), { x: 3, y: height * r + 1, size: 5, font, color: rgb(0, 0, 1) });
  }
}
```

Wire it to a query param in the download route, **gated to non-production**:

```ts
const debugGrid =
  process.env.NODE_ENV !== "production" &&
  new URL(req.url).searchParams.get("debug") === "grid";
```

`?debug=grid` then prints a labelled 5%-increment grid over the template. Read the ratios
for each target straight off it and paste them into `CLAUDE_CERT_LAYOUT`. Two minutes
instead of a dozen guess-and-check downloads. **The gate is required — a production URL
must never render the grid.**

---

### Step 10 — `src/app/achievements/page.tsx` `[new]`

```tsx
export const dynamic = "force-dynamic";
```

Server Component:
1. `const session = await auth();` → `if (!session?.user?.id) redirect("/login");`
2. Mirror `src/app/profile/page.tsx:59-66`: confirm the user row still exists
   (`prisma.user.findUnique`), redirect to `/api/auth/signout?callbackUrl=/login` if not.
   **This app has known stale-JWT issues — do not skip it.**
3. Build `headerUser` exactly as `profile/page.tsx:78-84` does; render `<AppHeader user={headerUser} />`.
4. `const achievements = await getAchievements(userId);`
5. Heading: `Your Achievements`, subtext "Certificates and milestones you've earned on ABTalks."
6. `achievements.length === 0` → empty-state card: `Trophy` icon, "No achievements yet",
   "Finish a challenge, hackathon or cohort and your certificate will show up here.",
   plus a `buttonVariants`-styled `<Link href="/dashboard">Back to dashboard</Link>`.
7. Otherwise map to `<AchievementCard />`.
8. Bottom padding `pb-24` so the fixed bottom nav doesn't cover the last card.

> **Note:** this page performs a write (lazy issuance) during render. That is intentional
> and safe **only because** of `force-dynamic` — do not remove it, and do not add
> `unstable_cache` around `getAchievements`.

---

### Step 11 — `src/components/certificate/achievement-card.tsx` `[new]`

Server Component. Props: `achievement: AchievementView`, `verifyBaseUrl: string`.

Renders a `Card` with:
- `Award` icon in a primary-tinted circle, title, subtitle.
- Status `Badge`: `Completed` (`bg-green-600 text-white`) or `Revoked` (`variant="destructive"`).
- Meta rows: `Certificate ID` (`font-mono`), `Issued on`, `Days completed`, `Longest streak`.
- Actions row:
  - `<Link href={`/verify/${certificateId}`} className={cn(buttonVariants({ variant: "outline" }))}>View certificate</Link>`
  - `<a href={`/verify/${certificateId}/download`} className={cn(buttonVariants())} download>Download PDF</a>`
  - `<CopyVerifyLinkButton link={`${verifyBaseUrl}/verify/${certificateId}`} />`
- **`buttonVariants` on the `Link`/`a` directly — never `<Button asChild>` or `<Button render={...}>`.**
- Hide the download/copy actions when `status === "REVOKED"`.

`src/components/certificate/copy-verify-link-button.tsx` `[new]`: copy
`src/components/profile/copy-referral-link-button.tsx` and change only the label/toast text.

---

### Step 12 — `src/app/verify/[certificateId]/page.tsx` `[new]`

**Public — no `auth()`, no `requireRole`, no `requireAdmin`.**

```tsx
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }): Promise<Metadata> {
  const { certificateId } = await params;
  return {
    title: `Verify certificate ${certificateId.toUpperCase()} · ABTalks`,
    robots: { index: false, follow: false },
  };
}
```

`robots: noindex` keeps a crawlable directory of student names out of search results.

Body:
1. `const { certificateId } = await params;` then `getPublicCertificate(certificateId)`.
2. **Not found / invalid format** → render a friendly card (not a bare 404): `ShieldAlert`
   icon, "Certificate not found", "We couldn't find a certificate with the ID
   `<the-id>`. Check the ID and try again.", link to `/`. Friendlier than `notFound()`
   when someone mistypes an ID off a printed page.
3. **Revoked** → `ShieldX` card, "This certificate has been revoked", ID + issue date, no
   download button.
4. **Valid** → verification card:
   - Big green `ShieldCheck` header: "Verified Certificate".
   - `Recipient` — `recipientName`
   - `Credential` — `title`
   - `Track` — `domainLabel`
   - `Issued on` — `issuedOn`
   - `Certificate ID` — `font-mono`
   - `Status` — `Completed` badge
   - `Days completed` / `Longest streak` when present in metadata
   - `<a href={`/verify/${id}/download`} download className={cn(buttonVariants())}>Download certificate</a>`
   - Footer: "Issued by ABTalks · abtalks.in"
5. Standalone layout — **no `<AppHeader />`** (recruiters landing here aren't logged in).
   Centred `max-w-2xl`, `min-h-svh`, `bg-muted/30`.

`/verify` is not in `middleware.ts`'s `protectedPaths`, so it stays public with no change
there. It **is** in the bottom-nav render path, so add `verify` to the hide regex in
`src/components/shared/bottom-nav.tsx` alongside `students|r|program|talent`.

---

### Step 13 — `src/app/verify/[certificateId]/download/route.ts` `[new]`

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```

**Public — no auth.**

1. `const { certificateId } = await context.params;`
2. `getPublicCertificate(certificateId)` → `null` → `new Response("Not found", { status: 404 })`.
3. `isRevoked` → `new Response("This certificate has been revoked", { status: 410 })`.
4. Build `verifyUrl`:
   ```ts
   const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://abtalks.in";
   const verifyUrl = `${base}/verify/${cert.certificateId}`;
   ```
5. `renderCertificatePdf({ recipientName, certificateId, issuedOn: cert.issuedOn, verifyUrl, debugGrid })`
   inside `try/catch` — `cert.issuedOn` is already an IST-formatted string from
   `getPublicCertificate`, so **no `Date` reaches the renderer**:
   - `UNRENDERABLE_NAME` → 422 with a plain-text message asking the student to update
     their profile name to Latin characters.
   - anything else → `logger.error(...)` + 500 `"Could not generate certificate"`.
6. Success:
   ```ts
   return new Response(new Uint8Array(bytes), {
     headers: {
       "Content-Type": "application/pdf",
       "Content-Disposition": `attachment; filename="${safeFilename}"`,
       "Cache-Control": "public, max-age=300",
     },
   });
   ```
   `safeFilename` = `ABTalks-Claude-Challenge-<Name>-<CERTID>.pdf` sanitized exactly like
   `safePdfFilename` in `src/app/r/[token]/pdf/route.ts:9-17` (strip non-word chars,
   collapse whitespace to `-`, cap length).
   Use `attachment` (not `inline`) — the spec says *download*.
   `max-age=300` keeps revocation reasonably prompt.

---

### Step 14 — `src/components/shared/mobile-sidebar.tsx` `[edit]`

- Add `Award` to the existing `lucide-react` import.
- Insert directly **above** the Profile row, inside the same `<nav>`:
  ```tsx
  <Link href="/achievements" onClick={() => setOpen(false)} className={ROW_CLASS}>
    <Award className="size-4 text-muted-foreground" aria-hidden />
    Your Achievements
  </Link>
  ```
- Nothing else in this file changes.

---

### Step 15 — `src/app/profile/page.tsx` `[edit]`

Add one card in the right-hand column, directly **above** the "My Redemptions" card:

```tsx
<Card className="min-w-0">
  <CardHeader className="pb-3 sm:pb-4">
    <CardTitle>Your Achievements</CardTitle>
    <CardDescription>Certificates and milestones you&apos;ve earned.</CardDescription>
  </CardHeader>
  <CardContent className="p-4 sm:p-6">
    <Link href="/achievements" className={cn(buttonVariants({ variant: "outline" }))}>
      View achievements
    </Link>
  </CardContent>
</Card>
```

Add `Award` to the `lucide-react` import only if you actually render the icon. **No other
change to this file** — do not restructure it into tabs, do not touch the existing cards.

---

### Step 16 — `middleware.ts` `[edit]`

Add `"/achievements",` to the `protectedPaths` array. **That's the entire change — no new
imports, edge-safety is non-negotiable.**

---

### Step 17 — `prisma/scripts/backfill-certificates.ts` `[new]`

`tsx` script, mirroring the style of `prisma/scripts/bootstrap-program-start-day.ts`:

1. Find CLAUDE enrollments where `(status === COMPLETED || daysCompleted >= 60)` **and**
   `certificate is null`.
2. Print the count and the names, then a **5-second pause** (same convention as
   `prisma/cleanup.ts`) before writing.
3. Loop calling `ensureClaudeCertificate(userId)`; log `certificateId` per user, tally
   issued/skipped/failed at the end.
4. Support `--dry-run` to list without writing.
5. `package.json`: `"db:backfill:certificates": "tsx prisma/scripts/backfill-certificates.ts"`.

---

### Step 18 — deps & ignore `[edit]`

```bash
npm i pdf-lib qrcode && npm i -D @types/qrcode
```

`.gitignore`, at the end:
```
# certificate templates (never commit — public repo)
/assets/certificates/
```

**Do NOT add `@pdf-lib/fontkit`** — we're on built-in Helvetica, it isn't needed.

New env vars (add to Vercel + `.env.local`):
- `CERTIFICATE_TEMPLATE_URL` — HTTPS URL of `claude-certificate-template.pdf` (production)
- `CERTIFICATE_TEMPLATE_PATH` — optional local override; defaults to
  `assets/certificates/claude-certificate-template.pdf`

---

## 7. DB safety

This plan changes the schema. **Before touching Prisma:**

1. `git add -A && git commit -m "checkpoint before certificate schema"` — **record the
   commit hash in the PR description.**
2. Create a Neon branch as a snapshot (name it `pre-certificates`).
3. `npx prisma migrate dev --name add_certificates`
4. `npx prisma generate`
5. **Additive only** — this migration creates two enums, one table, and two FKs. It must
   contain **no `ALTER`/`DROP` on `User`, `Enrollment`, or any existing column.** Read the
   generated SQL before applying and stop if it does.
6. Deploy runs `prisma migrate deploy` via the `build` script — no manual prod step.
7. Backfill runs **after** deploy: `npm run db:backfill:certificates -- --dry-run` first,
   then for real.

---

## 8. Verification

### Template calibration (do this first, before UI polish)
1. Drop the real `claude-certificate-template.pdf` into `assets/certificates/`.
2. **Print the real page size before anything else** — the ratios in Step 2 were measured
   off an artwork render whose aspect ratio (~1.57) matches no standard page. Temporarily
   `logger.info(page.getSize())` in the renderer, or run:
   ```bash
   node -e "const{PDFDocument}=require('pdf-lib');const fs=require('fs');PDFDocument.load(fs.readFileSync('assets/certificates/claude-certificate-template.pdf')).then(d=>console.log(d.getPages()[0].getSize()))"
   ```
   If the ratio of `width/height` is **not ≈1.57**, the artwork render was cropped and
   **every `baselineYRatio` in Step 2 is off** — recalibrate all of them via the grid.
3. `/verify/<a-test-cert-id>/download?debug=grid` → open the PDF, read the ratios for all
   five targets off the labelled grid, paste into `CLAUDE_CERT_LAYOUT`.
4. Re-download without `?debug=grid` and confirm each target:
   - date sits centred under **ISSUED ON**
   - ID sits centred under **CERTIFICATE ID**
   - name sits in the gap between **PROUDLY PRESENTED TO** and the orange rule, optically
     centred against the "CERTIFICATE" wordmark above it (not the page centre)
   - QR sits in the blank square under **SCAN TO VERIFY**, clear of the wreath emblem and
     of "Verify authenticity at"
   - URL sits directly under **Verify authenticity at**, left edges aligned, not running
     off the right edge
   Restart `npm run dev` after replacing the template file itself — `template-source.ts`
   caches bytes per-process.
5. Test with a long name (e.g. "Venkatanarasimharajuvaripeta Subramanian") to confirm the
   auto-shrink keeps it inside `maxWidthRatio` and it doesn't collide with the orange rule.
6. **Scan the QR with a real phone camera** at final print size. If it won't resolve, raise
   `qr.sizeRatio` before touching `errorCorrectionLevel`.

### Manual test path
1. `npm run db:seed:claude-test` (or admin-mark a test user to day 60).
2. Log in as that user → open the mobile sidebar → **Your Achievements** row is there.
3. `/achievements` shows one card: "60-Day Claude Challenge", **Completed**, an ID
   matching `ABT-CC-XXXXX`, issue date, days completed, longest streak.
4. Reload twice — **the certificate ID must not change** (idempotency).
5. Log in as a user on day 20 → `/achievements` shows the empty state, and **no
   Certificate row is created** for them (check the DB).
6. Open `/verify/ABT-CC-XXXXX` **in a logged-out incognito window** → full details render,
   no redirect to `/login`.
7. Click **Download certificate** → PDF opens with the correct name at 30pt and a QR that,
   when scanned with a phone, lands back on the same verify page.
8. `/verify/ABT-CC-BADID` and `/verify/nonsense` → friendly "Certificate not found" card,
   no crash, no stack trace.
9. Manually set a certificate's `status = REVOKED` in the DB → verify page shows the
   revoked state, download returns 410.
10. `/profile` still renders correctly and the new card links through.

### Must pass
- `npx tsc --noEmit` — zero errors, **no `any`**.
- `npm run lint` — clean.
- `npm run build` — succeeds. **Watch specifically for an Edge bundle-size error from
  `middleware.ts`; if one appears, something imported `@/lib/*` into it — revert that.**

### Files that should have changed — nothing else
```
prisma/schema.prisma
prisma/migrations/<ts>_add_certificates/migration.sql
prisma/scripts/backfill-certificates.ts
package.json  package-lock.json  .gitignore  middleware.ts
src/lib/validations/certificate.ts
src/features/certificate/{constants,generate-certificate-id,issue-certificate,get-achievements,get-certificate,template-source,render-certificate-pdf}.ts
src/app/achievements/page.tsx
src/app/verify/[certificateId]/page.tsx
src/app/verify/[certificateId]/download/route.ts
src/components/certificate/{achievement-card.tsx,copy-verify-link-button.tsx}
src/components/shared/{mobile-sidebar.tsx,bottom-nav.tsx}
src/app/profile/page.tsx
```

---

## 9. Guardrails for Cursor (DO NOT)

- **DO NOT** add `requireRole` / `requireAdmin` / `auth()` gating to
  `src/app/verify/[certificateId]/page.tsx` or its `download/route.ts`. **Both are
  deliberately public** — that is the entire point of a verifiable credential.
- **DO NOT** add any `@/lib/*` (or any non-`next-auth` / non-`next/server`) import to
  `middleware.ts`. The only change there is one string in `protectedPaths`.
- **DO NOT** modify `src/features/submission/submit-day.ts`. Certificate issuance stays
  out of the submission hot path and its 20s transaction.
- **DO NOT** use `@react-pdf/renderer` for the certificate. It builds PDFs from scratch and
  cannot overlay an existing template. `pdf-lib` only.
- **DO NOT** commit `claude-certificate-template.pdf`, and **do not** place it in `public/`
  — the repo is public and `public/` is world-readable.
- **DO NOT** add `@pdf-lib/fontkit` or register any custom TTF. Built-in
  `StandardFonts.HelveticaBold` at size 30, per the product decision.
- **DO NOT** re-read `StudentProfile.fullName` when rendering the PDF. Always use the
  snapshotted `Certificate.recipientName`.
- **DO NOT** regenerate or mutate an existing `certificateId`. Issuance is
  create-once-and-only-once, keyed on `enrollmentId`.
- **DO NOT** add a 6th tab to `src/components/shared/bottom-nav.tsx`. The only change
  there is adding `verify` to the hide regex.
- **DO NOT** restructure `/profile` into tabs. One card is added; everything else is left alone.
- **DO NOT** use `<Button asChild>` or `<Button render={<Link>}>`. Apply `buttonVariants`
  to `<Link>` / `<a>` directly (Base UI button semantics).
- **DO NOT** use `console.error` / `console.log`. Use `lib/logger.ts`.
- **DO NOT** return full Prisma records. Every query uses an explicit `select`, and
  `getPublicCertificate` must not select `userId` or `enrollmentId`.
- **DO NOT** pass `Date` objects, functions, or icon components from Server to Client
  components. `<CopyVerifyLinkButton link={string} />` takes a plain string, nothing else.
- **DO NOT** create helper/abstraction files beyond the list in §4.
- **DO NOT** wrap `getAchievements` in `unstable_cache` or remove `force-dynamic` from
  `/achievements` — it performs a write.
- **DO NOT** use `Math.random()` for certificate IDs. `node:crypto` `randomInt` only.
- **DO NOT** draw the recipient name or any label text that the artwork already prints.
  "ISSUED ON", "CERTIFICATE ID", "SCAN TO VERIFY", "PROUDLY PRESENTED TO" and "Verify
  authenticity at" are **baked into the template** — we stamp only the *values* beneath them.
- **DO NOT** centre the verify URL on the page. Its label is bottom-**right** in the
  artwork; the URL is left-aligned beneath it at `verifyText.xRatio`.
- **DO NOT** centre the name on `0.5`. The artwork's content column is at ~`0.512`.
- **DO NOT** let `?debug=grid` work in production. It is gated on
  `process.env.NODE_ENV !== "production"`.
- **DO NOT** seed or hard-code any real student's certificate ID.

---

## 10. Follow-ups deliberately out of scope

Note these; do not build them in this pass.

- **No rate limiting on `/verify/*`** — the ID space (31^5) makes enumeration impractical,
  but a scraper could still walk it. Consistent with the app-wide gap already tracked in
  `docs/security-todos.md`; add an entry there for this route.
- **No admin revoke UI.** Revocation is a manual DB update for now. An admin action +
  `AdminAction` audit row belongs in a later plan.
- **No email on issuance.** `src/features/email/` exists — sending "your certificate is
  ready" is a separate plan.
- **Hackathon / Cohort / Workshop certificates.** The enum, ID codes and registry are in
  place; the issuance rules and templates are not.
- **`docs/project-context.md`** should get §4 (domain model), §7 (routing), §13 (env vars)
  updated **once this actually ships**, not before.

---

## 11. Commit message

```
feat(certificates): Claude Challenge certificates, public verification & achievements

Add a Certificate model (ABT-CC-XXXXX ids) issued idempotently when a CLAUDE
enrollment reaches 60 days, a protected /achievements page, a public
/verify/<id> verification page, and a public PDF download that stamps the
recipient's name and a verification QR onto the designed template via pdf-lib.

Issuance is lazy and out of the submission hot path; a backfill script covers
enrollments completed before this shipped. The certificate template is fetched
from CERTIFICATE_TEMPLATE_URL at runtime and is never committed to the repo.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
