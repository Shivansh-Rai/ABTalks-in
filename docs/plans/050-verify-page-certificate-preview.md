# 050 — Verify page: live certificate preview panel

## 1. Goal

Turn `/verify/<certificate-id>` from a single centred details card into a two-column
layout: **verification details on the left, a live preview of the actual certificate PDF
on the right**, pinned (sticky) so it stays in view while the left column scrolls. The
preview must be the *real* generated certificate — not a mockup — so a recruiter sees
exactly what the student downloads.

---

## 2. Current behavior

- `src/app/verify/[certificateId]/page.tsx` — public Server Component, `force-dynamic`.
  Three branches, each a single `max-w-2xl` card inside
  `flex min-h-svh items-center justify-center bg-muted/30`:
  1. **not found** (`ShieldAlert`) — invalid ID format or no row,
  2. **revoked** (`ShieldX`),
  3. **valid** (`ShieldCheck`) — a `dl` of Recipient / Credential / Track / Issued on /
     Certificate ID / Status / Days completed / Longest streak, one
     `<a href="/verify/<id>/download" download>` button, and an "Issued by ABTalks" footer.
- `src/app/verify/[certificateId]/download/route.ts` — public `nodejs` GET handler.
  Renders the PDF on every request via `renderCertificatePdf` and **always** returns
  `Content-Disposition: attachment`, `Cache-Control: public, max-age=300`.
  Handles 404 (no cert), 410 (revoked), 422 (`UNRENDERABLE_NAME`), 500.
  Supports `?debug=grid`, gated to non-production.
- `src/features/certificate/render-certificate-pdf.ts` — pdf-lib overlay onto the template.
  **Verified template page box: `960 × 639.75` pt → aspect ratio `1.5006` (effectively 3:2).**
- `src/features/certificate/template-source.ts` — the template now lives at
  `public/certificates/claude-certificate-template.pdf` and **is committed to git**
  (plan 040 assumed otherwise; reality won). `CERTIFICATE_TEMPLATE_URL` still overrides.
- `src/components/shared/bottom-nav.tsx:82` already hides the bottom nav on `/verify/*`.
  The verify page renders no `AppHeader` — it is a standalone public page.
- There is **no PDF preview / embed anywhere in the app** today. `pdfjs-dist`,
  `react-pdf` and any rasterizer are **not** dependencies, and this plan does not add them.

---

## 3. Decisions taken (read before implementing)

| Decision | Choice | Why |
|---|---|---|
| What renders in the preview | **The real PDF, in an `<iframe>`, served by the existing download route with `?inline=1`** | Pixel-exact by construction, zero new deps, one source of truth for layout. Any HTML/CSS facsimile would need a PNG export of the artwork plus a second copy of `CLAUDE_CERT_LAYOUT` maths, and would drift from the PDF the moment either changes. |
| How the inline variant is exposed | **Query param on the existing route** (`?inline=1` → `Content-Disposition: inline`), default stays `attachment` | Keeps 404/410/422/500 handling, filename sanitisation and caching in one place. A separate `preview/route.ts` would duplicate all of it. |
| Why not serve `inline` always and let the anchor's `download` attribute force a save | **Rejected** | It works (same-origin `download` beats `Content-Disposition: inline`), and it would save one render — but anyone who opens the bare download URL directly would get a viewer instead of a file. Predictable download semantics win over one cached render. |
| Desktop/mobile gating | **`matchMedia("(min-width: 1024px)")` in a small client component**, not `hidden lg:block` | A `display:none` iframe **still fetches its `src`** — CSS-only gating would run a full pdf-lib render on every mobile visit for something nobody sees. Mobile is this platform's primary audience, so that is the common case, not the edge case. |
| Mobile experience | Details card, then an **"Open certificate preview"** link that opens the inline PDF in a new tab | Android Chrome and iOS Safari render PDF-in-iframe unreliably (blank box / download shelf). A new tab hands off to the OS/browser PDF viewer, which always works. |
| Preview on revoked / not-found | **No preview panel** — those branches stay exactly as they are | Never render a valid-looking certificate next to "this certificate has been revoked". |
| Element | **`<iframe>`, no `sandbox`** | `sandbox` disables Chrome's and Firefox's built-in PDF viewer, which is the entire mechanism here. `<object>`/`<embed>` add fallback complexity for no gain. |

