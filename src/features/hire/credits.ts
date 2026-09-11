import "server-only";

import { requireRecruiterWorkspace } from "@/features/recruiter-workspace/workspace";
import {
  getCreditBalance,
  listCreditTransactions,
  type CreditLedgerEntry,
} from "@/repositories/credits";
import {
  CONTACT_UNLOCK_COST_KEY,
  CREDITS_CURRENCY_KEY,
  getIntConfig,
  getStringConfig,
} from "@/lib/platform-config";

/**
 * What product code calls to ask about a recruiter's credits.
 *
 * Takes no ids, for the same reason `requireRecruiterWorkspace` takes none: the
 * workspace comes from the session, on the server, so the whole class of
 * "recruiter A passes recruiter B's organization id" bugs is closed by the
 * signature rather than by a check somebody has to remember to write.
 *
 * ## These are reads. They do not create money.
 *
 * There is no lazy "grant on first read" here, and there should never be one.
 * The onboarding grant happens where a workspace is created —
 * `provisionRecruiterIdentity` and the setup action — which is deterministic,
 * auditable, and happens exactly once. A read that quietly mints credits would
 * make "how much does this recruiter have" a mutation, put a write inside a
 * Server Component render, and give the ledger a grant site not tied to
 * anything a person did. Workspaces created before T-228 shipped are granted by
 * `npm run db:backfill:credit-grants -- --apply`, which is a required deploy
 * step, not an optional one.
 */

export type WorkspaceCredits = {
  /** USD minor units. Divide by 100 for dollars; never do that in a query. */
  balanceMinor: number;
  currency: string;
  /**
   * What one contact unlock will cost when T-229 ships. Surfaced here so a cost
   * preview has one place to read it; nothing spends it yet.
   */
  unlockCostMinor: number;
};

export type WorkspaceCreditsResult =
  | { ok: true; data: WorkspaceCredits }
  | { ok: false; message: string };

export async function getWorkspaceCredits(): Promise<WorkspaceCreditsResult> {
  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) return { ok: false, message: workspace.message };

  const [balanceMinor, currency, unlockCostMinor] = await Promise.all([
    getCreditBalance(workspace.data.organizationId),
    getStringConfig(CREDITS_CURRENCY_KEY),
    getIntConfig(CONTACT_UNLOCK_COST_KEY),
  ]);

  return { ok: true, data: { balanceMinor, currency, unlockCostMinor } };
}

export type WorkspaceLedgerResult =
  | { ok: true; data: CreditLedgerEntry[] }
  | { ok: false; message: string };

export async function getWorkspaceCreditHistory(
  opts?: { limit?: number; beforeSeq?: string },
): Promise<WorkspaceLedgerResult> {
  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) return { ok: false, message: workspace.message };

  return {
    ok: true,
    data: await listCreditTransactions(workspace.data.organizationId, opts),
  };
}

/**
 * The price of one contact unlock.
 *
 * Never zero: a missing or unreadable configuration row resolves to the
 * registry default (see `lib/platform-config.ts`), because the one answer a
 * price must never fall back to is "free".
 */
export async function contactUnlockCostMinor(): Promise<number> {
  return getIntConfig(CONTACT_UNLOCK_COST_KEY);
}

/**
 * Re-exported so a server surface that already imports the reads does not have
 * to reach for a second module to render what it just read. The definition
 * lives in `lib/credits-format.ts`, outside `server-only`, because a Client
 * Component needs it too.
 */
export { formatCreditsMinor } from "@/lib/credits-format";
