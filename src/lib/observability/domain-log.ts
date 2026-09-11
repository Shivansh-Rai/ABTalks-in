/**
 * T-259 — the published log contract for the money, contact and notification
 * areas.
 *
 * This is the API `docs/plans/116-t259-error-tracking-structured-logging.md`
 * §5.2/§5.3 asks for, and it exists mainly for the tasks that read it:
 *
 *  - **T-248** (notification service) calls `logNotificationDelivery`;
 *  - **T-268** (admin delivery diagnosis) parses what it writes;
 *  - **T-228/229/230/232** (money paths) call `logMoney` as they land.
 *
 * Every line these emit carries three things a reader can filter on —
 * `area`, `op` and `outcome` — plus the `event` name (`"<op>.<outcome>"`) that
 * the rest of this codebase's instrumentation already uses. One line, one
 * shape, both vocabularies: a consumer can group by `area`/`op` or match on
 * `event`, and neither has to know about the other.
 *
 * ## Decision record (naming)
 *
 * The plan wrote its context fields in snake_case (`recruiter_id`,
 * `amount_cents`). These are camelCase instead, because every other structured
 * field in this codebase is — `userId`, `engagementId`, `deliveryId`,
 * `idempotencyKey` — and a log where half the keys are snake_case and half are
 * not is worse for the consumer than either convention alone. The *set* of
 * fields is exactly the plan's.
 *
 * ## The one rule
 *
 * These helpers accept opaque ids and enums. They do not accept an email, a
 * phone number, a name or an address, and the types below are what stops a
 * caller passing one by accident. `@/lib/logger`'s redaction is the second
 * line, not the first.
 */

import { logger, type AppLogger } from "@/lib/logger";

/** Where a line sits, for a consumer filtering a stream. */
export type LogArea = "money" | "contact" | "notification";

/**
 * `attempt` opens an operation, exactly one of the others closes it. `refused`
 * is a business no (insufficient balance, no access); `failed` is a fault.
 */
export type Outcome = "attempt" | "success" | "failed" | "refused" | "skipped";

/**
 * Field names a domain log line may never contain. Listing them as `never`
 * turns "don't log a phone number" from a review comment into a type error at
 * the call site — which is the only place it can actually be prevented.
 */
type ForbiddenField =
  | "email"
  | "emailAddress"
  | "userEmail"
  | "workEmail"
  | "contactEmail"
  | "recipientEmail"
  | "candidateEmail"
  | "recruiterEmail"
  | "phone"
  | "phoneNumber"
  | "mobile"
  | "contactPhone"
  | "recipientPhone"
  | "password"
  | "token"
  | "accessToken"
  | "refreshToken"
  | "apiKey"
  | "secret"
  | "authorization"
  | "cookie"
  | "otp"
  | "fullName"
  | "recipientName"
  | "shippingAddress"
  | "addressLine1"
  | "pincode"
  | "resumeUrl"
  | "resumeText";

/**
 * Anything else a caller wants on the line — counts, statuses, enums, flags.
 * Deliberately open: a log shape that cannot carry `duplicate: true` or
 * `contactReleased: true` is a shape people work around.
 */
type SafeExtras = {
  [key: string]: unknown;
} & { [K in ForbiddenField]?: never };

type BaseContext = SafeExtras & {
  outcome: Outcome;
  /** Correlation id from the middleware; omit outside a request. */
  requestId?: string | null;
  /** Redacted reason. Use `safeErrorMessage(error)`, never `error.message`. */
  reason?: string | null;
  /** Bind a request-scoped child logger here when you have one. */
  log?: AppLogger;
};

/** Ids and enums only — no names, addresses, emails or phone numbers. */
export type MoneyContext = BaseContext & {
  userId?: string | null;
  recruiterId?: string | null;
  candidateId?: string | null;
  /** Signed. Points in this product; the field is named for the plan's shape. */
  amount?: number | null;
  ledgerEntryId?: string | null;
  idempotencyKey?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  newBalance?: number | null;
  route?: string | null;
};

export type ContactContext = BaseContext & {
  recruiterId?: string | null;
  candidateId?: string | null;
  /** The engagement/unlock this concerns. */
  unlockId?: string | null;
  route?: string | null;
  /** For bulk resolution, counts rather than the ids of everyone involved. */
  candidateCount?: number | null;
  grantedCount?: number | null;
};

export type NotificationContext = BaseContext & {
  /** The id shared by the DB row, this line and the Sentry event. */
  deliveryId: string;
  channel: "email";
  /**
   * Which send this was for the same message: 1 for the first, 2 for the first
   * retry. Nothing retries today, so it is 1 — the field exists because T-268
   * has to be able to tell "failed once" from "failed four times", and adding
   * it later would mean every row written before then reads as unknown.
   */
  attempt?: number;
  /** What the message is: "recruiter.otp", "hire.alert", … */
  kind?: string | null;
  /** SHA-256 of the recipient address. Never the address. */
  recipientHash?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  provider?: string | null;
  providerStatus?: string | number | null;
  sentryEventId?: string | null;
};

/** `failed` is the only outcome that is an incident; the rest are information. */
function levelFor(outcome: Outcome): "info" | "warn" | "error" {
  if (outcome === "failed") return "error";
  if (outcome === "refused" || outcome === "skipped") return "warn";
  return "info";
}

function emit(
  area: LogArea,
  op: string,
  ctx: BaseContext & Record<string, unknown>,
  message: string,
): void {
  const { outcome, log, ...rest } = ctx;
  const target = log ?? logger;

  // Undefined and null fields are dropped rather than written as nulls: a log
  // line should say what is known, not enumerate what is not.
  const fields: Record<string, unknown> = {
    area,
    op,
    outcome,
    event: `${op}.${outcome}`,
  };
  for (const [k, v] of Object.entries(rest)) {
    if (v !== null && v !== undefined) fields[k] = v;
  }

  target[levelFor(outcome)](fields, message);
}

/**
 * A money operation: a credit, a debit, a ledger write, a redemption.
 *
 * `op` is the lifecycle name without the outcome — `"credit.debit"`,
 * `"ledger.write"`, `"redemption"` — so the emitted `event` reads
 * `credit.debit.success`, which is what the money paths already log.
 */
export function logMoney(op: string, ctx: MoneyContext): void {
  emit("money", op, ctx, `money ${op} ${ctx.outcome}`);
}

/**
 * A contact operation: resolving whether a recruiter may see a candidate's
 * details, requesting an introduction, or an admin releasing contact.
 *
 * The details being protected are never arguments here, by construction.
 */
export function logContact(op: string, ctx: ContactContext): void {
  emit("contact", op, ctx, `contact ${op} ${ctx.outcome}`);
}

/**
 * One outbound message's outcome — the shape T-268's admin view reads.
 *
 * `deliveryId` is mandatory because it is the whole point: it is what joins
 * this line to the `NotificationDelivery` row and to the Sentry event.
 */
export function logNotificationDelivery(ctx: NotificationContext): void {
  emit("notification", "notification", ctx, `notification ${ctx.outcome}`);
}
