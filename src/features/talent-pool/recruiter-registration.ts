import "server-only";
import { prisma } from "@/lib/db";
import { provisionRecruiterIdentity } from "@/features/hire/provision-recruiter";
import { studentProfile } from "@/repositories/legacy/student-profile";
import {
  WORK_EMAIL_REQUIRED_MESSAGE,
  isPersonalEmailDomain,
} from "@/lib/validations/work-email";

/**
 * There are two states, and registering is what moves between them.
 *
 * There used to be four: a half-finished setup wizard, an application under
 * review, and an approved account. Registering now provisions the workspace,
 * so a `RecruiterProfile` and a working recruiter are the same thing.
 */
export type RecruiterState =
  | { status: "none" }
  | { status: "active"; fullName: string; company: string };

export type RecruiterDirectoryRow = {
  id: string;
  fullName: string;
  company: string;
  phone: string | null;
  createdAt: string;
  email: string;
  /** Whether the 078 workspace rows exist for this recruiter yet. */
  hasWorkspace: boolean;
  /** Open introduction requests this recruiter has placed. */
  openCandidateAsks: number;
};

/** Everyone who has registered to hire, newest first. Read-only. */
export async function listRecruiters(): Promise<RecruiterDirectoryRow[]> {
  const rows = await prisma.recruiterProfile.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      userId: true,
      fullName: true,
      company: true,
      phone: true,
      createdAt: true,
      user: { select: { email: true } },
    },
  });
  if (rows.length === 0) return [];

  const userIds = rows.map((r) => r.userId);

  // Two grouped queries rather than a query per row.
  const [asks, memberships] = await Promise.all([
    prisma.talentEngagementRequest.groupBy({
      by: ["recruiterUserId"],
      where: {
        recruiterUserId: { in: userIds },
        status: { notIn: ["CLOSED", "DECLINED"] },
      },
      _count: { _all: true },
    }),
    prisma.organizationMember.findMany({
      where: { userId: { in: userIds }, status: "ACTIVE" },
      select: { userId: true },
    }),
  ]);
  const asksByUser = new Map(
    asks.map((a) => [a.recruiterUserId, a._count._all]),
  );
  const withWorkspace = new Set(memberships.map((m) => m.userId));

  return rows.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    company: r.company,
    phone: r.phone,
    createdAt: r.createdAt.toISOString(),
    email: r.user.email ?? "",
    hasWorkspace: withWorkspace.has(r.userId),
    openCandidateAsks: asksByUser.get(r.userId) ?? 0,
  }));
}

/**
 * Read-only on purpose: this runs in the /hire and /talent layouts on every
 * request. Provisioning belongs in `requireRecruiter` /
 * `requireRecruiterWorkspace`, which are gates rather than renders.
 */
export async function getRecruiterState(userId: string): Promise<RecruiterState> {
  const profile = await prisma.recruiterProfile.findUnique({
    where: { userId },
    select: { fullName: true, company: true },
  });
  if (!profile) return { status: "none" };
  return {
    status: "active",
    fullName: profile.fullName,
    company: profile.company,
  };
}

export async function registerRecruiter(
  userId: string,
  input: { fullName: string; company: string; phone?: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const [user, existingStudent, existing] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true },
    }),
    studentProfile.findUnique({
      where: { userId },
      select: { id: true },
    }),
    prisma.recruiterProfile.findUnique({
      where: { userId },
      select: { id: true, approved: true },
    }),
  ]);

  if (!user) return { ok: false, message: "Account not found." };
  if (existingStudent) {
    return {
      ok: false,
      message:
        "Student challenge accounts cannot register as recruiters. Use a separate Google account.",
    };
  }
  if (user.role !== "STUDENT" && user.role !== "RECRUITER") {
    return { ok: false, message: "This account cannot register as a recruiter." };
  }
  if (existing) {
    return { ok: false, message: "You already have recruiter access." };
  }

  const email = user.email?.trim().toLowerCase();

  // The account signing in here may have arrived through Google, which will
  // happily authenticate a personal mailbox. Authenticating is not the same as
  // being a recruiter: a free consumer domain is refused before the seat is
  // even looked at, so a seat can never be the way around it.
  if (isPersonalEmailDomain(email)) {
    return { ok: false, message: WORK_EMAIL_REQUIRED_MESSAGE };
  }

  // A seat is no longer an access grant — registering is. It survives as a
  // pre-verified company name, so a recruiter ABTalks already spoke to gets the
  // name on file rather than whatever they typed into the form.
  const seat = email
    ? await prisma.verifiedRecruiterSeat.findFirst({
        where: { email, active: true, revokedAt: null },
        select: { id: true, company: true },
      })
    : null;

  const company = seat?.company || input.company;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.recruiterProfile.create({
      data: {
        userId,
        fullName: input.fullName,
        company,
        phone: input.phone || null,
        // Written, never read as a gate. See ensureRecruiterWorkspace.
        approved: true,
        approvedAt: now,
        setupStep: "COMPLETE",
        setupCompletedAt: now,
      },
    });
    await tx.user.update({
      where: { id: userId },
      data: { role: "RECRUITER" },
    });
    // Legacy above stays authoritative while ENABLE_NEW_* is off. This writes
    // the 078 identity alongside it so the recruiter product can be built on
    // Organization / OrganizationMember / UserRoleAssignment without waiting for
    // a backfill. See features/hire/provision-recruiter.ts.
    await provisionRecruiterIdentity(tx, { userId, company });
  });

  return { ok: true };
}
