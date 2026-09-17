/**
 * LOCAL demo fixture for the T-266 admin recruiter detail page and the T-267
 * unlock diagnosis.
 *
 * One admin, three recruiters in deliberately different states, nine
 * candidates, and just enough activity that opening Recruiter A, B and C shows
 * three genuinely different pages.
 *
 * ## It uses the real paths
 *
 * Workspaces are provisioned with `provisionRecruiterIdentity` (which also
 * lays down the T-228 starting grant), unlocks run through
 * `unlockResolvedContact`, and every credit movement goes through
 * `applyCreditChange`. Nothing here writes `CreditAccount.balance` by hand or
 * fabricates a `CONTACT_SHARED` row beside the ledger, because a demo built
 * that way would show states the product cannot actually reach — which is the
 * one thing a diagnosis page must never be tested against.
 *
 * The T-267 cases come out of that honestly:
 *   · Recruiter A — healthy, funded, can unlock.       → WOULD_SUCCEED
 *   · Recruiter A — already unlocked two candidates.   → ALREADY_UNLOCKED
 *   · Recruiter A — candidate withdrawn / disabled /
 *     searchable-but-not-in-the-pool.                  → CANDIDATE_UNAVAILABLE
 *   · Recruiter B — spent down below the unlock cost.  → INSUFFICIENT_CREDITS
 *   · Recruiter C — account suspended.                 → ACCOUNT_BLOCKED
 *
 * Deterministic and idempotent: every row is keyed on a fixed email, slug or
 * idempotency key, so re-running changes nothing and grants nothing twice.
 *
 * Usage:
 *   npm run db:seed:demo-admin
 */
import { createRequire } from "node:module";
import Module from "node:module";
import { config } from "dotenv";
import { PlatformRole, Role, RoleScopeType } from "@prisma/client";

function neutralizeServerOnly(): void {
  const require = createRequire(import.meta.url);
  try {
    const serverOnlyPath = require.resolve("server-only");
    require.cache[serverOnlyPath] = {
      id: serverOnlyPath,
      filename: serverOnlyPath,
      loaded: true,
      exports: {},
    } as NodeModule;
  } catch {
    // keep fallback
  }
  const mod = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = mod._load;
  mod._load = function (request: string, parent: unknown, isMain: boolean) {
    if (request === "server-only") return {};
    return originalLoad.call(this, request, parent, isMain);
  };
}

neutralizeServerOnly();

config({ path: ".env.local" });
config();

import { prisma } from "../src/lib/db";

const PRODUCTION_DB_HOST_IDS = ["ep-nameless-term-ams9a5e3", ".main."] as const;

function assertNotProductionDb() {
  const url = process.env.DATABASE_URL ?? "";
  for (const id of PRODUCTION_DB_HOST_IDS) {
    if (url.includes(id)) {
      throw new Error(
        `Refusing to seed: DATABASE_URL looks like production (${id}). Use a Neon branch.`,
      );
    }
  }
}

const PASSWORD = "demo1234";
const ADMIN_EMAIL = "demo-admin@abtalks.dev";

type RecruiterSpec = {
  key: "A" | "B" | "C";
  email: string;
  name: string;
  company: string;
  phone: string;
  /** Suspended accounts get a disabledAt and a reason on file. */
  suspended?: string;
};

const RECRUITERS: RecruiterSpec[] = [
  {
    key: "A",
    email: "asha@northstar.demo",
    name: "Asha Rao",
    company: "Northstar Labs",
    phone: "+91 98200 11001",
  },
  {
    key: "B",
    email: "raj@quantile.demo",
    name: "Raj Menon",
    company: "Quantile Analytics",
    phone: "+91 98200 11002",
  },
  {
    key: "C",
    email: "meera@vector.demo",
    name: "Meera Iyer",
    company: "Vector Systems",
    phone: "+91 98200 11003",
    suspended: "Payment dispute under review",
  },
];

type CandidateSpec = {
  key: string;
  name: string;
  skills: string[];
  /** Moderation state. Everything defaults to searchable. */
  state?: "withdrawn" | "disabled" | "no-claimed-skill";
};

