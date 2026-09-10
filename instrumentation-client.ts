/**
 * Sentry — browser. Loaded by Next.js before any client code runs.
 *
 * Deliberately lean: no session replay, no profiling, no console breadcrumbs.
 * A replay of a candidate filling in their phone number is precisely the thing
 * T-259 forbids sending, and the value it would add does not come close to
 * paying for that risk.
 */
import * as Sentry from "@sentry/nextjs";

import { isProduction } from "@/lib/env";
import {
  scrubBreadcrumb,
  scrubSentryEvent,
} from "@/lib/observability/sentry-scrub";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
  // Same gate as the server and as T-252's GA4 loader. `NEXT_PUBLIC_APP_ENV` is
  // inlined into the client bundle at build time, so this works in the browser.
  enabled: Boolean(dsn) && isProduction(),
  tracesSampleRate: Number(
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1,
  ),
  sendDefaultPii: false,
  // Console: replays whatever was logged just before the error, unredacted.
  // ContextLines: attaches the source code around the throwing line, which
  // ships any literal near a throw. `scrubSentryEvent` strips both again, and
  // dropping them here means the bytes are never assembled in the first place.
  integrations: (defaults) =>
    defaults.filter((i) => i.name !== "Console" && i.name !== "ContextLines"),
  beforeSend: (event) => scrubSentryEvent(event),
  beforeSendTransaction: (event) => scrubSentryEvent(event),
  beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
