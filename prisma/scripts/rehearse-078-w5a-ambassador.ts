/**
 * Child-only W5-A Campus Ambassador write-authority rehearsal.
 * Refuses the production Neon host.
 *
 * ENABLE_NEW_AMBASSADOR_WRITES=true
 * ENABLE_LEGACY_AMBASSADOR_MIRROR=true
 *
 * Canonical ambassador state must change first. StudentProfile ambassador
 * columns must mirror. W4 identity, synergyPoints, and domain must not.
 * Does not start W5-B. Does not drop StudentProfile.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

if (process.env.DATABASE_URL?.includes("-pooler.")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("-pooler.", ".");
}
process.env.DIRECT_URL = process.env.DATABASE_URL;

import { Domain, UserType } from "@prisma/client";
import { assertChildBranch } from "./migrate-078-shared";

async function db() {
  const { writeClient } = await import("../../src/lib/db");
  return writeClient();
}

type Db = Awaited<ReturnType<typeof db>>;
let prisma: Db;

const ISOLATION_SELECT = {
  fullName: true,
  phone: true,
  referralCode: true,
  college: true,
  organization: true,
  skills: true,
  synergyPoints: true,
  domain: true,
  isCampusAmbassadorCandidate: true,
  ambassadorAppliedAt: true,
  ambassadorDismissedAt: true,
} as const;

function log(label: string, value: unknown): void {
  process.stdout.write(
    `${label}: ${typeof value === "string" ? value : JSON.stringify(value)}\n`,
  );
}

function sameIsolation(
  before: {
    fullName: string;
    phone: string | null;
    referralCode: string;
    college: string | null;
    organization: string | null;
    skills: string[];
    synergyPoints: number;
    domain: Domain | null;
  },
  after: typeof before,
  label: string,
): void {
  if (
    before.fullName !== after.fullName ||
    before.phone !== after.phone ||
    before.referralCode !== after.referralCode ||
    before.college !== after.college ||
    before.organization !== after.organization ||
    JSON.stringify(before.skills) !== JSON.stringify(after.skills) ||
    before.synergyPoints !== after.synergyPoints ||
    before.domain !== after.domain
  ) {
    throw new Error(`${label}: unrelated StudentProfile fields changed`);
  }
}

async function main() {
  process.env.ENABLE_NEW_AMBASSADOR_WRITES = "true";
  process.env.ENABLE_LEGACY_AMBASSADOR_MIRROR = "true";
  delete process.env.AMBASSADOR_FAIL_LEGACY_MIRROR;

  assertChildBranch();
  const { isNewAmbassadorWritesEnabled, isLegacyAmbassadorMirrorEnabled } =
    await import("../../src/lib/feature-flags");
  if (!isNewAmbassadorWritesEnabled()) {
    throw new Error("ENABLE_NEW_AMBASSADOR_WRITES must be true for rehearsal");
  }
  if (!isLegacyAmbassadorMirrorEnabled()) {
    throw new Error("ENABLE_LEGACY_AMBASSADOR_MIRROR must stay on for W5-A");
  }

  prisma = await db();
  const { applyAmbassadorChange } = await import("../../src/repositories/ambassador");
  const { generateUniqueReferralCode } = await import(
    "../../src/features/registration/generate-referral-code"
  );

  const stamp = Date.now().toString(36);
  const email = `w5a-rehearse-${stamp}@abtalks.dev`;
  const user = await prisma.user.create({
    data: { email, name: "W5A Rehearse" },
    select: { id: true },
  });
  const referralCode = await generateUniqueReferralCode();
  await prisma.studentProfile.create({
    data: {
      userId: user.id,
      fullName: "W5A Rehearse",
      userType: UserType.STUDENT,
      college: "Rehearse College",
      referralCode,
      skills: ["sql"],
      synergyPoints: 42,
      domain: Domain.SE,
      phone: "+919000000042",
    },
  });
  await prisma.candidateProfile.create({
    data: {
      id: `cp_${user.id}`,
      userId: user.id,
      fullName: "W5A Rehearse",
      referralCode,
    },
  });

  const before = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    select: ISOLATION_SELECT,
  });
  if (!before) throw new Error("missing SP");

  try {
    const appliedAt = new Date("2026-09-21T10:00:00.000Z");
    await prisma.$transaction(async (tx) => {
      await applyAmbassadorChange(tx, user.id, { kind: "apply", at: appliedAt });
    });

    let canonical = await prisma.campusAmbassadorApplication.findUnique({
      where: { userId: user.id },
      select: { isCandidate: true, appliedAt: true, dismissedAt: true },
    });
    let sp = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: ISOLATION_SELECT,
    });
    if (!canonical?.isCandidate) throw new Error("apply: canonical not candidate");
    if (canonical.appliedAt?.toISOString() !== appliedAt.toISOString()) {
      throw new Error("apply: canonical appliedAt");
    }
    if (!sp?.isCampusAmbassadorCandidate) throw new Error("apply: SP not mirrored");
    if (sp.ambassadorAppliedAt?.toISOString() !== appliedAt.toISOString()) {
      throw new Error("apply: SP appliedAt");
    }
    sameIsolation(before, sp, "apply");
    log("apply", { canonical, ambassador: {
      isCandidate: sp.isCampusAmbassadorCandidate,
      appliedAt: sp.ambassadorAppliedAt,
    } });

    const retryAt = new Date("2026-09-21T11:00:00.000Z");
    await prisma.$transaction(async (tx) => {
      await applyAmbassadorChange(tx, user.id, { kind: "apply", at: retryAt });
    });
    canonical = await prisma.campusAmbassadorApplication.findUnique({
      where: { userId: user.id },
      select: { isCandidate: true, appliedAt: true, dismissedAt: true },
    });
    if (canonical?.appliedAt?.toISOString() !== appliedAt.toISOString()) {
      throw new Error("retry: appliedAt changed");
    }
    const caaCount = await prisma.campusAmbassadorApplication.count({
      where: { userId: user.id },
    });
    if (caaCount !== 1) throw new Error(`retry: duplicate rows ${caaCount}`);
    log("retry", { appliedAt: canonical?.appliedAt, rows: caaCount });

    const dismissedAt = new Date("2026-09-21T12:00:00.000Z");
    await prisma.$transaction(async (tx) => {
      await applyAmbassadorChange(tx, user.id, { kind: "dismiss", at: dismissedAt });
    });
    canonical = await prisma.campusAmbassadorApplication.findUnique({
      where: { userId: user.id },
      select: { isCandidate: true, appliedAt: true, dismissedAt: true },
    });
    sp = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: ISOLATION_SELECT,
    });
    if (!canonical?.isCandidate) throw new Error("dismiss: cleared candidate");
    if (canonical.dismissedAt?.toISOString() !== dismissedAt.toISOString()) {
      throw new Error("dismiss: timestamp");
    }
    if (!sp) throw new Error("missing SP after dismiss");
    sameIsolation(before, sp, "dismiss");
    log("dismiss", { canonical });

    process.env.AMBASSADOR_FAIL_LEGACY_MIRROR = "1";
    const failUser = await prisma.user.create({
      data: { email: `w5a-rehearse-fail-${stamp}@abtalks.dev`, name: "W5A Fail" },
      select: { id: true },
    });
    const failReferral = await generateUniqueReferralCode();
    await prisma.studentProfile.create({
      data: {
        userId: failUser.id,
        fullName: "W5A Fail",
        userType: UserType.STUDENT,
        referralCode: failReferral,
        synergyPoints: 7,
        domain: Domain.DS,
      },
    });
    const failBefore = await prisma.studentProfile.findUnique({
      where: { userId: failUser.id },
      select: ISOLATION_SELECT,
    });
    await prisma.$transaction(async (tx) => {
      const result = await applyAmbassadorChange(tx, failUser.id, {
        kind: "apply",
        at: appliedAt,
      });
      if (!result.mirrorFailed) throw new Error("expected mirror failure");
    });
    const failCanonical = await prisma.campusAmbassadorApplication.findUnique({
      where: { userId: failUser.id },
      select: { isCandidate: true },
    });
    const failSp = await prisma.studentProfile.findUnique({
      where: { userId: failUser.id },
      select: ISOLATION_SELECT,
    });
    if (!failCanonical?.isCandidate) throw new Error("mirror fail: canonical lost");
    if (failSp?.isCampusAmbassadorCandidate) throw new Error("mirror fail: SP wrote");
    if (!failBefore || !failSp) throw new Error("mirror fail: missing SP");
    sameIsolation(failBefore, failSp, "mirror-failure");
    log("mirror-failure", { canonicalKept: true, spUnchanged: true });
    delete process.env.AMBASSADOR_FAIL_LEGACY_MIRROR;

    await prisma.$transaction(async (tx) => {
      await applyAmbassadorChange(tx, user.id, { kind: "wipe" });
    });
    canonical = await prisma.campusAmbassadorApplication.findUnique({
      where: { userId: user.id },
      select: { isCandidate: true, appliedAt: true, dismissedAt: true },
    });
    if (canonical?.isCandidate) throw new Error("wipe: still candidate");
    log("wipe", { canonical });

    process.stdout.write("W5-A rehearsal OK\n");
  } finally {
    await prisma.campusAmbassadorApplication.deleteMany({
      where: { user: { email: { contains: "w5a-rehearse-" } } },
    });
    await prisma.studentProfile.deleteMany({
      where: { user: { email: { contains: "w5a-rehearse-" } } },
    });
    await prisma.candidateProfile.deleteMany({
      where: { user: { email: { contains: "w5a-rehearse-" } } },
    });
    await prisma.user.deleteMany({ where: { email: { contains: "w5a-rehearse-" } } });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
