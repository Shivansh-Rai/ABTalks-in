/**
 * Grant starting credits to workspaces that predate T-228.
 *
 * From T-228 onward a workspace is funded by the act that creates it, in
 * `provisionRecruiterIdentity`. Workspaces created before that — every
 * recruiter an admin approved up to now — have no grant, and deliberately do
 * not get one from a credit read: a read that quietly mints money is a bad
 * thing to leave in a financial path. This script is the alternative, and it is
 * a **required deploy step**, not an optional one. Until it runs, a
 * pre-existing recruiter's balance reads $0.00.
 *
 * Dry run by default. Pass --apply to write.
 *
 * Run: npm run db:backfill:credit-grants
 *      npm run db:backfill:credit-grants -- --apply
 */
import { PrismaClient } from "@prisma/client";
import { grantOnboardingCreditsAtomic } from "../../src/repositories/credits";
import { getIntConfig, STARTING_GRANT_KEY } from "../../src/lib/platform-config";

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");
  const amount = await getIntConfig(STARTING_GRANT_KEY);

  console.log(
    `\n${apply ? "APPLYING" : "DRY RUN"} — starting grant is ${amount} minor units ($${(amount / 100).toFixed(2)})\n`,
  );

  // A workspace with an active recruiter and no onboarding grant.
  const targets = await prisma.organization.findMany({
    where: {
      members: { some: { role: "RECRUITER", status: "ACTIVE" } },
      creditTransactions: { none: { type: "GRANT_ONBOARDING" } },
    },
    select: {
      id: true,
      slug: true,
      members: {
        where: { role: "RECRUITER", status: "ACTIVE" },
        orderBy: { joinedAt: "asc" },
        take: 1,
        select: { userId: true },
      },
    },
  });

  if (targets.length === 0) {
    console.log("Every recruiter workspace already has its starting credits.\n");
    return;
  }

  let granted = 0;
  for (const org of targets) {
    const recruiterUserId = org.members[0]?.userId;
    if (!recruiterUserId) continue;

    if (!apply) {
      console.log(`  would grant ${amount} to ${org.slug}`);
      continue;
    }

    // The same idempotent primitive the live paths use, so racing this script
    // against a recruiter finishing setup still leaves exactly one grant.
    const result = await grantOnboardingCreditsAtomic({
      organizationId: org.id,
      recruiterUserId,
    });
    if (result.ok && !result.duplicate) granted++;
    console.log(
      `  ${result.ok ? (result.duplicate ? "already granted" : "granted") : "FAILED"} ${org.slug}`,
    );
  }

  console.log(
    `\n${apply ? `${granted} workspace(s) granted.` : `${targets.length} workspace(s) would be granted. Re-run with --apply.`}\n`,
  );
}

main()
  .catch((e) => {
    console.error("Credit grant backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
