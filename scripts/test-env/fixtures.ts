/**
 * Plan 195 — named, parametric scenarios.
 *
 * A fixture puts the database into one specific, named state so a test starts
 * from a known place. They are the "different parameters" half of this
 * environment: the bootstrap gives one reasonable world, and these reshape it.
 *
 * Rules every fixture here follows:
 *
 *   - It is IDEMPOTENT. Running it twice leaves the same state as running it
 *     once, so a test can re-apply its own precondition without reasoning
 *     about what came before.
 *   - It is NARROW. A fixture changes what its name says and nothing else, so
 *     two can be combined without one quietly undoing the other.
 *   - It does NOT re-seed. `npm run test:env:reset` is the way back to the
 *     baseline; a fixture that silently wiped would make combinations
 *     order-dependent.
 *
 * The parametric ones take `--key` / `--day` / `--dollars`; the rest take
 * nothing. `npm run test:env:fixture -- --list` prints the catalogue.
 */
import { PipelineStage, PlatformRole, RoleScopeType } from "@prisma/client";

import { prisma } from "../../src/lib/db";
/**
 * The canonical write boundary, not a hand-rolled copy of it. Both of these
 * modules are `server-only`, which is why every `test:env:*` npm script runs
 * with `NODE_OPTIONS=--conditions=react-server` — and why the browser suite
 * applies fixtures by shelling out to `test:env:fixture` rather than importing
 * this file.
 */
import {
  applyCreditChange,
  getCreditBalance,
} from "../../src/repositories/credits";
import { pipelineListName } from "../../src/repositories/talent-pipeline";
import { TEST_IDENTITIES, findIdentity } from "../../src/lib/test-env";

export type FixtureParams = {
  key?: string;
  day?: number;
  dollars?: number;
};

