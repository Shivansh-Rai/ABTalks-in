/**
 * T-225 blast radius: which recruiter rows predate the work-email rule.
 *
 * The rule stops a free consumer mailbox becoming a recruiter from today. It
 * does not touch rows that already exist — an account created before it, or one
 * written straight to the database. Those accounts can no longer be approved,
 * but an already-approved one keeps working, so somebody has to look before
 * deciding what to do about them.
 *
 * READ ONLY. It counts and lists; it never updates, deletes or creates. Safe to
 * point at production, which is the only place the answer is interesting.
 *
 * Run: npm run db:audit:personal-domain-recruiters
 */
import { PrismaClient } from "@prisma/client";
import { isPersonalEmailDomain } from "../../src/lib/validations/work-email";

const prisma = new PrismaClient();

function line(label: string, value: string | number) {
  console.log(`  ${label.padEnd(34)} ${value}`);
}

async function main() {
  console.log("\nT-225 — recruiter rows on personal email domains\n");

  // Filtering happens in JS rather than SQL: the domain list is source, and a
  // hand-built `endsWith` chain here would be a second copy of it that can
  // drift from the one the product actually enforces.
  const profiles = await prisma.recruiterProfile.findMany({
    select: {
      id: true,
      company: true,
      approved: true,
      createdAt: true,
      user: { select: { id: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const flagged = profiles.filter((p) => isPersonalEmailDomain(p.user.email));

  line("RecruiterProfile rows total", profiles.length);
  line("…on a personal domain", flagged.length);
  line("…of those, approved", flagged.filter((p) => p.approved).length);

  if (flagged.length > 0) {
    console.log("\n  Affected profiles:");
    for (const p of flagged) {
      console.log(
        `    ${p.approved ? "APPROVED " : "pending  "} ${p.user.email} — ${p.company} — created ${p.createdAt.toISOString().slice(0, 10)}`,
      );
    }
    console.log(
      "\n  An approved row here still signs in and still holds recruiter access.\n" +
        "  Approving is now refused, so none of these can be re-approved once revoked.",
    );
  }

  // A seat is a pre-verification, so a personal-domain seat is the same problem
  // one step earlier: it would auto-approve a registration if the domain rule
  // were ever relaxed.
  const seats = await prisma.verifiedRecruiterSeat.findMany({
    select: { email: true, company: true, active: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const flaggedSeats = seats.filter((s) => isPersonalEmailDomain(s.email));

  console.log("");
  line("VerifiedRecruiterSeat rows total", seats.length);
  line("…on a personal domain", flaggedSeats.length);
  line("…of those, still active", flaggedSeats.filter((s) => s.active).length);

  for (const s of flaggedSeats) {
    console.log(
      `    ${s.active ? "ACTIVE  " : "revoked "} ${s.email} — ${s.company} — created ${s.createdAt.toISOString().slice(0, 10)}`,
    );
  }

  // Sanity check on the refusal itself: a refused registration returns before
  // `issueRecruiterOtp`, so it must leave no code behind.
  const strayOtps = await prisma.recruiterEmailOtp.findMany({
    select: { email: true, createdAt: true },
  });
  const flaggedOtps = strayOtps.filter((o) => isPersonalEmailDomain(o.email));
  console.log("");
  line("RecruiterEmailOtp rows total", strayOtps.length);
  line("…on a personal domain", flaggedOtps.length);
  if (flaggedOtps.length > 0) {
    console.log(
      "    A refused registration should never write one of these — investigate:",
    );
    for (const o of flaggedOtps) {
      console.log(`    ${o.email} — ${o.createdAt.toISOString()}`);
    }
  }

  console.log("");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
