/**
 * T-259 — Sentry init gating, per plan 116 §8.
 *   npm run test:observability:gating
 *
 * The plan's constraint (§6) is "Sentry must not send from dev or preview".
 * The trap it guards against is real and specific: Vercel preview deployments
 * run with `NODE_ENV=production`, so a config written the obvious way
 * (`enabled: process.env.NODE_ENV === "production"`) sends every preview's
 * noise into the production project. `NEXT_PUBLIC_APP_ENV` is set only on the
 * real production deploy, which is why `src/lib/env.ts` exists and why both
 * Sentry configs go through it.
 *
 * `Sentry.init` is global and one-way, so each case runs in its own child
 * process with a stubbed SDK that records the options it was handed.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// child: load the real config with a stubbed SDK and print what init received
// ---------------------------------------------------------------------------

async function child() {
  const captured: Record<string, unknown>[] = [];

  // Intercept `@sentry/nextjs` before the config imports it. `require.cache`
  // is the seam that works under tsx's CommonJS output.
  const sentryPath = require.resolve("@sentry/nextjs");
  const stub = {
    init: (options: Record<string, unknown>) => captured.push(options),
    captureRouterTransitionStart: () => {},
  };
  require.cache[sentryPath] = {
    id: sentryPath,
    filename: sentryPath,
    loaded: true,
    exports: stub,
  } as unknown as NodeJS.Module;

  await import(
    process.env.T259_TARGET === "client"
      ? "../../../instrumentation-client"
      : "../../../sentry.server.config"
  );

  // JSON drops functions, and `beforeSend` being a function is precisely what
  // this test needs to see — so they cross the process boundary as a marker.
  console.log(
    `__INIT__=${JSON.stringify(captured, (_k, v) =>
      typeof v === "function" ? "__fn__" : v,
    )}`,
  );
}

// ---------------------------------------------------------------------------
// parent
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

type Case = {
  target: "server" | "client";
  env: Record<string, string>;
};

async function initOptions(c: Case): Promise<Record<string, unknown>> {
  const self = fileURLToPath(import.meta.url);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    T259_GATING_CHILD: "1",
    T259_TARGET: c.target,
  };
  // Start from a clean slate so the developer's own .env cannot decide the
  // result of this test.
  delete env.SENTRY_DSN;
  delete env.NEXT_PUBLIC_SENTRY_DSN;
  delete env.NEXT_PUBLIC_APP_ENV;
  delete env.SENTRY_FORCE_ENABLE;
  Object.assign(env, c.env);

  const out = await new Promise<string>((resolve) => {
    const proc = spawn(process.execPath, [require.resolve("tsx/cli"), self], {
      env,
    });
    let buf = "";
    proc.stdout.on("data", (d: Buffer) => (buf += d.toString()));
    proc.stderr.on("data", (d: Buffer) => (buf += d.toString()));
    proc.on("close", () => resolve(buf));
  });

  const match = /__INIT__=(.*)/.exec(out);
  assert(match, `child did not report init options:\n${out.slice(0, 1200)}`);
  const parsed = JSON.parse(match[1]) as Record<string, unknown>[];
  assert(parsed.length === 1, `expected one init call, got ${parsed.length}`);
  return parsed[0];
}

async function suite(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}

const DSN = "https://examplekey@o0.ingest.sentry.io/1";

async function main() {
  console.log("\nT-259 Sentry init gating");

  await suite("server: disabled in development", async () => {
    const o = await initOptions({ target: "server", env: { SENTRY_DSN: DSN } });
    assert(o.enabled === false, `expected enabled:false, got ${o.enabled}`);
  });

  await suite("server: disabled on a Vercel preview (the NODE_ENV trap)", async () => {
    // Exactly what a preview deploy looks like: NODE_ENV=production, but
    // NEXT_PUBLIC_APP_ENV is not "production".
    const o = await initOptions({
      target: "server",
      env: {
        SENTRY_DSN: DSN,
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_ENV: "preview",
      },
    });
    assert(
      o.enabled === false,
      "a preview deploy must not report into the production project",
    );
  });

  await suite("server: enabled on the real production deploy", async () => {
    const o = await initOptions({
      target: "server",
      env: {
        SENTRY_DSN: DSN,
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_ENV: "production",
      },
    });
    assert(o.enabled === true, "production must report");
    assert(o.dsn === DSN, "the DSN must be read from the environment");
  });

  await suite("server: disabled in production when no DSN is configured", async () => {
    const o = await initOptions({
      target: "server",
      env: { NODE_ENV: "production", NEXT_PUBLIC_APP_ENV: "production" },
    });
    assert(
      o.enabled === false,
      "with no DSN the SDK must stay inert rather than retry into the void",
    );
  });

  await suite("server: SENTRY_FORCE_ENABLE opens the gate deliberately", async () => {
    const o = await initOptions({
      target: "server",
      env: { SENTRY_DSN: DSN, SENTRY_FORCE_ENABLE: "1" },
    });
    assert(o.enabled === true, "the documented local escape hatch must work");
  });

  await suite("both runtimes keep sendDefaultPii off and scrubbers on", async () => {
    for (const target of ["server", "client"] as const) {
      const key = target === "server" ? "SENTRY_DSN" : "NEXT_PUBLIC_SENTRY_DSN";
      const o = await initOptions({
        target,
        env: { [key]: DSN, NEXT_PUBLIC_APP_ENV: "production" },
      });
      assert(
        o.sendDefaultPii === false,
        `${target}: sendDefaultPii must be explicitly false`,
      );
      for (const hook of [
        "beforeSend",
        "beforeBreadcrumb",
        "beforeSendTransaction",
      ] as const) {
        assert(o[hook] === "__fn__", `${target}: ${hook} scrubber is missing`);
      }
      assert(o.integrations === "__fn__", `${target}: integration filter missing`);
    }
  });

  await suite("client: disabled in development", async () => {
    const o = await initOptions({
      target: "client",
      env: { NEXT_PUBLIC_SENTRY_DSN: DSN },
    });
    assert(o.enabled === false, `expected enabled:false, got ${o.enabled}`);
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

if (process.env.T259_GATING_CHILD) {
  void child();
} else {
  void main();
}
