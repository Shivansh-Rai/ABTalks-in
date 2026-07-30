/**
 * Issue certificates for already-COMPLETED CLAUDE enrollments.
 *
 * Usage:
 *   npm run db:backfill:certificates
 *   npm run db:backfill:certificates -- --dry-run
 */
import { config } from "dotenv";
import { Domain, EnrollmentStatus } from "@prisma/client";
import { prisma } from "../../src/lib/db";
import { ensureClaudeCertificate } from "../../src/features/certificate/issue-certificate";

config({ path: ".env.local" });
config();

const CERTIFICATE_ELIGIBLE_DAYS = 50;

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const enrollments = await prisma.enrollment.findMany({
    where: {
      domain: Domain.CLAUDE,
      certificate: null,
      OR: [
        { status: EnrollmentStatus.COMPLETED },
        { daysCompleted: { gte: CERTIFICATE_ELIGIBLE_DAYS } },
      ],
    },
    select: {
      id: true,
      userId: true,
      daysCompleted: true,
      status: true,
      user: {
        select: {
          email: true,
          studentProfile: { select: { fullName: true } },
        },
      },
    },
  });

  console.log(
    `Found ${enrollments.length} CLAUDE enrollment(s) eligible for certificates.`,
  );
  for (const e of enrollments) {
    const name = e.user.studentProfile?.fullName ?? "(no name)";
    console.log(
      `  - ${name} <${e.user.email}> days=${e.daysCompleted} status=${e.status}`,
    );
  }

  if (dryRun) {
    console.log("Dry run — no certificates issued.");
    return;
  }

  if (enrollments.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  console.log("\nPress Ctrl+C in the next 5 seconds to cancel...");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  let issued = 0;
  let skipped = 0;
  let failed = 0;

  for (const e of enrollments) {
    const result = await ensureClaudeCertificate(e.userId);
    const label = e.user.studentProfile?.fullName ?? e.user.email;
    if (!result.ok) {
      failed += 1;
      console.log(`  FAIL ${label}: ${result.message}`);
      continue;
    }
    if (result.data.alreadyIssued) {
      skipped += 1;
      console.log(
        `  SKIP ${label}: already ${result.data.certificateId}`,
      );
    } else {
      issued += 1;
      console.log(`  OK   ${label}: ${result.data.certificateId}`);
    }
  }

  console.log(
    `\nDone. issued=${issued} skipped=${skipped} failed=${failed}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
