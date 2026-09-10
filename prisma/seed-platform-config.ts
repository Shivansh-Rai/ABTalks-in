/**
 * Seed the runtime platform configuration (T-228).
 *
 * Upserts every key the registry declares, with `update: {}` — so running this
 * again never overwrites a value somebody changed on purpose. That matters:
 * the whole point of this table is that product edits it without a deployment,
 * and a seed that reset those edits on the next deploy would quietly undo the
 * feature.
 *
 * Run: npm run db:seed:platform-config
 */
import { PrismaClient } from "@prisma/client";
import { PLATFORM_CONFIG_KEYS } from "../src/lib/platform-config";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding PlatformConfig...\n");

  for (const [key, spec] of Object.entries(PLATFORM_CONFIG_KEYS)) {
    const data =
      spec.kind === "int"
        ? { intValue: spec.default, description: spec.description }
        : { stringValue: spec.default, description: spec.description };

    const before = await prisma.platformConfig.findUnique({
      where: { key },
      select: { key: true },
    });

    await prisma.platformConfig.upsert({
      where: { key },
      create: { key, ...data },
      update: {},
    });

    const value = spec.kind === "int" ? spec.default : spec.default;
    console.log(
      before
        ? `  = ${key} already set — left alone`
        : `  + ${key} = ${String(value)}`,
    );
  }

  console.log(
    "\nNote: credits.contact_unlock_cost_minor ships as a PLACEHOLDER.",
  );
  console.log(
    "T-228 specifies no unlock price and nothing reads this key yet.",
  );
  console.log("Product must set the real value before T-229 ships.\n");
}

main()
  .catch((e) => {
    console.error("PlatformConfig seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
