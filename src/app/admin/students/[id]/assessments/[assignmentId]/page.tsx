import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CandidateAttemptDetail } from "@/components/admin/candidate-attempt-detail";
import { getAdminAttemptDetail } from "@/features/admin/get-admin-attempt-detail";
import { requireAdmin } from "@/lib/admin-auth";
import { formatDateIST } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Assessment attempt | ABTalks Admin" };

/**
 * T-265 — what happened to one candidate's assessment.
 *
 * The candidate id comes from the URL and goes into the query alongside the
 * assignment id, so this page can only ever show an attempt that belongs to the
 * candidate named in the path; anything else is a 404.
 */
export default async function AdminCandidateAttemptPage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
}) {
  await requireAdmin();
  const { id, assignmentId } = await params;
  const view = await getAdminAttemptDetail(id, assignmentId);
  if (!view) notFound();

  const { detail, activity } = view;

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/students/${id}`}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1")}
      >
        <ArrowLeft className="size-4" />
        {detail.candidate.name}
      </Link>

      <AdminPageHeader
        title={detail.assessment.title}
        description={[
          detail.assessment.subheading,
          `Assigned ${formatDateIST(detail.assignedAt)}`,
          detail.candidate.email,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      <CandidateAttemptDetail detail={detail} activity={activity} />
    </div>
  );
}
