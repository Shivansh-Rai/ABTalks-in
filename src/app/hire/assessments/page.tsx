import type { Metadata } from "next";
import Link from "next/link";
import { requireRecruiter } from "@/lib/program-auth";
import { requireRecruiterWorkspace } from "@/features/recruiter-workspace/workspace";
import { listAssessments } from "@/features/recruiter-assessments/service";
import { prismaAssessmentStore } from "@/features/recruiter-assessments/prisma-store";
import { listAssessmentPresets } from "@/features/recruiter-assessments/presets";
import { deleteRecruiterAssessmentAction } from "@/app/actions/recruiter-assessment-actions";
import { AssessmentPresetPicker } from "@/components/hire/assessment/preset-picker";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Assessments | ABTalks Hire",
};

async function deleteAssessmentFormAction(formData: FormData) {
  "use server";
  const assessmentId = String(formData.get("assessmentId") ?? "");
  await deleteRecruiterAssessmentAction({ assessmentId });
}

export default async function HireAssessmentsPage() {
  await requireRecruiter();
  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) {
    return (
      <div className="hire-assess-list">
        <p>{workspace.message}</p>
      </div>
    );
  }

  const listed = await listAssessments(prismaAssessmentStore(), {
    organizationId: workspace.data.organizationId,
    createdByUserId: workspace.data.userId,
  });
  const rows = listed.ok ? listed.data : [];
  const presetSummaries = listAssessmentPresets().map((p) => ({
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    tags: p.tags,
    questionCount: p.content.questions.length,
    durationMinutes: p.content.durationMinutes,
  }));

  return (
    <div className="hire-assess-list">
      <div className="hire-assess-list__head">
        <div>
          <p className="hire-assess__kicker">Recruiter assessments</p>
          <h1>Assessments</h1>
        </div>
        <Link
          href="/hire/create-test"
          className={cn(buttonVariants({ variant: "default" }))}
        >
          Create assessment
        </Link>
      </div>

      <AssessmentPresetPicker presets={presetSummaries} />

      {rows.length === 0 ? (
        <div className="hire-assess-list__empty">
          <p>No assessments yet</p>
          <Link href="/hire/create-test" className="hire-assess-linkbtn">
            Create your first assessment
          </Link>
        </div>
      ) : (
        <>
          <div className="hire-assess-list__table-wrap">
            <table className="hire-assess-list__table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Questions</th>
                  <th>Duration</th>
                  <th>Pass mark</th>
                  <th>Status</th>
                  <th>Students</th>
                  <th>Passed</th>
                  <th>Failed</th>
                  <th>Last edited</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link
                        href={`/hire/assessments/${row.id}`}
                        className="hire-assess-list__title"
                      >
                        {row.title}
                      </Link>
                    </td>
                    <td>{row.questionCount}</td>
                    <td>
                      {row.durationMinutes == null
                        ? "Untimed"
                        : `${row.durationMinutes} min`}
                    </td>
                    <td>{row.passMarkPercent}%</td>
                    <td>
                      <span className="hire-assess-list__status">
                        {row.status}
                      </span>
                    </td>
                    <td>{row.results ? row.results.students : "—"}</td>
                    <td>{row.results ? row.results.passed : "—"}</td>
                    <td>{row.results ? row.results.failed : "—"}</td>
                    <td>
                      {row.updatedAt.toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="hire-assess-list__actions">
                      <Link
                        href={`/hire/create-test?id=${row.id}`}
                        className="hire-assess-linkbtn"
                      >
                        Open builder
                      </Link>
                      {row.status === "DRAFT" && (
                        <form action={deleteAssessmentFormAction}>
                          <input
                            type="hidden"
                            name="assessmentId"
                            value={row.id}
                          />
                          <button
                            type="submit"
                            className="hire-assess-linkbtn hire-assess-linkbtn--danger"
                          >
                            Delete
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hire-assess-list__footnote">
            Students counts candidates you assigned. Passed and Failed count
            completed attempts against the pass mark. Drafts show — until
            they&apos;re published.
          </p>
        </>
      )}
    </div>
  );
}