const CANDIDATES: CandidateSpec[] = [
  { key: "c1", name: "Priya Nair", skills: ["python", "sql"] },
  { key: "c2", name: "Arjun Sharma", skills: ["typescript", "react"] },
  { key: "c3", name: "Sneha Reddy", skills: ["python", "machine-learning"] },
  { key: "c4", name: "Vikram Bose", skills: ["java", "sql"], state: "withdrawn" },
  { key: "c5", name: "Ananya Gupta", skills: ["react", "typescript"], state: "disabled" },
  {
    key: "c6",
    name: "Rohit Verma",
    skills: ["python"],
    state: "no-claimed-skill",
  },
  { key: "c7", name: "Divya Krishnan", skills: ["sql", "machine-learning"] },
  { key: "c8", name: "Karan Malhotra", skills: ["java", "typescript"] },
  { key: "c9", name: "Isha Patel", skills: ["python", "react"] },
];

const SKILLS: { slug: string; name: string }[] = [
  { slug: "python", name: "Python" },
  { slug: "sql", name: "SQL" },
  { slug: "typescript", name: "TypeScript" },
  { slug: "react", name: "React" },
  { slug: "java", name: "Java" },
  { slug: "machine-learning", name: "Machine Learning" },
];

function candidateEmail(key: string): string {
  return `demo-${key}@abtalks.dev`;
}

