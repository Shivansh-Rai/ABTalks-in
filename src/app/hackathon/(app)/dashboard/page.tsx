import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  VIDEOTHON,
  getVideothonSubmissionWindow,
} from "@/features/hackathon-video/config";
import { getMyVideoRegistration } from "@/features/hackathon-video/get-my-registration";
import { VideothonCountdown } from "@/components/hackathon-video/countdown";
import { VideoSubmissionForm } from "@/components/hackathon-video/submission-form";
import "@/components/hackathon-video/landing.css";

export const metadata: Metadata = {
  title: `Your desk · ${VIDEOTHON.name}`,
};

/**
 * VideoThon participant dashboard. A proper full-width workspace, not a
 * shrunken clone of the landing page.
 *
 * Structure:
 *   - Compact top bar: name + status pill + inline countdown
 *   - Two-column main grid:
 *       Left  (primary): Brief (locked until kickoff) + Submission form
 *       Right (aside):   Guidelines checklist + Schedule
 *   - Full-width footer strip: Registration details
 *
 * Does NOT call `registrationRedirect` — VideoThon participants skip the
 * candidate-profile funnel. The only "am I registered" check is the
 * `HackathonVideoRegistration` row; anyone signed in without one goes back
 * to `/hackathon`, where the Register button opens the form.
 */
