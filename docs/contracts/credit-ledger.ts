/**
 * Authoritative Type Contracts & Interfaces for Recruiter Credit Ledger & Contact Unlock
 *
 * Task: T-148 (Stream G0 Decisions & Foundations)
 * Technical Reviewer: Sohail (APPROVED 2026-09-08)
 *
 * These contracts govern the implementation in:
 * - T-030 (R6 Contact Unlock build)
 * - T-032 / T-033 (R2 Plans, Limits & Entitlements)
 * - T-095 (A1 Company Admin Credits & Usage view)
 * - T-105 (Credit purchase / top-up)
 * - T-128 (Recruiter cost preview before spend)
 */

export type CreditTransactionType =
  | "GRANT_ONBOARDING"
  | "PURCHASE"
  | "UNLOCK_CONTACT"
  | "ADMIN_ADJUSTMENT"
  | "REFUND";

/**
 * The cached summary account per organisation.
 * Ground truth is always SUM(CreditTransaction.amount) WHERE organizationId = orgId.
 */
export interface CreditAccountContract {
  id: string;
  organizationId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  version: number;
  reconciledAt: Date | null;
  updatedAt: Date;
}

/**
 * The append-only ledger transaction.
 */
export interface CreditTransactionContract {
  id: string;
  organizationId: string;
  recruiterUserId: string;
  candidateUserId: string | null;
  amount: number; // Negative for debits/spend, positive for credits/grants
  type: CreditTransactionType;
  sourceType: string; // e.g. "TALENT_ENGAGEMENT_REQUEST", "ORGANIZATION", "STRIPE_CHECKOUT"
  sourceId: string | null;
  idempotencyKey: string; // Format: "unlock:<organizationId>:<candidateUserId>"
  reason: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

/**
 * Database configuration contract for D-17.
 * Initial baseline values: 100 free credits on registration, 10 credits per unlock.
 */
export interface CreditConfigContract {
  startingCreditsOnboarding: number; // Default: 100
  contactUnlockCost: number; // Default: 10
  allowOverdraft: false; // Strict non-negative enforcement
}

/**
 * Error codes returned by the contact unlock flow.
 */
export type UnlockContactErrorCode =
  | "UNAUTHORIZED"
  | "NO_ACTIVE_ORGANIZATION"
  | "INSUFFICIENT_CREDITS"
  | "CANDIDATE_UNAVAILABLE"
  | "TRANSACTION_FAILED"
  | "ALREADY_UNLOCKED";

/**
 * Revealed candidate contact details.
 * Strictly respects candidate privacy switches (Finding 2 / D-8).
 */
export interface RevealedCandidateContact {
  candidateUserId: string;
  candidatePublicId: string;
  fullName: string;
  email: string;
  phone: string | null; // Null if candidate's showPhone is false
  resumeUrl: string | null; // Null if candidate's showResume is false
}

export interface UnlockContactInput {
  recruiterUserId: string;
  candidateUserId: string;
}

export type UnlockContactResult =
  | {
      ok: true;
      charged: boolean;
      cost: number;
      remainingBalance: number;
      contact: RevealedCandidateContact;
      reason?: "ALREADY_UNLOCKED" | "UNLOCKED_WITH_CREDITS";
    }
  | {
      ok: false;
      error: UnlockContactErrorCode;
      message: string;
      remainingBalance?: number;
    };

export interface CheckCreditAllowanceInput {
  recruiterUserId: string;
  requiredCredits: number;
}

export interface CheckCreditAllowanceResult {
  allowed: boolean;
  currentBalance: number;
  shortfall: number;
}
