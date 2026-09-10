/**
 * T-259 — the one place that decides what must never leave this process.
 *
 * Two layers, deliberately overlapping:
 *
 *  1. **Key-based.** A field whose *name* looks like a secret or a protected
 *     contact detail is replaced wholesale. Cheap, and catches the common case.
 *  2. **Value-based.** A string that *looks* like an email, a phone number, a
 *     bearer token, a JWT or a provider key is replaced wherever it appears —
 *     including inside a message we did not author. Third-party SDKs put
 *     request bodies and headers into `error.message`; key-based redaction
 *     cannot see inside a string, and this is what covers that.
 *
 * Both are applied to structured logs (on top of pino's own `redact`) and to
 * every Sentry payload (`beforeSend` / `beforeSendTransaction` / `beforeBreadcrumb`).
 *
 * This module is intentionally dependency-free and runtime-agnostic — it is
 * imported by the browser bundle, the Node server and the test scripts. Do not
 * add imports to it.
 */

export const REDACTED = "[redacted]";

/**
 * Field names that are never logged. Matched case-insensitively against the
 * whole key, so `contactEmail`, `recipient_phone` and `AUTHORIZATION` all hit.
 *
 * Kept as one source of truth: `pino`'s redact paths in `@/lib/logger` are
 * generated from this list, and the deep scrubber below uses it directly.
 */
export const SENSITIVE_KEYS = [
  "password",
  "passwd",
  "pass",
  "newpassword",
  "currentpassword",
  "confirmpassword",
  "hashedpassword",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "sessiontoken",
  "csrftoken",
  "verificationtoken",
  "apikey",
  "api_key",
  "secret",
  "clientsecret",
  "authsecret",
  "credential",
  "credentials",
  "authorization",
  "auth",
  "cookie",
  "cookies",
  "setcookie",
  "set-cookie",
  "session",
  "otp",
  "otpcode",
  "code",
  "pin",
  "dsn",
  "email",
  "emailaddress",
  "useremail",
  "workemail",
  "contactemail",
  "recipientemail",
  "candidateemail",
  "recruiteremail",
  "to",
  "cc",
  "bcc",
  "replyto",
  "phone",
  "phonenumber",
  "mobile",
  "contactphone",
  "recipientphone",
  "whatsapp",
  "contact",
  "contactdetails",
  "resumeurl",
  "resumetext",
  "shippingaddress",
  "addressline1",
  "addressline2",
  "pincode",
  "linkedinurl",
  "fullname",
  "recipientname",
] as const;

const SENSITIVE_KEY_SET = new Set<string>(SENSITIVE_KEYS);

/** `contact_email` / `CONTACT-EMAIL` / `contactEmail` all normalise to one key. */
function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[_\s-]/g, "");
}

export function isSensitiveKey(key: string): boolean {
  const k = normaliseKey(key);
  if (SENSITIVE_KEY_SET.has(k)) return true;
  // `set-cookie` normalises to `setcookie`; the dashless forms are listed, so
  // only the suffix families need a pattern.
  return /(password|secret|token|apikey|authorization|cookie|credential)$/.test(
    k,
  );
}

// --- value patterns -------------------------------------------------------

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/**
 * +91 98765 43210, (044) 2345-6789, 9876543210 — 8–17 digits with separators.
 *
 * The boundaries exclude `-` as well as word characters so that a UUID's digit
 * groups are not mistaken for a phone number: `…-cccc-000000000001` must stay
 * intact, because that is what request ids and delivery ids look like and they
 * are the whole point of the log line.
 */
const PHONE_RE = /(?<![\w.-])\+?\d[\d\s().-]{7,17}\d(?![\w.-])/g;
const BEARER_RE = /\b(bearer|basic|token|apikey|api[_-]?key)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/g;
/** sk-…, xkeysib-… (Brevo), pk_live_…, ghp_… — long opaque provider keys. */
const PROVIDER_KEY_RE =
  /\b(?:sk|pk|rk|ghp|gho|xox[baprs]|xkeysib|xsmtpsib|AIza)[-_][A-Za-z0-9_-]{12,}\b/g;