export default async function VideothonDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?from=/hackathon");
  }

  const registration = await getMyVideoRegistration(session.user.id);
  if (!registration) {
    redirect("/hackathon");
  }

  const window = getVideothonSubmissionWindow();
  const firstName = registration.fullName.split(" ")[0] ?? registration.fullName;
  const phase = window.closed ? "ended" : window.unlocked ? "live" : "pre";
  const pillLabel =
    phase === "ended"
      ? "Wrapped"
      : phase === "live"
        ? "Editing window open"
        : "Registered · Kickoff pending";

  return (
    <div className="vt-mono vt-desk">
      {/* ============ TOP BAR — compact welcome + status + countdown ============ */}
      <header className="vt-desk__bar">
        <div className="vt-desk__bar-meta">
          <p className="vt-desk__eyebrow">
            <span className="vt-desk__dot" data-tone={phase} aria-hidden />
            {VIDEOTHON.name} · Participant desk
          </p>
          <h1 className="vt-desk__hi">
            Welcome, <span className="vt-desk__hi-name">{firstName}</span>
          </h1>
          <span className="vt-desk__status" data-tone={phase}>
            {pillLabel}
          </span>
        </div>
        <div className="vt-desk__bar-timer">
          <VideothonCountdown
            kickoffUtc={VIDEOTHON.kickoffUtc}
            deadlineUtc={VIDEOTHON.deadlineUtc}
          />
        </div>
      </header>

      {/* ============ Brief + Submission side by side ============ */}
      <div className="vt-desk__row vt-desk__row--split">
        {/* --- The brief --- */}
        <section
          className={`vt-card vt-card--dark vt-brief${window.unlocked ? " is-open" : " is-locked"}`}
          aria-labelledby="vt-brief-title"
        >
          <header className="vt-card__head">
            <p className="vt-card__eyebrow">Scene 01 · The brief</p>
            <span className="vt-card__tag" data-tone={window.unlocked ? "live" : "locked"}>
              {window.unlocked ? "Declassified" : "Classified"}
            </span>
          </header>

          {window.unlocked ? (
            <>
              <h2 className="vt-card__title" id="vt-brief-title">
                Your brief
              </h2>
              <p className="vt-brief__text">{VIDEOTHON.brief}</p>
            </>
          ) : (
            <>
              <div className="vt-brief__redacted" aria-hidden>
                <span style={{ width: "94%" }} />
                <span style={{ width: "78%" }} />
                <span style={{ width: "88%" }} />
                <span style={{ width: "62%" }} />
                <span style={{ width: "84%" }} />
              </div>
              <div className="vt-brief__lock">
                <span className="vt-brief__lock-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" focusable="false">
                    <rect x="4" y="10.5" width="16" height="10.5" rx="2.4" />
                    <path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9" />
                  </svg>
                </span>
                <div>
                  <h2 className="vt-card__title" id="vt-brief-title">
                    The brief is locked
                  </h2>
                  <p className="vt-card__body">
                    It drops at kickoff, {VIDEOTHON.kickoffLabel}. Everyone
                    gets it at the same second, straight into the WhatsApp
                    group.
                  </p>
                </div>
              </div>
            </>
          )}

          {VIDEOTHON.whatsappLink ? (
            <Link
              href={VIDEOTHON.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="vt-card__link"
            >
              Open the WhatsApp group
              <svg viewBox="0 0 24 24" aria-hidden focusable="false">
                <path d="M4 12h15M13 6l6 6-6 6" />
              </svg>
            </Link>
          ) : null}
        </section>

        {/* --- Submission --- */}
        <VideoSubmissionForm
          initial={registration.submission}
          editable={window.editable}
          closed={window.closed}
        />
      </div>

      {/* ============ Guidelines (full width, 2-col internal) ============ */}
      <section className="vt-card vt-card--dark" aria-labelledby="vt-guidelines-title">
        <header className="vt-card__head">
          <p className="vt-card__eyebrow" id="vt-guidelines-title">
            Submission guidelines
          </p>
          <span className="vt-card__tag" data-tone="rules">
            Rules · Read before you submit
          </span>
        </header>
        <ul className="vt-guidelines">
          <li>
            <strong>One public link.</strong> Google Drive, Behance, YouTube,
            or Vimeo. Nothing that requires a login or a private account.
          </li>
          <li>
            <strong>Set access to &quot;Anyone with the link can view.&quot;</strong>{" "}
            Judges will not request access; a link they can&apos;t open does
            not count.
          </li>
          <li>
            <strong>Solo entry only.</strong> Individual competition. No
            credited collaborators, no team submissions.
          </li>
          <li>
            <strong>No client or copyrighted work.</strong> Stock is fine if
            it&apos;s licensed for you to use. Cite any sources in the notes.
          </li>
          <li>
            <strong>All editing inside 48 hours.</strong> The cut, grade,
            sound and export happen after kickoff. Disclose any pre-built
            templates.
          </li>
          <li>
            <strong>Re-save until the deadline.</strong> Each save overwrites
            the last one. The last save at the deadline is what the judges
            see.
          </li>
          <li>
            <strong>Late submissions do not count.</strong> Save before the
            timer hits zero.
          </li>
          <li>
            <strong>Notes for the judges are optional.</strong> Use them to
            list software, cite sources, or flag anything unusual about your
            cut.
          </li>
        </ul>
      </section>

      {/* ============ Schedule (full-width horizontal rail) ============ */}
      <section className="vt-card vt-card--dark vt-schedule-strip" aria-labelledby="vt-schedule-title">
        <header className="vt-card__head">
          <p className="vt-card__eyebrow" id="vt-schedule-title">
            Schedule
          </p>
          <span className="vt-card__tag" data-tone="info">
            All times IST
          </span>
        </header>
        <ol className="vt-schedule vt-schedule--horizontal">
          <li className={phase !== "pre" ? "is-past" : "is-next"}>
            <span className="vt-schedule__pip" data-tone="kickoff" aria-hidden />
            <div>
              <p className="vt-schedule__label">Kickoff</p>
              <p className="vt-schedule__value">{VIDEOTHON.kickoffLabel}</p>
            </div>
          </li>
          <li>
            <span className="vt-schedule__pip" data-tone="mid" aria-hidden />
            <div>
              <p className="vt-schedule__label">Halfway check-in</p>
              <p className="vt-schedule__value">Optional pulse in WhatsApp</p>
            </div>
          </li>
          <li className={phase === "ended" ? "is-past" : phase === "live" ? "is-next" : ""}>
            <span className="vt-schedule__pip" data-tone="deadline" aria-hidden />
            <div>
              <p className="vt-schedule__label">Deadline</p>
              <p className="vt-schedule__value">{VIDEOTHON.deadlineLabel}</p>
            </div>
          </li>
          <li className={phase === "ended" ? "is-next" : ""}>
            <span className="vt-schedule__pip" data-tone="results" aria-hidden />
            <div>
              <p className="vt-schedule__label">Results</p>
              <p className="vt-schedule__value">
                {VIDEOTHON.resultsLabel.replace(/^Winners announced: /, "")}
              </p>
            </div>
          </li>
        </ol>
      </section>

      {/* ============ FULL-WIDTH FOOTER: registration on file ============ */}
      <section className="vt-card vt-card--dark vt-registration" aria-labelledby="vt-reg-title">
        <header className="vt-card__head">
          <p className="vt-card__eyebrow" id="vt-reg-title">
            Your registration on file
          </p>
          <span className="vt-card__tag" data-tone="info">
            Read-only
          </span>
        </header>
        <dl className="vt-registration__grid">
          <div>
            <dt>Name</dt>
            <dd>{registration.fullName}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{registration.email}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{registration.phoneDisplay}</dd>
          </div>
          <div>
            <dt>City</dt>
            <dd>{registration.city}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              {registration.employment === "WORKING" ? "Working" : "Learner"}
              {registration.employment === "WORKING" && registration.currentCtc
                ? ` · CTC ${registration.currentCtc}`
                : ""}
            </dd>
          </div>
          <div>
            <dt>Portfolio</dt>
            <dd>
              <a
                href={registration.portfolioUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="vt-registration__link"
              >
                {registration.portfolioUrl}
              </a>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
