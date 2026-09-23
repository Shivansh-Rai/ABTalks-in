/**
 * Phase 8-B: writeClient is independent of ENABLE_DUAL_WRITE.
 * Run: npm run test:078-write-client
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;

function assert(cond: boolean | undefined, msg: string) {
  if (!cond) throw new Error(msg);
}

function suite(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err: unknown) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.error(err instanceof Error ? err.stack ?? err.message : err);
  }
}

function source(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function main() {
  const src = source("src/lib/db.ts");

  suite("writeClient does not reference isDualWriteEnabled", () => {
    assert(!src.includes("isDualWriteEnabled"), "no dual-write import or call");
    assert(!src.includes("@/lib/feature-flags"), "no feature-flag import");
  });

  suite("writeClient always returns directClient", () => {
    assert(src.includes("export function writeClient()"), "exported");
    assert(src.includes("return directClient();"), "always direct");
    assert(!src.includes("isDualWriteEnabled() ? directClient()"), "no flag ternary");
    assert(!src.includes("isDualWriteEnabled() ? directClient() : prisma"), "no pooled fallback");
  });

  suite("ENABLE_DUAL_WRITE true and false use the same writer", () => {
    const fn = src.slice(src.indexOf("export function writeClient()"));
    assert(!fn.includes("ENABLE_DUAL_WRITE"), "flag not in writeClient body");
    assert(!fn.includes("process.env"), "no env branch in writeClient");
  });

  suite("pooler URL is rejected rather than used for writes", () => {
    assert(src.includes('url.includes("-pooler.")'), "detects pooler");
    assert(src.includes("throw new Error"), "fails loudly");
    assert(src.includes("neonDirectUrl"), "strips -pooler. from DATABASE_URL fallback");
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main();
