/**
 * Child-only W5-B StudentProfile ambassador freeze rehearsal.
 * Refuses the production Neon host.
 *
 * ENABLE_NEW_AMBASSADOR_WRITES=true
 * ENABLE_LEGACY_AMBASSADOR_MIRROR=false
 *
 * Canonical ambassador state must change. StudentProfile ambassador fields
 * must stay frozen except the anonymize/wipe compliance scrub.
 * Does not start W6. Does not drop StudentProfile.
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

const SP_SELECT = {
  fullName: true,
  phone: true,
  referralCode: true,
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

function sameAmbassador(
  before: {
    isCampusAmbassadorCandidate: boolean;
    ambassadorAppliedAt: Date | null;
    ambassadorDismissedAt: Date | null;
  },
  after: typeof before,
  label: string,
): void {
  if (
    before.isCampusAmbassadorCandidate !== after.isCampusAmbassadorCandidate ||
    (before.ambassadorAppliedAt?.toISOString() ?? null) !==
      (after.ambassadorAppliedAt?.toISOString() ?? null) ||
    (before.ambassadorDismissedAt?.toISOString() ?? null) !==
      (after.ambassadorDismissedAt?.toISOString() ?? null)
  ) {
    throw new Error(`${label}: StudentProfile ambassador fields changed`);
  }
}

function sameIsolation(
  before: { fullName: string; phone: string | null; referralCode: string; synergyPoints: number; domain: Domain | null },
  after: typeof before,
  label: string,
): void {
  if (
    before.fullName !== after.fullName ||
    before.phone !== after.phone ||
    before.referralCode !== after.referralCode ||
    before.synergyPoints !== after.synergyPoints ||
    before.domain !== after.domain
  ) {
    throw new Error(`${label}: unrelated StudentProfile fields changed`);
  }
}

async function main() {
  process.env.ENABLE_NEW_AMBASSADOR_WRITES = "true";
  process.env.ENABLE_LEGACY_AMBASSADOR_MIRROR = "false";
  delete process.env.AMBASSADOR_FAIL_LEGACY_MIRROR;

  assertChildBranch();
  const { isNewAmbassadorWritesEnabled, isLegacyAmbassadorMirrorEnabled } =
    await import("../../src/lib/feature-flags");
  if (!isNewAmbassadorWritesEnabled()) {
    throw new Error("ENABLE_NEW_AMBASSADOR_WRITES must be true for W5-B rehearsal");
  }
  if (isLegacyAmbassadorMirrorEnabled()) {
    throw new Error("ENABLE_LEGACY_AMBASSADOR_MIRROR must be false for W5-B rehearsal");
  }

  prisma = await db();
  const { applyAmbassadorChange, getAmbassadorState, listAmbassadorCandidates } =
    await import("../../src/repositories/ambassador");
  const { generateUniqueReferralCode } = await import(
    "../../src/features/registration/generate-referral-code"
  );

  const stamp = Date.now().toString(36);
  const email = `w5b-rehearse-${stamp}@abtalks.dev`;
  const user = await prisma.user.create({
    data: { email, name: "W5B Rehearse" },
    select: { id: true },
  });
  const referralCode = await generateUniqueReferralCode();
  await prisma.studentProfile.create({
    data: {
      userId: user.id,
      fullName: "W5B Rehearse",
      userType: UserType.STUDENT,
      college: "Rehearse College",
      referralCode,
      skills: ["sql"],
      synergyPoints: 42,
      domain: Domain.SE,
      phone: "+919000000052",
    },
  });
  await prisma.candidateProfile.create({
    data: {
      id: `cp_${user.id}`,
      userId: user.id,
      fullName: "W5B Rehearse",
      referralCode,
    },
  });

  const before = await prisma.studentProfile.findUnique({
    where: { userId: user.id },
    select: SP_SELECT,
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
      select: SP_SELECT,
    });
    if (!canonical?.isCandidate) throw new Error("apply: canonical not candidate");
    if (!sp) throw new Error("missing SP");
    sameAmbassador(before, sp, "apply");
    sameIsolation(before, sp, "apply");
    const read = await getAmbassadorState(user.id);
    if (!read.isCandidate) throw new Error("read: SP disagreement hid candidate");
    const listed = await listAmbassadorCandidates("W5B Rehearse");
    if (!listed.some((row) => row.userId === user.id)) {
      throw new Error("admin list missed canonical candidate with stale SP");
    }
    log("apply", { canonical, read, spAmbassador: {
      isCandidate: sp.isCampusAmbassadorCandidate,
      appliedAt: sp.ambassadorAppliedAt,
    } });

    await prisma.$transaction(async (tx) => {
      await applyAmbassadorChange(tx, user.id, {
        kind: "apply",
        at: new Date("2026-09-21T11:00:00.000Z"),
      });
    });
    canonical = await prisma.campusAmbassadorApplication.findUnique({
      where: { userId: user.id },
      select: { isCandidate: true, appliedAt: true, dismissedAt: true },
    });
    sp = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: SP_SELECT,
    });
    if (canonical?.appliedAt?.toISOString() !== appliedAt.toISOString()) {
      throw new Error("retry: appliedAt changed");
    }
    if (!sp) throw new Error("missing SP");
    sameAmbassador(before, sp, "retry");
    log("retry", { appliedAt: canonical?.appliedAt });

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
      select: SP_SELECT,
    });
    if (!canonical?.isCandidate) throw new Error("dismiss: cleared candidate");
    if (canonical.dismissedAt?.toISOString() !== dismissedAt.toISOString()) {
      throw new Error("dismiss: timestamp");
    }
    if (!sp) throw new Error("missing SP");
    sameAmbassador(before, sp, "dismiss");
    log("dismiss", { canonical });

    const dismissOnly = await prisma.user.create({
      data: { email: `w5b-rehearse-dismiss-${stamp}@abtalks.dev`, name: "W5B Dismiss" },
      select: { id: true },
    });
    const dismissReferral = await generateUniqueReferralCode();
    await prisma.studentProfile.create({
      data: {
        userId: dismissOnly.id,
        fullName: "W5B Dismiss",
        userType: UserType.STUDENT,
        referralCode: dismissReferral,
        synergyPoints: 7,
        domain: Domain.DS,
      },
    });
    const dismissBefore = await prisma.studentProfile.findUnique({
      where: { userId: dismissOnly.id },
      select: SP_SELECT,
    });
    await prisma.$transaction(async (tx) => {
      await applyAmbassadorChange(tx, dismissOnly.id, {
        kind: "dismiss",
        at: dismissedAt,
      });
    });
    const dismissCanonical = await prisma.campusAmbassadorApplication.findUnique({
      where: { userId: dismissOnly.id },
      select: { isCandidate: true, appliedAt: true, dismissedAt: true },
    });
    const dismissSp = await prisma.studentProfile.findUnique({
      where: { userId: dismissOnly.id },
      select: SP_SELECT,
    });
    if (dismissCanonical?.isCandidate) throw new Error("dismiss-only: invented candidate");
    if (!dismissCanonical?.dismissedAt) throw new Error("dismiss-only: missing timestamp");
    if (!dismissBefore || !dismissSp) throw new Error("dismiss-only: missing SP");
    sameAmbassador(dismissBefore, dismissSp, "dismiss-without-apply");
    log("dismiss-without-apply", { canonical: dismissCanonical });

    await prisma.$transaction(async (tx) => {
      await applyAmbassadorChange(tx, user.id, { kind: "wipe" });
    });
    canonical = await prisma.campusAmbassadorApplication.findUnique({
      where: { userId: user.id },
      select: { isCandidate: true, appliedAt: true, dismissedAt: true },
    });
    sp = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: SP_SELECT,
    });
    if (canonical?.isCandidate) throw new Error("wipe: still candidate");
    if (sp?.isCampusAmbassadorCandidate) throw new Error("wipe: SP ambassador not scrubbed");
    if (sp?.fullName !== before.fullName) throw new Error("wipe: identity changed");
    if (sp?.synergyPoints !== 42) throw new Error("wipe: points changed");
    if (sp?.domain !== Domain.SE) throw new Error("wipe: domain changed");
    log("wipe-compliance", { canonical, spAmbassadorCleared: true });

    process.stdout.write("W5-B rehearsal OK\n");
  } finally {
    await prisma.campusAmbassadorApplication.deleteMany({
      where: { user: { email: { contains: "w5b-rehearse-" } } },
    });
    await prisma.studentProfile.deleteMany({
      where: { user: { email: { contains: "w5b-rehearse-" } } },
    });
    await prisma.candidateProfile.deleteMany({
      where: { user: { email: { contains: "w5b-rehearse-" } } },
    });
    await prisma.user.deleteMany({ where: { email: { contains: "w5b-rehearse-" } } });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