async function main() {
  assertNotProductionDb();

  // Imported here, after `neutralizeServerOnly()` has run: these modules are
  // `server-only`, and the demo drives the real application code rather than a
  // second copy of it.
  const { provisionRecruiterIdentity } = await import(
    "../src/features/hire/provision-recruiter"
  );
  const { applyCreditChange, getCreditBalance } = await import(
    "../src/repositories/credits"
  );
  const { unlockResolvedContact } = await import(
    "../src/features/hire/unlock-transaction"
  );
  const { candidatePublicId } = await import("../src/features/hire/public-id");
  console.log("\n─── T-266 / T-267 demo fixture ───\n");

  // ── Admin ────────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      email: ADMIN_EMAIL,
      name: "Demo Support Admin",
      password: PASSWORD,
      role: Role.ADMIN,
      emailVerified: new Date(),
    },
    update: { password: PASSWORD, role: Role.ADMIN, emailVerified: new Date() },
    select: { id: true, email: true },
  });

  // The live authority is UserRoleAssignment, not ADMIN_EMAILS — granting it
  // here means the demo admin works without editing env.
  const liveGrant = await prisma.userRoleAssignment.findFirst({
    where: {
      userId: admin.id,
      role: PlatformRole.ADMIN,
      scopeType: RoleScopeType.GLOBAL,
      revokedAt: null,
    },
    select: { id: true },
  });
  if (!liveGrant) {
    await prisma.userRoleAssignment.create({
      data: {
        userId: admin.id,
        role: PlatformRole.ADMIN,
        scopeType: RoleScopeType.GLOBAL,
      },
    });
  }
  console.log(`  admin   ${admin.email}  /  ${PASSWORD}   (id ${admin.id})`);

  // ── Skills ───────────────────────────────────────────────────────────────
  const skillIdBySlug = new Map<string, string>();
  for (const s of SKILLS) {
    const row = await prisma.skill.upsert({
      where: { slug: s.slug },
      create: { slug: s.slug, name: s.name },
      update: {},
      select: { id: true },
    });
    skillIdBySlug.set(s.slug, row.id);
  }

  // ── Candidates ───────────────────────────────────────────────────────────
  const candidateIdByKey = new Map<string, string>();
  for (const c of CANDIDATES) {
    const email = candidateEmail(c.key);
    const user = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name: c.name,
        password: PASSWORD,
        role: Role.STUDENT,
        emailVerified: new Date(),
        disabledAt: c.state === "disabled" ? new Date("2026-09-05") : null,
        disabledReason:
          c.state === "disabled" ? "Demo: account suspended by support" : null,
      },
      update: {
        password: PASSWORD,
        disabledAt: c.state === "disabled" ? new Date("2026-09-05") : null,
        disabledReason:
          c.state === "disabled" ? "Demo: account suspended by support" : null,
      },
      select: { id: true },
    });
    candidateIdByKey.set(c.key, user.id);

    await prisma.candidateProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        fullName: c.name,
        headline: `${c.skills[0]} engineer`,
        referralCode: `DEMO${c.key.toUpperCase()}`,
        phone: `+91 90000 0${c.key.replace(/\D/g, "").padStart(4, "0")}`,
        locationCity: "Bengaluru",
        countryCode: "IN",
      },
      update: { fullName: c.name },
      select: { id: true },
    });

    for (const slug of c.skills) {
      const skillId = skillIdBySlug.get(slug)!;
      // `no-claimed-skill` keeps the rows but withdraws the claim, which is the
      // real reason resolveProfileRefs drops somebody who is otherwise visible.
      await prisma.candidateSkill.upsert({
        where: { userId_skillId: { userId: user.id, skillId } },
        create: {
          userId: user.id,
          skillId,
          claimedByCandidate: c.state !== "no-claimed-skill",
        },
        update: { claimedByCandidate: c.state !== "no-claimed-skill" },
        select: { id: true },
      });
    }

    await prisma.candidateVisibility.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        searchableByRecruiters: true,
        consentSource: "demo_seed",
        withdrawnAt: c.state === "withdrawn" ? new Date("2026-09-08") : null,
      },
      update: {
        searchableByRecruiters: true,
        withdrawnAt: c.state === "withdrawn" ? new Date("2026-09-08") : null,
      },
      select: { id: true },
    });

    console.log(
      `  cand    ${candidatePublicId(user.id)}  ${c.name.padEnd(18)} ${email}${c.state ? `  [${c.state}]` : ""}`,
    );
  }

  // ── Recruiters ───────────────────────────────────────────────────────────
  const recruiters = new Map<
    string,
    { userId: string; organizationId: string; company: string }
  >();

  for (const r of RECRUITERS) {
    const user = await prisma.user.upsert({
      where: { email: r.email },
      create: {
        email: r.email,
        name: r.name,
        password: PASSWORD,
        role: Role.RECRUITER,
        emailVerified: new Date(),
      },
      update: { password: PASSWORD, role: Role.RECRUITER },
      select: { id: true },
    });

    await prisma.recruiterProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        fullName: r.name,
        company: r.company,
        phone: r.phone,
        approved: true,
        approvedAt: new Date(),
        setupCompletedAt: new Date(),
      },
      update: { company: r.company, phone: r.phone, approved: true },
      select: { id: true },
    });

    const { organizationId } = await prisma.$transaction(
      async (tx) =>
        provisionRecruiterIdentity(tx, {
          userId: user.id,
          company: r.company,
        }),
      { maxWait: 20_000, timeout: 20_000 },
    );

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        websiteUrl: `https://${r.company.toLowerCase().replace(/\s+/g, "")}.demo`,
        industry: r.key === "B" ? "Analytics" : "Software",
        sizeBucket: r.key === "A" ? "51-200" : "11-50",
        location: r.key === "C" ? "Pune, IN" : "Bengaluru, IN",
        isVerified: r.key === "A",
      },
    });

    recruiters.set(r.key, {
      userId: user.id,
      organizationId,
      company: r.company,
    });
  }

  const A = recruiters.get("A")!;
  const B = recruiters.get("B")!;
  const C = recruiters.get("C")!;

  // ── Unlocks, through the real money path ─────────────────────────────────
  const unlock = async (
    recruiter: { userId: string; organizationId: string },
    candidateKey: string,
  ) => {
    const candidateUserId = candidateIdByKey.get(candidateKey)!;
    const result = await unlockResolvedContact({
      organizationId: recruiter.organizationId,
      recruiterUserId: recruiter.userId,
      candidateUserId,
      candidatePublicId: candidatePublicId(candidateUserId),
      programMemberId: null,
      source: "PROFILE",
    });
    if (!result.ok) {
      throw new Error(
        `unlock ${candidateKey} refused: ${result.reason} — ${result.message}`,
      );
    }
    return result;
  };

  await unlock(A, "c1");
  await unlock(A, "c2");
  await unlock(C, "c8");

  // Open asks that were never granted: these are what the diagnosis is asked
  // about, and they must NOT carry CONTACT_SHARED.
  const openAsk = async (
    recruiterUserId: string,
    candidateKey: string,
    note: string,
  ) => {
    const candidateUserId = candidateIdByKey.get(candidateKey)!;
    const existing = await prisma.talentEngagementRequest.findFirst({
      where: { recruiterUserId, candidateUserId, status: "SUBMITTED" },
      select: { id: true },
    });
    if (existing) return;
    await prisma.talentEngagementRequest.create({
      data: {
        recruiterUserId,
        candidateUserId,
        candidatePublicId: candidatePublicId(candidateUserId),
        source: "PROFILE",
        status: "SUBMITTED",
        note,
        submittedAt: new Date(),
      },
      select: { id: true },
    });
  };

  await openAsk(A.userId, "c4", "Withdrawn from discovery — diagnosis case.");
  await openAsk(A.userId, "c5", "Account disabled — diagnosis case.");
  await openAsk(A.userId, "c6", "Claim withdrawn, so out of the pool.");
  await openAsk(B.userId, "c3", "Wants to unlock but cannot afford it.");

  // ── Recruiter B spends down below the unlock cost ─────────────────────────
  // A compensating ledger row, not an edited balance: the ledger is the money.
  const bBalance = await getCreditBalance(B.organizationId);
  const targetB = 500; // $5.00 — below the $10 unlock cost.
  if (bBalance > targetB) {
    await prisma.$transaction(
      async (tx) =>
        applyCreditChange(tx, {
          organizationId: B.organizationId,
          recruiterUserId: B.userId,
          amount: -(bBalance - targetB),
          type: "ADMIN_ADJUSTMENT",
          sourceType: "DEMO_SEED",
          idempotencyKey: `demo:spend-down:${B.organizationId}`,
          reason: "Demo fixture: spent down to show the insufficient-credits case",
          createdByUserId: admin.id,
        }),
      { maxWait: 20_000, timeout: 20_000 },
    );
  }

  // ── Projects ─────────────────────────────────────────────────────────────
  const project = async (
    recruiterUserId: string,
    name: string,
    title: string,
    status: "DRAFT" | "ACTIVE",
  ) => {
    const existing = await prisma.talentRequest.findFirst({
      where: { recruiterUserId, name },
      select: { id: true },
    });
    if (existing) return existing.id;
    const row = await prisma.talentRequest.create({
      data: {
        recruiterUserId,
        name,
        title,
        status,
        openings: 2,
        mustHaveStack: ["python", "sql"],
      },
      select: { id: true },
    });
    return row.id;
  };

  const projectA = await project(
    A.userId,
    "Platform Data Engineer — Bengaluru",
    "Data Engineer",
    "ACTIVE",
  );
  await project(A.userId, "Frontend Hire — Q4", "Frontend Engineer", "DRAFT");
  await project(B.userId, "Analytics Bench", "Analytics Engineer", "DRAFT");

  // One search inside A's first project, so the project row is not empty.
  await prisma.talentSearchSession.upsert({
    where: { requestId_ordinal: { requestId: projectA, ordinal: 1 } },
    create: {
      requestId: projectA,
      ordinal: 1,
      title: "Python + SQL, 2-4 years, Bengaluru",
      matchCount: 3,
      lastRunAt: new Date(),
      resultCandidateIds: [
        candidateIdByKey.get("c1")!,
        candidateIdByKey.get("c3")!,
        candidateIdByKey.get("c7")!,
      ],
    },
    update: {},
    select: { id: true },
  });

  // ── Jobs and one application ─────────────────────────────────────────────
  let jobA = await prisma.job.findFirst({
    where: { recruiterId: A.userId, title: "Data Engineer (Demo)" },
    select: { id: true },
  });
  if (!jobA) {
    jobA = await prisma.job.create({
      data: {
        title: "Data Engineer (Demo)",
        company: A.company,
        location: "Bengaluru, IN",
        description: "Demo job for the admin recruiter detail page.",
        skills: ["python", "sql"],
        recruiterId: A.userId,
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
      select: { id: true },
    });
  }
  // c7 is reachable through this application rather than the pool.
  await prisma.jobApplication.upsert({
    where: {
      userId_jobId: { userId: candidateIdByKey.get("c7")!, jobId: jobA.id },
    },
    create: { userId: candidateIdByKey.get("c7")!, jobId: jobA.id },
    update: {},
    select: { id: true },
  });

  // ── One assessment for Recruiter A ───────────────────────────────────────
  let assessment = await prisma.recruiterAssessment.findFirst({
    where: { organizationId: A.organizationId, title: "SQL screen (Demo)" },
    select: { id: true },
  });
  if (!assessment) {
    assessment = await prisma.recruiterAssessment.create({
      data: {
        organizationId: A.organizationId,
        createdByUserId: A.userId,
        title: "SQL screen (Demo)",
        subheading: "Twenty minutes, two questions.",
        status: "PUBLISHED",
        publishedAt: new Date(),
        durationMinutes: 20,
        questions: {
          create: [
            {
              position: 1,
              type: "PARAGRAPH",
              title: "What does a LEFT JOIN return that an INNER JOIN does not?",
              points: 5,
              maxWords: 120,
            },
            {
              position: 2,
              type: "PARAGRAPH",
              title: "Describe a query you optimised and how you measured it.",
              points: 10,
              maxWords: 200,
            },
          ],
        },
      },
      select: { id: true },
    });
  }
  await prisma.recruiterAssessmentAssignment.upsert({
    where: {
      assessmentId_candidateUserId: {
        assessmentId: assessment.id,
        candidateUserId: candidateIdByKey.get("c1")!,
      },
    },
    create: {
      assessmentId: assessment.id,
      candidateUserId: candidateIdByKey.get("c1")!,
      candidateRef: `PROFILE:${candidateIdByKey.get("c1")!}`,
      status: "SUBMITTED",
      startedAt: new Date("2026-09-12T09:00:00Z"),
      submittedAt: new Date("2026-09-12T09:18:00Z"),
      scorePercent: 78,
      passed: true,
    },
    update: {},
    select: { id: true },
  });

  // ── Outreach, including one failed email ─────────────────────────────────
  const thread = await prisma.outreachThread.upsert({
    where: {
      recruiterUserId_candidateUserId: {
        recruiterUserId: A.userId,
        candidateUserId: candidateIdByKey.get("c2")!,
      },
    },
    create: {
      recruiterUserId: A.userId,
      organizationId: A.organizationId,
      candidateUserId: candidateIdByKey.get("c2")!,
      subject: "Data Engineer role at Northstar Labs",
      lastMessageBy: "RECRUITER",
      lastMessageAt: new Date("2026-09-13T06:00:00Z"),
    },
    update: {},
    select: { id: true },
  });
  await prisma.outreachMessage.upsert({
    where: {
      threadId_clientRequestId: {
        threadId: thread.id,
        clientRequestId: "demo-msg-1",
      },
    },
    create: {
      threadId: thread.id,
      author: "RECRUITER",
      authorUserId: A.userId,
      body: "Hi — your SQL screen looked strong. Would you like to talk this week?",
      clientRequestId: "demo-msg-1",
      emailStatus: "SENT",
    },
    update: {},
    select: { id: true },
  });
  await prisma.outreachMessage.upsert({
    where: {
      threadId_clientRequestId: {
        threadId: thread.id,
        clientRequestId: "demo-msg-2",
      },
    },
    create: {
      threadId: thread.id,
      author: "RECRUITER",
      authorUserId: A.userId,
      body: "Following up on the above.",
      clientRequestId: "demo-msg-2",
      emailStatus: "FAILED",
      emailFailureReason:
        "The candidate's mail provider rejected the message as undeliverable.",
    },
    update: {},
    select: { id: true },
  });

  // ── Suspend Recruiter C, last, so provisioning above still ran ───────────
  const suspended = RECRUITERS.find((r) => r.suspended)!;
  await prisma.user.update({
    where: { id: C.userId },
    data: {
      disabledAt: new Date("2026-09-14T00:00:00Z"),
      disabledReason: suspended.suspended,
    },
  });

  // ── Report ───────────────────────────────────────────────────────────────
  console.log("");
  for (const r of RECRUITERS) {
    const w = recruiters.get(r.key)!;
    const balance = await getCreditBalance(w.organizationId);
    console.log(
      `  recr ${r.key}  ${r.email.padEnd(24)} $${(balance / 100).toFixed(2).padStart(7)}  ${r.suspended ? "SUSPENDED" : "active"}`,
    );
    console.log(`           /admin/recruiters/${w.userId}`);
  }
  console.log(`\n  Sign in at /login with any address above and ${PASSWORD}.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
