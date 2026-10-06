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

suite("requireAdmin checks UserRoleAssignment", () => {
  const src = read("src/lib/admin-auth.ts");
  const role = read("src/lib/platform-role.ts");
  assert(src.includes("hasPlatformAdmin"), "requireAdmin must use hasPlatformAdmin");
  assert(role.includes("userRoleAssignment"), "must query UserRoleAssignment");
  assert(role.includes("revokedAt: null"), "only active assignments count");
});

/**
 * Plan 169. The env bootstrap is gone, and must not come back. It granted
 * GLOBAL/ADMIN from ADMIN_EMAILS to any account that had never held the grant,
 * but "never held it" was a count of that userId's rows — and userId cascades
 * on user delete, so deleting an admin's User row destroyed the only record
 * that env had already been honoured. The next sign-in re-granted admin.
 */
suite("nothing grants admin from ADMIN_EMAILS at runtime", () => {
  const src = read("src/lib/admin-auth.ts");
  const role = read("src/lib/platform-role.ts");
  assert(
    !src.includes("bootstrapAdminFromEnv") && !role.includes("bootstrapAdminFromEnv"),
    "the env bootstrap must not come back",
  );
  assert(
    !src.includes("everGranted") && !role.includes("everGranted"),
    "the userId-keyed ever-granted guard went with it",
  );
  // The whole point: ADMIN_EMAILS may be parsed (isAdminEmail answers a
  // configuration question) but must never reach a role-row write. Asserted
  // against env access rather than the string, which appears in the comment
  // explaining why the bootstrap was removed.
  assert(
    !role.includes("process.env"),
    "the access lookup must not read env at all",
  );
  assert(
    !src.includes("userRoleAssignment"),
    "admin-auth must not touch role rows directly; it delegates to platform-role",
  );
});

suite("the admin access lookup is a pure read", () => {
  const role = read("src/lib/platform-role.ts");
  for (const write of [".create(", ".update(", ".upsert(", ".delete(", ".createMany("]) {
    assert(
      !role.includes(write),
      `hasPlatformAdmin must not write (${write}) — it runs on every admin page render`,
    );
  }
});

suite("revoking admin also invalidates the target's sessions", () => {
  const src = read("src/app/actions/admin-platform-actions.ts");
  const fn = src.slice(src.indexOf("export async function revokePlatformAdminAction"));
  assert(
    fn.includes("sessionInvalidatedAt"),
    "a revoke that leaves the JWT asserting isAdmin is not a revoke",
  );
  assert(fn.includes("$transaction"), "revoke must be atomic");
  assert(
    fn.includes("PLATFORM_ADMIN_REVOKED"),
    "revoke must be audited in AdminAction",
  );
});

suite("revocation is revokedAt, never a change to role", () => {
  const src = read("src/app/actions/admin-platform-actions.ts");
  const fn = src.slice(src.indexOf("export async function revokePlatformAdminAction"));
  const update = fn.slice(fn.indexOf("userRoleAssignment.update"));
  const body = update.slice(0, update.indexOf("});"));
  assert(body.includes("revokedAt"), "revoke sets revokedAt");
  assert(
    !body.includes("role:"),
    "editing role is what made a revoked grant look never-granted; it must not be how we revoke",
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
