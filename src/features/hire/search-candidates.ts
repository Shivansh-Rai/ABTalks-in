import "server-only";

import { errorFields, logger } from "@/lib/logger";
import type { JobSpec } from "@/lib/validations/hire";
import { selectSearchResults } from "@/features/hire/score-candidate";
import { hasSearchCriteria, readPoolExtra } from "@/features/hire/pool-brief";
import { estimateCompensation } from "@/features/hire/compensation";
import { enabledTracks, isKnownTrack } from "@/features/hire/track-registry";
import {
  EMPTY_COVERAGE,
  attachRoleTitles,
  loadTrack,
  mergeTrackLoads,
} from "@/features/hire/track-loaders";
import type {
  EvidenceCoverage,
  ScoreableMember,
  ScoredCandidate,
} from "@/features/hire/types";

export type SearchCandidatesResult =
  | {
      ok: true;
      data: {
        cohortName: string | null;
        /** Whether the pool is a finished cohort or one still running. */
        stage: "PUBLISHED" | "OPEN_MIDCOHORT" | null;
        matches: ScoredCandidate[];
        /** Near-miss / hard-filtered, for gap analysis only (not shortlist). */
        nearMisses: ScoredCandidate[];
        totalEligible: number;
        /** Consenting members held back by the evidence floor — the honest
         *  denominator behind a thin shortlist. */
        belowEvidenceFloor: number;
        coverage: EvidenceCoverage;
        /**
         * Tracks that threw and were swallowed, so this pool is incomplete.
         *
         * Empty on every healthy search. Non-empty means the caller is holding
         * a partial answer and should say so rather than present it as the
         * whole pool — a recruiter cannot judge a shortlist they do not know is
         * truncated.
         */
        failedTracks: string[];
        /**
         * What actually decided the order the recruiter is looking at.
         *
         * `"score"` is the normal case. `"evidence"` means the score could not
         * separate these people — every shown candidate scored the same — so the
         * order is "fullest profile first" rather than a quality ranking, and
         * the surface should say so instead of implying a judgement the engine
         * did not make.
         *
         * This is reachable, and not rarely. A search naming only must-have
         * skills pre-filters the pool to people who hold them, which makes
         * `stackScore` a constant (`1 x 0.75 + 0.5 x 0.25`); for profile-only
         * candidates every evidence dimension is uncovered and drops out. On
         * 2026-10-07, four of sixteen real recruiter queries came back with a
         * single distinct score across the whole top 20.
         */
        rankedBy: "score" | "evidence";
      };
    }
  | { ok: false; message: string };

/**
 * Below this, a shortlist is padded out with the next best people rather than
 * left short. Five is enough to read a pool from; a strict list of one tells
 * the recruiter nothing about who else is here.
 */
export const MIN_RESULTS = 5;

/**
 * How many matches one signed-in search returns.
 *
 * Was 20, which is why the results pager stopped at two pages no matter how
 * large the pool: 20 results over `MATCHES_PER_PAGE = 10` is exactly two
 * (plan 161 §2f).
 *
 * Not unbounded, and the reason is below this line rather than in the pager:
 * every returned match is upserted as a `TalentRequestMatch` row by this same
 * function and is run through `explainMatches`. Sixty is six real pages for a
 * recruiter without turning one search into hundreds of rows and an LLM pass
 * over all of them.
 *
 * The signed-out preview stays at 20 (`hire-guest-actions.ts`) and the alert
 * run stays at 5 (`run-hire-alerts.ts`) — both are deliberate and different.
 */
export const SEARCH_RESULT_LIMIT = 60;

/**
 * How many candidates are loaded before ranking.
 *
 * Scoring is a pure function over an in-memory array, so the cost of the pool is
 * the dossier assembly, never the scoring: 2,573 candidates score in **17 ms**
 * (measured 2026-10-07, alongside 10 ms for 428 and 44 ms for 1,777). The cap
 * has never been protecting the scorer.
 *
 * It was 600, then 2,000. Two thousand BOUND: the PROFILE track has 2,573
 * eligible candidates, so an unfiltered search silently dropped 573 people who
 * all had claimed skills and were perfectly rankable — excluded before ranking
 * rather than ranked and not shown, which is a different and worse thing.
 *
 * Five thousand clears today's pool with headroom. It costs nothing on a
 * skill-named search, because those are already far below it — `python` 1,599,
 * `python+sql` 1,777, `react` 428 — and it only widens the unfiltered case,
 * which is the one that was losing people.
 *
 * What keeps this honest as the pool grows is not the number, it is that the
 * tracks whose caps can bind select on the brief rather than on recency:
 * PROFILE since plan 161 §2g, HACKATHON since 2026-10-08. The other three
 * (CLAUDE 320, CHALLENGE_60 65, PROGRAM 74) are bounded by enrolment and cannot
 * reach this ceiling at all.
 *
 * Challenge rows are ordered by days submitted before the cap, so there the
 * ceiling can still only ever trim the least-evidenced people.
 */
