/**
 * Sentry — Node.js server runtime (Server Components, Server Actions, route
 * handlers, cron). Loaded from `instrumentation.ts`.
 *
 * There is deliberately **no `sentry.edge.config.ts`**. `middleware.ts` and
 * everything Next bundles into the Edge entry are held under a 1 MB limit
 * (see CLAUDE.md — the middleware may not even import `@/lib/*`), and pulling
 * the Sentry Edge SDK in there is exactly the kind of thing that blows it.
 * This app declares no `runtime = "edge"` route, so every server error already
 * lands in the Node runtime and is captured here.
 */
import * as Sentry from "@sentry/nextjs";

import { isProduction } from "@/lib/env";
import { scrubBreadcrumb, scrubSentryEvent } from "@/lib/observability/sentry-scrub";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  // `isProduction()` and not `NODE_ENV`: Vercel preview builds run with
  // NODE_ENV=production, so NODE_ENV would send every preview deploy's noise
  // into the production project. This is the same gate T-252 uses for GA4 —
  // reused, not re-derived, so there is one answer to "are we live?".
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
  // No DSN, or not the production deploy → the SDK stays inert. Set
  // SENTRY_FORCE_ENABLE=1 to exercise it locally.
  enabled:
    Boolean(dsn) && (isProduction() || process.env.SENTRY_FORCE_ENABLE === "1"),
  tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  // Never let Sentry attach IPs, cookies, headers or user identity on its own.
  sendDefaultPii: false,
  // The console integration replays whatever the app logged just before the
  // error. Our own logger is redacted; a stray third-party console.log is not.
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
