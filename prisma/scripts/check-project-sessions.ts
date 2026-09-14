/**
 * Plan 133 — projects and search sessions, proved against Postgres.
 *
 * The ten required behaviours, each by doing it: projects persist, sessions
 * live inside one project and never overwrite each other, the shortlist and
 * assessments stay inside their project, a legacy project becomes Session 1
 * with nothing lost, unassigned assessments survive, and recruiter B can read
 * or write none of recruiter A's projects or sessions.
 *
 * Writes scratch recruiters, an organization, projects, sessions and
 * assessments, then removes them. Two existing searchable candidates are
 * REFERENCED by scratch match rows (read-only; the rows go with the scratch
 * projects). Refuses to run against production.
 *
 * Run: npm run db:check:project-sessions
 */
import { PrismaClient } from "@prisma/client";
import {
  createProject,
  createSession,
  ensureLegacySession,
  getOwnedSession,
  listProjectSessions,
  listSessionMessages,
  pruneUndecidedOutsideSessions,
  recordSessionRun,
  specFromJson,
  specToJson,
  type SessionSnapshotRow,
} from "../../src/features/hire/search-sessions";
import {
  linkProjectAssessment,
  listProjectAssessments,
  listUnassignedAssessments,
  unlinkProjectAssessment,
} from "../../src/features/hire/project-assessments";
import { loadRequestMatches } from "../../src/features/hire/load-request-matches";
import { listProjectShortlistByProject } from "../../src/features/hire/project-shortlist";
import { scopePodRows } from "../../src/components/hire/shortlist-scope";
import type { CartRow } from "../../src/components/hire/shortlist-cart";
import { filterSearchableUserIds } from "../../src/repositories/talent";