export const CHALLENGE_POOL_CAP = 5000;


/**
 * Phase B: deterministic Prisma load + pure scoring.
 * Never invents candidates. Empty pool → empty arrays (caller's gap UI).
 */
export async function searchCandidates(
  spec: JobSpec,
  opts?: { limit?: number },
): Promise<SearchCandidatesResult> {
  try {
    // An EMPTY spec is not a search, it is a page of whoever ranks highest.
    //
    // This path was reachable in production: the Gemini brief parse fails (a
    // 503, or the 4,000 ms budget against a model that answers in 1.3-4.0 s),
    // the deterministic fallback finds no keyword it recognises, and the spec
    // reduces to `{}`. The old behaviour returned 20 arbitrary candidates,
    // indistinguishable to the recruiter from a real answer to what they typed.
    //
    // A caller that genuinely wants the unfiltered pool asks for it with a
    // track, a skill or an explicit `resultLimit` — all of which make the spec
    // non-empty. So refusing here costs no legitimate caller anything.
    if (!hasSearchCriteria(spec)) {
      return {
        ok: false,
        message:
          "That search had no criteria we could read. Tell us a role, a skill or a source and we will search for it.",
      };
    }
    const extra = readPoolExtra(spec);

    // Which tracks to search, from the registry rather than a fixed set of
    // booleans. An unscoped search means "everything that is open" — previously
    // that was PROGRAM plus CLAUDE by hand, and CHALLENGE_60 and HACKATHON were
    // unreachable unless named, which is not what "no filter" should mean.
    const wanted =
      extra.sources.length > 0
        ? extra.sources.filter((s) => isKnownTrack(s))
        : enabledTracks().map((t) => t.slug);

    // What the brief actually asks for. The PROFILE track uses this to pick who
    // is considered; every other track ignores it (plan 161 §2g).
    const briefSkills = [
      ...(spec.mustHaveStack ?? []),
      ...(spec.niceToHaveStack ?? []),
    ];

    const loads = await Promise.all(
      wanted.map((slug) =>
        loadTrack(slug, {
          minEvidenceDays: extra.minEvidenceDays ?? 0,
          limit: CHALLENGE_POOL_CAP,
          skills: briefSkills,
        }),
      ),
    );

    const merged = mergeTrackLoads(loads);
    const scoreable: ScoreableMember[] = await attachRoleTitles(merged.members);
    const { coverage, belowEvidenceFloor } = merged;

    if (scoreable.length === 0) {
      return {
        ok: true,
        data: {
          cohortName: merged.cohortName,
          stage: merged.stage,
          matches: [],
          nearMisses: [],
          totalEligible: 0,
          belowEvidenceFloor,
          coverage: EMPTY_COVERAGE,
          failedTracks: merged.failedTracks,
          rankedBy: "score",
        },
      };
    }

    const hardCap = extra.resultLimit;
    const limit = hardCap ?? opts?.limit ?? 25;

    // A recruiter with nobody on screen cannot judge the pool, the role or us.
    // So the shortlist is the ranked STRONG/PARTIAL list, and when that comes
    // back thin it is topped up with the next best people the pool has — still
    // carrying their real tier and their real gaps, never dressed up. Chosen
    // from the whole ranked pool, never a truncated window (QA-KI-006).
    const { matches, nearMisses } = selectSearchResults(scoreable, spec, {
      coverage,
      hardCap,
      limit,
      minResults: MIN_RESULTS,
    });

    // The band needs the tier, and the tier needs the score — so the estimate
    // is attached after ranking rather than during dossier assembly, and only
    // for the people this search actually returns.
    for (const r of [...matches, ...nearMisses]) {
      const d = r.dossier;
      if (!d) continue;
      d.compensation.estimate = estimateCompensation({
        roleFamily: d.roleFamily.value,
        yearsExperience: d.yearsExperience.value,
        evidenceTier: r.tier,
        missionsPassed: d.evidence.missionsPassed.value,
      });
    }

    return {
      ok: true,
      data: {
        cohortName: merged.cohortName,
        stage: merged.stage,
        matches,
        nearMisses,
        totalEligible: scoreable.length,
        belowEvidenceFloor,
        coverage,
        failedTracks: merged.failedTracks,
        // One distinct score across every card means the score ranked nobody.
        rankedBy:
          matches.length > 1 && new Set(matches.map((m) => m.score)).size === 1
            ? "evidence"
            : "score",
      },
    };
  } catch (error) {
    logger.error("[hire] searchCandidates failed", { ...errorFields(error) });
    return {
      ok: false,
      message:
        "Could not search the talent pool. If tables are missing, apply the hire migration on a Neon branch first.",
    };
  }
}
