import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import {
  ACTIVITY_DISCLAIMER,
  CAMERA_DISCLAIMER,
  SUMMARY_COPY,
  formatDuration,
  type ActivitySummary,
  type IntervalKind,
} from "@/features/assessment-attempts/activity";
import {
  explainAttemptOutcome,
  isPenaltyReason,
  type AdminAttemptDetail,
  type AttemptQuestionDetail,
} from "@/features/admin/attempt-outcome";
import { formatDateTimeIST } from "@/lib/date-utils";

/**
 * T-265 — one candidate's assessment attempt, for Platform Admin.
 *
 * Server Component. Read-only: no `"use client"`, no `@/app/actions/*`, no
 * control that changes a result. An admin reads what happened and can say why;
 * re-grading and re-opening are not on this surface.
 *
 * The activity half is the recruiter attempt page's own copy
 * (`SUMMARY_COPY`, `ACTIVITY_DISCLAIMER`, `CAMERA_DISCLAIMER`) rather than a
 * second wording of the same facts, so the admin and the recruiter cannot end up
 * reading the same attempt differently.
 */

const STATUS_LABEL: Record<AdminAttemptDetail["status"], string> = {
  ASSIGNED: "Not started",
  STARTED: "In progress",
  SUBMITTED: "Submitted",
};

const TYPE_LABEL: Record<AttemptQuestionDetail["type"], string> = {
  MULTIPLE_CHOICE: "Multiple choice",
  PARAGRAPH: "Paragraph",
  FILE_UPLOAD: "File link",
};

const TILE_KINDS: IntervalKind[] = [
  "FULLSCREEN",
  "HIDDEN",
  "UNFOCUSED",
  "PAGE_CLOSED",
];

/** Timeline rows carry the clock only — the date is in the facts above them. */
function formatTimeIST(d: Date): string {
  return d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E9E9E9] bg-white p-5">
      <h2 className="font-display text-base font-semibold text-[#353535]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="text-sm text-[#353535]">
      <span className="text-[#787878]">{label}:</span> {children}
    </p>
  );
}

