import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      email: { in: ["arjun@abtalks.dev", "demo-candidate@abtalks.dev", "candidate@abtalks.dev"] },
    },
    select: { id: true, email: true, name: true, role: true, password: true },
  });
  console.log("Found users:", users);

  if (users.length === 0) {
    const anyUser = await prisma.user.findMany({
      where: { role: "CANDIDATE" },
      select: { id: true, email: true, name: true, role: true, password: true },
      take: 3,
    });
    console.log("Any candidates:", anyUser);
  }
}

main().finally(() => prisma.$disconnect());
