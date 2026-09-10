/**
 * T-259 — the last thing that touches a Sentry payload before it leaves.
 *
 * `sendDefaultPii: false` stops Sentry *adding* PII of its own; it does nothing
 * about PII we put there ourselves, or that an SDK put into an exception
 * message. Every hook (`beforeSend`, `beforeSendTransaction`, `beforeBreadcrumb`)
 * runs through here, so there is no path to the wire that skips redaction.
 *
 * Deliberately typed structurally rather than against `@sentry/nextjs`'s
 * `Event` type: this module is unit-tested with plain objects and must not drag
 * the SDK into the test process.
 */

import {
  REDACTED,
  isSensitiveKey,
  safeErrorMessage,
  scrubDeep,
  scrubString,
} from "./redact";

type Bag = Record<string, unknown>;

type Stacktrace = {
  frames?: {
    context_line?: unknown;
    pre_context?: unknown;
    post_context?: unknown;
    vars?: unknown;
  }[];
};

/**
 * Strip source code and local variables out of a stack trace.
 *
 * Sentry's `ContextLines` integration reads the file around the throwing line
 * and ships it as `pre_context` / `context_line` / `post_context`. That is a
 * real exfiltration channel, not a hypothetical one: any line of source within
 * a few lines of a throw goes out verbatim, so a hardcoded key, a seed address
 * or a fixture email travels with the error. `includeLocalVariables` would send
 * `vars` — the actual runtime values — which is worse again.
 *
 * Both are disabled in the Sentry configs. This is the second lock: the file
 * name, line number and function are what make a stack trace useful, and they
 * are all kept.
 */
function scrubStacktrace(stacktrace: Stacktrace): Stacktrace {
  if (!Array.isArray(stacktrace.frames)) return stacktrace;
  return {
    ...stacktrace,
    frames: stacktrace.frames.map((frame) => {
      // Copy the frame minus the four source/locals fields. Written as a delete
      // over a shallow copy rather than destructuring, because the discarded
      // bindings that pattern creates are exactly what the unused-vars rule
      // exists to flag.
      const kept: Record<string, unknown> = { ...frame };
      for (const field of [
        "context_line",
        "pre_context",
        "post_context",
        "vars",
      ]) {
        delete kept[field];
      }
      return kept;
    }),
  };
}

export type ScrubbableEvent = {
  request?: {
    headers?: Record<string, string>;
    cookies?: unknown;
    data?: unknown;
    query_string?: unknown;
    url?: string;
  };
  extra?: Bag;
  contexts?: Bag;
  tags?: Record<string, unknown>;
  user?: Bag;
  breadcrumbs?: ScrubbableBreadcrumb[];
  exception?: {
    values?: { type?: string; value?: string; stacktrace?: Stacktrace }[];
  };
  message?: unknown;
} & Bag;

export type ScrubbableBreadcrumb = {
  message?: string;
  data?: Bag;
  category?: string;
} & Bag;

/** Query strings carry `?token=`, `?email=`, `?code=` — strip values by key. */
function scrubUrl(url: string): string {
  const q = url.indexOf("?");
  if (q === -1) return scrubString(url);
  const base = scrubString(url.slice(0, q));
  const params = url
    .slice(q + 1)
    .split("&")
    .map((pair) => {
      const eq = pair.indexOf("=");
      if (eq === -1) return pair;
      const key = pair.slice(0, eq);
      return isSensitiveKey(decodeURIComponent(key))
        ? `${key}=${REDACTED}`
        : `${key}=${scrubString(decodeURIComponent(pair.slice(eq + 1)))}`;
    });
  return `${base}?${params.join("&")}`;
}

/**
 * Generic and unconstrained on purpose: the Sentry SDK's `Breadcrumb` and
 * `Event` are interfaces, so they are not assignable to a `Record<string,
 * unknown>` constraint. The shapes above document what is actually read.
 */
export function scrubBreadcrumb<T>(input: T | null): T | null {
  if (!input) return input;
  const crumb = input as ScrubbableBreadcrumb;
  // Console breadcrumbs replay whatever the app logged before the error, which
  // is exactly the payload we spent the rest of this file removing. Drop them.
  if (crumb.category === "console") return null;

  const out = { ...crumb } as ScrubbableBreadcrumb;
  if (typeof out.message === "string") out.message = scrubString(out.message);
  if (out.data) out.data = scrubDeep(out.data) as Bag;
  return out as T;
}

/**
 * Scrub an outgoing Sentry event in place-safe fashion (returns a new object).
 *
 * Covers everything the SDK can populate: request headers and body, query
 * string, cookies, `extra`, `contexts`, `tags`, `user`, breadcrumbs, and the
 * exception values themselves — the last one because a provider SDK's
 * `error.message` is attacker-of-convenience territory, not ours.
 */
export function scrubSentryEvent<T>(input: T | null): T | null {
  if (!input) return input;
  const event = input as ScrubbableEvent;
  const out = { ...event } as ScrubbableEvent;

  if (out.request) {
    const req = { ...out.request };
    if (req.headers) {
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        headers[k] = isSensitiveKey(k) ? REDACTED : scrubString(String(v));
      }
      req.headers = headers;
    }
    // Cookies are never diagnostic and always sensitive.
    if (req.cookies !== undefined) req.cookies = REDACTED;
    if (req.data !== undefined) req.data = scrubDeep(req.data);
    if (typeof req.query_string === "string") {
      req.query_string = scrubUrl(`?${req.query_string}`).slice(1);
    } else if (req.query_string !== undefined) {
      req.query_string = scrubDeep(req.query_string);
    }
    if (typeof req.url === "string") req.url = scrubUrl(req.url);
    out.request = req;
  }

  if (out.extra) out.extra = scrubDeep(out.extra) as Bag;
  if (out.contexts) out.contexts = scrubDeep(out.contexts) as Bag;

  if (out.tags) {
    const tags: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(out.tags)) {
      tags[k] = isSensitiveKey(k)
        ? REDACTED
        : typeof v === "string"
          ? scrubString(v)
          : v;
    }
    out.tags = tags;
  }

  // Only the opaque id survives. `sendDefaultPii: false` already suppresses
  // ip_address, but a manual `setUser({ email })` would not be caught by it.
  if (out.user) {
    const id = (out.user as Bag).id;
    out.user = id === undefined ? {} : { id: String(id) };
  }

  if (typeof out.message === "string") out.message = scrubString(out.message);

  if (Array.isArray(out.breadcrumbs)) {
    out.breadcrumbs = out.breadcrumbs
      .map((c) => scrubBreadcrumb(c))
      .filter((c): c is ScrubbableBreadcrumb => c !== null);
  }

  if (out.exception?.values) {
    out.exception = {
      ...out.exception,
      values: out.exception.values.map((v) => ({
        ...v,
        value:
          typeof v.value === "string" ? safeErrorMessage(v.value) : v.value,
        ...(v.stacktrace ? { stacktrace: scrubStacktrace(v.stacktrace) } : {}),
      })),
    };
  }

  return out as T;
}
