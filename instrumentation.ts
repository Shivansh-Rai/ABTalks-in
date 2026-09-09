/**
 * Next.js instrumentation hook — T-259.
 *
 * Two jobs:
 *  1. initialise Sentry once per server process (`register`);
 *  2. catch every error Next.js surfaces from a Server Component, Server
 *     Action, route handler or data fetch, and report it with the request's
 *     correlation id attached (`onRequestError`).
 *
 * Only the Node runtime is instrumented. See `sentry.server.config.ts` for why
 * the Edge runtime deliberately is not.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}

type RequestErrorRequest = {
  path?: string;
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type RequestErrorContext = {
  routerKind?: string;
  routePath?: string;
  routeType?: string;
};

/**
 * `onRequestError` is the only place Next.js hands us server errors it caught
 * itself — a Server Action that threw never reaches application code again.
 */
export async function onRequestError(
  error: unknown,
  request: RequestErrorRequest,
  context: RequestErrorContext,
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const requestId = readRequestId(request.headers?.["x-request-id"]);

  // Imported here rather than at module scope: `register()` may not have run
  // (the hook can fire during a build), and the logger must not be a cost on
  // the happy path.
  const [{ captureFailure }] = await Promise.all([
    import("@/lib/observability/capture"),
  ]);

  await captureFailure(error, {
    event: "request.error",
    message: "unhandled request error",
    tags: {
      requestId,
      route: context.routePath,
      routeType: context.routeType,
      method: request.method,
    },
  });
}

function readRequestId(
  value: string | string[] | undefined,
): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v)
    ? v
    : undefined;
}
