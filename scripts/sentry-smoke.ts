/**
 * T-259 — send one deliberate error to Sentry and prove it arrived clean.
 *   npm run sentry:smoke
 *
 * An operator CLI, deliberately NOT an HTTP route. Plan 116 §10 proposed a
 * hidden `/api/dev/boom` endpoint; a script does the same job without leaving
 * anything reachable in a production deployment, and it can be run against any
 * environment by pointing `SENTRY_DSN` at it.
 *
 * Two independent checks, because they answer different questions:
 *
 *   1. **Is the DSN actually accepted?** A raw envelope POST, so the HTTP
 *      status is visible. This matters more than it sounds: the SDK mints an
 *      event id locally whether or not ingest accepts the event, so `flush()`
 *      returning `true` is not evidence. A truncated DSN looked perfectly
 *      healthy this way during the first run of this task.
 *
 *   2. **Is the payload clean?** The error is stuffed with fabricated secrets —
 *      a password, an API key, an email, a phone number, a bearer token — and
 *      the script fails loudly if any of them survive redaction.
 *
 * Nothing here touches the database, sends mail, or writes application state.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** `tsx` does not load .env files the way `next` does, so do it by hand. */
function dsnFromEnvFiles(): string | undefined {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(join(process.cwd(), file), "utf8");
      for (const line of text.split("\n")) {
        const m = /^\s*(SENTRY_DSN|NEXT_PUBLIC_SENTRY_DSN)\s*=\s*(.+?)\s*$/.exec(
          line,
        );
        if (m) return m[2].replace(/^["']|["']$/g, "");
      }
    } catch {
      // File absent — try the next one.
    }
  }
  return undefined;
}

/** Fabricated. If any of these reach Sentry, redaction is broken. */
const PLANTED = {
  email: "fake.person@example.com",
  phone: "+91 90000 00000",
  apiKey: "xkeysib-000000000000000000000000000000",
  password: "not-a-real-password",
  bearer: "fake-token-abc123",
};

async function probeDsn(dsn: string): Promise<boolean> {
  const m = /^https:\/\/([^@]+)@([^/]+)\/(\d+)$/.exec(dsn);
  if (!m) {
    console.log("  ✗ malformed DSN — expected https://<key>@<host>/<projectId>");
    return false;
  }
  const [, key, host, projectId] = m;
  const eventId = randomUUID().replace(/-/g, "");
  const body = [
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }),
    JSON.stringify({ type: "event" }),
    JSON.stringify({
      event_id: eventId,
      level: "info",
      platform: "node",
      message: `T-259 DSN validity probe ${eventId}`,
      tags: { kind: "t259.verification" },
    }),
  ].join("\n");

  const res = await fetch(`https://${host}/api/${projectId}/envelope/`, {
    method: "POST",
    headers: {
      "content-type": "application/x-sentry-envelope",
      "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${key}, sentry_client=t259-smoke/1.0`,
    },
    body,
  });

  if (res.ok) {
    console.log(`  ✓ HTTP ${res.status} — Sentry accepted the event`);
    console.log(`    project ${projectId} on ${host}`);
    return true;
  }
  console.log(`  ✗ HTTP ${res.status} ${res.statusText}`);
  console.log(`    ${(await res.text()).slice(0, 200)}`);
  console.log("    A 401/403 here means the DSN key is wrong or truncated.");
  return false;
}

async function sendThroughRealConfig(): Promise<boolean> {
  // The real config, so the production gate, beforeSend scrubber and
  // integration filter are the ones under test — not a stand-in.
  await import("../sentry.server.config");
  const { captureFailure } = await import("../src/lib/observability/capture");

  const marker = randomUUID();
  const requestId = randomUUID();
  const deliveryId = randomUUID();

  const error = Object.assign(
    new Error(
      `T-259 smoke test ${marker} :: Brevo 400 ` +
        `{"to":[{"email":"${PLANTED.email}"}],"apiKey":"${PLANTED.apiKey}",` +
        `"phone":"${PLANTED.phone}","password":"${PLANTED.password}"} ` +
        `authorization: Bearer ${PLANTED.bearer}`,
    ),
    { status: 400 },
  );

  const result = await captureFailure(error, {
    event: "notification.failed",
    message: "T-259 smoke test",
    tags: { requestId, deliveryId, channel: "email", kind: "t259.verification" },
  });

  const mod = (await import("@sentry/nextjs")) as unknown as Record<
    string,
    unknown
  >;
  const api = (typeof mod.flush === "function" ? mod : mod.default) as {
    flush: (ms: number) => Promise<boolean>;
  };
  await api.flush(20_000);

  console.log(`  event id   : ${result.sentryEventId ?? "(none — SDK disabled)"}`);
  console.log(`  requestId  : ${requestId}`);
  console.log(`  deliveryId : ${deliveryId}`);
  console.log(`  search for : ${marker}`);

  let clean = true;
  for (const [name, secret] of Object.entries(PLANTED)) {
    const leaked = result.reason.includes(secret);
    if (leaked) clean = false;
    console.log(`  ${leaked ? "✗ LEAKED" : "✓ clean  "}  ${name}`);
  }
  return clean && Boolean(result.sentryEventId);
}

async function main() {
  const dsn = process.env.SENTRY_DSN ?? dsnFromEnvFiles();

  console.log("\nT-259 Sentry smoke test");

  if (!dsn) {
    console.log(
      "\n  No DSN found.\n" +
        "  Add SENTRY_DSN to .env.local, or run:\n" +
        "    SENTRY_DSN=https://<key>@<host>/<projectId> npm run sentry:smoke\n",
    );
    process.exitCode = 1;
    return;
  }

  // Sentry is gated off outside production by design, so opening the gate is
  // the whole point of this script. Scoped to this process only.
  process.env.SENTRY_DSN = dsn;
  process.env.SENTRY_FORCE_ENABLE = "1";

  console.log("\n1) Is the DSN accepted?");
  const accepted = await probeDsn(dsn);

  console.log("\n2) Through the real production config:");
  const clean = await sendThroughRealConfig();

  console.log(
    accepted && clean
      ? "\n✓ Sentry is receiving errors, and no planted secret survived.\n" +
          "  Check your Issues feed, then delete the t259.verification issues.\n"
      : "\n✗ Something is wrong — see above.\n",
  );
  if (!accepted || !clean) process.exitCode = 1;
}

void main();