**Accepted trade-off:** a valid verify page render now costs one PDF render for the preview,
and a later download click costs a second (different URL ⇒ different cache entry). At this
page's traffic, with `max-age=300`, that is fine. Do **not** "optimise" it by merging the
two URLs — see the rejected row above.

---

## 4. Files to touch

| Path | | Note |
|---|---|---|
| `src/app/verify/[certificateId]/download/route.ts` | `[edit]` | Read `?inline=1`; flip `Content-Disposition` only for that. Nothing else changes. |
| `src/components/certificate/certificate-preview-panel.tsx` | `[new]` | `"use client"` — sticky preview card: desktop iframe + skeleton, mobile link fallback. |
| `src/app/verify/[certificateId]/page.tsx` | `[edit]` | Valid branch only: two-column grid + render the panel. |

**Do NOT create or modify any file not on this list.** No schema change, no new
dependency, no new env var, no `middleware.ts` change (`/verify/*` stays public).

---

## 5. Server vs Client

| Component | Boundary |
|---|---|
| `src/app/verify/[certificateId]/page.tsx` | **Server** (`force-dynamic`, public — unchanged) |
| `src/app/verify/[certificateId]/download/route.ts` | **Server** route handler, `runtime = "nodejs"` (public — unchanged) |
| `src/components/certificate/certificate-preview-panel.tsx` | **Client** |

**Server → Client prop passing:** exactly two props, both plain strings —
`<CertificatePreviewPanel previewSrc={string} certificateId={string} />`.
No `Date`, no functions, no icon components, no Prisma objects, and **not** the
`PublicCertificateView` object.

---

## 6. Steps

### Step 1 — `src/app/verify/[certificateId]/download/route.ts` `[edit]`

Only the disposition becomes conditional. The `URL` object is already built for
`?debug=grid` — reuse it instead of constructing a second one.

Replace lines 35–37:

```ts
const searchParams = new URL(req.url).searchParams;
const inline = searchParams.get("inline") === "1";
const debugGrid =
  process.env.NODE_ENV !== "production" &&
  searchParams.get("debug") === "grid";
```

and in the success response:

```ts
"Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeFilename}"`,
```

Everything else in this file is untouched — no auth, same 404 / 410 / 422 / 500 branches,
same `Cache-Control: public, max-age=300`, same `safePdfFilename`.

---

### Step 2 — `src/components/certificate/certificate-preview-panel.tsx` `[new]`

```tsx
"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Matches Tailwind's `lg` breakpoint — keep the two in sync. */
const DESKTOP_QUERY = "(min-width: 1024px)";

type Props = {
  /** Inline PDF URL, already built by the server. */
  previewSrc: string;
  certificateId: string;
};

export function CertificatePreviewPanel({ previewSrc, certificateId }: Props) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setIsDesktop(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  return (
    <Card className="min-w-0 lg:sticky lg:top-6">
      <CardHeader className="pb-3 sm:pb-4">
        <CardTitle className="text-base sm:text-lg">Certificate preview</CardTitle>
        <CardDescription>
          The certificate exactly as issued to the recipient.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-4 sm:p-6">
        {isDesktop ? (
          <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg border bg-muted">
            {!loaded ? (
              <Skeleton className="absolute inset-0 rounded-none" />
            ) : null}
            <iframe
              src={previewSrc}
              title={`Certificate ${certificateId}`}
              onLoad={() => setLoaded(true)}
              className="relative size-full"
            />
          </div>
        ) : null}

        <a
          href={previewSrc}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "w-full sm:w-auto",
          )}
        >
          <ExternalLink className="mr-2 size-4" aria-hidden />
          {/* Desktop: escape hatch when the browser's PDF viewer is disabled.
              Mobile: this IS the preview — iframed PDFs are unreliable there. */}
          Open certificate preview
        </a>
      </CardContent>
    </Card>
  );
}
```

Notes the executor must respect:

- **The skeleton sits *behind* the iframe** (`absolute inset-0`, iframe `relative` on top),
  not over it. `onLoad` does not fire in every browser/PDF-viewer combination — an overlay
  would then cover the certificate forever. Behind, a missed `onLoad` is harmless.
- `isDesktop` starts `false` so SSR and first paint never emit the iframe; the effect
  upgrades it. This is intentional — do not "fix" it with a `useSyncExternalStore` rewrite
  or by rendering the iframe unconditionally.
- **No `sandbox` attribute.** It disables the built-in PDF viewer.
- No `loading="lazy"` — on desktop this is the primary content of the panel.
- `size="sm"` must exist in `buttonVariants`; if it does not, drop the `size` key rather
  than adding a variant.

---

### Step 3 — `src/app/verify/[certificateId]/page.tsx` `[edit]`

**Only the valid (third) branch changes.** The not-found and revoked branches keep their
current markup verbatim, including `flex min-h-svh items-center justify-center` and
`max-w-2xl`.

Add the import:

```tsx
import { CertificatePreviewPanel } from "@/components/certificate/certificate-preview-panel";
```

Build the preview URL just above the final `return` (server-side, plain string):

```tsx
// `#toolbar=0&navpanes=0&view=FitH` are PDF open-parameter hints — Chrome honours them,
// Firefox's pdf.js ignores most. Harmless either way; the fragment must follow the query.
const previewSrc = `/verify/${cert.certificateId}/download?inline=1#toolbar=0&navpanes=0&view=FitH`;
```

Replace the valid branch's outer wrapper (currently
`<div className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-12">` with
a single `<Card className="w-full max-w-2xl">` inside) with:

