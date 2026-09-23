import { PrismaClient, Role } from "@prisma/client";
const prisma = new PrismaClient();

// A signed-in but UNREGISTERED candidate. Registration goes through /register
// so StudentProfile + CandidateProfile are created the way the app expects;
// locally ENABLE_NEW_CANDIDATE is off, so the gate checks StudentProfile and a
// hand-made CandidateProfile alone makes /register loop on "already registered".
const EMAIL = "resume-tester@abtalks.dev";

async function main() {
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {},
    create: { email: EMAIL, name: "Resume Tester", password: "test", role: Role.STUDENT, emailVerified: new Date() },
    select: { id: true },
  });
  const student = await prisma.studentProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!student) {
    const removed = await prisma.candidateProfile.deleteMany({ where: { userId: user.id } });
    console.log("unregistered candidate ready:", user.id, "| removed half-made candidate profiles:", removed.count);
  } else {
    console.log("already registered through /register:", user.id);
  }
}

main().finally(() => prisma.$disconnect());
