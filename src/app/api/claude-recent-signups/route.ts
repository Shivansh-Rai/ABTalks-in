import { Domain } from "@prisma/client";
import { NextResponse } from "next/server";
import { listCandidateProfiles } from "@/repositories/candidate";
import { listChallengePeRows } from "@/repositories/enrollment-state";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await listChallengePeRows({ domains: [Domain.CLAUDE] });
    rows.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    const totalCount = rows.length;
    const recent = rows.slice(0, 20);

    const identities = await listCandidateProfiles(recent.map((e) => e.userId));
    const signups = recent
      .map((e) => {
        const profile = identities.get(e.userId);
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
