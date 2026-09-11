import type { ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { SignupQuotePanel } from "./signup-quote-panel";

/*
 * Shared frame for the recruiter sign-up and sign-in screens: the animated
 * quote panel on the left, a static form card on the right. Only the form
 * differs between the two pages.
 *
 * The card never scrolls. Its spacing tightens on short viewports instead:
 * ≤860px tall trims gaps and padding, ≤760px shrinks the heading, ≤720px
 * drops inputs to 44px and hides field hints. Every class is written out
 * literally — Tailwind only generates classes it can read verbatim.
 */

/** Client-side shape check only; the server's Zod schema is the authority. */
export const EMAIL_RE = /^\S+@\S+\.\S+$/;

// DS v2 §12: 48px input, 16px padding, 8px radius, 1px #E0E0E0, white.
export const AUTH_INPUT =
  "h-12 [@media(max-height:720px)]:h-11 w-full rounded-lg border border-[#E0E0E0] bg-white px-4 text-base text-[#161616] placeholder:text-[#A5A5A5] transition-colors hover:border-[#A5A5A5] focus-visible:border-[#03535F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#03535F]/25 disabled:bg-[#F4F4F4] disabled:text-[#8F8F8F]";

export const AUTH_TITLE =
  "text-center font-heading text-[32px] font-bold leading-9 text-[#10292C] lg:text-[40px] lg:leading-[48px] [@media(max-height:760px)]:lg:text-[34px] [@media(max-height:760px)]:lg:leading-10";

export const AUTH_LEAD =
  "mt-4 text-center text-base leading-[25px] text-[#626262] lg:text-[17px] lg:leading-7 [@media(max-height:860px)]:mt-3";

export const AUTH_FORM =
  "mx-auto mt-10 max-w-[470px] space-y-4 [@media(max-height:860px)]:mt-6 [@media(max-height:860px)]:space-y-3";

/** Wraps the primary CTA so it sits a step below the last field. */
export const AUTH_CTA_WRAP = "pt-4 [@media(max-height:860px)]:pt-2";

export const AUTH_FOOTNOTE =
  "mt-6 text-center text-sm text-[#626262] [@media(max-height:860px)]:mt-4";

export const AUTH_FOOTNOTE_LINK =
  "font-semibold text-[#03535F] underline underline-offset-2 hover:text-[#076573]";

export function AuthField({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-[#161616]">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {hint && (
        <p
          id={`${id}-hint`}
          className="mt-1.5 text-xs text-[#787878] [@media(max-height:720px)]:hidden"
        >
          {hint}
        </p>
      )}
    </div>
  );
}

/** Inline, icon-led error — never colour alone (DS v2 §17). */
export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 text-sm text-[#D92D20]">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

/** Shown in place of an emailed code when no mail provider is configured. */
export function DevCodeNotice({ code }: { code: string | null }) {
  if (!code) return null;
  return (
    <p className="rounded-lg border border-[#AA821D]/30 bg-[#FFEDB0]/60 px-3 py-2 text-xs text-[#6B5212]">
      <strong className="font-semibold">Development only.</strong> No mail
      provider is configured, so the code is shown here:{" "}
      <span className="font-mono text-sm font-bold tracking-widest">{code}</span>
    </p>
  );
}

export function RecruiterAuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh bg-[#D4EBEC] p-4 sm:p-6 lg:h-svh lg:gap-12 lg:overflow-hidden lg:p-9 [@media(max-height:860px)]:lg:p-6">
      {/* The panel itself is aria-hidden (decorative), so the link sits on top
          of it rather than inside — it must stay reachable and announced. */}
      <div className="relative hidden min-w-0 flex-1 lg:block">
        <SignupQuotePanel />
        <Link
          href="/"
          className="absolute left-6 top-6 z-10 inline-flex h-11 items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to home
        </Link>
      </div>

      <section className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden rounded-[36px] border border-white/70 bg-[#EAF4F4] px-5 py-8 shadow-[0_24px_60px_-30px_rgba(3,83,95,0.35)] sm:px-10 [@media(max-height:860px)]:py-6">
        {/* Phones have no gradient panel, so the way home moves into the card. */}
        <Link
          href="/"
          className="absolute left-3 top-3 inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-[#03535F] transition-colors hover:bg-[#03535F]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#03535F] lg:hidden"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to home
        </Link>
        <div className="w-full max-w-[540px]">{children}</div>
      </section>
    </div>
  );
}
