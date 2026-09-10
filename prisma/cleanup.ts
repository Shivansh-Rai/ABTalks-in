import { prisma } from "../src/lib/db";

async function cleanup() {
  // Get cleanup mode from command line argument
  const mode = process.argv[2] ?? "all";

  console.log(`Cleanup mode: ${mode}`);

  let whereClause: object;

  switch (mode) {
    case "test":
      // Only delete test users (@abtalks.dev)
      whereClause = { email: { endsWith: "@abtalks.dev" } };
      console.log("Deleting only @abtalks.dev test users...");
      break;

    case "real":
      // Only delete real users (everything except @abtalks.dev)
      whereClause = { email: { not: { endsWith: "@abtalks.dev" } } };
      console.log("Deleting all real users (Google OAuth users)...");
      break;

    case "all":
      // Delete EVERYTHING — for full reset
      whereClause = {};
      console.log("Deleting ALL users (test + real)...");
      break;

    default:
      console.error(`Unknown mode: ${mode}. Use 'test', 'real', or 'all'.`);
      process.exit(1);
  }

  // Confirmation prompt for safety
  if (mode === "all" || mode === "real") {
    console.log("\nWARNING: This will permanently delete user data.");
    console.log("Press Ctrl+C in the next 5 seconds to cancel...");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  const userCount = await prisma.user.count({ where: whereClause });
  console.log(`Found ${userCount} users matching the criteria.`);

  if (userCount === 0) {
    console.log("Nothing to delete.");
    await prisma.$disconnect();
    return;
  }

  // T-228: the credit ledger is deliberately ON DELETE RESTRICT — financial
  // history does not vanish because somebody deleted a row — which means a
  // recruiter with credits cannot be deleted while their ledger stands. This is
  // a destructive dev reset, so the ledger goes with them, explicitly, rather
  // than the delete failing with a foreign key error. Nothing outside this
  // script may delete a CreditTransaction.
  const doomed = await prisma.user.findMany({
    where: whereClause,
    select: { id: true },
  });
  const doomedIds = doomed.map((u) => u.id);

  if (doomedIds.length > 0) {
    const ledger = await prisma.creditTransaction.deleteMany({
      where: {
        OR: [
          { recruiterUserId: { in: doomedIds } },
          { candidateUserId: { in: doomedIds } },
        ],
      },
    });
    // The cached projection goes with the ledger it projected, so the two never
    // survive each other.
    const accounts = await prisma.creditAccount.deleteMany({
      where: { organization: { members: { some: { userId: { in: doomedIds } } } } },
    });
    if (ledger.count > 0 || accounts.count > 0) {
      console.log(
        `Deleted ${ledger.count} credit ledger rows and ${accounts.count} credit accounts.`,
      );
    }
  }

  const result = await prisma.user.deleteMany({ where: whereClause });
  console.log(`Deleted ${result.count} users (cascades handled related rows).`);
  console.log("Cleanup complete.");

  await prisma.$disconnect();
}

cleanup().catch((e) => {
  console.error("Cleanup failed:", e);
  process.exit(1);
});
