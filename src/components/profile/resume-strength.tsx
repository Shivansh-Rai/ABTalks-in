import type { ResumeView } from "@/features/resume/types";

/**
 * Resume Strength, as the candidate sees it.
 *
 * The score describes the resume, not a job. It is never labelled ATS, match or
 * compatibility anywhere in this component — no job description was involved in
 * producing it, and a label implying otherwise would be a lie to the candidate.
 *
 * Deliberately small. The engine behind this scores seven weighted categories
 * and stores every one of them, but a candidate reading their own profile does
 * not need a diagnostic panel — they need to know how they are doing and what
 * to do next. Category bars, per-category numbers and a "what is working" list
 * were all removed for that reason; they are still computed, still persisted in
 * `CandidateResume.analysis`, and still available to whatever needs them.
 *
 * A Server Component: it renders plain data and has no interactivity. Styled
 * with the wizard's `pw-*` classes so it matches the sheet it renders inside.
 */

// Design System v2: success / semantic-warning / semantic-error — never orange.
function tone(score: number) {
  if (score >= 75) return { text: "pw-tone-good", bar: "pw-tone-good-bg" };
  if (score >= 50) return { text: "pw-tone-warn", bar: "pw-tone-warn-bg" };
  return { text: "pw-tone-bad", bar: "pw-tone-bad-bg" };
}

export function ResumeStrength({
  strength,
}: {
  strength: NonNullable<ResumeView["strength"]>;
}) {
  const t = tone(strength.overallScore);

  return (
    <div>
      <div className="pw-resume-strength">
        <p className="pw-resume-strength-k">Resume strength</p>

        <div className="pw-resume-score">
          <b className={t.text}>{strength.overallScore}</b>
          <span>/ 100</span>
          <span className="pw-resume-band">{strength.band}</span>
        </div>

        <div
          className="pw-resume-bar"
          role="progressbar"
          aria-valuenow={strength.overallScore}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Resume strength"
        >
          <i
            className={t.bar}
            style={{ width: `${strength.overallScore}%` }}
          />
        </div>

        <p className="pw-resume-caption">
          How complete and well written your resume is on its own — not measured
          against any particular job.
        </p>
      </div>

      {strength.tips.length > 0 ? (
        <div className="pw-resume-tips">
          <h4>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M9 18h6" />
              <path d="M10 22h4" />
              <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z" />
            </svg>
            Areas to improve
          </h4>
          <ul>
            {strength.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