```tsx
return (
  <div className="min-h-svh bg-muted/30 px-4 py-8 sm:py-12">
    <div className="mx-auto grid w-full max-w-6xl items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <Card className="min-w-0">
        {/* …existing CardHeader + CardContent, completely unchanged… */}
      </Card>

      <CertificatePreviewPanel
        previewSrc={previewSrc}
        certificateId={cert.certificateId}
      />
    </div>
  </div>
);
```

Constraints on this edit:

- **`items-start` on the grid is required.** Grid items stretch by default, which silently
  breaks `position: sticky` on the panel.
- Vertical centring is dropped (`items-center justify-center` → nothing). With a tall
  two-column layout, centring fights the sticky panel.
- The panel is **second in DOM order**, so mobile stacks details → preview with no `order-*`
  classes.
- The left card keeps `w-full max-w-2xl`? **No** — swap it for `min-w-0` so the grid column
  controls its width. That is the only change to the card element itself.
- Do **not** touch the `dl`, the existing "Download certificate" button, or the
  "Issued by ABTalks · abtalks.in" footer. The primary download stays on the left card.

---

## 7. DB safety

**Not applicable.** This plan changes no Prisma schema, runs no migration, writes no rows,
and reads nothing new from the database. No Neon branch or checkpoint is required.

---

## 8. Verification

### Manual test path

1. `npm run dev`, open `/verify/<a-real-ABT-CC-id>` on a **desktop-width** window,
   **logged out / incognito** — the page must render two columns with no redirect to
   `/login`, and the right panel must show the certificate with the recipient's name,
   certificate ID, issue date and QR visible.
2. Scroll the page — the preview panel stays pinned (`top-6`) while the left card scrolls.
3. Network tab: exactly **one** request to `…/download?inline=1`, response
   `Content-Type: application/pdf` and `Content-Disposition: inline; filename="…"`.
4. Click **Download certificate** on the left card → request to `…/download` **without**
   `inline=1`, `Content-Disposition: attachment`, file saves. Opening that saved file shows
   the same certificate as the preview.
5. Narrow the window below 1024px **without reloading** — the iframe disappears and only
   the "Open certificate preview" link remains (the `change` listener must handle this).
6. On a real phone (or DevTools device mode + reload): **no** iframe in the DOM and **no**
   `?inline=1` request fires on load. Tapping "Open certificate preview" opens the PDF in a
   new tab.
7. `/verify/ABT-CC-BADID` and `/verify/nonsense` → unchanged single "Certificate not found"
   card, **no preview panel**, no `?inline=1` request.
8. Set a certificate's `status = REVOKED` in the DB → revoked card only, **no preview
   panel**; `…/download?inline=1` still returns **410**.
9. Disable Chrome's built-in PDF viewer (`chrome://settings/content/pdfDocuments` → "Download
   PDFs") and reload the desktop page: the iframe may show a download prompt — the "Open
   certificate preview" link must still work. Nothing may crash or hang on a skeleton.
10. `/achievements` and its "Download PDF" button still behave exactly as before (untouched).

### Must pass

- `npx tsc --noEmit` — zero errors, no `any`.
- `npm run lint` — clean.
- `npm run build` — succeeds. If an Edge bundle-size error appears from `middleware.ts`,
  something was imported that shouldn't be — this plan touches no middleware, so revert it.

