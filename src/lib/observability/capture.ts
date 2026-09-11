/**
 * T-259 — the failure bridge: one incident, three views.
 *
 * A single call writes
 *   1. a structured `level:"error"` log line with a safe reason, and
 *   2. a Sentry event tagged with the ids that identify the incident,
 * then hands back both the reason and the Sentry event id so the caller can
 * persist them — which is view 3, the database row.
 *
 * Because all three carry the same `requestId` (and, for notifications, the
 * same delivery id), an incident found in any one of them can be followed into
 * the other two.
 *
 * The Sentry SDK is imported lazily. This module is reachable from scripts and
 * test runners that have no Next.js build around them, and `@sentry/nextjs`
 * must not be a load-time cost for them.
 */

import { logger, type AppLogger, type LogMeta } from "@/lib/logger";
import { safeErrorMessage, scrubDeep } from "./redact";

export type CaptureContext = {
  /** Domain event name, e.g. `notification.failed`, `credit.debit.failed`. */
  event: string;
  /** Human sentence for the log's `msg`. Defaults to the event name. */
  message?: string;
  /** Safe identifiers only — ids, routes, channels. Never contact details. */
  tags?: Record<string, string | number | null | undefined>;
  /** Extra structured fields for the log line (scrubbed before writing). */
  extra?: LogMeta;
  /** Overrides the process logger; pass a request-bound child where you have one. */
  log?: AppLogger;
};

export type CaptureResult = {
  /** Redacted, loggable, persistable failure reason. */
  reason: string;
  /** Searchable Sentry event id, when the SDK accepted the event. */
  sentryEventId?: string;
};

type SentryCapture = (
  error: unknown,
  tags: Record<string, string>,
) => string | undefined;

let override: SentryCapture | null = null;

/**
 * Swap the Sentry side out. Test-only: the notification-failure test asserts
 * that a capture happened without standing up the SDK.
 */
export function __setSentryCaptureForTests(fn: SentryCapture | null): void {
  override = fn;
}

/** Tag values must be strings; drop the empty ones rather than send "undefined". */
function stringTags(
  tags: CaptureContext["tags"],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tags ?? {})) {
    if (v === null || v === undefined || v === "") continue;
    out[k] = String(v);
  }
  return out;
}

async function sendToSentry(
  error: unknown,
  tags: Record<string, string>,
): Promise<string | undefined> {
  if (override) return override(error, tags);
  try {
    const mod = await import("@sentry/nextjs");
    // Interop, and not a theoretical one: under a CommonJS loader (tsx, a
    // migration script, a jest-style runner) this namespace hoists `init` but
    // leaves `captureException` on `.default`. Reading only the namespace made
    // the call a silent no-op in exactly the environments least likely to be
    // watched. Resolve whichever object actually has the function.
    const ns = mod as unknown as Record<string, unknown>;
    const sentry = (
      typeof ns.captureException === "function"
        ? ns
        : ((ns.default ?? {}) as Record<string, unknown>)
    ) as { captureException?: (e: unknown, hint?: unknown) => string };

    if (typeof sentry.captureException !== "function") return undefined;
    // `beforeSend` in the Sentry config scrubs the event; nothing added here
    // bypasses it, because tags go through the same hook.
    return sentry.captureException(error, { tags });
  } catch {
    // Sentry being unavailable must never take down the path it observes.
    return undefined;
  }
}

/**
 * Log a failure and report it. Returns the safe reason and the Sentry id.
 *
 * `error` is never logged raw — only `safeErrorMessage(error)` reaches the log
 * line, and `extra` is deep-scrubbed on the way through.
 */
export async function captureFailure(
  error: unknown,
  ctx: CaptureContext,
): Promise<CaptureResult> {
  const reason = safeErrorMessage(error);
  const tags = stringTags(ctx.tags);
  const log = ctx.log ?? logger;

  const sentryEventId = await sendToSentry(error, tags);

  log.error(
    {
      event: ctx.event,
      reason,
      ...(scrubDeep(ctx.extra ?? {}) as LogMeta),
      ...tags,
      ...(sentryEventId ? { sentryEventId } : {}),
    },
    ctx.message ?? ctx.event,
  );

  return { reason, sentryEventId };
}