const POSTGRES_URL_RE = /\b[a-z+]+:\/\/[^\s:@/]+:[^\s@/]+@[^\s/]+/gi;

/**
 * A sensitive key sitting next to its value *inside a string*.
 *
 * This is the case the other two layers cannot reach. Key-based redaction sees
 * object keys, not text. Value-based redaction recognises shapes — an email
 * looks like an email, a JWT looks like a JWT — but a password has no shape:
 * `not-a-real-password` is indistinguishable from a product name.
 *
 * What gives it away is the key beside it, which is exactly how it arrives. A
 * provider rejects a request and echoes the body back, so the error message
 * contains `{"password":"..."}` or `password=...`.
 *
 * Found during the first live Sentry verification against the real project:
 * every other planted secret was redacted and this one went through.
 */
const KEYED_SECRET =
  "password|passwd|pwd|secret|token|api[_-]?key|apikey|authorization|cookie|otp|passcode|credential|client[_-]?secret|private[_-]?key";

/** JSON bodies: `"password": "value"`, `"otp":482913`. */
const JSON_SECRET_RE = new RegExp(
  `("(?:${KEYED_SECRET})"\\s*:\\s*)(?:"[^"]*"|[^,}\\s]+)`,
  "gi",
);

/**
 * Query strings, form bodies, header dumps: `password=x`, `authorization: x`.
 *
 * The scheme alternative comes first and deliberately spans the space:
 * `authorization: Bearer abc123` must consume the token too. Matching only
 * `Bearer` would redact the word and leave the credential sitting beside it.
 */
const KV_SECRET_RE = new RegExp(
  `\\b(${KEYED_SECRET})(\\s*[=:]\\s*)` +
    `(?:(?:bearer|basic|token|digest)\\s+[^&,;}\\s"']+|"[^"]*"|'[^']*'|[^&,;}\\s"']+)`,
  "gi",
);

/**
 * Scrub secrets and PII out of a free-text string.
 *
 * Order matters: connection strings and bearer prefixes are matched before the
 * generic email/phone sweep, so `postgres://user:pw@host` is redacted whole
 * rather than leaving the credentials behind a redacted host.
 */
export function scrubString(value: string): string {
  return value
    .replace(POSTGRES_URL_RE, REDACTED)
    // Keyed pairs run before the shape matchers: they bring their own
    // delimiters, and running them afterwards would leave a redacted value
    // still sitting under a `"password":` label, which reads as a near-miss.
    .replace(JSON_SECRET_RE, `$1"${REDACTED}"`)
    .replace(KV_SECRET_RE, `$1$2${REDACTED}`)
    .replace(JWT_RE, REDACTED)
    .replace(BEARER_RE, REDACTED)
    .replace(PROVIDER_KEY_RE, REDACTED)
    .replace(EMAIL_RE, REDACTED)
    .replace(PHONE_RE, REDACTED);
}

// --- deep scrub -----------------------------------------------------------

const MAX_DEPTH = 8;
const MAX_ARRAY = 200;
const MAX_STRING = 4000;

/**
 * Deep-copy `input`, replacing sensitive keys and sensitive-looking values.
 *
 * Cycles are broken with `[circular]`, depth and size are capped, and anything
 * that is not a plain object/array/primitive (a Prisma client, a socket, a
 * class instance) is reduced to a safe tag rather than walked. Never throws —
 * a scrubber that can fail is a scrubber that gets bypassed by a try/catch.
 */
export function scrubDeep<T>(input: T): unknown {
  return walk(input, 0, new WeakSet<object>());
}

