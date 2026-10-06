import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { AssessmentBuilder } from "@/components/hire/assessment/assessment-builder";
import { PlatformBuilderFrame } from "@/components/admin/platform-builder-frame";
import { rowToBuilderDraft } from "@/features/platform-assessments/service";
import { prismaPlatformStore } from "@/features/platform-assessments/prisma-store";

export const metadata = { title: "Edit assessment | Admin" };

type Props = { params: Promise<{ assessmentId: string }> };

/**
 * Plan 166 — edit a SENT platform assessment. Drafts are edited on the
 * assessment's own page; this page is only for published ones.
 */
export default async function AdminEditSentAssessmentPage({ params }: Props) {
  await requireAdmin();
  const { assessmentId } = await params;
  const store = prismaPlatformStore();

  const row = await store.find(assessmentId);
  if (!row) notFound();
  if (row.status !== "PUBLISHED") {
    redirect(`/admin/assessments/${assessmentId}`);
  }

  const [audienceOptions, startedCount] = await Promise.all([
    store.audienceOptions(),
    store.countStarted(assessmentId),
  ]);

  return (
    // `relative` keeps the builder's sr-only nodes inside admin <main>'s
    // scroll area (see ../../new/page.tsx).
    <div className="relative space-y-4">
      <Link
        href={`/admin/assessments/${assessmentId}`}
        className="text-sm font-medium text-[#03535F] hover:underline"
      >
        ← Back to results
      </Link>
      <PlatformBuilderFrame>
        <AssessmentBuilder
          candidates={[]}
          existingDraft={rowToBuilderDraft(row)}
          platform={{
            audienceOptions,
            sent: {
              deadlineAt: row.deadlineAt?.toISOString() ?? null,
              audience: row.audience,
              startedCount,
            },
          }}
        />
      </PlatformBuilderFrame>
    </div>
  );
}
