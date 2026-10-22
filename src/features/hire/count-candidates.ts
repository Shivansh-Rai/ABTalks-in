import "server-only";

/**
 * How many candidates a brief would reach, for the /hire review card.
 *
 * Loads the same pool `searchCandidates` loads, then counts the people who pass
 * the hard filters (`evaluateHardFilters`) AND hold every must-have skill. It
 * does not rank, persist matches or run any AI pass, so it is a read and never
 * changes what a later search returns.
 *
 * Experience and role are not counted against: in search they rank, they do
 * not exclude, and a count that disagreed with that would promise people the
 * search then shows.
 */
import { errorFields, logger } from "@/lib/logger";
import type { JobSpec } from "@/lib/validations/hire";
import { evaluateHardFilters } from "@/features/hire/score-candidate";
import { hasSearchCriteria, readPoolExtra } from "@/features/hire/pool-brief";
import { enabledTracks, isKnownTrack } from "@/features/hire/track-registry";
import { loadTrack, mergeTrackLoads } from "@/features/hire/track-loaders";
import { CHALLENGE_POOL_CAP } from "@/features/hire/search-candidates";

export type CountCandidatesResult =
  | {
      ok: true;
      data: {
        count: number;
        /** A track failed to load, so the real number may be higher. */
        partial: boolean;
      };
    }
  | { ok: false; message: string };

/** Editing filters back and forth re-asks for the same spec; keep it briefly. */
const CACHE_TTL_MS = 60 * 1000;
const CACHE_MAX = 100;
const cache = new Map<string, { at: number; data: { count: number; partial: boolean } }>();

export async function countMatchingCandidates(
  spec: JobSpec,
): Promise<CountCandidatesResult> {
  // Same refusal as search: an empty brief is not a search, so it has no count.
  if (!hasSearchCriteria(spec)) {
    return { ok: false, message: "Add a role or a skill to count matches." };
  }

  const key = JSON.stringify(spec);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at <= CACHE_TTL_MS) return { ok: true, data: hit.data };

  try {
    const extra = readPoolExtra(spec);
    const wanted =
      extra.sources.length > 0
        ? extra.sources.filter((s) => isKnownTrack(s))
        : enabledTracks().map((t) => t.slug);
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

    let count = 0;
    for (const member of merged.members) {
      const { ok, missingMust } = evaluateHardFilters(member, spec);
      if (ok && missingMust.length === 0) count += 1;
    }

    const data = { count, partial: merged.failedTracks.length > 0 };
    if (!data.partial) {
      if (cache.size >= CACHE_MAX) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      cache.set(key, { at: now, data });
    }
    return { ok: true, data };
  } catch (error) {
    logger.error("[hire] countMatchingCandidates failed", { ...errorFields(error) });
    return { ok: false, message: "Could not count matches." };
  }
}