export type Fixture = {
  name: string;
  /** One line for `--list`. */
  describe: string;
  /** Which parameters this fixture reads, for the usage line. */
  params?: string;
  apply: (params: FixtureParams) => Promise<string>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function userIdFor(key: string): Promise<{ id: string; name: string }> {
  const identity = findIdentity(key);
  if (!identity) {
    throw new Error(
      `Unknown identity "${key}". Known: ${TEST_IDENTITIES.map((i) => i.key).join(", ")}`,
    );
  }
  const user = await prisma.user.findUnique({
    where: { email: identity.email },
    select: { id: true },
  });
  if (!user) {
    throw new Error(
      `${identity.email} does not exist — run \`npm run test:env:bootstrap\`.`,
    );
  }
  return { id: user.id, name: identity.name };
}

/** The challenge enrollment, selected by cohort rather than by id prefix. */
async function challengeEnrollment(userId: string) {
  const enrollment = await prisma.programEnrollment.findFirst({
    where: {
      userId,
      cohort: {
        slug: { startsWith: "legacy-" },
        NOT: { slug: { startsWith: "legacy-program-" } },
      },
    },
    orderBy: { startedAt: "asc" },
    select: { id: true, cohortId: true },
  });
  if (!enrollment) throw new Error("No challenge enrollment for that identity.");
  return enrollment;
}

async function organizationFor(key: string) {
  const { id: userId } = await userIdFor(key);
  const membership = await prisma.organizationMember.findFirst({
    where: { userId, status: "ACTIVE" },
    select: {
      organizationId: true,
      organization: { select: { name: true } },
    },
  });
  if (!membership) throw new Error(`${key} has no organization.`);
  const profile = await prisma.recruiterProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return {
    userId,
    organizationId: membership.organizationId,
    organizationName: membership.organization.name,
    recruiterProfileId: profile?.id ?? null,
  };
}

/**
 * Move an organization's credit balance to `targetMinor`, the way the product
 * does it.
 *
 * WHY NOT `CreditAccount.balance = n`, WHICH IS WHAT THIS USED TO DO. That
 * column is a cache, not the source of truth: `getCreditBalance` reads
 * `balanceAfter` off the newest `CreditTransaction`, so the hire desk went on
 * showing $200.00 however many times a fixture wrote 35000 to the account row.
 * `src/features/admin/unlock-diagnosis.ts` says it outright — "Add credits with
 * an ADMIN_ADJUSTMENT on the ledger. Never edit CreditAccount.balance by hand."
 * The browser suite is what caught the fixture doing exactly that.
 *
 * So this appends a real ledger movement through `applyCreditChange`, which
 * writes the row and the cache in one transaction and can never leave them
 * disagreeing. The one direct write left is the repair below.
 */
async function setCreditBalance(
  organizationId: string,
  recruiterUserId: string,
  targetMinor: number,
): Promise<number> {
  return prisma.$transaction(
    async (tx) => {
      const ledger = await getCreditBalance(organizationId, tx);

      // The repair. `applyCreditChange` takes the new `balanceAfter` from the
      // account row's post-image, so if the cache has drifted from the ledger
      // the movement would record a wrong balance. Earlier versions of these
      // fixtures drifted it on purpose, so a test database restored from
      // before this fix still needs straightening out. Setting it *to the
      // ledger's own number* is not a second source of truth — it is the
      // definition of what this column is for.
      await tx.creditAccount.upsert({
        where: { organizationId },
        create: { organizationId, balance: ledger },
        update: { balance: ledger },
        select: { id: true },
      });

      const delta = targetMinor - ledger;
      /**
       * Already there. This is what makes the fixture idempotent — and it is
       * the *only* thing that should: an append-only ledger should not carry
       * rows that say nothing happened.
       */
      if (delta === 0) return ledger;

      /**
       * The key has to be unique per application, not per transition.
       *
       * Keying it on `<from>-><to>` looked deterministic and tidy and was
       * wrong: `applyCreditChange` treats a seen key as a retry and applies
       * nothing, so the second time a suite walked 200 → 350 → 0 → 200 the
       * ledger refused every step as a duplicate and the balance silently
       * stopped tracking the fixture. The contract here is "the balance ends
       * at the target", not "this exact movement happens at most once", so the
       * transaction count — monotonic, and already in the row this is about to
       * append after — distinguishes one application from the next without
       * reaching for a clock.
       */
      const movements = await tx.creditTransaction.count({
        where: { organizationId },
      });

      const result = await applyCreditChange(tx, {
        organizationId,
        recruiterUserId,
        amount: delta,
        type: "ADMIN_ADJUSTMENT",
        sourceType: "test-env-fixture",
        idempotencyKey: `test-env:set-balance:${organizationId}:${movements}:${ledger}->${targetMinor}`,
        reason: `Test fixture set the balance to ${targetMinor} minor units`,
      });
      if (!result.ok) {
        throw new Error(`Could not set the balance: ${result.message}`);
      }
      return result.balance;
    },
    // The allowance the repository's own doc comment asks callers to pass.
    { maxWait: 20_000, timeout: 20_000 },
  );
}

/** Noon UTC, `day - 1` days ago — the seeds' own `utcNoon` convention. */
function anchorForDay(day: number): Date {
  const at = new Date();
  at.setUTCHours(12, 0, 0, 0);
  at.setUTCDate(at.getUTCDate() - (day - 1));
  return at;
}

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

export const FIXTURES: Fixture[] = [
  // --- Challenge track ----------------------------------------------------
  {
    name: "candidate-day",
    describe: "Move a challenge candidate to a specific day (1–60)",
    params: "--key=<identity> --day=<1-60>",
    /**
     * WHAT THIS DOES NOT DO, measured in a browser rather than assumed: it
     * moves the day anchor and the progress counters, and it does NOT invent
     * `ActivityAttempt` rows. So the dashboard's track card reads "Day 45 of
     * 60" from the anchor, while the squares beside it still say "7 active
     * days of 60" — that figure counts real attempts, and the seed only made
     * seven of them.
     *
     * That is the right trade. Synthesising attempts means inventing
     * submissions, evaluations and points for every intervening day, and a
     * fixture that fabricates a candidate's proof of work would make every
     * assertion about evaluation or points meaningless. Use this for anything
     * that keys off the day number — unlocking, streak windows, certificate
     * eligibility — and reach for the real submission flow when the thing
     * under test is the work itself.
     */
    async apply({ key = "arjun", day = 30 }) {
      if (day < 1 || day > 60) throw new Error("--day must be 1–60.");
      const { id: userId, name } = await userIdFor(key);
      const enrollment = await challengeEnrollment(userId);
      const startedAt = anchorForDay(day);

      await prisma.$transaction(async (tx) => {
        await tx.programEnrollment.update({
          where: { id: enrollment.id },
          data: {
            // Both the anchor AND the counters. `getCurrentDayNumber` derives
            // the day from elapsed IST time since `startedAt`, so setting only
            // the counters produces a candidate whose dashboard and whose
            // progress row disagree — which reads as a product bug.
            startedAt,
            trackCurrentStreak: day,
            trackLongestStreak: Math.max(day, 1),
            status: day >= 60 ? "COMPLETED" : "ACTIVE",
            completedAt: day >= 60 ? new Date() : null,
          },
          select: { id: true },
        });
        await tx.enrollmentProgress.upsert({
          where: { enrollmentId: enrollment.id },
          create: {
            enrollmentId: enrollment.id,
            cohortId: enrollment.cohortId,
            completedActivities: day,
            totalActivities: 60,
            percentCompleteBp: Math.round((day / 60) * 10000),
            currentStreak: day,
            longestStreak: day,
            lastActivityAt: new Date(),
            unlockedThroughPosition: day,
          },
          update: {
            completedActivities: day,
            percentCompleteBp: Math.round((day / 60) * 10000),
            currentStreak: day,
            longestStreak: day,
            lastActivityAt: new Date(),
            unlockedThroughPosition: day,
          },
          select: { id: true },
        });
      });

      return `${name} is on day ${day} (${day >= 60 ? "COMPLETED" : "ACTIVE"}).`;
    },
  },
  {
    name: "candidate-broken-streak",
    describe: "A candidate mid-challenge whose streak has lapsed — relaxation-window state",
    params: "--key=<identity> --day=<1-60>",
    async apply({ key = "anika", day = 30 }) {
      const { id: userId, name } = await userIdFor(key);
      const enrollment = await challengeEnrollment(userId);

      // Last activity three days ago with a zero current streak: the shape a
      // backfill / relaxation decision is made against. `getElapsedDayNumber`
      // is the uncapped reading those decisions use, so the anchor still has
      // to be real — only the streak lapses.
      const lapsed = new Date();
      lapsed.setUTCDate(lapsed.getUTCDate() - 3);

      await prisma.$transaction(async (tx) => {
        await tx.programEnrollment.update({
          where: { id: enrollment.id },
          data: {
            startedAt: anchorForDay(day),
            trackCurrentStreak: 0,
            trackLongestStreak: Math.max(day - 5, 1),
            status: "ACTIVE",
          },
          select: { id: true },
        });
        await tx.enrollmentProgress.upsert({
          where: { enrollmentId: enrollment.id },
          create: {
            enrollmentId: enrollment.id,
            cohortId: enrollment.cohortId,
            completedActivities: Math.max(day - 3, 0),
            totalActivities: 60,
            currentStreak: 0,
            longestStreak: Math.max(day - 5, 1),
            lastActivityAt: lapsed,
            unlockedThroughPosition: Math.max(day - 3, 0),
          },
          update: {
            completedActivities: Math.max(day - 3, 0),
            currentStreak: 0,
            longestStreak: Math.max(day - 5, 1),
            lastActivityAt: lapsed,
          },
          select: { id: true },
        });
      });

      return `${name} is on day ${day} with a lapsed streak (last activity 3 days ago).`;
    },
  },

  // --- Recruiter / hire desk ---------------------------------------------
  {
    name: "recruiter-credits",
    describe: "Set a recruiter organization's credit balance, in dollars",
    params: "--key=<recruiter|recruiter2> --dollars=<n>",
    async apply({ key = "recruiter", dollars = 200 }) {
      const org = await organizationFor(key);
      // Minor units: 20000 is $200.00, which is the onboarding grant.
      const balance = await setCreditBalance(
        org.organizationId,
        org.userId,
        dollars * 100,
      );
      return `${org.organizationName} now holds $${(balance / 100).toFixed(2)}.`;
    },
  },
  {
    name: "recruiter-empty-desk",
    describe: "A recruiter with no credits and no shortlists — the paywall / empty states",
    params: "--key=<recruiter|recruiter2>",
    async apply({ key = "recruiter" }) {
      const org = await organizationFor(key);
      // Through the ledger, for the reason `setCreditBalance` explains: a
      // paywall that reads the ledger is not fooled by a zeroed cache row.
      await setCreditBalance(org.organizationId, org.userId, 0);
      // Items cascade from the list, so deleting the lists is enough. The
      // pipeline's own list goes with them and `ensureRecruiterPipeline`
      // re-creates it empty on the next visit, which is the state wanted here.
      await prisma.talentList.deleteMany({
        where: { organizationId: org.organizationId },
      });
      return `${org.organizationName}: $0.00 and no talent lists.`;
    },
  },
  {
    name: "recruiter-pipeline",
    describe: "A populated shortlist across pipeline stages, for the review panel",
    params: "--key=<recruiter|recruiter2>",
    async apply({ key = "recruiter" }) {
      const org = await organizationFor(key);
      if (!org.recruiterProfileId) {
        throw new Error(`${key} has no RecruiterProfile, so it has no pipeline.`);
      }

      /**
       * THE NAME IS THE WHOLE THING. `/hire/pipeline` does not show "a talent
       * list" — `listPipeline` reads exactly one, the list named
       * `__pipeline:<recruiterProfileId>` and owned by that profile
       * (`ensureRecruiterPipeline`). This fixture used to create a list called
       * "Test pipeline", which is a perfectly valid talent list that the
       * pipeline board never looks at, so the board kept saying "No one in
       * your pipeline yet" with five rows sitting in the database. The browser
       * suite is what caught it; the CLI could not, because the rows it wrote
       * were all exactly as intended.
       *
       * `pipelineListName` is imported from the repository rather than spelled
       * out here, so a change to that convention cannot leave this behind.
       */
      const listName = pipelineListName(org.recruiterProfileId);

      // Real candidates from the cast, so unlocking and profile views lead
      // somewhere rather than to a tombstone label.
      const candidateKeys = ["meera", "karan", "anika", "dhruv", "vikram"];
      const stages: PipelineStage[] = [
        PipelineStage.SHORTLISTED,
        PipelineStage.CONTACTED,
        PipelineStage.SCREENING,
        PipelineStage.SHORTLISTED,
        PipelineStage.REJECTED,
      ];

      const list = await prisma.talentList.upsert({
        where: {
          organizationId_name: {
            organizationId: org.organizationId,
            name: listName,
          },
        },
        create: {
          organizationId: org.organizationId,
          ownerRecruiterId: org.recruiterProfileId,
          isSharedWithOrg: false,
          name: listName,
          description: "Hiring pipeline",
        },
        update: {},
        select: { id: true },
      });

      let added = 0;
      for (const [index, candidateKey] of candidateKeys.entries()) {
        const identity = findIdentity(candidateKey);
        if (!identity) continue;
        const candidate = await prisma.user.findUnique({
          where: { email: identity.email },
          select: { id: true },
        });
        if (!candidate) continue;

        await prisma.talentListItem.upsert({
          where: {
            talentListId_candidateUserId: {
              talentListId: list.id,
              candidateUserId: candidate.id,
            },
          },
          create: {
            talentListId: list.id,
            candidateUserId: candidate.id,
            candidateLabel: identity.name,
            stage: stages[index] ?? PipelineStage.SHORTLISTED,
            addedByUserId: org.userId,
          },
          update: { stage: stages[index] ?? PipelineStage.SHORTLISTED },
          select: { id: true },
        });
        added += 1;
      }

      return `${org.organizationName}: ${added} candidates across stages on the hiring pipeline.`;
    },
  },

  // --- AI Cohort program --------------------------------------------------
  {
    name: "program-day",
    describe: "Move the AI-cohort member's score/progress to a given day (1–31)",
    params: "--key=<identity> --day=<1-31>",
    async apply({ key = "program", day = 15 }) {
      if (day < 1 || day > 31) throw new Error("--day must be 1–31 for /program.");
      const { id: userId, name } = await userIdFor(key);
      const enrollment = await prisma.programEnrollment.findFirst({
        where: { userId, cohort: { slug: { startsWith: "legacy-program-" } } },
        select: { id: true },
      });
      if (!enrollment) throw new Error(`${key} has no /program enrollment.`);

      // Points scaled off the day rather than invented per field, so the total
      // stays the sum of its parts — the leaderboard orders on `totalScore`
      // and a total that disagrees with its components is a confusing fixture.
      const mission = day * 4;
      const concept = day * 3;
      const commit = day * 2;
      const project = day >= 7 ? 30 : 0;

      await prisma.programEnrollment.update({
        where: { id: enrollment.id },
        data: {
          startedAt: anchorForDay(day),
          missionPoints: mission,
          conceptPoints: concept,
          commitPoints: commit,
          projectPoints: project,
          totalScore: mission + concept + commit + project,
          cleanPassCount: Math.floor(day / 3),
          status: day >= 31 ? "COMPLETED" : "ACTIVE",
        },
        select: { id: true },
      });

      return `${name} is on /program day ${day}, score ${mission + concept + commit + project}.`;
    },
  },

  // --- Hackathon ----------------------------------------------------------
  {
    name: "hackathon-submitted",
    describe: "The hackathon participant's team has submitted",
    params: "--key=<identity>",
    async apply({ key = "hackathon" }) {
      const { id: userId, name } = await userIdFor(key);
      const participant = await prisma.hackathonParticipant.findFirst({
        where: { userId },
        select: { teamId: true, team: { select: { teamCode: true } } },
      });
      if (!participant) throw new Error(`${key} is not a hackathon participant.`);

      const problem = await prisma.hackathonProblem.findFirst({
        select: { id: true },
      });

      await prisma.hackathonSubmission.upsert({
        where: { teamId: participant.teamId },
        create: {
          teamId: participant.teamId,
          problemId: problem?.id ?? null,
          repoUrl: "https://github.com/abtalks-test/hackathon-entry",
          liveUrl: "https://example.test/hackathon-entry",
          aiLogUrl: "https://example.test/hackathon-ai-log",
        },
        update: {},
        select: { id: true },
      });

      return `${name}'s team ${participant.team.teamCode} has a submission.`;
    },
  },
  {
    name: "hackathon-open",
    describe: "Remove the submission, putting the team back to pre-submit",
    params: "--key=<identity>",
    async apply({ key = "hackathon" }) {
      const { id: userId, name } = await userIdFor(key);
      const participant = await prisma.hackathonParticipant.findFirst({
        where: { userId },
        select: { teamId: true },
      });
      if (!participant) throw new Error(`${key} is not a hackathon participant.`);
      const { count } = await prisma.hackathonSubmission.deleteMany({
        where: { teamId: participant.teamId },
      });
      return `${name}: ${count} submission(s) removed.`;
    },
  },

  // --- Admin --------------------------------------------------------------
  {
    name: "admin-grant",
    describe: "Grant platform admin to any identity",
    params: "--key=<identity>",
    async apply({ key = "admin" }) {
      const { id: userId, name } = await userIdFor(key);
      const live = await prisma.userRoleAssignment.findFirst({
        where: {
          userId,
          role: PlatformRole.ADMIN,
          scopeType: RoleScopeType.GLOBAL,
          revokedAt: null,
        },
        select: { id: true },
      });
      if (live) return `${name} is already a platform admin.`;
      await prisma.userRoleAssignment.create({
        data: {
          userId,
          role: PlatformRole.ADMIN,
          scopeType: RoleScopeType.GLOBAL,
        },
        select: { id: true },
      });
      return `${name} is now a platform admin.`;
    },
  },
  {
    name: "admin-revoke",
    describe: "Revoke platform admin — for testing what a demoted admin can still reach",
    params: "--key=<identity>",
    async apply({ key = "admin" }) {
      const { id: userId, name } = await userIdFor(key);
      // Stamps `revokedAt`, as the product does. Never edit `role` to revoke —
      // liveness is defined as `revokedAt IS NULL`.
      const { count } = await prisma.userRoleAssignment.updateMany({
        where: {
          userId,
          role: PlatformRole.ADMIN,
          scopeType: RoleScopeType.GLOBAL,
          revokedAt: null,
        },
        data: { revokedAt: new Date(), revokedReason: "test fixture" },
      });
      return `${name}: ${count} admin grant(s) revoked.`;
    },
  },

  // --- Cross-cutting ------------------------------------------------------
  {
    name: "clear-rate-limits",
    describe: "Drop every recorded rate-limit event (login, search, unlock, outreach)",
    async apply() {
      const { count } = await prisma.rateLimitEvent.deleteMany({});
      return `${count} rate-limit event(s) cleared.`;
    },
  },
  {
    name: "unregister",
    describe: "Strip an identity's CandidateProfile so it lands on /register",
    params: "--key=<identity>",
    async apply({ key = "fresh" }) {
      const { id: userId, name } = await userIdFor(key);
      const { count } = await prisma.candidateProfile.deleteMany({
        where: { userId },
      });
      return `${name}: ${count} candidate profile(s) removed — now lands on /register.`;
    },
  },
];

export function findFixture(name: string): Fixture | undefined {
  return FIXTURES.find((f) => f.name === name);
}
