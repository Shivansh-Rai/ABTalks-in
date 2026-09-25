"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { COMPENSATION_DISCLAIMER } from "@/features/hire/compensation";
import {
  missionsLine,
  summaryInputFromMatch,
  trackLongLabel,
  verifiedEvidenceSentence,
} from "@/features/hire/candidate-summary";
import {
  recallEvidence,
} from "@/components/hire/evidence-cache";
import { OpenToWorkBadge } from "@/components/hire/hire-card-facts";
import type { MatchCardData } from "@/components/hire/match-card";

function firstAttempt(e: MatchCardData["evidence"]): string | null {
  if (typeof e.cleanPassCount !== "number") return null;
  if (e.cleanPassCount <= 0) return "None recorded";
  return String(e.cleanPassCount);
}

function Cell({ k, v }: { k: string; v: string | null }) {
  return (
    <div>
      <div className="hire-sheet__k">{k}</div>
      <div className={v ? "hire-sheet__v" : "hire-sheet__v is-empty"}>
        {v ?? "Not shared"}
      </div>
    </div>
  );
}

function BackToScout() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="hire-back"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push("/hire");
      }}
    >
      <ChevronLeft aria-hidden="true" />
      Back to Scout
    </button>
  );
}

export function EvidenceResume({ lookup }: { lookup: string }) {
  const [match, setMatch] = useState<MatchCardData | null | undefined>(
    undefined,
  );

  useEffect(() => {
    setMatch(recallEvidence(lookup));
  }, [lookup]);

  if (match === undefined) {
    return (
      <main className="hire-sheet">
        <BackToScout />
        <p className="hire-sheet__missing">Loading evidence…</p>
      </main>
    );
  }

  if (!match) {
    return (
      <main className="hire-sheet">
        <BackToScout />
        <p className="hire-sheet__missing">
          No candidate matches the reference
          {lookup ? (
            <>
              {" "}
              <b>{lookup}</b>
            </>
          ) : (
            " provided"
          )}
          . Run a search in Scout, then open Resume from the card.
        </p>
      </main>
    );
  }

  return (
    <main className="hire-sheet">
      <BackToScout />
      <EvidenceResumeBody match={match} />
    </main>
  );
}

/**
 * The evidence record itself, without a container.
 *
 * Split out so the review panel can render the same record inline instead of
 * sending the recruiter to a new tab — the panel wraps it in
 * `.hire-sheet--embed`, the page in `.hire-sheet`. Returns a fragment so each
 * caller owns its own element.
 */
