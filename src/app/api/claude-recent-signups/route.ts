import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { listCandidateProfiles } from "@/repositories/candidate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const recent = await prisma.enrollment.findMany({
      where: { domain: "CLAUDE" },
      orderBy: { startedAt: "desc" },
      take: 20,
      select: {
        startedAt: true,
        user: {
          select: {
            id: true,
            studentProfile: {
              select: {
                fullName: true,
                userType: true,
                college: true,
                organization: true,
              },
            },
          },
        },
      },
    });

    const totalCount = await prisma.enrollment.count({
      where: { domain: "CLAUDE" },
    });

    const identities = await listCandidateProfiles(recent.map((e) => e.user.id));
    const signups = recent
      .map((e) => {
        const identity = identities.get(e.user.id);
        const profile = identity ?? e.user.studentProfile;
        if (!profile?.fullName) return null;

        const firstName = profile.fullName.split(" ")[0];

        let context = "";
        if (profile.userType === "STUDENT" && profile.college) {
          context =
            profile.college.length > 25
              ? profile.college.slice(0, 22) + "..."
              : profile.college;
        } else if (
          profile.userType === "PROFESSIONAL" &&
          profile.organization
        ) {
          context =
            profile.organization.length > 25
              ? profile.organization.slice(0, 22) + "..."
              : profile.organization;
        }

        return { firstName, context, joinedAt: e.startedAt };
      })
      .filter(
        (s): s is { firstName: string; context: string; joinedAt: Date } =>
          s !== null,
      );

    return NextResponse.json({ signups, totalCount });
  } catch (error) {
    console.error("[claude-recent-signups] error:", error);
    return NextResponse.json({ signups: [], totalCount: 0 });
  }
}
