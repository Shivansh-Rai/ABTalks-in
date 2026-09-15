import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRecruiter } from "@/lib/program-auth";
import { requireRecruiterWorkspace } from "@/features/recruiter-workspace/workspace";
import {
  endReasonCopy,
  getAttemptActivity,
  isPenalty,
} from "@/features/recruiter-assessments/service";
import { prismaAssessmentStore } from "@/features/recruiter-assessments/prisma-store";
import {
  ACTIVITY_DISCLAIMER,
  CAMERA_DISCLAIMER,
  SUMMARY_COPY,
  formatDuration,
  type IntervalKind,
} from "@/features/assessment-attempts/activity";
import { formatDateTimeIST } from "@/lib/date-utils";

type Props = { params: Promise<{ assessmentId: string; assignmentId: string }> };
export const metadata: Metadata = { title: "Candidate activity | ABTalks Hire" };

const TILE_KINDS: IntervalKind[] = [
  "FULLSCREEN",
  "HIDDEN",
  "UNFOCUSED",
  "PAGE_CLOSED",
];

function formatTimeIST(d: Date): string {
  return d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default async function AttemptActivityPage({ params }: Props) {
  await requireRecruiter();
  const workspace = await requireRecruiterWorkspace();
  if (!workspace.ok) notFound();
  const { assessmentId, assignmentId } = await params;
  const found = await getAttemptActivity(
    prismaAssessmentStore(),
    { organizationId: workspace.data.organizationId, createdByUserId: workspace.data.userId },
    assessmentId,
    assignmentId,
    new Date(),
  );
  if (!found.ok) notFound(); // foreign, unknown, or the id of another assessment's attempt

  const { row, summary } = found.data;
  const facts: string[] = [];
  if (row.startedAt) facts.push(`Started ${formatDateTimeIST(row.startedAt)}`);
  if (row.submittedAt) {
    facts.push(`Submitted ${formatDateTimeIST(row.submittedAt)}`);
    if (row.startedAt) {
      facts.push(`Took ${formatDuration(row.submittedAt.getTime() - row.startedAt.getTime())}`);
    }
  } else if (summary) {
    facts.push("In progress — totals so far");
  }

  return (
    <div className="hire-assess-list hire-assess-activity">
      <Link href={`/hire/assessments/${assessmentId}`} className="hire-assess-detail__back">
        ← {row.assessment.title}
      </Link>

      <header className="hire-assess-detail__head">
        <p className="hire-assess__kicker">Candidate activity</p>
        <div className="hire-assess-detail__title">
          <h1>{row.label}</h1>
          {isPenalty(row.endReason) ? <span className="hire-assess-penalty">Penalty</span> : null}
        </div>
        {facts.length > 0 ? (
          <p className="hire-assess-detail__facts">{facts.join(" · ")}</p>
        ) : null}
        {endReasonCopy(row.endReason) ? (
          <p
            className="hire-assess-detail__facts"
            data-tone={isPenalty(row.endReason) ? "penalty" : undefined}
          >
            {endReasonCopy(row.endReason)}
          </p>
        ) : null}
      </header>

      {summary === null ? (
        <p>Activity isn&apos;t recorded for this assessment — it was published before strict mode.</p>
      ) : (
        <>
          <div className="hire-assess-activity__disclaimer">
            <p>{ACTIVITY_DISCLAIMER}</p>
            {row.assessment.cameraRequired ? <p>{CAMERA_DISCLAIMER}</p> : null}
          </div>

          <dl className="hire-assess-activity__tiles">
            <div className="hire-assess-activity__tile">
              <dt>{SUMMARY_COPY.away.label}</dt>
              <dd>{formatDuration(summary.awayMs)}</dd>
              <p>{SUMMARY_COPY.away.help}</p>
              {summary.awayAfterUploadLinkMs > 0 ? (
                <p>
                  {SUMMARY_COPY.awayAfterUploadLink.help(
                    formatDuration(summary.awayAfterUploadLinkMs),
                  )}
                </p>
              ) : null}
            </div>
            {TILE_KINDS.map((kind) => {
              const t = summary.totals[kind];
              const copy = SUMMARY_COPY[kind];
              return (
                <div key={kind} className="hire-assess-activity__tile">
                  <dt>{copy.label}</dt>
                  <dd>
                    {kind === "FULLSCREEN"
                      ? SUMMARY_COPY.FULLSCREEN.help(t.times, formatDuration(t.ms))
                      : `${t.times} · ${formatDuration(t.ms)}`}
                  </dd>
                  {kind === "FULLSCREEN" ? null : (
                    <p>{typeof copy.help === "string" ? copy.help : null}</p>
                  )}
                  {t.withoutReturn > 0 ? (
                    <p className="hire-assess-activity__notice">
                      {SUMMARY_COPY.withoutReturn.help(t.withoutReturn)}
                    </p>
                  ) : null}
                </div>
              );
            })}
            {row.assessment.cameraRequired ? (
              <div className="hire-assess-activity__tile">
                <dt>{SUMMARY_COPY.CAMERA_OFF.label}</dt>
                <dd>
                  {summary.totals.CAMERA_OFF.times} ·{" "}
                  {formatDuration(summary.totals.CAMERA_OFF.ms)}
                </dd>
                <p>{SUMMARY_COPY.CAMERA_OFF.help}</p>
                {summary.totals.CAMERA_OFF.withoutReturn > 0 ? (
                  <p className="hire-assess-activity__notice">
                    {SUMMARY_COPY.withoutReturn.help(summary.totals.CAMERA_OFF.withoutReturn)}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="hire-assess-activity__tile">
              <dt>{SUMMARY_COPY.clipboard.label}</dt>
              <dd>{summary.clipboardBlocked}</dd>
              <p>{SUMMARY_COPY.clipboard.help}</p>
            </div>
            <div className="hire-assess-activity__tile">
              <dt>{SUMMARY_COPY.links.label}</dt>
              <dd>{summary.linksPasted}</dd>
              <p>{SUMMARY_COPY.links.help}</p>
            </div>
            <div className="hire-assess-activity__tile">
              <dt>{SUMMARY_COPY.sessions.label}</dt>
              <dd>{summary.sessionCount}</dd>
              <p>{SUMMARY_COPY.sessions.help}</p>
            </div>
          </dl>
          {summary.limitReached ? (
            <p className="hire-assess-activity__notice">{SUMMARY_COPY.limit.help}</p>
          ) : null}

          {summary.timeline.length === 0 ? (
            <p>No activity was recorded yet.</p>
          ) : (
            <ol className="hire-assess-activity__timeline">
              {summary.timeline.map((entry, i) => (
                <li key={`${entry.at.toISOString()}-${i}`}>
                  <time className="hire-assess-activity__time" dateTime={entry.at.toISOString()}>
                    {formatTimeIST(entry.at)}
                  </time>
                  <ul className="hire-assess-activity__lines">
                    {entry.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