export function EvidenceResumeBody({
  match,
  showIdentity = true,
}: {
  match: MatchCardData;
  /**
   * The panel already shows the name, location and score in its own header, so
   * it turns this off — repeating them would duplicate the identity a few
   * inches apart, and would nest this <h1> under the panel's <h3>.
   */
  showIdentity?: boolean;
}) {
  const e = match.evidence ?? {};
  const sample = match.candidateRef.startsWith("SAMPLE:");
  const track = trackLongLabel(match.source);
  /**
   * The inspector's copy of this record is the slim one.
   *
   * The panel above it already carries the score, the tier, the experience and
   * the whole ABTalks Evidence story, so repeating them here made Resume a
   * second scoreboard a few inches under the first. `showIdentity` is already
   * the embed flag, so it decides this too rather than adding a second one.
   */
  const embed = !showIdentity;
  const missions = missionsLine({
    source: match.source,
    missionsPassed: e.missionsPassed ?? null,
    totalTrackDays: e.totalTrackDays ?? null,
  });

  return (
    <>
      {showIdentity && (
        <div className="hire-sheet__top">
          <div>
            <h1 className="hire-sheet__name">
              {match.jobRole} <OpenToWorkBadge openToWork={match.openToWork} />
            </h1>
            <p className="hire-sheet__sub">
              {sample
                ? "Sample profile, not a person in the pool"
                : [match.locationLabel, track].filter(Boolean).join(" · ")}
            </p>
          </div>
          {!sample && (
            <div className="hire-sheet__score">
              <b>{match.score}</b>
              <span>out of 100</span>
            </div>
          )}
        </div>
      )}

      <div className="hire-sheet__tags">
        {track && <span className="desk-pill">{track}</span>}
        {!embed && missions && (
          <span className="desk-pill desk-pill--good">{missions}</span>
        )}
        {!embed && e.certificateIssued && (
          <span className="desk-pill desk-pill--good">Certified</span>
        )}
        {!embed &&
          typeof e.yearsExperience === "number" &&
          e.yearsExperience > 0 && (
            <span className="desk-pill">{e.yearsExperience} yrs</span>
          )}
        {!embed && match.tier && match.tier !== "NONE" && !sample && (
          <span className="desk-pill">{match.tier}</span>
        )}
        {match.availabilityUnknown && (
          <span className="desk-pill desk-pill--warn">
            Availability unconfirmed
          </span>
        )}
      </div>

      <div className="hire-sheet__rule" />

      <div className="hire-sheet__grid">
        {/* The scoreboard half of this grid is the embed's duplicate of
            ABTalks Evidence, so it only renders on the standalone page. */}
        {!embed && (
          <>
            <Cell k="AB score" v={sample ? null : `${match.score}/100`} />
            <Cell k="Tier" v={sample ? null : match.tier || null} />
            <Cell
              k="Experience"
              v={
                typeof e.yearsExperience === "number"
                  ? `${e.yearsExperience} yrs`
                  : null
              }
            />
            <Cell k="Missions" v={missions} />
            <Cell k="First-attempt" v={firstAttempt(e)} />
            <Cell
              k="Verified commits"
              v={
                typeof e.commitDayCount === "number"
                  ? String(e.commitDayCount)
                  : null
              }
            />
            <Cell
              k="Projects"
              v={
                e.projectScores?.length
                  ? e.projectScores.join(" / ")
                  : null
              }
            />
            <Cell
              k="Quiz average"
              v={typeof e.quizAverage === "number" ? String(e.quizAverage) : null}
            />
            <Cell k="Certificate" v={e.certificateIssued ? "Issued" : null} />
            <Cell
              k="Cohort day"
              v={typeof e.cohortDay === "number" ? `Day ${e.cohortDay}` : null}
            />
          </>
        )}
        <Cell k="Track" v={track} />
        <Cell k="Location" v={match.locationLabel ?? null} />
        <Cell
          k="Languages"
          v={(e.workingLanguages ?? []).join(" · ") || null}
        />
        <Cell k="Est. compensation" v={match.compensationBand ?? null} />
      </div>

      {!embed && (
        <section className="hire-sheet__section">
          <h2 className="hire-sheet__h">Verified evidence</h2>
          <p className="hire-sheet__p">
            {verifiedEvidenceSentence(summaryInputFromMatch(match))}
          </p>
        </section>
      )}

      {!embed && (e.skills?.length ?? 0) > 0 && (
        <section className="hire-sheet__section">
          <h2 className="hire-sheet__h">Skills declared by the candidate</h2>
          <div className="hire-sheet__tags" style={{ marginTop: 0 }}>
            {e.skills!.map((s) => (
              <span key={s} className="desk-pill">
                {s}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* No Gaps section. Scoring still computes them; they are not something a
          recruiter reads about a named person on a search surface. */}

      {/* <p className="hire-sheet__note">
        This is an ABTalks evidence record, not a self-written resume. Mission,
        first-attempt, commit and project figures are verified by the platform.
        Experience, skills and role are declared by the candidate.
        {match.compensationBand ? ` ${COMPENSATION_DISCLAIMER}` : ""}{" "}
        Compensation and availability are confirmed at outreach.
      </p> */}
    </>
  );
}
