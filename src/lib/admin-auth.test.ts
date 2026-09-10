/**
 * Platform Admin is a database role, not ADMIN_EMAILS.
 *   npm run test:demo1-security
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
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

console.log("\nDemo 1 platform admin");

suite("requireAdmin checks UserRoleAssignment, not only env", () => {
  const src = read("src/lib/admin-auth.ts");
  assert(src.includes("hasPlatformAdmin"), "requireAdmin must use hasPlatformAdmin");
  assert(src.includes("userRoleAssignment"), "must query UserRoleAssignment");
  assert(src.includes("revokedAt: null"), "only active assignments count");
  assert(
    src.includes("bootstrapAdminsFromEnv"),
    "env is bootstrap-only when no admin rows exist",
  );
});

suite("grant and revoke exist as server actions", () => {
  const src = read("src/app/actions/admin-platform-actions.ts");
  assert(src.includes("export async function grantPlatformAdminAction"), "grant action");
  assert(src.includes("export async function revokePlatformAdminAction"), "revoke action");
  assert(src.includes("requireAdmin"), "grant/revoke themselves require admin");
  assert(
    src.includes("Cannot revoke the last Platform Admin"),
    "last admin cannot be revoked",
  );
});

suite("admin console page lists database assignments", () => {
  const src = read("src/app/admin/platform-admins/page.tsx");
  assert(src.includes("requireAdmin"), "page is admin-gated");
  assert(src.includes("userRoleAssignment.findMany"), "lists assignment rows");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