const prisma = new PrismaClient();
const PRODUCTION_NEON_HOST_ID = "ep-nameless-term-ams9a5e3";
const stamp = Date.now();

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ""}`);
  }
}

async function makeRecruiter(label: string) {
  const user = await prisma.user.create({
    data: { email: `sessions-proof-${label}-${stamp}@abtalks.dev`, name: `Proof ${label}`, role: "RECRUITER" },
    select: { id: true },
  });
  const org = await prisma.organization.create({
    data: { slug: `sessions-proof-${label}-${stamp}`, name: `Proof ${label} Co` },
    select: { id: true },
  });
  await prisma.organizationMember.create({
    data: { organizationId: org.id, userId: user.id, role: "RECRUITER", status: "ACTIVE", joinedAt: new Date() },
  });
  return { userId: user.id, organizationId: org.id };
}

async function makeAssessment(r: { userId: string; organizationId: string }, title: string) {
  const a = await prisma.recruiterAssessment.create({
    data: { organizationId: r.organizationId, createdByUserId: r.userId, title },
    select: { id: true },
  });
  return a.id;
}

function snap(candidateUserId: string, score: number): SessionSnapshotRow {
  return {
    candidateUserId,
    score,
    tier: "STRONG",
    scoreBreakdown: {},
    evidence: { skills: ["React"] },
    rationale: `score ${score}`,
    gaps: [],
    availabilityUnknown: true,
  };
}

async function upsertMatch(requestId: string, candidateUserId: string, score: number) {
  await prisma.talentRequestMatch.upsert({
    where: { requestId_candidateUserId: { requestId, candidateUserId } },
    create: {
      requestId,
      candidateUserId,
      source: "PROFILE",
      score,
      tier: "STRONG",
      scoreBreakdown: {},
      evidence: { skills: ["React"] },
    },
    update: { score },
  });
}

/** What the header would get for a recruiter, as CartRows, tagged by project. */
async function podRowsFor(userId: string): Promise<CartRow[]> {
  const rows = await listProjectShortlistByProject(userId);
  return rows.map((r) => ({
    candidateRef: r.candidateRef,
    memberId: r.memberId,
    jobRole: r.jobRole,
    totalScore: r.totalScore,
    note: null,
    revealedName: null,
    engagementStatus: null,
    projectRequestId: r.requestId,
    candidateUserId: r.candidateUserId,
  }));
}

async function main() {
  if ((process.env.DATABASE_URL ?? "").includes(PRODUCTION_NEON_HOST_ID)) {
    console.error("Refusing to run project-session proofs against production.");
    process.exit(1);
  }
  console.log("\nPlan 133 — projects and search sessions (database proofs)\n");

  // Two real, searchable candidates, referenced only.
  const cands = await prisma.user.findMany({
    where: { email: { in: ["strong@hire.abtalks.dev", "demo-day31@abtalks.dev"] } },
    select: { id: true },
  });
  const searchable = await filterSearchableUserIds(cands.map((c) => c.id));
  const [C1, C2] = cands.map((c) => c.id).filter((id) => searchable.has(id));
  if (!C1 || !C2) {
    console.error("Need two searchable candidates (run the hire seeds first).");
    process.exit(1);
  }

  const A = await makeRecruiter("a");
  const B = await makeRecruiter("b");

  try {
    /* 1. New project persists */
    const p1 = await createProject(A.userId, "Frontend Engineer");
    const p2 = await createProject(A.userId, "ML Engineer");
    const stored = await prisma.talentRequest.findUnique({
      where: { id: p1.id },
      select: { name: true, recruiterUserId: true, _count: { select: { sessions: true } } },
    });
    check("1. New project is a persistent, named row owned by the recruiter",
      stored?.name === "Frontend Engineer" && stored.recruiterUserId === A.userId);
    check("   …with no search session until something is searched", stored?._count.sessions === 0);
    check("   …and an empty project is not given a fake Session 1",
      (await ensureLegacySession(p1.id)) === null &&
        (await prisma.talentSearchSession.count({ where: { requestId: p1.id } })) === 0);

    /* 2 + 3. Sessions live inside ONE project, many of them */
    const projectsBefore = await prisma.talentRequest.count({ where: { recruiterUserId: A.userId } });
    const s1 = await createSession({ requestId: p1.id, title: "Find React developers with 2+ years experience", spec: { title: "React developer", mustHaveStack: ["React"] } });
    const s2 = await createSession({ requestId: p1.id, title: "Find senior React + TypeScript developers", spec: { title: "Senior React developer", mustHaveStack: ["React", "TypeScript"] } });
    const s3 = await createSession({ requestId: p1.id, title: "Find React developers in Delhi NCR" });
    const projectsAfter = await prisma.talentRequest.count({ where: { recruiterUserId: A.userId } });
    check("2. New search creates a session in the current project, not a project",
      projectsAfter === projectsBefore && s1.ordinal === 1);
    const listed = await listProjectSessions(A.userId, p1.id);
    check("3. One project holds several sessions (1, 2, 3)",
      listed.length === 3 && s3.ordinal === 3 && listed.map((s) => s.ordinal).join(",") === "3,2,1",
      JSON.stringify(listed.map((s) => s.ordinal)));
    const raced = await Promise.all([1, 2, 3].map(() => createSession({ requestId: p2.id, title: "race" })));
    check("   …concurrent new searches get distinct numbers",
      new Set(raced.map((r) => r.ordinal)).size === 3);

    /* 4. Earlier sessions stay intact */
    await prisma.talentRequestMessage.createMany({
      data: [
        { requestId: p1.id, sessionId: s1.id, role: "user", content: "S1 question" },
        { requestId: p1.id, sessionId: s2.id, role: "user", content: "S2 question" },
      ],
    });
    await upsertMatch(p1.id, C1, 90);
    await recordSessionRun({ sessionId: s1.id, rows: [snap(C1, 90)], overallGap: "s1", matchCount: 1 });
    // Session 2 re-scores C1 and finds C2 — it must not rewrite session 1.
    await upsertMatch(p1.id, C1, 40);
    await upsertMatch(p1.id, C2, 80);
    await recordSessionRun({ sessionId: s2.id, rows: [snap(C2, 80), snap(C1, 40)], overallGap: "s2", matchCount: 2 });
    await prisma.talentSearchSession.update({ where: { id: s2.id }, data: { spec: specToJson({ title: "changed" }) } });
    await pruneUndecidedOutsideSessions(p1.id);

    const s1Back = await getOwnedSession(A.userId, p1.id, s1.id);
    const s1Msgs = await listSessionMessages(s1.id);
    const s1View = await loadRequestMatches(p1.id, A.userId, { sessionId: s1.id });
    const s2View = await loadRequestMatches(p1.id, A.userId, { sessionId: s2.id });
    check("4. A previous session keeps its own brief",
      specFromJson(s1Back?.spec).title === "React developer");
    check("   …its own chat", s1Msgs.length === 1 && s1Msgs[0]!.content === "S1 question");
    check("   …its own results and scoring (C1 at 90, not session 2's 40)",
      s1View?.matches.length === 1 && s1View.matches[0]!.score === 90,
      JSON.stringify(s1View?.matches.map((m) => m.score)));
    check("   …while session 2 shows its own (C2, C1 at 40)",
      s2View?.matches.map((m) => m.score).join(",") === "80,40");
    check("   …and pruning never drops a candidate an older session still shows",
      (await prisma.talentRequestMatch.count({ where: { requestId: p1.id } })) === 2);

    /* 5. Project A and Project B have independent sessions */
    const p2Sessions = await listProjectSessions(A.userId, p2.id);
    check("5. Project B's sessions are its own",
      p2Sessions.every((s) => !listed.some((l) => l.id === s.id)) && p2Sessions.length === 3);
    check("   …and a session id from Project A is not found under Project B",
      (await getOwnedSession(A.userId, p2.id, s1.id)) === null);

    /* 6. Shortlist stays in its project */
    await prisma.talentRequestMatch.update({
      where: { requestId_candidateUserId: { requestId: p1.id, candidateUserId: C1 } },
      data: { decision: "SHORTLISTED" },
    });
    const pod = await podRowsFor(A.userId);
    const inA = scopePodRows(pod, p1.id);
    const inB = scopePodRows(pod, p2.id);
    check("6. Project A's shortlist shows in Project A", inA.some((r) => r.candidateUserId === C1));
    check("   …and not in Project B", inB.length === 0, JSON.stringify(inB));
    check("   …and stays shortlisted across A's sessions",
      (await loadRequestMatches(p1.id, A.userId, { sessionId: s2.id }))?.matches.find(
        (m) => m.candidateUserId === C1,
      )?.decision === "SHORTLISTED");
    // Same person shortlisted in B too: one row in each, never merged.
    await upsertMatch(p2.id, C1, 70);
    await prisma.talentRequestMatch.update({
      where: { requestId_candidateUserId: { requestId: p2.id, candidateUserId: C1 } },
      data: { decision: "SHORTLISTED" },
    });
    const pod2 = await podRowsFor(A.userId);
    check("   …a person shortlisted in both appears once in each project",
      scopePodRows(pod2, p1.id).length === 1 && scopePodRows(pod2, p2.id).length === 1);

    /* 7 + 9. Assessments */
    const aOld = await makeAssessment(A, `Old unassigned ${stamp}`);
    const aFront = await makeAssessment(A, `Frontend test ${stamp}`);
    const linked = await linkProjectAssessment({ recruiterUserId: A.userId, requestId: p1.id, assessmentId: aFront });
    const inProjectA = await listProjectAssessments(A.userId, p1.id);
    const inProjectB = await listProjectAssessments(A.userId, p2.id);
    check("7. An assessment filed under Project A is listed there",
      linked.ok && inProjectA.some((a) => a.id === aFront));
    check("   …and not in Project B", !inProjectB.some((a) => a.id === aFront));
    const unassigned = await listUnassignedAssessments(A.userId);
    check("9. An assessment with no project stays available as Unassigned",
      unassigned.some((a) => a.id === aOld) && !unassigned.some((a) => a.id === aFront));
    await unlinkProjectAssessment({ recruiterUserId: A.userId, assessmentId: aFront });
    check("   …unfiling returns it to Unassigned without deleting it",
      (await listUnassignedAssessments(A.userId)).some((a) => a.id === aFront) &&
        (await prisma.recruiterAssessment.count({ where: { id: aFront } })) === 1);

    /* 8. A legacy project becomes Session 1 with nothing lost */
    const legacy = await prisma.talentRequest.create({
      data: {
        recruiterUserId: A.userId,
        status: "MATCHED",
        title: "Backend engineer",
        mustHaveStack: ["Node.js"],
      },
      select: { id: true },
    });
    await prisma.talentRequestMessage.createMany({
      data: [
        { requestId: legacy.id, role: "user", content: "Backend engineer with Node" },
        { requestId: legacy.id, role: "assistant", content: "Searching…" },
      ],
    });
    await upsertMatch(legacy.id, C2, 77);
    const legacySession = await ensureLegacySession(legacy.id);
    const again = await ensureLegacySession(legacy.id);
    const lSessions = await listProjectSessions(A.userId, legacy.id);
    const lMsgs = legacySession ? await listSessionMessages(legacySession) : [];
    const lView = legacySession
      ? await loadRequestMatches(legacy.id, A.userId, { sessionId: legacySession })
      : null;
    const lSpec = legacySession ? await getOwnedSession(A.userId, legacy.id, legacySession) : null;
    check("8. An existing project's search becomes Session 1", lSessions.length === 1 && lSessions[0]!.ordinal === 1);
    check("   …titled with the recruiter's original prompt", lSessions[0]?.title === "Backend engineer with Node");
    check("   …with all its original messages", lMsgs.length === 2);
    check("   …its original brief", specFromJson(lSpec?.spec).mustHaveStack?.[0] === "Node.js");
    check("   …and its original results", lView?.matches.length === 1 && lView.matches[0]!.score === 77);
    check("   …and doing it again changes nothing", again === null && lSessions.length === 1);

    /* 10. Recruiter isolation */
    check("10. Recruiter B cannot read Recruiter A's session", (await getOwnedSession(B.userId, p1.id, s1.id)) === null);
    check("    …or list A's sessions", (await listProjectSessions(B.userId, p1.id)).length === 0);
    check("    …or load A's results", (await loadRequestMatches(p1.id, B.userId, { sessionId: s1.id })) === null);
    check("    …or see A's shortlist", (await podRowsFor(B.userId)).length === 0);
    check("    …or list A's project assessments", (await listProjectAssessments(B.userId, p1.id)).length === 0);
    const bAssessment = await makeAssessment(B, `B test ${stamp}`);
    const bIntoA = await linkProjectAssessment({ recruiterUserId: B.userId, requestId: p1.id, assessmentId: bAssessment });
    const aTakesB = await linkProjectAssessment({ recruiterUserId: A.userId, requestId: p1.id, assessmentId: bAssessment });
    check("    …or file anything into A's project", !bIntoA.ok);
    check("    …and A cannot file B's assessment", !aTakesB.ok);
    const bUnlinkA = await unlinkProjectAssessment({ recruiterUserId: B.userId, assessmentId: aFront });
    check("    …or unfile A's assessment", !bUnlinkA.ok);
  } finally {
    await prisma.talentProjectAssessment.deleteMany({ where: { request: { recruiterUserId: { in: [A.userId, B.userId] } } } });
    await prisma.recruiterAssessment.deleteMany({ where: { createdByUserId: { in: [A.userId, B.userId] } } });
    await prisma.talentRequest.deleteMany({ where: { recruiterUserId: { in: [A.userId, B.userId] } } });
    await prisma.organizationMember.deleteMany({ where: { userId: { in: [A.userId, B.userId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [A.organizationId, B.organizationId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [A.userId, B.userId] } } });
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
