import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRecruiter } from "@/lib/program-auth";
import { requireRecruiterWorkspace } from "@/features/recruiter-workspace/workspace";
import {
  getAssessmentMonitor,
  type AssignmentRow,
} from "@/features/recruiter-assessments/service";
import { prismaAssessmentStore } from "@/features/recruiter-assessments/prisma-store";
import { AssessmentAssignPanel } from "@/components/hire/assessment/assessment-assign-panel";

type Props = { params: Promise<{ assessmentId: string }> };

export const metadata: Metadata = { title: "Assessment | ABTalks Hire" };
// Assign sends up to MAX_ASSIGN_PER_CALL notifications inline; the server
// action runs under this page's function limit.
export const maxDuration = 60;

const STATUS_COPY: Record<AssignmentRow["status"], string> = {
  ASSIGNED: "Not started",
  STARTED: "In progress",
  SUBMITTED: "Completed",
};

function formatWhen(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function resultCopy(a: AssignmentRow): string {
  if (a.passed === true) return "Passed";
  if (a.passed === false) return "Failed";
  if (a.status === "SUBMITTED") return "Awaiting result";
  return "—";
}

export default async function HireAssessmentDetailPage({ params }: Props) {
  await requireRecruiter();
  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) notFound();
  const { assessmentId } = await params;
  const monitor = await getAssessmentMonitor(
    prismaAssessmentStore(),
    {
      organizationId: workspace.data.organizationId,
      createdByUserId: workspace.data.userId,
    },
    assessmentId,
  );
  // A foreign or unknown id is a 404, never a 403 — ids are not enumerable.
  if (!monitor.ok) notFound();

  const { assessment, summary, assignments, candidates } = monitor.data;
  const isDraft = assessment.status === "DRAFT";
  // Job role is a Shortlist fact, so it shows for anyone still shortlisted.
  const roleByRef = new Map(candidates.map((c) => [c.candidateRef, c.jobRole]));

  const facts = [
    `${assessment.questionCount} ${assessment.questionCount === 1 ? "question" : "questions"}`,
    assessment.durationMinutes == null
      ? "Untimed"
      : `${assessment.durationMinutes} min`,
    `Pass mark ${assessment.passMarkPercent}%`,
  ];
  if (assessment.publishedAt) {
    facts.push(`Published ${formatWhen(assessment.publishedAt)}`);
  }

  const stats = [
    { label: "Assigned", value: summary.assigned },
    { label: "Started", value: summary.started },
    { label: "Completed", value: summary.completed },
    { label: "Passed", value: summary.passed },
    { label: "Failed", value: summary.failed },
  ];

  return (
    <div className="hire-assess-list hire-assess-detail">
      <Link href="/hire/assessments" className="hire-assess-detail__back">
        ← All assessments
      </Link>

      <header className="hire-assess-detail__head">
        <p className="hire-assess__kicker">Recruiter assessment</p>
        <div className="hire-assess-detail__title">
          <h1>{assessment.title}</h1>
          <span className="hire-assess-list__status">{assessment.status}</span>
        </div>
        <p className="hire-assess-detail__facts">{facts.join(" · ")}</p>
      </header>

      {!isDraft && (
        <dl className="hire-assess-detail__stats">
          {stats.map((s) => (
            <div key={s.label} className="hire-assess-detail__stat">
              <dt>{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <AssessmentAssignPanel
        assessmentId={assessment.id}
        status={assessment.status}
        candidates={candidates}
      />

      {isDraft ? (
        <p className="hire-assess-list__footnote">
          This is a draft. Publish it to assign candidates — publishing locks the
          questions and pass mark.
        </p>
      ) : (
        <section className="hire-assess-detail__monitor" aria-label="Assigned candidates">
          <h2>Assigned candidates</h2>
          {assignments.length === 0 ? (
            <div className="hire-assess-list__empty">
              <p>No candidates assigned yet. Pick candidates from your Shortlist above.</p>
            </div>
          ) : (
            <div className="hire-assess-list__table-wrap">
              <table className="hire-assess-list__table hire-assess-detail__table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Status</th>
                    <th>Assigned</th>
                    <th>Started</th>
                    <th>Completed</th>
                    <th>Score</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => {
                    const role = roleByRef.get(a.candidateRef);
                    return (
                      <tr key={a.id}>
                        <td>
                          <span className="hire-assess-detail__who">{a.label}</span>
                          {role && (
                            <span className="hire-assess-detail__role">{role}</span>
                          )}
                        </td>
                        <td>{STATUS_COPY[a.status]}</td>
                        <td>{formatWhen(a.assignedAt)}</td>
                        <td>{formatWhen(a.startedAt)}</td>
                        <td>{formatWhen(a.submittedAt)}</td>
                        <td>{a.scorePercent == null ? "—" : `${a.scorePercent}%`}</td>
                        <td>{resultCopy(a)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