function Chip({
  tone,
  children,
}: {
  tone: "good" | "bad" | "warn" | "muted";
  children: ReactNode;
}) {
  const style =
    tone === "good"
      ? "border-[#A7E8D2] bg-[#D6F7EC] text-[#197E23]"
      : tone === "bad"
        ? "border-[#FFCDC4] bg-[#FFF2F0] text-[#D92D20]"
        : tone === "warn"
          ? "border-[#FFE2B8] bg-[#FFF7EB] text-[#B54708]"
          : "border-[#E9E9E9] bg-[#F6F6F6] text-[#5C5C5C]";
  return (
    <span
      className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${style}`}
    >
      {children}
    </span>
  );
}

function outcomeChip(q: AttemptQuestionDetail) {
  switch (q.outcome) {
    case "CORRECT":
      return <Chip tone="good">Correct · {q.earnedPoints} pts</Chip>;
    case "INCORRECT":
      return <Chip tone="bad">Incorrect · 0 of {q.points} pts</Chip>;
    case "NO_KEY":
      return <Chip tone="warn">No correct option marked · 0 of {q.points} pts</Chip>;
    default:
      return <Chip tone="muted">Not auto-graded</Chip>;
  }
}

function QuestionCard({ q }: { q: AttemptQuestionDetail }) {
  return (
    <li className="border-b border-[#E9E9E9] py-4 last:border-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-[#353535]">
          Q{q.number}. {q.title}
        </p>
        {outcomeChip(q)}
        {!q.answered ? (
          <Chip tone={q.isRequired ? "bad" : "muted"}>
            {q.isRequired ? "Required · unanswered" : "Unanswered"}
          </Chip>
        ) : null}
        {q.overWordLimit ? <Chip tone="warn">Over the word limit</Chip> : null}
      </div>

      <p className="mt-1 text-xs text-[#8F8F8F]">
        {TYPE_LABEL[q.type]} · {q.points} {q.points === 1 ? "pt" : "pts"}
        {q.isRequired ? " · required" : " · optional"}
        {q.savedAt ? ` · last saved ${formatDateTimeIST(q.savedAt)}` : ""}
      </p>
      {q.helpText ? (
        <p className="mt-1 text-xs text-[#787878]">{q.helpText}</p>
      ) : null}

      {q.type === "MULTIPLE_CHOICE" ? (
        <ul className="mt-2 space-y-1">
          {q.options.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span
                className={
                  o.selected ? "font-medium text-[#353535]" : "text-[#5C5C5C]"
                }
              >
                {o.body}
              </span>
              {o.selected ? <Chip tone="muted">Candidate chose this</Chip> : null}
              {o.isCorrect ? <Chip tone="good">Correct answer</Chip> : null}
            </li>
          ))}
          {q.options.length === 0 ? (
            <li className="text-sm text-[#787878]">This question has no options.</li>
          ) : null}
        </ul>
      ) : null}

      {q.type === "PARAGRAPH" ? (
        q.text && q.text.trim().length > 0 ? (
          <>
            <p className="mt-2 whitespace-pre-wrap rounded-lg bg-[#F6F6F6] p-3 text-sm text-[#353535]">
              {q.text}
            </p>
            <p className="mt-1 text-xs text-[#8F8F8F]">
              {q.wordCount} words
              {q.maxWords != null ? ` · limit ${q.maxWords}` : ""}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-[#787878]">Nothing was written.</p>
        )
      ) : null}

      {q.type === "FILE_UPLOAD" ? (
        <div className="mt-2 space-y-1 text-sm">
          {q.fileUrl && q.fileUrl.trim().length > 0 ? (
            <p>
              <span className="text-[#787878]">Link the candidate pasted:</span>{" "}
              <a
                className="inline-flex items-center gap-1 break-all text-[#03535F] underline"
                href={q.fileUrl}
                target="_blank"
                rel="noreferrer nofollow"
              >
                {q.fileUrl} <ExternalLink className="size-3 shrink-0" />
              </a>
            </p>
          ) : (
            <p className="text-[#787878]">No link was pasted.</p>
          )}
          {q.uploadDestinationUrl ? (
            <p className="text-xs text-[#8F8F8F]">
              The recruiter asked for the file at {q.uploadDestinationUrl}. ABTalks
              stores no files — the answer is the candidate&apos;s own link.
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function CandidateAttemptDetail({
  detail,
  activity,
}: {
  detail: AdminAttemptDetail;
  activity: ActivitySummary | null;
}) {
  const explanation = explainAttemptOutcome(detail);
  const g = detail.grading;
  const submitted = detail.status === "SUBMITTED";
  const tone = !submitted
    ? "muted"
    : detail.passed === true
      ? "good"
      : detail.passed === false
        ? "bad"
        : "warn";

  return (
    <div className="space-y-4">
      <Section title="What happened">
        <div
          className={`rounded-lg border p-4 ${
            tone === "good"
              ? "border-[#A7E8D2] bg-[#D6F7EC]"
              : tone === "bad"
                ? "border-[#FFCDC4] bg-[#FFF2F0]"
                : tone === "warn"
                  ? "border-[#FFE2B8] bg-[#FFF7EB]"
                  : "border-[#E9E9E9] bg-[#F6F6F6]"
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              tone === "good"
                ? "text-[#197E23]"
                : tone === "bad"
                  ? "text-[#D92D20]"
                  : tone === "warn"
                    ? "text-[#B54708]"
                    : "text-[#353535]"
            }`}
          >
            {explanation.headline}
          </p>
          <ul className="mt-2 space-y-1">
            {explanation.lines.map((line) => (
              <li key={line} className="text-sm text-[#5C5C5C]">
                {line}
              </li>
            ))}
          </ul>
        </div>

        {explanation.warnings.length > 0 ? (
          <div className="mt-3 rounded-lg border border-[#FFE2B8] bg-[#FFF7EB] p-4">
            <p className="text-xs font-medium uppercase tracking-[0.06em] text-[#B54708]">
              Worth knowing before you answer for this result
            </p>
            <ul className="mt-2 space-y-1">
              {explanation.warnings.map((w) => (
                <li key={w} className="text-sm text-[#5C5C5C]">
                  {w}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      <Section title="Attempt">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="muted">{STATUS_LABEL[detail.status]}</Chip>
          {submitted && detail.passed !== null ? (
            <Chip tone={detail.passed ? "good" : "bad"}>
              {detail.passed ? "Passed" : "Failed"}
            </Chip>
          ) : null}
          {isPenaltyReason(detail.endReason) ? (
            <Chip tone="bad">Ended on a strict-mode limit</Chip>
          ) : null}
          {detail.assessment.strictMode ? (
            <Chip tone="muted">Strict mode</Chip>
          ) : (
            <Chip tone="muted">No activity recording</Chip>
          )}
          {detail.assessment.cameraRequired ? (
            <Chip tone="muted">Camera required</Chip>
          ) : null}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Fact label="Result">
            {detail.scorePercent != null
              ? `${detail.scorePercent}% · pass mark ${detail.assessment.passMarkPercent}%`
              : `No score recorded · pass mark ${detail.assessment.passMarkPercent}%`}
          </Fact>
          <Fact label="Auto-graded points">
            {g.earnedPoints} of {g.totalPoints}
          </Fact>
          <Fact label="Assigned">{formatDateTimeIST(detail.assignedAt)}</Fact>
          <Fact label="Started">
            {detail.startedAt ? formatDateTimeIST(detail.startedAt) : "—"}
          </Fact>
          <Fact label="Submitted">
            {detail.submittedAt ? formatDateTimeIST(detail.submittedAt) : "—"}
          </Fact>
          <Fact label="Time limit">
            {detail.assessment.durationMinutes != null
              ? `${detail.assessment.durationMinutes} min`
              : "Untimed"}
          </Fact>
          <Fact label="Assigned by">
            {[detail.assessment.createdByName, detail.assessment.organizationName]
              .filter(Boolean)
              .join(" · ") || "—"}
          </Fact>
          <Fact label="Shortlist handle">{detail.candidateRef}</Fact>
        </div>

        {detail.assessment.instructions ? (
          <p className="mt-3 whitespace-pre-wrap rounded-lg bg-[#F6F6F6] p-3 text-sm text-[#5C5C5C]">
            {detail.assessment.instructions}
          </p>
        ) : null}
      </Section>

      <Section title="Answers">
        <p className="text-sm text-[#787878]">
          {g.correctCount} correct · {g.incorrectCount} incorrect ·{" "}
          {g.notAutoGradedCount} not auto-graded · {g.unansweredCount} unanswered
        </p>
        {detail.questions.length === 0 ? (
          <p className="mt-3 text-sm text-[#787878]">
            This assessment has no questions.
          </p>
        ) : (
          <ul className="mt-2">
            {detail.questions.map((q) => (
              <QuestionCard key={q.questionId} q={q} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Recorded activity (integrity signals)">
        {activity === null ? (
          <p className="text-sm text-[#787878]">
            {detail.status === "ASSIGNED"
              ? "Nothing was recorded — the candidate never opened the assessment."
              : "Activity isn't recorded for this assessment — it was published before strict mode."}
          </p>
        ) : (
          <>
            <div className="space-y-2 rounded-lg bg-[#F6F6F6] p-3 text-xs text-[#5C5C5C]">
              <p>{ACTIVITY_DISCLAIMER}</p>
              {detail.assessment.cameraRequired ? <p>{CAMERA_DISCLAIMER}</p> : null}
            </div>

            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-[#E9E9E9] p-3">
                <dt className="text-xs text-[#8F8F8F]">{SUMMARY_COPY.away.label}</dt>
                <dd className="text-lg font-semibold text-[#353535]">
                  {formatDuration(activity.awayMs)}
                </dd>
                <p className="mt-1 text-xs text-[#787878]">{SUMMARY_COPY.away.help}</p>
                {activity.awayAfterUploadLinkMs > 0 ? (
                  <p className="mt-1 text-xs text-[#787878]">
                    {SUMMARY_COPY.awayAfterUploadLink.help(
                      formatDuration(activity.awayAfterUploadLinkMs),
                    )}
                  </p>
                ) : null}
              </div>

              {TILE_KINDS.map((kind) => {
                const t = activity.totals[kind];
                const copy = SUMMARY_COPY[kind];
                return (
                  <div key={kind} className="rounded-lg border border-[#E9E9E9] p-3">
                    <dt className="text-xs text-[#8F8F8F]">{copy.label}</dt>
                    <dd className="text-lg font-semibold text-[#353535]">
                      {kind === "FULLSCREEN"
                        ? SUMMARY_COPY.FULLSCREEN.help(t.times, formatDuration(t.ms))
                        : `${t.times} · ${formatDuration(t.ms)}`}
                    </dd>
                    {kind === "FULLSCREEN" ? null : (
                      <p className="mt-1 text-xs text-[#787878]">
                        {typeof copy.help === "string" ? copy.help : null}
                      </p>
                    )}
                    {t.withoutReturn > 0 ? (
                      <p className="mt-1 text-xs text-[#B54708]">
                        {SUMMARY_COPY.withoutReturn.help(t.withoutReturn)}
                      </p>
                    ) : null}
                  </div>
                );
              })}

              {detail.assessment.cameraRequired ? (
                <div className="rounded-lg border border-[#E9E9E9] p-3">
                  <dt className="text-xs text-[#8F8F8F]">
                    {SUMMARY_COPY.CAMERA_OFF.label}
                  </dt>
                  <dd className="text-lg font-semibold text-[#353535]">
                    {activity.totals.CAMERA_OFF.times} ·{" "}
                    {formatDuration(activity.totals.CAMERA_OFF.ms)}
                  </dd>
                  <p className="mt-1 text-xs text-[#787878]">
                    {SUMMARY_COPY.CAMERA_OFF.help}
                  </p>
                </div>
              ) : null}

              <div className="rounded-lg border border-[#E9E9E9] p-3">
                <dt className="text-xs text-[#8F8F8F]">{SUMMARY_COPY.clipboard.label}</dt>
                <dd className="text-lg font-semibold text-[#353535]">
                  {activity.clipboardBlocked}
                </dd>
                <p className="mt-1 text-xs text-[#787878]">{SUMMARY_COPY.clipboard.help}</p>
              </div>
              <div className="rounded-lg border border-[#E9E9E9] p-3">
                <dt className="text-xs text-[#8F8F8F]">{SUMMARY_COPY.links.label}</dt>
                <dd className="text-lg font-semibold text-[#353535]">
                  {activity.linksPasted}
                </dd>
                <p className="mt-1 text-xs text-[#787878]">{SUMMARY_COPY.links.help}</p>
              </div>
              <div className="rounded-lg border border-[#E9E9E9] p-3">
                <dt className="text-xs text-[#8F8F8F]">{SUMMARY_COPY.sessions.label}</dt>
                <dd className="text-lg font-semibold text-[#353535]">
                  {activity.sessionCount}
                </dd>
                <p className="mt-1 text-xs text-[#787878]">{SUMMARY_COPY.sessions.help}</p>
              </div>
            </dl>

            {activity.limitReached ? (
              <p className="mt-3 text-xs text-[#B54708]">{SUMMARY_COPY.limit.help}</p>
            ) : null}

            <h3 className="mt-5 text-xs font-medium uppercase tracking-[0.06em] text-[#8F8F8F]">
              Timeline
            </h3>
            {activity.timeline.length === 0 ? (
              <p className="mt-2 text-sm text-[#787878]">
                No activity was recorded yet.
              </p>
            ) : (
              <ol className="mt-2 space-y-2">
                {activity.timeline.map((entry, i) => (
                  <li
                    key={`${entry.at.toISOString()}-${i}`}
                    className="flex gap-3 text-sm"
                  >
                    <time
                      className="w-20 shrink-0 text-xs text-[#8F8F8F]"
                      dateTime={entry.at.toISOString()}
                    >
                      {formatTimeIST(entry.at)}
                    </time>
                    <ul className="min-w-0 space-y-0.5 text-[#5C5C5C]">
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
      </Section>
    </div>
  );
}