### Files that should have changed — nothing else

```
src/app/verify/[certificateId]/page.tsx
src/app/verify/[certificateId]/download/route.ts
src/components/certificate/certificate-preview-panel.tsx
```

`package.json` / `package-lock.json` must be **unchanged** — no new dependency is part of
this plan.

---

## 9. Guardrails for Cursor (DO NOT)

- **DO NOT** add `auth()`, `requireRole` or `requireAdmin` to the verify page or the
  download route. Both are deliberately public — that is the point of a verifiable credential.
- **DO NOT** change the default `Content-Disposition`. It stays `attachment`; **only**
  `?inline=1` produces `inline`.
- **DO NOT** create a separate `preview/route.ts`, or any file beyond the three in §4.
- **DO NOT** add `pdfjs-dist`, `react-pdf`, `@react-pdf/renderer`, `sharp`, a headless
  browser, or any rasterizer. No new dependency at all.
- **DO NOT** rebuild the certificate as HTML/CSS. The preview is the real PDF.
- **DO NOT** touch `render-certificate-pdf.ts`, `constants.ts` (`CLAUDE_CERT_LAYOUT`),
  `template-source.ts`, `get-certificate.ts`, or the template PDF. Layout calibration is
  settled; this plan is presentation only.
- **DO NOT** gate the iframe with `hidden lg:block` / `sm:hidden`. A hidden iframe still
  fetches its `src` and would run a pdf-lib render on every mobile visit. The `matchMedia`
  gate exists for that reason.
- **DO NOT** add a `sandbox` attribute to the iframe — it disables the browser PDF viewer.
- **DO NOT** convert `page.tsx` into a Client Component or add `"use client"` to it. Only
  `certificate-preview-panel.tsx` is client.
- **DO NOT** pass the `cert` object, a `Date`, a function, or an icon component into
  `CertificatePreviewPanel`. Two plain strings, nothing else.
- **DO NOT** render the preview panel in the not-found or revoked branches.
- **DO NOT** remove `export const dynamic = "force-dynamic"` from the page or the route,
  and do not wrap `getPublicCertificate` in `unstable_cache`.
- **DO NOT** put the skeleton *over* the iframe. `onLoad` is not guaranteed to fire; an
  overlay can strand the panel on a loading state forever.
- **DO NOT** add an `AppHeader`, bottom nav, or site chrome to `/verify/*`. It is a
  standalone public page, and `bottom-nav.tsx` already hides itself on this route.
- **DO NOT** use `<Button asChild>` or `<Button render={<Link>}>`. Apply `buttonVariants`
  to the `<a>` directly (Base UI button semantics).
- **DO NOT** use `console.*` — `lib/logger.ts` only (no new logging is expected here).
- **DO NOT** change the `robots: { index: false }` metadata. A crawlable index of student
  names stays out of search results.
- **DO NOT** let `?debug=grid` become reachable in production; its existing
  `NODE_ENV !== "production"` gate must survive the edit in Step 1.

---

## 10. Follow-ups deliberately out of scope

- **Same preview on `/achievements`.** `AchievementCard` could reuse
  `CertificatePreviewPanel`, but the achievements list is a stack of cards and would fire N
  PDF renders. It needs its own design pass (a modal, or preview-on-expand).
- **Caching the rendered PDF.** Every valid verify view renders the PDF fresh (bounded by
  `max-age=300`). If Vercel function time becomes a concern, persist the rendered bytes to
  Blob on first issue and serve them — a separate plan.
- **Social/OG preview image** for shared verify links (would need a rasterizer or
  `next/og`).
- **Print stylesheet** for the verify page.
- `docs/project-context.md` needs no update for this change (presentation only).

---

## 11. Commit message

```
feat(verify): live certificate preview panel on the verification page

Split /verify/<id> into a two-column layout — verification details on the
left, a sticky preview of the real certificate PDF on the right. The preview
embeds the existing download route with ?inline=1, so it is the exact
document the recipient downloads rather than a mockup.

The iframe is mounted only above the lg breakpoint via matchMedia (a hidden
iframe would still fetch and render a PDF on every mobile visit); mobile and
PDF-viewer-disabled browsers get an "Open certificate preview" link instead.
Not-found and revoked states are unchanged and show no preview.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
