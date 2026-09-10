import "server-only";

/**
 * Add one candidate to a recruiter's shortlist, on any track.
 *
 * STUB — T-003. Returns `{ ok: false }` and writes nothing. A stub that
 * answered `{ ok: true }` would let a consumer render "Added to your shortlist"
 * over a row that was never created, and nothing would contradict it until
 * someone reloaded the page.
 *
 * ## Why this does not call `ensureShortlisted`
 *
 * `features/talent-pool/pool.ts` already shortlists — for AI Cohort members and
 * nobody else. `RecruiterShortlistItem.memberId` is a hard FK to `ProgramMember`
 * (`onDelete: Restrict`), and every function around it goes through
 * `assertPoolAccess`, which requires a cohort with `resultsPublishedAt` set. A
 * 60-day, Claude or hackathon candidate has no `ProgramMember` row to point at,
 * so there is nothing for that key to name.
 *
 * This is the same defect `hasContactAccess` was built to avoid — "a rule that
 * cannot name half the candidates is not one rule" — still unfixed one layer
 * down, at the schema level.
 *
 * Hence `candidateUserId`: the only key all four tracks share. Fixing
 * `RecruiterShortlistItem` so this can be implemented is a schema change and
 * belongs to whoever owns the shortlist feature. What this signature buys today
 * is that consumers do not write `memberId` into their call sites this week and
 * have to unpick it later.
 */
export async function addToShortlist(
  recruiterUserId: string,
  candidateUserId: string,
  note?: string,
): Promise<{ ok: true; added: boolean } | { ok: false; message: string }> {
  void recruiterUserId;
  void candidateUserId;
  void note;
  return { ok: false, message: "addToShortlist not implemented" };
}