function walk(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) return value;

  const t = typeof value;
  if (t === "string") {
    const s = value as string;
    const scrubbed = scrubString(s);
    return scrubbed.length > MAX_STRING
      ? `${scrubbed.slice(0, MAX_STRING)}…[truncated]`
      : scrubbed;
  }
  if (t === "number" || t === "boolean" || t === "bigint") return value;
  if (t === "function" || t === "symbol") return `[${t}]`;

  if (depth >= MAX_DEPTH) return "[depth-limit]";

  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: safeErrorMessage(value),
      // Stack frames are file paths and function names — no payloads — but a
      // provider that interpolates a URL into the message can reach the first
      // line, so the whole thing goes through the string scrubber.
      stack: value.stack ? scrubString(value.stack) : undefined,
    };
  }

  const obj = value as object;
  if (seen.has(obj)) return "[circular]";
  seen.add(obj);

  try {
    if (Array.isArray(value)) {
      const out = value
        .slice(0, MAX_ARRAY)
        .map((v) => walk(v, depth + 1, seen));
      if (value.length > MAX_ARRAY) out.push(`[+${value.length - MAX_ARRAY} more]`);
      return out;
    }

    if (value instanceof Map) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of value) {
        const key = String(k);
        out[key] = isSensitiveKey(key) ? REDACTED : walk(v, depth + 1, seen);
      }
      return out;
    }
    if (value instanceof Set) {
      return [...value].slice(0, MAX_ARRAY).map((v) => walk(v, depth + 1, seen));
    }

    const proto = Object.getPrototypeOf(value);
    if (proto !== null && proto !== Object.prototype) {
      // A class instance (Prisma client, Response, Headers, an SDK error…).
      // Headers is the one worth reading, and only after redaction.
      if (typeof Headers !== "undefined" && value instanceof Headers) {
        const out: Record<string, unknown> = {};
        (value as Headers).forEach((v, k) => {
          out[k] = isSensitiveKey(k) ? REDACTED : scrubString(v);
        });
        return out;
      }
      const name = (proto as { constructor?: { name?: string } })?.constructor
        ?.name;
      // Plain-ish data bags from SDKs still deserve a walk; anything with
      // behaviour does not.
      if (name && name !== "Object") return `[${name}]`;
    }

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSensitiveKey(k) ? REDACTED : walk(v, depth + 1, seen);
    }
    return out;
  } catch {
    return "[unserialisable]";
  } finally {
    seen.delete(obj);
  }
}

// --- error messages -------------------------------------------------------

const MAX_MESSAGE = 500;

/**
 * A message safe to put in a log line, a Sentry tag, or a database column.
 *
 * Never trust `error.message`: Brevo, Prisma and the Auth.js providers all
 * interpolate request context into it — recipient addresses, connection
 * strings, `Authorization` headers echoed back from a 401. This keeps the
 * diagnostic shape (provider name, status code, constraint name) and removes
 * the payload.
 */
export function safeErrorMessage(error: unknown): string {
  const raw = extractMessage(error);
  const scrubbed = scrubString(raw).trim();
  if (!scrubbed) return "unknown error";
  return scrubbed.length > MAX_MESSAGE
    ? `${scrubbed.slice(0, MAX_MESSAGE)}…`
    : scrubbed;
}

function extractMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error === null || error === undefined) return "unknown error";

  if (error instanceof Error) {
    const parts = [error.name === "Error" ? "" : error.name, error.message]
      .filter(Boolean)
      .join(": ");
    // Prisma puts the useful bit on `.code`; HTTP SDKs on `.status`.
    const extras: string[] = [];
    const bag = error as unknown as Record<string, unknown>;
    if (typeof bag.code === "string" || typeof bag.code === "number") {
      extras.push(`code=${bag.code}`);
    }
    if (typeof bag.status === "number") extras.push(`status=${bag.status}`);
    if (typeof bag.statusCode === "number") extras.push(`status=${bag.statusCode}`);
    const head = parts || "Error";
    const withExtras = extras.length ? `${head} (${extras.join(" ")})` : head;
    // `cause` is where fetch/undici hides the real reason (ECONNREFUSED etc).
    const cause = (error as { cause?: unknown }).cause;
    if (cause && cause !== error) {
      return `${withExtras} <- ${extractMessage(cause).slice(0, 200)}`;
    }
    return withExtras;
  }

  if (typeof error === "object") {
    const bag = error as Record<string, unknown>;
    if (typeof bag.message === "string") return bag.message;
    try {
      return JSON.stringify(scrubDeep(bag)).slice(0, MAX_MESSAGE);
    } catch {
      return "unserialisable error";
    }
  }

  return String(error);
}
