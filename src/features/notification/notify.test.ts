/**
 * The notifyUser contract — run with:
 *   npm run test:notify
 *
 * No network, no database. The helper is a no-op stub in this phase, so there
 * is little behaviour to test; what these checks actually protect is the
 * frozen contract other developers are coding against.
 *
 * Three kinds of check:
 *
 *  1. `emailDeliveryFrom` maps every state of sendEmail's result. This is the
 *     one piece of real logic here, and the reason the stub is more than a
 *     placeholder: it makes the reuse of @/lib/email compiler-enforced.
 *  2. The stub returns the documented shape and never throws.
 *  3. types.ts is still client-safe — a source scan, unusual for a unit test
 *     and deliberate. notification-provider.tsx is a Client Component that
 *     imports that file; the day someone adds a `@prisma/client` import to it,
 *     the bell breaks at runtime for every user and no type-check catches it.
 *     That is the failure this guards against, not a wrong type.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emailDeliveryFrom, notifyUser } from "./notify";
import type { NotifyInput } from "./types";

let passed = 0;
let failed = 0;

function assert(cond: boolean | undefined, msg: string) {
  if (!cond) throw new Error(msg);
}

async function suite(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}

/**
 * Compile-time only: the call shape another developer will write. If this stops
 * type-checking, the contract is wrong — fix the contract, not the example.
 */
const _example: NotifyInput = {
  userId: "u_123",
  eventKey: "submission.approved",
  title: "Your Day 12 submission was approved",
  body: "Nice work.",
  href: "/dashboard",
  category: "CHALLENGE",
  channels: { email: true },
};
void _example;

async function main() {
  console.log("\nnotifyUser contract");

  await suite("emailDeliveryFrom maps all three sendEmail states", () => {
    assert(
      emailDeliveryFrom({ ok: true, deliveryId: "d1" }) === "delivered",
      "a sent email is 'delivered'",
    );
    assert(
      emailDeliveryFrom({ ok: false, skipped: true, deliveryId: "d2" }) ===
        "skipped",
      "a deliberately skipped send is 'skipped', not 'failed'",
    );
    assert(
      emailDeliveryFrom({ ok: false, deliveryId: "d3" }) === "failed",
      "a throwing send is 'failed'",
    );
  });

  await suite("the stub returns the frozen shape", async () => {
    const res = await notifyUser({
      userId: "u_1",
      eventKey: "admin.direct",
      title: "Hello",
    });

    assert(res.ok === true, "the stub never returns ok:false");
    if (!res.ok) return;

    assert(res.data.notificationId === null, "nothing is persisted yet");
    assert(res.data.inApp === "skipped", "in-app is skipped");
    assert(res.data.email === "skipped", "email is skipped");
    assert(
      res.data.skipReasons.inApp === "not_implemented",
      "in-app skip reason is 'not_implemented'",
    );
    assert(
      res.data.skipReasons.email === "not_implemented",
      "email skip reason is 'not_implemented'",
    );
  });

  await suite("the stub is inert for minimal and maximal input", async () => {
    const minimal = await notifyUser({
      userId: "u_2",
      eventKey: "certificate.issued",
      title: "Minimal",
    });
    assert(minimal.ok === true, "minimal input resolves ok");

    const maximal = await notifyUser({
      userId: "u_3",
      eventKey: "recruiter.approved",
      title: "Maximal",
      body: "Every optional field set.",
      href: "https://abtalks.in/hire",
      category: "GENERAL",
      channels: { inApp: true, email: false },
    });
    assert(maximal.ok === true, "maximal input resolves ok");
  });

  await suite("types.ts stays client-safe", () => {
    const src = readFileSync(
      join(process.cwd(), "src/features/notification/types.ts"),
      "utf8",
    );
    // Comments may name these; code may not.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

    assert(
      !code.includes("server-only"),
      "types.ts must not import server-only — a Client Component imports it",
    );
    assert(
      !code.includes("@prisma/client"),
      "types.ts must not import @prisma/client — it would ship Prisma to the browser",
    );
    assert(
      !code.includes("@/lib/"),
      "types.ts must not take a runtime @/lib/* import",
    );
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

void main();
