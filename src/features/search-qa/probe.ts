import "server-only";

import {
  hireChallengePool,
  hireOpenCohortIds,
  isNewTalentRepoEnabled,
} from "@/lib/feature-flags";
import type { JobSpec } from "@/lib/validations/hire";
import {
  CHALLENGE_POOL_CAP,
  MIN_RESULTS,
  searchCandidates,
} from "@/features/hire/search-candidates";
import { toPublicMatch } from "@/features/hire/to-public-match";
import { enabledTracks, isKnownTrack } from "@/features/hire/track-registry";
import { attachRoleTitles, loadTrack, mergeTrackLoads } from "@/features/hire/track-loaders";
import { HACKATHON_POOL_TAKE } from "@/repositories/hire";
import type { SearchEnv } from "@/features/search-qa/canonical";
import type {
  PipelineConstants,
  PoolSnapshot,
  TrackLoadInfo,
} from "@/features/search-qa/compare";

/**
 * The ACTUAL side: the recruiter-search pipeline as production runs it.
 *
 * Pools are loaded through the real `loadTrack` / `mergeTrackLoads` with the
 * real caps, then scored in memory by `evaluateSpec`. The only thing this adds
 * is keeping the full ranking. `assertProbeMatchesService` then calls the real
 * `searchCandidates` and fails loudly if the probe's page differs — so the
 * audit can never be measuring a pipeline production does not run.
 */

/** The limit recruiter match runs pass (`runMatchAction`, guest search). */
export const RECRUITER_PAGE_LIMIT = 20;

export const PIPELINE: PipelineConstants = {
  minResults: MIN_RESULTS,
  defaultLimit: RECRUITER_PAGE_LIMIT,
};

export function currentSearchEnv(): SearchEnv {
  return {
    newTalentRead: isNewTalentRepoEnabled(),
    challengePool: hireChallengePool(),
    openCohortIds: hireOpenCohortIds(),
  };
}

function capFor(slug: string): number | null {
  if (slug === "HACKATHON") return HACKATHON_POOL_TAKE;
  if (slug === "CLAUDE" || slug === "CHALLENGE_60" || slug === "PROFILE") return CHALLENGE_POOL_CAP;
  return null;
}

export type LoadedPool = {
  pool: PoolSnapshot;
  timings: { slug: string; ms: number; count: number }[];
  totalMs: number;
};

/** Exactly the track selection and loading `searchCandidates` performs. */
export async function loadServicePool(tracks: string[], minEvidenceDays: number): Promise<LoadedPool> {
  const wanted = tracks.length > 0
    ? tracks.filter((s) => isKnownTrack(s))
    : enabledTracks().map((t) => t.slug);
  const started = performance.now();
  const timings: LoadedPool["timings"] = [];
  const loads = await Promise.all(
    wanted.map(async (slug) => {
      const t0 = performance.now();
      const load = await loadTrack(slug, { minEvidenceDays, limit: CHALLENGE_POOL_CAP });
      timings.push({ slug, ms: performance.now() - t0, count: load.members.length });
      return load;
    }),
  );
  const merged = mergeTrackLoads(loads);
  // The same step `searchCandidates` runs, so role ranking is measured as served.
  await attachRoleTitles(merged.members);
  const seen = new Set<string>();
  const duplicateUserIds: string[] = [];
  for (const m of merged.members) {
    if (!m.userId) continue;
    if (seen.has(m.userId)) duplicateUserIds.push(m.userId);
    seen.add(m.userId);
  }
  const infos: TrackLoadInfo[] = loads.map((l) => {
    const cap = capFor(l.slug);
    return {
      slug: l.slug,
      count: l.members.length,
      cap,
      truncated: cap != null && l.members.length >= cap,
      userIds: l.members.map((m) => m.userId),
    };
  });
  return {
    pool: {
      key: `${[...tracks].sort().join(",") || "*"}|${minEvidenceDays}`,
      members: merged.members,
      coverage: merged.coverage,
      loads: infos,
      duplicateUserIds,
    },
    timings,
    totalMs: performance.now() - started,
  };
}

export type ServiceCall = {
  ok: boolean;
  refs: string[];
  scores: number[];
  tiers: string[];
  tiebreak: string[];
  /** The browser payload (`toPublicMatch`) — only for the privacy scan. */
  publicJson: string;
  ms: number;
  message?: string;
};

export async function callSearchService(spec: JobSpec, limit = RECRUITER_PAGE_LIMIT): Promise<ServiceCall> {
  const t0 = performance.now();
  const res = await searchCandidates(spec, { limit });
  const ms = performance.now() - t0;
  if (!res.ok) return { ok: false, refs: [], scores: [], tiers: [], tiebreak: [], publicJson: "[]", ms, message: res.message };
  return {
    ok: true,
    refs: res.data.matches.map((m) => m.candidateRef),
    scores: res.data.matches.map((m) => m.score),
    tiers: res.data.matches.map((m) => m.tier),
    tiebreak: res.data.matches.map((m) => m.fullName || m.candidateRef),
    publicJson: JSON.stringify(res.data.matches.map((m) => toPublicMatch(m))),
    ms,
  };
}
