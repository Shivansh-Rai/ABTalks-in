import { formatCreditsMinor } from "@/lib/credits-format";

/**
 * The recruiter's credit balance, in the desk header (T-229).
 *
 * ## Why it exists
 *
 * Until now the balance was only visible inside the unlock dialog, which meant
 * a recruiter had to start spending to find out what they had. This is the
 * smallest honest fix: one figure, in the header they already look at, beside
 * the shortlist counts.
 *
 * ## Who sees it
 *
 * Approved recruiters only. The balance is granted earlier — at setup
 * completion, before an admin reviews the application — but a figure is only
 * worth showing to someone allowed to spend it, and unlocking refuses an
 * unapproved recruiter. The layout decides this; the component simply renders
 * nothing when it is handed nothing.
 *
 * ## Why it is a plain server-rendered figure
 *
 * The value arrives as a prop from `hire/layout.tsx`, which already resolves
 * the workspace server-side. No fetch, no client state, and therefore no
 * loading state to design.
 *
 * ## Temporary
 *
 * The placement is a decision made in the absence of T-202, not a considered
 * one. It borrows `hire-hbtn`'s geometry so it sits correctly beside the
 * existing pills, and it is a single component with a single prop so it can be
 * moved or replaced wholesale later without unpicking anything.
 */
export function CreditBalancePill({
  balanceMinor,
  currency,
}: {
  balanceMinor: number;
  currency: string;
}) {
  const amount = formatCreditsMinor(balanceMinor, currency);

  return (
    <span
      className="hire-hbtn hire-credits"
      title={`${amount} in credits. Contact unlocks are charged from this balance.`}
    >
      <span className="hire-credits__label">Credits</span>
      {/* Not inside the label span: at ≤900px the header hides pill labels, and
          the one part of this that must survive is the number. */}
      <span className="hire-credits__value">{amount}</span>
    </span>
  );
}
